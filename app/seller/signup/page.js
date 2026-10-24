import SellerAuthForm from "../../seller-auth-form";

export const metadata = {
  title: "Seller signup | BuildMart Ghana",
};

export default function SellerSignupPage() {
  return <main className="account-page seller-auth-page"><SellerAuthForm mode="signup" /></main>;
}
