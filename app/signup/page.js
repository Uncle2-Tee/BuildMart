import AccountLayout from "../account-layout";

export const metadata = {
  title: "Sign up | BuildMart Ghana",
};

export default async function SignupPage({ searchParams }) {
  const params = await searchParams;
  return <AccountLayout mode="signup" initialRole={params.role === "seller" ? "seller" : ""} />;
}
