import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import { BarChart3, CalendarDays, ChevronRight, Clock, Info, MapPin, ShieldCheck, Users } from "lucide-react";
import { PublicBackButton } from "../../components/PublicBackButton";
import { PublicFollowButton } from "../../components/PublicFollowButton";
import { APP_NAME, BRAND_ASSETS } from "../../lib/branding";
import { getPublicTeamDirectory, type PublicGameSummary, type PublicRosterPlayer, type PublicTeamDirectory } from "../../lib/publicDirectory";

type PublicTeamTab = "games" | "roster" | "stats" | "info";
type GameMode = "upcoming" | "past";
type TeamPageSearchParams = { tab?: string | string[]; games?: string | string[] };

const PUBLIC_TEAM_TABS: Array<{ id: PublicTeamTab; label: string; icon: ComponentType<{ size?: number }> }> = [
  { id: "games", label: "Games", icon: CalendarDays },
  { id: "roster", label: "Roster", icon: Users },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "info", label: "Info", icon: Info },
];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeTab(value: string | string[] | undefined): PublicTeamTab {
  const tab = firstParam(value);
  return tab === "roster" || tab === "stats" || tab === "info" ? tab : "games";
}

function normalizeGameMode(value: string | string[] | undefined): GameMode {
  return firstParam(value) === "past" ? "past" : "upcoming";
}

function teamHref(teamId: string, tab: PublicTeamTab, gameMode?: GameMode) {
  const params = new URLSearchParams({ tab });
  if (tab === "games" && gameMode) params.set("games", gameMode);
  return `/team/${teamId}?${params.toString()}`;
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "C9";
}

function dateFromGame(game: PublicGameSummary) {
  return new Date(`${game.gameDate}T12:00:00`);
}

function gameIsUpcoming(game: PublicGameSummary) {
  if (game.result || game.status === "final") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dateFromGame(game) >= today;
}

function formatGameDate(game: PublicGameSummary) {
  const date = dateFromGame(game);
  return {
    weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
    monthDay: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    full: date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }),
  };
}

function formatGameTime(game: PublicGameSummary) {
  if (!game.startsAt) return "Time TBD";
  return new Date(game.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function locationParts(location?: string) {
  if (!location) return { venue: "Location TBD", city: "" };
  const [venue, ...rest] = location.split(",").map((part) => part.trim()).filter(Boolean);
  return { venue: venue || location, city: rest.join(", ") };
}

function recordForGames(games: PublicGameSummary[]) {
  const completed = games.filter((game) => game.result || game.status === "final");
  const wins = completed.filter((game) => game.result === "W").length;
  const losses = completed.filter((game) => game.result === "L").length;
  const ties = completed.filter((game) => game.result === "T").length;
  return {
    completed,
    wins,
    losses,
    ties,
    runsScored: completed.reduce((total, game) => total + game.ourScore, 0),
    runsAllowed: completed.reduce((total, game) => total + game.opponentScore, 0),
    label: completed.length ? `${wins}-${losses}${ties ? `-${ties}` : ""}` : "--",
  };
}

function positionLine(player: PublicRosterPlayer) {
  return [player.primaryPosition, player.secondaryPosition].filter(Boolean).join(" / ") || "Position TBD";
}

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<TeamPageSearchParams>;
}) {
  const emptyQuery: TeamPageSearchParams = {};
  const [{ id }, query] = await Promise.all([params, searchParams ?? Promise.resolve(emptyQuery)]);
  const team = await getPublicTeamDirectory(id);
  if (!team) notFound();

  const activeTab = normalizeTab(query.tab);
  const gameMode = normalizeGameMode(query.games);
  const record = recordForGames(team.games);

  return (
    <main className="public-shell public-team-shell">
      <header className="public-topbar public-team-topbar">
        <div className="public-topbar__left">
          <PublicBackButton />
          <Link href="/" className="public-brand">
            <img src={BRAND_ASSETS.mark} alt="" />
            <span>{APP_NAME}</span>
          </Link>
        </div>
        {team.workspaceAccess ? (
          <Link href={`/?view=teamHome&team=${team.id}`} className="public-workspace-link">
            Open Team Workspace
          </Link>
        ) : (
          <PublicFollowButton
            organizationId={team.organization.id}
            teamId={team.id}
            label="Follow Team"
            locked={!team.canFollow}
            lockedLabel="You already have access to this team"
          />
        )}
      </header>

      <PublicTeamHeader team={team} record={record.label} />
      <PublicTeamTabs teamId={team.id} activeTab={activeTab} />

      <section className="public-team-view">
        {activeTab === "games" ? <GamesTab team={team} gameMode={gameMode} record={record} /> : null}
        {activeTab === "roster" ? <RosterTab team={team} /> : null}
        {activeTab === "stats" ? <StatsTab team={team} record={record} /> : null}
        {activeTab === "info" ? <InfoTab team={team} record={record.label} /> : null}
      </section>
    </main>
  );
}

