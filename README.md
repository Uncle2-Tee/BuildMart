# BuildMart Ghana

A Ghana-focused marketplace built with Next.js, Supabase and Paystack.

## Roles

- **Buyers** can browse the public marketplace and check out as a guest with contact and delivery details. Signed-in buyers can also place orders linked to their account. Public signup and login are temporarily disabled.
- **Prospective sellers** can submit a shop application from the seller dashboard without signing up or logging in. Administrators review and approve or reject applications from the admin dashboard. Existing authenticated sellers can manage products only after their seller profile is approved.
- **Administrators** have a protected platform dashboard to review, approve or suspend seller shops, manage payout setup, and hide or remove marketplace products. They can inspect marketplace accounts and orders. Admin privileges are assigned manually in Supabase; public sign-up cannot create administrator accounts.
- The site opens on the public shop at `/`. For now, `/signup`, `/login`, and `/forgot-password` redirect to the shop; `/account` redirects there for compatibility. The seller dashboard URL has a public information view; approved public applicants manage their shops through a private browser-bound token, while existing seller accounts continue to use sign-in.
- Existing buyers can access Shop (`/dashboard/buyer/shop`); the old `/dashboard/buyer` route redirects to Shop, and their cart is preserved while navigating. Administrators reach the marketplace landing page from Home. Sellers use the seller dashboard's View market link to see active products in the buyer-facing layout.

Existing Supabase Auth users retain their accounts and secure password hashes. Public account creation is currently disabled in the application. Public shop applications are stored separately and do not require applicants to create an account or sign in. Once approved, an applicant's browser-bound access token authorizes product management without a login; an internal seller identity links the shop's products and orders.

Prospective sellers can submit a shop application from the public seller dashboard with its name, description, location and phone number. Applications are saved to `public.seller_shop_applications` and can be approved or rejected by an administrator. The applicant's open browser checks for approval and automatically opens the product dashboard when approved. Existing authenticated sellers' shop details are saved to their Supabase Auth user metadata; approval status remains in `public.profiles.seller_status`. Approved sellers can add products, edit product names and prices, hide or remove listings, and see orders containing their own products. Each seller dashboard shows only that seller's order items and the buyer's submitted delivery details for fulfilling those items. Only active products belonging to approved seller profiles appear in buyer catalogues.

The public shop, guest checkout, and shop application form can be used without an account. Checkout collects a contact email and delivery details; authenticated buyer orders are linked to that buyer, while guest orders have no buyer account association. Seller management APIs verify either an approved seller account or the private application token, and scope product and order access to that seller. Checkout resolves each cart item to its seller from the product record, stores that seller on the order item, and splits a multi-seller payment using each seller's verified Paystack subaccount. Signup and login entry points are temporarily disabled by redirecting their pages to `/`. Payment verification callbacks and the signed Paystack webhook remain accessible for payment processing. Supabase Row Level Security limits profiles and signed-in buyers' orders to their owner, sellers to their own store and order items, and administrators to platform-wide access. Unapproved seller accounts cannot add products or appear in the marketplace. Checkout totals are calculated from current database prices, and payments are only marked paid after server-side Paystack verification. The Paystack webhook also verifies the signed request and transaction.

## Configure services

1. Create a Supabase project and copy `.env.example` to `.env.local`.
2. Run the SQL in `prisma/migrations/20261018235000_create_seller_shop_applications/migration.sql`, `prisma/migrations/20261019063200_add_order_delivery_details/migration.sql`, `prisma/migrations/20261019071100_add_order_shipping_fee/migration.sql`, and `prisma/migrations/20261019081000_allow_guest_orders/migration.sql` in the Supabase SQL Editor. These migrations are safe to rerun; the order migrations add delivery/shipping fields and allow the buyer account reference to be empty for guest orders without affecting existing orders. The remaining schema, storage bucket, and row-level security policies have already been applied directly to the database.
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`, and `NEXT_PUBLIC_SITE_URL`. The PostgreSQL URLs alone do not provide the Supabase Auth/Storage API credentials required by the application. Keep the service-role key and Paystack secret private; never prefix them with `NEXT_PUBLIC_` or commit them.
4. Keep the Supabase Auth project configured for existing accounts. Public signup, login, and password recovery routes are temporarily redirected to the shop in the application.
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
6. Configure a Paystack webhook pointing to `https://your-domain.example/api/payments/paystack/webhook` and subscribe to the `charge.success` event. Use a Paystack test secret during development and a live secret only after production verification.
7. Review seller requests in the administrator dashboard and approve each shop before it can list products. Create and verify each approved seller's Paystack subaccount in Paystack. An administrator must enter its `ACCT_...` subaccount code on the admin dashboard before that seller's products can be checked out. Do not collect bank details in BuildMart.
8. Install and run the app:

   ```bash
   npm install
   npm run dev
   ```

## Payment and fulfilment scope

Prices and payments are in Ghana cedis (GHS). Paystack receives amounts in pesewas. Checkout adds a flat GH₵6.00 shipping charge per order. Each seller receives 90% of their product subtotal through their verified Paystack subaccount; the 10% BuildMart commission and shipping charge remain with BuildMart, which bears Paystack processing fees. Seller order views only show their own line items and the buyer's delivery details. Signed-in buyer orders are linked to their account; guest orders are visible to the relevant sellers and administrators.

Before public launch, add deployment-level rate limiting and abuse monitoring to public checkout and seller-registration endpoints, review the payment/legal terms, and verify test-to-live Paystack behavior and subaccount splits with real test transactions.

## Checks

```bash
npm run lint
npm run build
```
