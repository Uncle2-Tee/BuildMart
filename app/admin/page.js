import Link from "next/link";
import { redirect } from "next/navigation";
import AdminPayoutForm from "../admin-payout-form";
import AdminProductControls from "../admin-product-controls";
import AdminShopApplicationApproval from "../admin-shop-application-approval";
import AdminSellerApproval from "../admin-seller-approval";
import DashboardHeader from "../dashboard-header";
import { getAdminSession } from "../../lib/admin-session";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "../../lib/supabase/admin";
import { isSupabaseConfigured } from "../../lib/supabase/server";

export const metadata = {
  title: "Admin dashboard | BuildMart Ghana",
};

export default async function AdminPage() {
  if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) {
    return <main className="dashboard-shell"><div className="dashboard-empty"><h1>Admin setup needed</h1><p>Connect Supabase and configure a trusted administrator account to continue.</p><Link href="/">Return to marketplace</Link></div></main>;
  }

  const adminSession = await getAdminSession();
  if (!adminSession) redirect("/admin/login");

  const admin = createSupabaseAdminClient();
  const [
    { data: profiles, error: profilesError },
    { data: products, error: productsError },
    { data: orders, error: ordersError },
    { data: applications, error: applicationsError },
  ] = await Promise.all([
    admin.from("profiles").select("id, display_name, role, seller_status, created_at, paystack_subaccount_code").order("created_at", { ascending: false }).limit(100),
    admin.from("products").select("id, title, category, price_kobo, active, created_at").order("created_at", { ascending: false }).limit(100),
    admin.from("orders").select("id, buyer_email, status, total_kobo, currency, created_at").order("created_at", { ascending: false }).limit(100),
    admin.from("seller_shop_applications").select("id, shop_name, shop_description, shop_location, shop_phone, status, created_at").order("created_at", { ascending: false }).limit(100),
  ]);

  if (profilesError) throw new Error(`Unable to load marketplace users: ${profilesError.message}`);
  if (productsError) throw new Error(`Unable to load marketplace products: ${productsError.message}`);
  if (ordersError) throw new Error(`Unable to load marketplace orders: ${ordersError.message}`);
  const applicationTableMissing = applicationsError?.code === "PGRST205" ||
    applicationsError?.message.includes("seller_shop_applications");
  if (applicationsError && !applicationTableMissing) {
    throw new Error(`Unable to load seller shop applications: ${applicationsError.message}`);
  }
  if (applicationTableMissing) {
    console.error("Seller shop applications table is not available in Supabase", applicationsError);
  }
  const shopApplications = applications ?? [];

  const sellers = (profiles ?? []).filter((item) => item.role === "seller");
  const paidOrders = (orders ?? []).filter((order) => order.status === "paid");
  const sellerIds = new Set(sellers.map((seller) => seller.id));
  const authUsersById = new Map();
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
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
      <DashboardHeader admin />
      <section className="dashboard-welcome">
        <div><span className="eyebrow muted-eyebrow">PLATFORM OVERVIEW</span><h1>Good morning, <em>{adminSession.username}.</em></h1><p>Marketplace activity, accounts and catalogue at a glance.</p></div>
        <span className="dashboard-date">Admin control centre</span>
      </section>
      <section className="stat-grid admin-stat-grid" aria-label="Marketplace summary">
        <div className="stat-card"><span>Seller accounts</span><strong>{sellers.length}</strong><small>Registered local businesses</small></div>
        <div className="stat-card"><span>Shops pending review</span><strong>{sellerShops.filter((seller) => seller.shopName && seller.seller_status === "pending").length + shopApplications.filter((application) => application.status === "pending").length}</strong><small>Awaiting your approval</small></div>
        <div className="stat-card"><span>Products</span><strong>{products?.length ?? 0}</strong><small>Most recently listed</small></div>
        <div className="stat-card"><span>Paid orders</span><strong>{paidOrders.length}</strong><small>From the latest 100 orders</small></div>
      </section>
      {applicationTableMissing ? (
        <section className="dashboard-panel shop-application-setup" role="alert">
          <h2>Shop applications need database setup</h2>
          <p>Run the SQL in <code>prisma/migrations/20261018235000_create_seller_shop_applications/migration.sql</code> once in the Supabase SQL Editor, then refresh this page. Public applications will appear here after the table is created.</p>
        </section>
      ) : null}
      <div className="admin-grid">
        <section className="dashboard-panel">
          <div className="panel-heading"><div><span className="eyebrow muted-eyebrow">NEW SELLER REQUESTS</span><h2>Shop applications <span>{applications?.length ?? 0}</span></h2></div></div>
          <div className="admin-list">
            {shopApplications.length ? shopApplications.map((application) => (
              <div className="admin-list-row seller-application-row" key={application.id}>
                <span className="user-avatar">{application.shop_name.slice(0, 1).toUpperCase()}</span>
                <span className="seller-application-details">
                  <strong>{application.shop_name}</strong>
                  <small>{application.shop_location} · {application.shop_phone} · Submitted {new Date(application.created_at).toLocaleDateString("en-GH")}</small>
                  <small className="seller-shop-description">{application.shop_description}</small>
                </span>
                <AdminShopApplicationApproval applicationId={application.id} initialStatus={application.status} />
              </div>
            )) : <p className="table-empty">Submitted shop applications will appear here.</p>}
          </div>
        </section>
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
    </main>
  );
}
