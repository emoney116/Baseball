"use client";
import { createClient } from "./supabase/client";
import { createEmailAuth, type EmailAuthService } from "./emailAuth";

// Use the current browser origin: PKCE verifier cookies must stay on the host
// where signup started (including www, localhost and approved preview hosts).
function client() { return createEmailAuth(createClient().auth, window.location.origin); }
export const emailAuth: EmailAuthService = {
  signIn: (...args) => client().signIn(...args),
  signUp: (...args) => client().signUp(...args),
  verifyEmail: (...args) => client().verifyEmail(...args),
  resendVerification: (...args) => client().resendVerification(...args),
  resetPassword: (...args) => client().resetPassword(...args),
  updatePassword: (...args) => client().updatePassword(...args),
};
