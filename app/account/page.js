import { redirect } from "next/navigation";

export default async function AccountPage({ searchParams }) {
  const params = await searchParams;
  if (params.mode === "signup") redirect("/seller/signup");
  if (params.mode === "login") redirect("/seller/login");
  if (params.setup) redirect("/seller/login");
  redirect("/seller/login");
}
