import { getShopApplicationSession } from "../../../../lib/shop-application-session";

export async function GET() {
  const session = await getShopApplicationSession();
  if (!session) {
    return Response.json(
      { error: "This browser no longer has access to the shop application." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json({
    shop: {
      name: session.application.shop_name,
      description: session.application.shop_description,
      location: session.application.shop_location,
      phone: session.application.shop_phone,
    },
    status: session.application.status,
  }, { headers: { "Cache-Control": "no-store" } });
}
