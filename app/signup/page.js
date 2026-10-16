import { redirect } from "next/navigation";

export const metadata = {
  title: "Sign up | BuildMart Ghana",
};

export default async function SignupPage() {
  redirect("/");
}
