import Link from "next/link";
import AdminLoginForm from "../admin-login-form";

export const metadata = {
  title: "Admin sign in | BuildMart Ghana",
};

export default function AdminLoginPage() {
  return (
    <main className="dashboard-shell">
      <section className="dashboard-empty">
        <span className="eyebrow muted-eyebrow">ADMINISTRATOR</span>
        <h1>Sign in to BuildMart admin</h1>
        <p>Use the administrator credentials configured for this application.</p>
        <AdminLoginForm />
        <Link href="/">Return to marketplace</Link>
      </section>
    </main>
  );
}
