import PlayerInvitationClient from "./PlayerInvitationClient";
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <PlayerInvitationClient token={(await params).token} />;
}
