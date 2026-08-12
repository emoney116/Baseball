import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicBackButton } from "../../components/PublicBackButton";
import { PublicFollowButton } from "../../components/PublicFollowButton";
import { APP_NAME, BRAND_ASSETS } from "../../lib/branding";
import { getPublicTeamDirectory } from "../../lib/publicDirectory";

function gameLine(game: { result?: string; ourScore: number; opponentScore: number }) {
  if (!game.result) return "Scheduled";
  return `${game.result} ${game.ourScore}-${game.opponentScore}`;
}

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = await getPublicTeamDirectory(id);
  if (!team) notFound();

  return (
    <main className="public-shell">
      <header className="public-topbar">
        <div className="public-topbar__left">
          <PublicBackButton />
          <Link href="/" className="public-brand">
            <img src={BRAND_ASSETS.mark} alt="" />
            <span>{APP_NAME}</span>
          </Link>
        </div>
        <PublicFollowButton
          organizationId={team.organization.id}
          teamId={team.id}
          label="Follow Team"
          locked={!team.canFollow}
          lockedLabel="You already have access to this team"
        />
      </header>

      <section className="public-hero">
        <div>
          <Link href={`/org/${team.organization.slug}`} className="public-kicker">{team.organization.name}</Link>
          <h1>{team.name}</h1>
          <p>{team.season?.name ?? "Current season"} - {team.level ?? "Baseball"}</p>
        </div>
        <div className="public-stat-strip">
          <span><strong>{team.roster.length}</strong><small>Players</small></span>
          <span><strong>{team.games.length}</strong><small>Games</small></span>
          <span><strong>{team.authorized ? "Full" : "Public"}</strong><small>View</small></span>
        </div>
      </section>

      <section className="public-content-grid">
        <article className="public-panel">
          <div className="public-section__heading">
            <h2>Roster</h2>
          </div>
          <div className="public-roster-list">
            {team.roster.length ? team.roster.map((player) => (
              <div key={player.id} className="public-roster-row">
                <strong>{player.jerseyNumber ?? "-"}</strong>
                <span>
                  <b>{player.name}</b>
                  <small>{[player.primaryPosition, player.secondaryPosition].filter(Boolean).join(" / ")} - {player.graduationYear ?? "Class TBD"}</small>
                </span>
                <em>{player.height ?? "--"} - {player.weight ? `${player.weight} lb` : "--"}</em>
              </div>
            )) : (
              <article className="public-empty">No public roster entries yet.</article>
            )}
          </div>
        </article>

        <article className="public-panel">
          <div className="public-section__heading">
            <h2>Games</h2>
          </div>
          <div className="public-game-list">
            {team.games.length ? team.games.map((game) => (
              <div key={game.id} className="public-game-row">
                <span>{new Date(`${game.gameDate}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                <strong>{game.homeAway === "Home" ? "vs" : "at"} {game.opponent}</strong>
                <small>{gameLine(game)}</small>
              </div>
            )) : (
              <article className="public-empty">No public game results yet.</article>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
