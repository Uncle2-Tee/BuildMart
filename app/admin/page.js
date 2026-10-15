import Link from "next/link";
import AdminPayoutForm from "../admin-payout-form";
import AdminProductControls from "../admin-product-controls";
import AdminSellerApproval from "../admin-seller-approval";
import SignOutButton from "../sign-out-button";
import { requireRole } from "../../lib/auth";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { isSupabaseConfigured } from "../../lib/supabase/server";

export const metadata = {
  title: "Admin dashboard | BuildMart Ghana",
};

export default async function AdminPage() {
  if (!isSupabaseConfigured()) {
    return <main className="dashboard-shell"><div className="dashboard-empty"><h1>Admin setup needed</h1><p>Connect Supabase and configure a trusted administrator account to continue.</p><Link href="/">Return to marketplace</Link></div></main>;
  }

  const { supabase, profile } = await requireRole(["admin"]);
  const [
    { data: profiles, error: profilesError },
    { data: products, error: productsError },
    { data: orders, error: ordersError },
  ] = await Promise.all([
    supabase.from("profiles").select("id, display_name, role, seller_status, created_at, paystack_subaccount_code").order("created_at", { ascending: false }).limit(100),
    supabase.from("products").select("id, title, category, price_kobo, active, created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("orders").select("id, buyer_email, status, total_kobo, currency, created_at").order("created_at", { ascending: false }).limit(100),
  ]);

  if (profilesError) throw new Error(`Unable to load marketplace users: ${profilesError.message}`);
  if (productsError) throw new Error(`Unable to load marketplace products: ${productsError.message}`);
  if (ordersError) throw new Error(`Unable to load marketplace orders: ${ordersError.message}`);

  const sellers = (profiles ?? []).filter((item) => item.role === "seller");
  const paidOrders = (orders ?? []).filter((order) => order.status === "paid");
  const adminClient = createSupabaseAdminClient();
  const sellerIds = new Set(sellers.map((seller) => seller.id));
  const authUsersById = new Map();
  for (let page = 1; ; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Unable to load shop registration details: ${error.message}`);
    for (const authUser of data.users) {
      if (sellerIds.has(authUser.id)) authUsersById.set(authUser.id, authUser);
    }
    if (authUsersById.size === sellerIds.size || data.users.length < 1000) break;
  }
  const sellerShops = sellers.map((seller) => {
    const authUser = authUsersById.get(seller.id);
    const metadata = authUser?.user_metadata ?? {};
    return {
      ...seller,
      shopName: typeof metadata.shop_name === "string" ? metadata.shop_name : "",
      shopDescription: typeof metadata.shop_description === "string" ? metadata.shop_description : "",
      shopLocation: typeof metadata.shop_location === "string" ? metadata.shop_location : "",
      shopPhone: typeof metadata.shop_phone === "string" ? metadata.shop_phone : "",
    };
  });

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <Link className="brand" href="/"><span className="mark brand-mark">B</span><span>buildmart<span className="brand-country">GH</span></span></Link>
        <div className="dashboard-user"><span className="admin-label">ADMINISTRATOR</span><Link href="/">View marketplace ↗</Link><SignOutButton /></div>
      </header>
      <section className="dashboard-welcome">
        <div><span className="eyebrow muted-eyebrow">PLATFORM OVERVIEW</span><h1>Good morning, <em>{profile.display_name || "admin"}.</em></h1><p>Marketplace activity, accounts and catalogue at a glance.</p></div>
        <span className="dashboard-date">Admin control centre</span>
      </section>
      <section className="stat-grid admin-stat-grid" aria-label="Marketplace summary">
        <div className="stat-card"><span>Seller accounts</span><strong>{sellers.length}</strong><small>Registered local businesses</small></div>
        <div className="stat-card"><span>Shops pending review</span><strong>{sellerShops.filter((seller) => seller.shopName && seller.seller_status === "pending").length}</strong><small>Awaiting your approval</small></div>
        <div className="stat-card"><span>Products</span><strong>{products?.length ?? 0}</strong><small>Most recently listed</small></div>
        <div className="stat-card"><span>Paid orders</span><strong>{paidOrders.length}</strong><small>From the latest 100 orders</small></div>
      </section>
      <div className="admin-grid">
        <section className="dashboard-panel">
          <div className="panel-heading"><div><span className="eyebrow muted-eyebrow">ACCOUNT ACCESS</span><h2>Seller accounts <span>{sellers.length}</span></h2></div></div>
          <div className="admin-list">
            {sellerShops.map((seller) => <div className="admin-list-row" key={seller.id}><span className="user-avatar">{(seller.shopName || seller.display_name || "S").slice(0, 1).toUpperCase()}</span><span><strong>{seller.shopName || "Shop not registered"}</strong><small>{seller.shopName ? `${seller.display_name || "Seller"} · ${seller.shopLocation}${seller.shopPhone ? ` · ${seller.shopPhone}` : ""}` : `Seller account · ${new Date(seller.created_at).toLocaleDateString("en-GH")}`}</small>{seller.shopDescription ? <small className="seller-shop-description">{seller.shopDescription}</small> : null}</span><AdminSellerApproval sellerId={seller.id} initialStatus={seller.seller_status} hasShop={Boolean(seller.shopName)} /><AdminPayoutForm sellerId={seller.id} initialCode={seller.paystack_subaccount_code} /></div>)}
            {!sellers.length ? <p className="table-empty">New seller accounts will appear here.</p> : null}
          </div>
        </section>
        <section className="dashboard-panel">
          <div className="panel-heading"><div><span className="eyebrow muted-eyebrow">LATEST ACTIVITY</span><h2>Orders <span>{orders?.length ?? 0}</span></h2></div></div>
          {orders?.length ? <div className="orders-table-wrap"><table className="orders-table"><thead><tr><th>Order</th><th>Buyer</th><th>Total</th><th>Status</th></tr></thead><tbody>{orders.slice(0, 12).map((order) => <tr key={order.id}><td>#{order.id.slice(0, 8).toUpperCase()}</td><td>{order.buyer_email}</td><td>{new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(order.total_kobo / 100)}</td><td><span className={`status-pill ${order.status === "paid" ? "live" : "paused"}`}>{order.status}</span></td></tr>)}</tbody></table></div> : <p className="table-empty">Customer orders will appear here.</p>}
        </section>
        <section className="dashboard-panel admin-products-panel">
          <div className="panel-heading"><div><span className="eyebrow muted-eyebrow">MARKETPLACE CATALOGUE</span><h2>Recent products <span>{products?.length ?? 0}</span></h2></div></div>
          <div className="admin-product-list">{products?.slice(0, 12).map((product) => <div className="admin-product-row" key={product.id}><span><strong>{product.title}</strong><small>{product.category} · {new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(product.price_kobo / 100)}</small></span><span className={`status-pill ${product.active ? "live" : "paused"}`}>{product.active ? "Live" : "Hidden"}</span><AdminProductControls productId={product.id} initialActive={product.active} /></div>)}</div>
        </section>
      </div>
      <p className="admin-security-note">Administrator access is assigned manually in Supabase. Public registration cannot create administrator accounts. Approve shops before sellers can publish products; suspend an approved shop to remove its products from the marketplace. Enter each verified Paystack subaccount code below; checkout pays sellers 90% of their line-item sales and retains a 10% BuildMart commission.</p>
    </main>
  );
}
