import type { SupabaseClient } from "@supabase/supabase-js";

export type SignupInput = { email: string; password: string; firstName?: string; lastName?: string; next?: string };
export type SignupResult = { status: "authenticated" | "verification-required" };
export const EMAIL_CODE_LENGTH = 6;
export const RESEND_COOLDOWN_SECONDS = 60;

// Do not accept arbitrary redirects, even same-origin URLs supplied in an email.
export function safeAuthNext(next?: string | null) {
  if (next === "/auth/reset-password") return next;
  return /^\/join\/(?:player\/)?[A-Za-z0-9_-]{43}$/.test(next ?? "") ? next! : "/";
}

export function authCallbackUrl(origin: string, next = "/") {
  const url = new URL("/auth/callback", origin);
  const destination = safeAuthNext(next);
  if (destination !== "/") url.searchParams.set("next", destination);
  return url.toString();
}

export function authErrorMessage(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "otp_expired") return "This code is invalid or has expired. Try again or request a new code.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") return "Too many attempts. Please wait a minute before trying again.";
  if (code === "invalid_credentials") return "Your email or password is incorrect. Please try again.";
  if (error instanceof Error && /fetch|network|timeout|abort/i.test(error.message)) return "We couldn’t connect. Check your connection and try again.";
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

/** Supabase remains the authority for identity, expiry, rate limits and sessions. */
export function createEmailAuth(auth: SupabaseClient["auth"], origin: string) {
  return {
    async signIn(email: string, password: string) {
      const { data, error } = await auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (!data.session) throw new Error("Sign-in did not complete. Please try again.");
    },
    async signUp(input: SignupInput): Promise<SignupResult> {
      const firstName = input.firstName?.trim() ?? "";
      const lastName = input.lastName?.trim() ?? "";
      const { data, error } = await auth.signUp({
        email: input.email.trim(), password: input.password,
        options: {
          emailRedirectTo: authCallbackUrl(origin, input.next),
          data: { first_name: firstName || null, last_name: lastName || null, display_name: [firstName, lastName].filter(Boolean).join(" ") || input.email.trim() },
        },
      });
      if (error) throw error;
      // A user record alone is NOT a signed-in session. Never load protected data yet.
      return { status: data.session ? "authenticated" : "verification-required" };
    },
    async verifyEmail(email: string, token: string) {
      if (!new RegExp(`^\\d{${EMAIL_CODE_LENGTH}}$`).test(token)) throw new Error("Enter the six-digit code from your email.");
      const { data, error } = await auth.verifyOtp({ email: email.trim(), token, type: "email" });
      if (error) throw error;
      if (!data.session) throw new Error("Email verification did not complete. Request a new code and try again.");
    },
    async resendVerification(email: string, next = "/") {
      const { error } = await auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: authCallbackUrl(origin, next) } });
      if (error) throw error;
    },
    async resetPassword(email: string) {
      const { error } = await auth.resetPasswordForEmail(email.trim(), { redirectTo: authCallbackUrl(origin, "/auth/reset-password") });
      if (error) throw error;
    },
    async updatePassword(password: string) {
      const { error } = await auth.updateUser({ password });
      if (error) throw error;
    },
  };
}

export type EmailAuthService = ReturnType<typeof createEmailAuth>;
