import JoinInvitationClient from "./JoinInvitationClient";

export default async function JoinInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <JoinInvitationClient token={token} />;
}
