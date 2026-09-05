import { notFound } from "next/navigation";
import { PlayerAccessPanel } from "../components/PlayerAccessPanel";
export const dynamic = "force-dynamic";
export default function PlayerAccessPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="player-beta">
      <h1>Metrolina Varsity</h1>
      <p>Fall 2026</p>
      <PlayerAccessPanel
        teamId="fixture-team"
        seasonId="fixture-season"
        previewSettings={{
          teamDefault: "VIEW_ONLY",
          roster: [
            {
              playerId: "10000000-0000-4000-8000-000000000040",
              membershipId: "fixture-1",
              name: "#12 J. Smith",
              override: null,
            },
            {
              playerId: "10000000-0000-4000-8000-000000000041",
              membershipId: "fixture-2",
              name: "#7 A. Jones",
              override: "VIEW_ONLY",
            },
            {
              playerId: "10000000-0000-4000-8000-000000000042",
              membershipId: "fixture-3",
              name: "#22 M. White",
              override: "FULL_PLAYER",
            },
          ],
        }}
      />
    </main>
  );
}
