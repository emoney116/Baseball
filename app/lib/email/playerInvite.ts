import { Resend } from "resend";

export function playerInvitationMessage(input: {
  url: string;
  playerName: string;
}) {
  return `Your coach invited you to link your Clubhouse 9 account to ${input.playerName}.\n\nAccept your exact-player invitation: ${input.url}\n\nSign in or create an account with the email address receiving this invitation. This link expires in seven days. If this is not you, do not accept it.`;
}
export async function sendPlayerInviteEmail(
  to: string,
  url: string,
  playerName: string,
) {
  if (!process.env.RESEND_API_KEY || !process.env.INVITE_FROM_EMAIL)
    return {
      sent: false,
      message: "Invitation saved. Email delivery is not configured.",
    };
  try {
    const { data, error } = await new Resend(
      process.env.RESEND_API_KEY,
    ).emails.send({
      from: process.env.INVITE_FROM_EMAIL,
      to,
      subject: "Your Clubhouse 9 player invitation",
      text: playerInvitationMessage({ url, playerName }),
    });
    if (error)
      return {
        sent: false,
        message: "Invitation saved, but delivery failed. Try resend.",
      };
    console.info("player_invitation_email_sent", { messageId: data?.id });
    return { sent: true };
  } catch {
    return {
      sent: false,
      message: "Invitation saved, but delivery failed. Try resend.",
    };
  }
}
