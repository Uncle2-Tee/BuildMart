import AccountLayout from "../account-layout";

export const metadata = {
  title: "Log in | BuildMart Ghana",
};

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const mode = params.mode === "reset" ? "reset" : "login";
  const recoveryError = mode === "reset" && Boolean(params.error_code || params.error);
  return <AccountLayout mode={mode} setup={params.setup} check={params.check} recoveryError={recoveryError} />;
}
