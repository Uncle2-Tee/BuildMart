import { redirect } from "next/navigation";

export default async function AccountPage({ searchParams }) {
  const params = await searchParams;
  if (params.mode === "signup") {
    redirect("/");
  }
  if (params.setup) redirect("/");
  if (params.check) redirect("/");
  redirect("/");
}
