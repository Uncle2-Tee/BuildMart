# BuildMart Ghana

A Ghana-focused marketplace built with Next.js, Supabase and Paystack.

## Roles

- **Buyers** can browse and search the public catalogue, add products to a local cart and check out as guests. No buyer account is required.
- **Sellers** sign in to a protected dashboard to publish products, manage product visibility and see orders containing their products.
- **Administrators** have a protected platform dashboard for seller accounts, products and orders. Admin privileges are assigned manually in Supabase; public sign-up always creates a seller account.

Product, profile and order access is enforced by Supabase Row Level Security as well as server-side role checks. Checkout totals are calculated from current database prices, and payments are only marked paid after server-side Paystack verification. The Paystack webhook also verifies the signed request and transaction.

## Configure services

1. Create a Supabase project and copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`, and `NEXT_PUBLIC_SITE_URL`. Keep the service-role key and Paystack secret private; never prefix them with `NEXT_PUBLIC_` or commit them.
3. Run `supabase/migrations/20261014000000_buildmart.sql` in the Supabase SQL editor (or apply it with the Supabase CLI). It creates the profiles, catalogue, orders, storage bucket, RLS policies and new-seller profile trigger.
4. In Supabase Auth, configure the application URL and allowed redirect URL for `/account`. Enable email confirmation for seller sign-up.
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
7. Create and verify each seller's Paystack subaccount in Paystack. An administrator must enter its `ACCT_...` subaccount code on the admin dashboard before that seller's products can be checked out. Do not collect bank details in BuildMart.
8. Install and run the app:

   ```bash
   npm install
   npm run dev
   ```

## Payment and fulfilment scope

Prices and payments are in Ghana cedis (GHS). Paystack receives amounts in pesewas. Each checkout uses a flat Paystack split: 90% of each seller's product subtotal is sent to that seller's verified subaccount, and the remaining 10% is retained by BuildMart. BuildMart bears Paystack processing fees. Delivery fees, tax, shipping labels and fulfilment are not included. Seller order views only show their own line items, with the buyer email needed for fulfilment.

Before public launch, add deployment-level rate limiting and abuse monitoring to public checkout and seller-registration endpoints, review the payment/legal terms, and verify test-to-live Paystack behavior and subaccount splits with real test transactions.

## Checks

```bash
npm run lint
npm run build
```
