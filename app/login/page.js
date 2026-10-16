import { redirect } from "next/navigation";

export const metadata = {
  title: "Log in | BuildMart Ghana",
};

export default async function LoginPage() {
  redirect("/");
}
