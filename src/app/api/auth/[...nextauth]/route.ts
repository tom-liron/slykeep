import { handlers } from "@/auth";

// NextAuth's own routes: sign-in, callback, sign-out, session, csrf. This phase uses the built-in
// pages, so `/api/auth/signin` is the sign-in UI too — custom pages land in Auth Phase 3.
export const { GET, POST } = handlers;
