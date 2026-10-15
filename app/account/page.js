import { redirect } from "next/navigation";

export default async function AccountPage({ searchParams }) {
  const params = await searchParams;
  if (params.mode === "signup") {
    redirect(params.role === "seller" ? "/signup?role=seller" : "/signup");
  }
  if (params.setup) redirect("/login?setup=1");
  if (params.check) redirect("/login?check=1");
  redirect("/login");
}
