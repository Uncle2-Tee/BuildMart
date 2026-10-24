import SellerAuthForm from "../../seller-auth-form";

export const metadata = {
  title: "Seller sign in | BuildMart Ghana",
};

export default function SellerLoginPage() {
  return <main className="account-page seller-auth-page"><SellerAuthForm mode="login" /></main>;
}