function PublicTeamHeader({ team, record }: { team: PublicTeamDirectory; record: string }) {
  const location = [team.city, team.state].filter(Boolean).join(", ");

  return (
    <section className="public-team-identity">
      <TeamMark team={team} />
      <div className="public-team-title-block">
        <Link href={`/org/${team.organization.slug}`} className="public-team-kicker">
          {team.organization.name}
        </Link>
        <h1>{team.name}</h1>
        <div className="public-team-meta">
          <span>{team.season?.name ?? "Current season"}</span>
          <span>{team.ageGroup ?? team.level ?? "Baseball"}</span>
          <span className="public-team-badge"><ShieldCheck size={13} /> Public Team</span>
        </div>
        {location ? (
          <p className="public-team-location"><MapPin size={16} /> {location}</p>
        ) : null}
      </div>
      <div className="public-team-header-stats" aria-label="Team summary">
        <span>
          <strong>{team.roster.length}</strong>
          <small>Players</small>
        </span>
        <span>
          <strong>{team.games.length}</strong>
          <small>Games</small>
        </span>
        <span>
          <strong>{record}</strong>
          <small>Record</small>
        </span>
      </div>
    </section>
  );
}

function TeamMark({ team }: { team: PublicTeamDirectory }) {
  const logoUrl = team.logoUrl ?? team.organization.logoUrl;
  return (
    <span className="public-team-mark" aria-hidden="true">
      {logoUrl ? <img src={logoUrl} alt="" /> : <span>{initials(team.name)}</span>}
    </span>
  );
}

function OpponentMark({ opponent }: { opponent: string }) {
  return <span className="public-opponent-mark" aria-hidden="true">{initials(opponent)}</span>;
}

