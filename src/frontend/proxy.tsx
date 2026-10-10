import { withAuth } from "next-auth/middleware";

// withAuth's bare default export ignores authOptions.pages.signIn and
// redirects to next-auth's own /api/auth/signin page - passing pages/secret
// explicitly is what makes it redirect to our own /login instead. Mirrors
// lib/auth.ts's values rather than importing authOptions: that module pulls
// in the Postgres pool (session tracking, lib/sessions.ts), which has no
// business in the proxy bundle. This only checks the JWT's own validity -
// revoked or idle-expired sessions are turned away by getCurrentUserId
// (lib/data.real.ts) once the request reaches a page or action.
export default withAuth({
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
});

export const config = {
  // Proxy runs before the public/ filesystem route is served, so any static
  // asset path (logos, icons, etc.) needs excluding here too, not just the
  // _next/image endpoint that requests it through - otherwise an
  // unauthenticated <Image> request gets redirected to /login instead of
  // the actual file, and Next rejects the redirect as "not a valid image".
  // Excluding all of `_next` (not just _next/static|_next/image) also keeps
  // proxy off dev mode's /_next/webpack-hmr websocket - running auth logic
  // on that upgrade request breaks the handshake and the browser just keeps
  // reconnecting forever (only visible in dev; production has no HMR socket).
  // `health` is excluded too - uptime monitors, container health checks, and
  // reverse proxies probing it can't complete an OAuth redirect. Same for
  // `manifest.webmanifest` (app/manifest.ts): browsers fetch the PWA
  // manifest without cookies, so behind auth it would never load.
  matcher: [
    "/((?!api/auth|health|login|robots.txt|manifest.webmanifest|_next|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)",
  ],
};
