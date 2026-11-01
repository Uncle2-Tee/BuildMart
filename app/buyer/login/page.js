import BuyerAuthForm from "../../buyer-auth-form";

export const metadata = {
  title: "Buyer login | BuildMart Ghana",
};

export default function BuyerLoginPage() {
  return <main className="account-page"><BuyerAuthForm mode="login" /></main>;
}
