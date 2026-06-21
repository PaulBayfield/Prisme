import { withAuth } from "next-auth/middleware";

import { authOptions } from "@/lib/auth";

// withAuth's bare default export ignores authOptions.pages.signIn and
// redirects to next-auth's own /api/auth/signin page - passing pages/secret
// explicitly is what makes it redirect to our own /login instead. Can't pass
// authOptions directly: NextAuthMiddlewareOptions only accepts the
// `authorized` callback, which is structurally incompatible with
// AuthOptions["callbacks"] (jwt/session/etc).
export default withAuth({
  pages: authOptions.pages,
  secret: authOptions.secret,
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
  matcher: ["/((?!api/auth|login|_next|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
