export type SetupAuthorizationResult =
  | { authorized: true; requiresSetupCode: boolean }
  | { authorized: false; reason: string; requiresSetupCode: boolean };

export function authorizeSetupUser(email: string | null | undefined, setupCode?: string): SetupAuthorizationResult {
  const allowedEmails = parseAllowedEmails(process.env.METROLINA_SETUP_EMAILS);
  const requiredCode = process.env.METROLINA_SETUP_CODE?.trim();
  const requiresSetupCode = Boolean(requiredCode);

  if (allowedEmails.size === 0) {
    return {
      authorized: false,
      reason: "METROLINA_SETUP_EMAILS is not configured on the server.",
      requiresSetupCode,
    };
  }

  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail || !allowedEmails.has(normalizedEmail)) {
    return {
      authorized: false,
      reason: "This signed-in email is not authorized for first-run setup.",
      requiresSetupCode,
    };
  }

  if (requiredCode && setupCode !== requiredCode) {
    return {
      authorized: false,
      reason: "The setup code is incorrect.",
      requiresSetupCode,
    };
  }

  return { authorized: true, requiresSetupCode };
}

function parseAllowedEmails(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(/[\s,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}
