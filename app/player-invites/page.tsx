import { Suspense } from "react";
import PlayerQrInvites from "./PlayerQrInvites";
export const metadata = { title: "Player Invites | Clubhouse 9", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default function Page() {
  return <Suspense fallback={<p>Loading invites...</p>}><PlayerQrInvites /></Suspense>;
}
