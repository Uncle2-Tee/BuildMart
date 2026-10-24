import { redirect } from "next/navigation";

export default async function AccountPage({ searchParams }) {
  redirect("/seller/login");
}
