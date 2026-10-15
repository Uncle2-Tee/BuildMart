# BuildMart Ghana

A Ghana-focused marketplace built with Next.js, Supabase and Paystack.

## Roles

- **Buyers** must create an account and sign in before accessing the marketplace. They can search products, place orders and pay securely; their order history is private to their account.
- **Sellers** select the Seller role at sign-up, then register their shop from the seller dashboard. Their product-management tools remain locked until an administrator approves the shop; approved sellers can preview unpublished products in the buyer-facing card layout, publish when ready, hide or remove their products, and see orders containing their products.
- **Administrators** have a protected platform dashboard to review, approve or suspend seller shops, manage payout setup, and hide or remove marketplace products. They can inspect marketplace accounts and orders. Admin privileges are assigned manually in Supabase; public sign-up cannot create administrator accounts.
- The site opens on `/login` for signed-out visitors. Dedicated `/signup`, `/login`, and `/forgot-password` pages provide account creation with Buyer/Seller role selection, sign-in, and password recovery. Recovery links return to `/login?mode=reset`; `/account` redirects to the login page for compatibility.
- Buyers land directly on Shop (`/dashboard/buyer/shop`) after signing in and can view My orders (`/dashboard/buyer/orders`); the old `/dashboard/buyer` route redirects to Shop, and their cart is preserved while navigating between pages. Administrators reach the marketplace landing page from Home. Sellers use the seller dashboard's View market link to preview products before publishing.

When someone signs up, Supabase Auth saves their email and a secure password hash in the configured Supabase database's `auth.users` table. The password is never stored in plain text or copied to the application profile. A database trigger creates the corresponding `public.profiles` row with the user's display name and Buyer/Seller role; seller accounts start pending administrator approval. Email confirmation may be required before the user can sign in.

After signing in, a seller registers a shop from the seller dashboard with its name, description, location and phone number. Shop details are saved to that seller's Supabase Auth user metadata; approval status remains in `public.profiles.seller_status`. Administrators review the submitted details in the admin dashboard and can approve or suspend the shop. Approved sellers save products as unpublished, review buyer-style product cards in View market, and explicitly publish products when ready. Only active products belonging to approved sellers appear in buyer catalogues.

All application pages require an authenticated session except `/signup`, `/login`, and `/forgot-password`; payment verification callbacks and the signed Paystack webhook remain accessible for payment processing. Dashboard routes and APIs enforce roles server-side, while Supabase Row Level Security limits profiles and orders to their owner, sellers to their own store and order items, and administrators to platform-wide access. Only signed-in buyers can check out. Unapproved shops cannot publish products or appear in the marketplace. Checkout totals are calculated from current database prices, and payments are only marked paid after server-side Paystack verification. The Paystack webhook also verifies the signed request and transaction.

## Configure services

1. Create a Supabase project and copy `.env.example` to `.env.local`.
2. The schema, storage bucket, and row-level security policies have been applied directly to the PostgreSQL database using the configured `DIRECT_URL` (or `DATABASE_URL`) connection. No migration-file step is required for this database.
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`, and `NEXT_PUBLIC_SITE_URL`. The PostgreSQL URLs alone do not provide the Supabase Auth/Storage API credentials required by the application. Keep the service-role key and Paystack secret private; never prefix them with `NEXT_PUBLIC_` or commit them.
4. In Supabase Auth, configure the application URL and allowed redirect URLs for `/login` and `/login?mode=reset`. Enable email confirmation for account sign-up and password recovery.
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

Prices and payments are in Ghana cedis (GHS). Paystack receives amounts in pesewas. Each checkout uses a flat Paystack split: 90% of each seller's product subtotal is sent to that seller's verified subaccount, and the remaining 10% is retained by BuildMart. BuildMart bears Paystack processing fees. Delivery fees, tax, shipping labels and fulfilment are not included. Seller order views only show their own line items, with the buyer email needed for fulfilment. Orders placed by signed-in buyers are linked to their account and visible only to that buyer, the relevant sellers and administrators.

Before public launch, add deployment-level rate limiting and abuse monitoring to public checkout and seller-registration endpoints, review the payment/legal terms, and verify test-to-live Paystack behavior and subaccount splits with real test transactions.

## Checks

```bash
npm run lint
npm run build
```
