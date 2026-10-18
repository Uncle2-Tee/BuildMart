import AccountLayout from "../account-layout";

export const metadata = {
  title: "Log in | BuildMart Ghana",
};

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const redirectTo = params.next === "/dashboard/buyer/orders"
    ? params.next
    : "";

  return (
    <AccountLayout
      mode="login"
      check={params.check}
      redirectTo={redirectTo}
    />
  );
}
