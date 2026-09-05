import PlayerInvitationClient from "./PlayerInvitationClient";
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <PlayerInvitationClient token={(await params).token} />;
}
