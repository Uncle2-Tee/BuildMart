
import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";

function dashboardPath(role) {
  if (role === "admin") return "/admin";
  if (role === "seller") return "/dashboard/seller";
  return "/dashboard/buyer/shop";
}

export async function requireRole(allowedRoles) {
  const supabase = await createSupabaseServerClient({
    readOnly: true,
  });

  if (!supabase) {
    redirect("/account?setup=1");
  }

  const { data, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError) {
    if (
      claimsError.status === 400 ||
      claimsError.status === 401
    ) {
      redirect("/login");
    }

    throw new Error(
      `Unable to verify account: ${claimsError.message}`
    );
  }

  // Prevent errors when Supabase returns null data.
  const claims = data?.claims;

  if (!claims?.sub) {
    redirect("/login");
  }

  const user = {
    id: claims.sub,
    email: claims.email,
    user_metadata: claims.user_metadata ?? {},
  };

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role, display_name, seller_status")
      .eq("id", user.id)
      .single();

  if (profileError) {
    throw new Error(
      `Unable to load account permissions: ${profileError.message}`
    );
  }

  if (!profile) {
    throw new Error("Unable to load account permissions: Profile not found.");
  }

  if (!allowedRoles.includes(profile.role)) {
    redirect(dashboardPath(profile.role));
  }

  return { supabase, user, profile };
}

export async function getApiRole(
  allowedRoles,
  { requireApprovedSeller = false } = {}
) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      response: Response.json(
        { error: "Authentication is not configured." },
        { status: 503 }
      ),
    };
  }

  const {
    data: { user } = {},
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return {
      response: Response.json(
        { error: "Unable to verify your account." },
        { status: 401 }
      ),
    };
  }

  if (!user) {
    return {
      response: Response.json(
        { error: "Sign in to continue." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role, seller_status")
      .eq("id", user.id)
      .single();

  if (profileError) {
    console.error(
      "Failed to load account permissions",
      profileError
    );

    return {
      response: Response.json(
        { error: "Unable to verify account permissions." },
        { status: 500 }
      ),
    };
  }

  if (!profile) {
    return {
      response: Response.json(
        { error: "Account profile not found." },
        { status: 403 }
      ),
    };
  }

  if (!allowedRoles.includes(profile.role)) {
    return {
      response: Response.json(
        { error: "You do not have permission to do that." },
        { status: 403 }
      ),
    };
  }

  if (
    requireApprovedSeller &&
    profile.seller_status !== "approved"
  ) {
    return {
      response: Response.json(
        {
          error:
            "Your shop must be approved before you can manage products.",
        },
        { status: 403 }
      ),
    };
  }

  return { supabase, user, profile };
}
