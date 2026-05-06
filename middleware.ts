import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  const isDashboard =
    path.startsWith("/portfolio") ||
    path.startsWith("/satoshi-test") ||
    path.startsWith("/staking") ||
    path.startsWith("/send") ||
    path.startsWith("/receive") ||
    path.startsWith("/transactions") ||
    path.startsWith("/settings") ||
    path.startsWith("/ai") ||
    path.startsWith("/swap") ||
    path.startsWith("/buy");

  const isOnboarding = path.startsWith("/onboarding");
  const isAdmin = path.startsWith("/admin");

  // Not logged in → go to login
  if (!user && (isDashboard || isOnboarding || isAdmin)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Admin routes: only for admin email
  if (user && isAdmin) {
    const adminEmail = process.env.ADMIN_EMAIL ?? "daniel.luterbach06@gmail.com";
    if (user.email !== adminEmail) {
      const url = request.nextUrl.clone();
      url.pathname = "/portfolio";
      return NextResponse.redirect(url);
    }
  }

  // Logged in but onboarding not complete → redirect to /onboarding
  // (except if already on /onboarding or /satoshi-test which is part of the flow)
  if (user && isDashboard && !isOnboarding) {
    const onboardingComplete = user.user_metadata?.onboarding_complete === true;
    if (!onboardingComplete) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/portfolio/:path*",
    "/satoshi-test/:path*",
    "/staking/:path*",
    "/send/:path*",
    "/receive/:path*",
    "/transactions/:path*",
    "/settings/:path*",
    "/ai/:path*",
    "/onboarding/:path*",
    "/admin/:path*",
    "/swap/:path*",
    "/buy/:path*",
  ],
};
