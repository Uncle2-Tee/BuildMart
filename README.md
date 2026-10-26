# BuildMart Ghana

A Ghana-focused marketplace built with Next.js, Supabase and Paystack.

## Roles

- **Buyers** can browse the public marketplace and check out as a guest with contact and delivery details. Signed-in buyers can also place orders linked to their account. Buyer signup and login are not available in the current application.
- **Sellers** must create an account and sign in to access the seller dashboard. A signed-in seller submits shop details there; administrators review and approve or reject the shop before the seller can list products.
- **Administrators** have a protected platform dashboard to review, approve or suspend seller shops, manage payout setup, and hide or remove marketplace products. They can inspect marketplace accounts and orders. Admin privileges are assigned manually in Supabase; public sign-up cannot create administrator accounts.
- The site opens on the public shop at `/`. Seller login is the default entry at `/seller/login` and accepts the seller profile name and password; new sellers can create an account from that page. `/seller/signup` remains available, while `/signup`, `/login`, and `/account` redirect to seller login for compatibility. The seller dashboard and market preview require an authenticated seller account.
- Existing buyers can access Shop (`/dashboard/buyer/shop`); the old `/dashboard/buyer` route redirects to Shop, and their cart is preserved while navigating. Administrators reach the marketplace landing page from Home. Sellers use the seller dashboard's View market link to open the public Shop page (`/shop`).

Seller signup uses Supabase Auth email/password accounts. If email confirmation is enabled in Supabase, sellers must confirm their address before signing in. After signup and login, sellers submit their shop details from the protected seller dashboard; the resulting seller profile is reviewed by an administrator. Approval enables product and order management. Public, browser-token-based seller dashboard access is no longer supported.

Seller shop details are saved to Supabase Auth user metadata; approval status remains in `public.profiles.seller_status`. Approved sellers can add products, edit product names and prices, hide or remove listings, and see orders containing their own products. Each seller dashboard shows only that seller's order items and the buyer's submitted delivery details for fulfilling those items. Only active products belonging to approved seller profiles appear in buyer catalogues.

The public shop and guest checkout can be used without an account. Checkout collects a contact email and delivery details; authenticated buyer orders are linked to that buyer, while guest orders have no buyer account association. Seller management APIs require an authenticated seller account and scope product and order access to that seller. Checkout resolves each cart item to its seller from the product record and stores that seller on the order item. Customer payments are collected into BuildMart's Paystack balance; seller payouts are managed separately by administrators. Payment verification callbacks and the signed Paystack webhook remain accessible for payment processing. Supabase Row Level Security limits profiles and signed-in buyers' orders to their owner, sellers to their own store and order items, and administrators to platform-wide access. Unapproved seller accounts cannot add products or appear in the marketplace. Checkout totals are calculated from current database prices, and payments are only marked paid after server-side Paystack verification. The Paystack webhook also verifies the signed request and transaction.

Arkesel sends buyers an SMS after checkout is initialized and after payment is confirmed or verified as failed. When checkout is initialized, each distinct seller whose products are in that order receives one SMS saying the payment is pending. Seller contacts are looked up only for those order sellers (with at most five lookups at once), and valid seller numbers are sent in one Arkesel request rather than one request per seller. Sellers also receive an SMS when an administrator approves or rejects their shop and when payment is confirmed or verified as failed. The shop-decision messages begin “Shop approved” or “Shop rejected”; admins receive “Pending shop approval” when seller shop details are submitted. Administrators also receive an SMS when a shop is approved or rejected and when an order payment is confirmed or verified as failed. A canceled checkout is checked with Paystack before a failure notification is sent; a still-pending payment is not reported as failed. Set `ADMIN_NOTIFICATION_PHONE` to the administrator's phone number to enable admin alerts. SMS notifications are best-effort: provider errors are logged without interrupting checkout, payment confirmation, or shop approval. Local Ghana numbers are normalized to the `233` country code before they are sent to Arkesel. Admin email notifications are not configured; the current integration uses Arkesel SMS only.