function PublicTeamTabs({ teamId, activeTab }: { teamId: string; activeTab: PublicTeamTab }) {
  return (
    <nav className="public-team-tabs" aria-label="Public team sections">
      {PUBLIC_TEAM_TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            href={teamHref(teamId, tab.id)}
            className={activeTab === tab.id ? "active" : undefined}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            <Icon size={17} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

function GamesTab({
  team,
  gameMode,
  record,
}: {
  team: PublicTeamDirectory;
  gameMode: GameMode;
  record: ReturnType<typeof recordForGames>;
}) {
  const upcomingGames = team.games.filter(gameIsUpcoming).sort((a, b) => dateFromGame(a).getTime() - dateFromGame(b).getTime());
  const pastGames = team.games.filter((game) => !gameIsUpcoming(game)).sort((a, b) => dateFromGame(b).getTime() - dateFromGame(a).getTime());
  const fallbackToPast = gameMode === "upcoming" && !upcomingGames.length && pastGames.length > 0;
  const visibleGames = fallbackToPast ? pastGames : gameMode === "past" ? pastGames : upcomingGames;
  const nextGame = upcomingGames[0];
  const lastGame = pastGames[0];

  return (
    <div className="public-games-layout">
      <article className="public-team-panel public-games-panel">
        <div className="public-team-panel__heading">
          <div>
            <h2>Games</h2>
            {fallbackToPast ? <p>No upcoming games. Showing recent results.</p> : null}
          </div>
          <div className="public-game-toggle" aria-label="Game filter">
            <Link href={teamHref(team.id, "games", "upcoming")} className={gameMode === "upcoming" ? "active" : undefined}>Upcoming</Link>
            <Link href={teamHref(team.id, "games", "past")} className={gameMode === "past" ? "active" : undefined}>Past</Link>
          </div>
        </div>
        <div className="public-schedule-list">
          {visibleGames.length ? visibleGames.map((game) => <PublicGameRow key={game.id} teamId={team.id} game={game} />) : (
            <div className="public-team-empty">
              {gameMode === "past" ? "No public results yet." : "No games scheduled yet."}
            </div>
          )}
        </div>
      </article>

      <aside className="public-side-stack">
        <QuickStatsPanel team={team} record={record} />
        <NextGamePanel teamId={team.id} nextGame={nextGame} lastGame={lastGame} />
      </aside>
    </div>
  );
}

function PublicGameRow({ teamId, game }: { teamId: string; game: PublicGameSummary }) {
  const date = formatGameDate(game);
  const location = locationParts(game.location);
  const completed = Boolean(game.result || game.status === "final");
  const homeAway = game.homeAway === "Home" ? "vs." : "@";

  return (
    <Link href={`/team/${teamId}?tab=games&game=${game.id}`} className="public-schedule-row">
      <span className="public-schedule-date">
        <small>{date.weekday}</small>
        <strong>{date.monthDay}</strong>
      </span>
      <OpponentMark opponent={game.opponent} />
      <span className="public-schedule-opponent">
        <strong>{homeAway} {game.opponent}</strong>
        <small>{game.gameType ?? "Game"}</small>
      </span>
      <span className="public-schedule-location">
        <MapPin size={15} />
        <span>
          <strong>{location.venue}</strong>
          {location.city ? <small>{location.city}</small> : null}
        </span>
      </span>
      <span className="public-schedule-status">
        {completed ? (
          <span className={`public-result-pill public-result-pill--${game.result?.toLowerCase() ?? "final"}`}>
            {game.result ?? "Final"} {game.ourScore}-{game.opponentScore}
          </span>
        ) : (
          <>
            <strong>{formatGameTime(game)}</strong>
            <small>{game.status === "cancelled" ? "Cancelled" : "Scheduled"}</small>
          </>
        )}
      </span>
      <ChevronRight size={17} />
    </Link>
  );
}

function QuickStatsPanel({ team, record }: { team: PublicTeamDirectory; record: ReturnType<typeof recordForGames> }) {
  const hasCompleted = record.completed.length > 0;
  return (
    <article className="public-team-panel">
      <div className="public-team-panel__heading">
        <h2>Quick Stats</h2>
        <Link href={teamHref(team.id, "stats")}>View Stats</Link>
      </div>
      <div className="public-quick-stat-grid">
        <span><strong>--</strong><small>Team AVG</small></span>
        <span><strong>--</strong><small>Team OBP</small></span>
        <span><strong>--</strong><small>Team SLG</small></span>
        <span><strong>{hasCompleted ? record.runsScored : "--"}</strong><small>Runs Scored</small></span>
        <span><strong>{hasCompleted ? record.runsAllowed : "--"}</strong><small>Runs Allowed</small></span>
        <span><strong>{record.label}</strong><small>Record</small></span>
      </div>
      {!hasCompleted ? <p className="public-panel-note">Stats will appear after games are scored.</p> : null}
    </article>
  );
}

function NextGamePanel({
  teamId,
  nextGame,
  lastGame,
}: {
  teamId: string;
  nextGame?: PublicGameSummary;
  lastGame?: PublicGameSummary;
}) {
  const game = nextGame ?? lastGame;
  if (!game) {
    return (
      <article className="public-team-panel public-next-game">
        <h2>Next Game</h2>
        <div className="public-team-empty">No upcoming games.</div>
      </article>
    );
  }
  const date = formatGameDate(game);
  const location = locationParts(game.location);
  const label = nextGame ? "Next Game" : "Last Game";

  return (
    <article className="public-team-panel public-next-game">
      <h2>{label}</h2>
      <div className="public-next-game__opponent">
        <OpponentMark opponent={game.opponent} />
        <span>
          <strong>{game.homeAway === "Home" ? "vs." : "@"} {game.opponent}</strong>
          <small>{game.gameType ?? "Game"}</small>
        </span>
      </div>
      <p><CalendarDays size={16} /> {date.full}</p>
      <p><Clock size={16} /> {nextGame ? formatGameTime(game) : `${game.result ?? "Final"} ${game.ourScore}-${game.opponentScore}`}</p>
      <p><MapPin size={16} /> {location.venue}{location.city ? `, ${location.city}` : ""}</p>
      <Link href={`/team/${teamId}?tab=games&game=${game.id}`} className="public-game-detail-link">
        View Game Details <ChevronRight size={16} />
      </Link>
    </article>
  );
}

function RosterTab({ team }: { team: PublicTeamDirectory }) {
  return (
    <article className="public-team-panel">
      <div className="public-team-panel__heading">
        <div>
          <h2>Roster</h2>
          <p>{team.roster.length} Players</p>
        </div>
      </div>
      {team.roster.length ? (
        <div className="public-roster-table">
          <div className="public-roster-head">
            <span>#</span>
            <span>Player</span>
            <span>Position</span>
            <span>Class</span>
            <span>B/T</span>
            <span>Height</span>
            <span>Weight</span>
          </div>
          {team.roster.map((player) => (
            <div key={player.id} className="public-roster-entry">
              <strong className="public-player-number">{player.jerseyNumber ?? "-"}</strong>
              <span className="public-player-name">
                <b>{player.name}</b>
                <small>{positionLine(player)}</small>
              </span>
              <span>{positionLine(player)}</span>
              <span>{player.graduationYear ?? "--"}</span>
              <span>{[player.bats, player.throws].filter(Boolean).join("/") || "--"}</span>
              <span>{player.height ?? "--"}</span>
              <span>{player.weight ? `${player.weight}` : "--"}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="public-team-empty">No public roster available yet.</div>
      )}
    </article>
  );
}

function StatsTab({ team, record }: { team: PublicTeamDirectory; record: ReturnType<typeof recordForGames> }) {
  return (
    <div className="public-stats-layout">
      <article className="public-team-panel">
        <div className="public-team-panel__heading"><h2>Team Hitting</h2></div>
        <div className="public-quick-stat-grid public-quick-stat-grid--wide">
          <span><strong>--</strong><small>AVG</small></span>
          <span><strong>--</strong><small>OBP</small></span>
          <span><strong>--</strong><small>SLG</small></span>
          <span><strong>{record.completed.length ? record.runsScored : "--"}</strong><small>Runs</small></span>
          <span><strong>--</strong><small>Hits</small></span>
        </div>
        <p className="public-panel-note">Public hitting stats will appear when scored game data is available.</p>
      </article>
      <article className="public-team-panel">
        <div className="public-team-panel__heading"><h2>Team Pitching</h2></div>
        <div className="public-quick-stat-grid public-quick-stat-grid--wide">
          <span><strong>--</strong><small>ERA</small></span>
          <span><strong>--</strong><small>WHIP</small></span>
          <span><strong>--</strong><small>Strikeouts</small></span>
          <span><strong>--</strong><small>Walks</small></span>
          <span><strong>{record.completed.length ? record.runsAllowed : "--"}</strong><small>Runs Allowed</small></span>
        </div>
        <p className="public-panel-note">Pitching leaderboards stay hidden until public scoring data exists.</p>
      </article>
      <article className="public-team-panel">
        <div className="public-team-panel__heading"><h2>Player Leaders</h2></div>
        <div className="public-team-empty">No public player leaders yet.</div>
      </article>
      <article className="public-team-panel">
        <div className="public-team-panel__heading"><h2>Game Summary</h2></div>
        <div className="public-info-grid">
          <InfoItem label="Record" value={record.label} />
          <InfoItem label="Games" value={`${team.games.length}`} />
          <InfoItem label="Runs Scored" value={record.completed.length ? `${record.runsScored}` : "--"} />
          <InfoItem label="Runs Allowed" value={record.completed.length ? `${record.runsAllowed}` : "--"} />
        </div>
      </article>
    </div>
  );
}

function InfoTab({ team, record }: { team: PublicTeamDirectory; record: string }) {
  const location = [team.city, team.state].filter(Boolean).join(", ") || "Location TBD";
  return (
    <article className="public-team-panel">
      <div className="public-team-panel__heading"><h2>Info</h2></div>
      <div className="public-info-grid">
        <InfoItem label="Organization" value={team.organization.name} href={`/org/${team.organization.slug}`} />
        <InfoItem label="Team" value={team.ageGroup ?? team.level ?? team.name} />
        <InfoItem label="Season" value={team.season?.name ?? "Current season"} />
        <InfoItem label="Location" value={location} />
        <InfoItem label="Visibility" value="Public" />
        <InfoItem label="Record" value={record} />
      </div>
    </article>
  );
}

function InfoItem({ label, value, href }: { label: string; value: string; href?: string }) {
  const content = (
    <>
      <small>{label}</small>
      <strong>{value}</strong>
    </>
  );
  return href ? <Link href={href} className="public-info-item">{content}</Link> : <span className="public-info-item">{content}</span>;
}
