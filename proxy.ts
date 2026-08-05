import { clerkMiddleware } from '@clerk/nextjs/server';

/**
 * Runs Clerk's session detection on every request so `auth()` can read a session in
 * `app/api/ask/route.ts`. No route here requires sign-in; the ask agent stays anonymous-first.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