## Configure services

1. Create a Supabase project and copy `.env.example` to `.env.local`.
2. Run the SQL in `prisma/migrations/20261018235000_create_seller_shop_applications/migration.sql`, `prisma/migrations/20261019063200_add_order_delivery_details/migration.sql`, `prisma/migrations/20261019071100_add_order_shipping_fee/migration.sql`, `prisma/migrations/20261019081000_allow_guest_orders/migration.sql`, and `prisma/migrations/20261026003000_platform_managed_seller_payouts/migration.sql` in the Supabase SQL Editor. The platform payout migration removes the seller subaccount field and creates the payout/transfer ledger tables and recipient-code field required by the new admin payout dashboard. Apply it before deploying code that uses that dashboard. The remaining schema, storage bucket, and row-level security policies have already been applied directly to the database.
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`, and `ARKESEL_API_KEY`. The PostgreSQL URLs alone do not provide the Supabase Auth/Storage API credentials required by the application. Keep service-role, Paystack secret, and SMS API keys private; never prefix them with `NEXT_PUBLIC_` or commit them. BuildMart initializes Paystack transactions server-side with the secret key and opens the returned access code using Paystack Inline, so a Paystack public key is not required. Set `ARKESEL_SENDER_ID` to a sender ID approved in Arkesel; it defaults to `BuildMart` if unset.
4. Configure Supabase Auth email/password sign-in for sellers. If email confirmation is enabled, configure Supabase's confirmation email template and delivery provider so new sellers can confirm their accounts.
5. Create an administrator user through Supabase Auth, then assign its role in the SQL editor:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = (
     select id
     from auth.users
     where email = 'admin@example.com'
   );
   ```

   Use the exact email of the account you created. Do not expose a public admin-registration flow.
6. Configure a Paystack webhook pointing to `https://your-domain.example/api/payments/paystack/webhook` and subscribe to `charge.success`, `transfer.success`, `transfer.failed`, `transfer.reversed`, and `transfer.otp` events. Use a Paystack test secret during development and a live secret only after production verification.
7. Review seller requests in the administrator dashboard and approve each shop before it can list products. For each seller who should receive payouts, create and verify a Paystack transfer recipient in Paystack, then save its `RCP_...` recipient code from the seller's admin dashboard form. Do not collect or store bank or mobile-money account details in BuildMart. Configure the BuildMart merchant's settlement destination in Paystack; the app does not route collection to an arbitrary phone number. Enable Paystack Transfers and ensure BuildMart's Paystack balance is funded before initiating transfers. Paystack may require an OTP to authorize a transfer; an administrator enters that OTP in the payout card.
8. Install and run the app:

   ```bash
   npm install
   npm run dev
   ```

## Payment and fulfilment scope

Prices and payments are in Ghana cedis (GHS). Paystack receives amounts in pesewas. The Paystack payment form opens inline on the BuildMart checkout page; payment is verified server-side before the order is marked paid. Checkout adds a flat GH₵6.00 shipping charge per order. For each paid order, BuildMart records a payout obligation equal to 90% of each seller's product subtotal; the remaining 10% is BuildMart's commission, shipping is retained by BuildMart, and BuildMart bears Paystack processing fees. An administrator initiates and monitors one Paystack Transfer per seller/order obligation from the admin payout dashboard. Transfers use a unique reference and uncertain provider results are held for verification instead of being blindly retried. Seller order views only show their own line items and the buyer's delivery details. Signed-in buyer orders are linked to their account; guest orders are visible to the relevant sellers and administrators.

Before public launch, add deployment-level rate limiting and abuse monitoring to public checkout and seller-registration endpoints, review the payment/legal terms, and verify test-to-live Paystack collection and transfer behavior with real test transactions. Do not test by initiating transfers against live recipients or live balances.

## Checks

```bash
npm run lint
npm run build
```
