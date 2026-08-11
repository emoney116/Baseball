import { Resend } from "resend";

type StaffInviteEmailInput = {
  to: string;
  inviteUrl: string;
  organizationName: string;
  teams: string[];
  staffRole: string;
  accessRole: string;
  expiresAt: string;
};

export type StaffInviteEmailResult =
  | { sent: true; id?: string }
  | { sent: false; reason: "not-configured" | "send-failed"; message: string };

export async function sendStaffInviteEmail(input: StaffInviteEmailInput): Promise<StaffInviteEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM_EMAIL;

  if (!apiKey || !from) {
    console.warn("staff_invite_email_not_configured", {
      hasApiKey: Boolean(apiKey),
      hasFrom: Boolean(from),
    });
    return {
      sent: false,
      reason: "not-configured",
      message: "Invite created, but email delivery is not configured.",
    };
  }

  const resend = new Resend(apiKey);
  const expires = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(input.expiresAt));
  const teams = input.teams.length ? input.teams.join(", ") : "Assigned team";
  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: "You're invited to Metrolina Baseball",
    html: buildStaffInviteHtml({ ...input, teamsLabel: teams, expiresLabel: expires }),
    text: [
      `You've been invited to join ${input.organizationName}.`,
      `Role: ${input.staffRole}`,
      `Access: ${input.accessRole}`,
      `Teams: ${teams}`,
      `Accept invitation: ${input.inviteUrl}`,
      `Invite expires ${expires}.`,
      "If you weren't expecting this invitation, you can ignore this email.",
    ].join("\n\n"),
  });

  if (error) {
    console.warn("staff_invite_email_send_failed", {
      name: "name" in error ? error.name : "ResendError",
      message: error.message,
    });
    return {
      sent: false,
      reason: "send-failed",
      message: error.message,
    };
  }

  console.info("staff_invite_email_sent", { id: data?.id });
  return { sent: true, id: data?.id };
}

function buildStaffInviteHtml(input: StaffInviteEmailInput & { teamsLabel: string; expiresLabel: string }) {
  return `
    <div style="margin:0;padding:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#15191f;">
      <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
        <div style="background:#ffffff;border:1px solid #e3e6eb;border-radius:14px;padding:28px;">
          <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9f244c;">Metrolina Baseball</div>
          <h1 style="margin:14px 0 10px;font-size:24px;line-height:1.2;">You're invited to join ${escapeHtml(input.organizationName)}.</h1>
          <p style="margin:0 0 22px;color:#4b5563;font-size:15px;line-height:1.5;">Accept the invitation to access the team workspace.</p>
          <div style="border-top:1px solid #edf0f3;border-bottom:1px solid #edf0f3;padding:16px 0;margin-bottom:22px;">
            <p style="margin:0 0 8px;"><strong>Role:</strong> ${escapeHtml(input.staffRole)}</p>
            <p style="margin:0 0 8px;"><strong>Access:</strong> ${escapeHtml(input.accessRole)}</p>
            <p style="margin:0;"><strong>Teams:</strong> ${escapeHtml(input.teamsLabel)}</p>
          </div>
          <a href="${input.inviteUrl}" style="display:inline-block;background:#9f244c;color:#ffffff;text-decoration:none;font-weight:700;border-radius:9px;padding:12px 18px;">Accept Invitation</a>
          <p style="margin:22px 0 0;color:#69717d;font-size:13px;">Invite expires ${escapeHtml(input.expiresLabel)}. If you weren't expecting this invitation, you can ignore this email.</p>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
