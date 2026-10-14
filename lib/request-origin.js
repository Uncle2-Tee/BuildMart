export function isSameOriginRequest(request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const origin = request.headers.get("origin");
  if (!siteUrl || !origin) return false;

  try {
    return new URL(origin).origin === new URL(siteUrl).origin;
  } catch {
    return false;
  }
}
