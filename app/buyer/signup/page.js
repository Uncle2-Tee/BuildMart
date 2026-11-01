import BuyerAuthForm from "../../buyer-auth-form";

export const metadata = {
  title: "Create buyer account | BuildMart Ghana",
};

export default function BuyerSignupPage() {
  return <main className="account-page"><BuyerAuthForm mode="signup" /></main>;
}
