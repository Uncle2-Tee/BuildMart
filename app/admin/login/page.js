import Link from "next/link";
import Image from "next/image";
import AdminLoginForm from "../admin-login-form";

export const metadata = {
  title: "Admin sign in | BuildMart Ghana",
};

export default function AdminLoginPage() {
  return (
    <main className="dashboard-shell admin-login-page">
      <section className="dashboard-empty admin-login-card">
        <div className="admin-login-branding">
          <Link className="admin-login-logo" href="/" aria-label="BuildMart Ghana home"><Image className="admin-login-logo-image" src="/buildmart-logo.png" alt="BuildMart Ghana" width={928} height={192} priority /></Link>
          <span className="eyebrow muted-eyebrow">ADMINISTRATOR</span>
        </div>
        <h1>Sign in to BuildMart admin</h1>
        <p>Use the administrator credentials configured for this application.</p>
        <AdminLoginForm />
        <Link href="/">Return to marketplace</Link>
      </section>
    </main>
  );
}
