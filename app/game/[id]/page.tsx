import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentType, CSSProperties } from "react";
import {
  CalendarDays,
  ChevronRight,
  Clock,
  Info,
  ListTree,
  MapPin,
  ShieldCheck,
  Table2,
  Trophy,
  Users,
} from "lucide-react";
import { PublicBackButton } from "../../components/PublicBackButton";
import { PublicFollowButton } from "../../components/PublicFollowButton";
import { APP_NAME, BRAND_ASSETS } from "../../lib/branding";
import {
  getPublicGameDetail,
  type PublicBattingRow,
  type PublicGameDetail,
  type PublicGameSummary,
  type PublicPitchingRow,
  type PublicTeamBoxScore,
} from "../../lib/publicDirectory";

type GameTab = "preview" | "summary" | "play-by-play" | "box-score" | "info";
type GamePageSearchParams = { tab?: string | string[] };

const UPCOMING_TABS: Array<{ id: GameTab; label: string; icon: ComponentType<{ size?: number }> }> = [
  { id: "preview", label: "Preview", icon: CalendarDays },
  { id: "play-by-play", label: "Play by Play", icon: ListTree },
  { id: "box-score", label: "Box Score", icon: Table2 },
  { id: "info", label: "Info", icon: Info },
];

const FINAL_TABS: Array<{ id: GameTab; label: string; icon: ComponentType<{ size?: number }> }> = [
  { id: "summary", label: "Summary", icon: Trophy },
  { id: "play-by-play", label: "Play by Play", icon: ListTree },
  { id: "box-score", label: "Box Score", icon: Table2 },
  { id: "info", label: "Info", icon: Info },
];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isFinalGame(game: PublicGameSummary) {
  return Boolean(game.result || game.status === "final");
}

function normalizeTab(value: string | string[] | undefined, final: boolean): GameTab {
  const tab = firstParam(value);
  const allowed = final ? FINAL_TABS : UPCOMING_TABS;
  return allowed.some((item) => item.id === tab) ? tab as GameTab : final ? "summary" : "preview";
}

function gameHref(gameId: string, tab: GameTab) {
  return `/game/${gameId}?tab=${tab}`;
}

function teamPageHref(teamId: string, workspaceAccess: boolean) {
  return workspaceAccess ? `/?view=games&team=${teamId}` : `/team/${teamId}?tab=games`;
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

function formatGameDate(game: PublicGameSummary) {
  const date = dateFromGame(game);
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

function formatShortDate(game: PublicGameSummary) {
  const date = dateFromGame(game);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatGameTime(game: PublicGameSummary) {
  if (!game.startsAt) return "Time TBD";
  return new Date(game.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function locationParts(game: PublicGameDetail) {
  const fallback = game.game.location?.split(",").map((part) => part.trim()).filter(Boolean) ?? [];
  const venue = game.detail.venue ?? fallback[0] ?? "Location TBD";
  const cityState = [game.detail.city, game.detail.state].filter(Boolean).join(", ") || fallback.slice(1).join(", ");
  const field = game.detail.fieldLabel;
  return {
    venue,
    field,
    cityState,
    full: [venue, field, cityState].filter(Boolean).join(" - "),
  };
}

function recordFromGames(games: PublicGameSummary[]) {
  const completed = games.filter(isFinalGame);
  const wins = completed.filter((game) => game.result === "W").length;
  const losses = completed.filter((game) => game.result === "L").length;
  const ties = completed.filter((game) => game.result === "T").length;
  return completed.length ? `${wins}-${losses}${ties ? `-${ties}` : ""}` : "--";
}

function scoreLabel(game: PublicGameSummary) {
  return `${game.result ?? "Final"} ${game.ourScore}-${game.opponentScore}`;
}

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<GamePageSearchParams>;
}) {
  const emptyQuery: GamePageSearchParams = {};
  const [{ id }, query] = await Promise.all([params, searchParams ?? Promise.resolve(emptyQuery)]);
  const publicGame = await getPublicGameDetail(id);
  if (!publicGame) notFound();

  const final = isFinalGame(publicGame.game);
  const activeTab = normalizeTab(query.tab, final);
  const teamHref = teamPageHref(publicGame.team.id, publicGame.workspaceAccess);

  return (
    <main className="public-shell public-game-shell">
      <header className="public-topbar public-game-topbar">
        <div className="public-topbar__left">
          <PublicBackButton href={teamHref} label={`Back to ${publicGame.team.name}`} />
          <Link href="/" className="public-brand">
            <img className="brand-mark-image" src={BRAND_ASSETS.mark} alt="" />
            <span>{APP_NAME}</span>
          </Link>
        </div>
        {publicGame.workspaceAccess ? (
          <Link href={teamHref} className="public-workspace-link">
            Open Team Workspace
          </Link>
        ) : (
          <PublicFollowButton
            organizationId={publicGame.team.organization.id}
            teamId={publicGame.team.id}
            label="Follow Team"
            locked={!publicGame.canFollow}
            lockedLabel="You already have access to this team"
          />
        )}
      </header>

      <GameMatchupHeader game={publicGame} final={final} />
      <GameTabs gameId={publicGame.game.id} tabs={final ? FINAL_TABS : UPCOMING_TABS} activeTab={activeTab} />

      <section className="public-game-view">
        {!final && activeTab === "preview" ? <GamePreview game={publicGame} /> : null}
        {final && activeTab === "summary" ? <FinalSummary game={publicGame} /> : null}
        {activeTab === "play-by-play" ? <PlayByPlay game={publicGame} final={final} /> : null}
        {activeTab === "box-score" ? <BoxScore game={publicGame} final={final} /> : null}
        {activeTab === "info" ? <GameInfoTab game={publicGame} /> : null}
      </section>
    </main>
  );
}

function GameMatchupHeader({ game, final }: { game: PublicGameDetail; final: boolean }) {
  const location = locationParts(game);
  const teamRecord = game.detail.teamRecord ?? recordFromGames(game.team.games);
  const opponentRecord = game.detail.opponentRecord ?? "--";

  return (
    <section className={`public-game-matchup ${final ? "public-game-matchup--final" : ""}`}>
      <div className="public-game-status-label">{final ? "Final" : "Upcoming Game"}</div>
      <div className="public-game-matchup__side">
        <TeamLogo src={game.team.logoUrl} name={game.team.name} />
        <span>
          <strong>{game.team.name}</strong>
          <small>{teamRecord}</small>
        </span>
      </div>

      <div className="public-game-matchup__center">
        {final ? (
          <div className="public-game-scoreline">
            <strong>{game.game.ourScore}</strong>
            <span>Final</span>
            <strong>{game.game.opponentScore}</strong>
          </div>
        ) : (
          <div className="public-game-vs">
            <strong>VS.</strong>
            <span>{game.detail.eventName ?? game.game.gameType ?? "Game"}</span>
          </div>
        )}
        <small>{game.detail.eventName ?? game.game.gameType ?? "Game"}</small>
        <small>{formatGameDate(game.game)}</small>
        <small>{formatGameTime(game.game)}</small>
        <small><MapPin size={14} /> {location.full}</small>
      </div>

      <div className="public-game-matchup__side public-game-matchup__side--opponent">
        <span>
          <strong>{game.game.opponent}</strong>
          <small>{opponentRecord}</small>
        </span>
        <TeamLogo name={game.game.opponent} />
      </div>
    </section>
  );
}

function TeamLogo({ src, name }: { src?: string; name: string }) {
  return (
    <span className="public-game-logo">
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}

function GameTabs({
  gameId,
  tabs,
  activeTab,
}: {
  gameId: string;
  tabs: Array<{ id: GameTab; label: string; icon: ComponentType<{ size?: number }> }>;
  activeTab: GameTab;
}) {
  return (
    <nav className="public-game-tabs" aria-label="Game sections">
      {tabs.map(({ id, label, icon: Icon }) => (
        <Link key={id} href={gameHref(gameId, id)} replace className={activeTab === id ? "active" : undefined}>
          <Icon size={16} />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function GamePreview({ game }: { game: PublicGameDetail }) {
  return (
    <div className="public-game-preview">
      <article className="public-game-panel">
        <h2>Game Preview</h2>
        {game.detail.publicNotes ? <p className="public-panel-note">{game.detail.publicNotes}</p> : null}
        <GameInfoList game={game} compact />
      </article>
      <TeamComparison game={game} title="Team Comparison" />
      <ProbableStarters game={game} />
      <RecentMatchup game={game} />
    </div>
  );
}

function FinalSummary({ game }: { game: PublicGameDetail }) {
  return (
    <div className="public-game-summary-grid">
      <div className="public-game-summary-main">
        <Linescore game={game} />
        <TeamComparison game={game} title="Game Totals" />
        <NextGameCard game={game} />
      </div>
      <aside className="public-game-summary-side">
        <article className="public-game-panel">
          <h2>Game Info</h2>
          <GameInfoList game={game} />
        </article>
        <Highlights game={game} />
        <RecentGames game={game} />
      </aside>
    </div>
  );
}

function GameInfoList({ game, compact = false }: { game: PublicGameDetail; compact?: boolean }) {
  const location = locationParts(game);
  const items = [
    { icon: CalendarDays, label: formatGameDate(game.game) },
    { icon: Clock, label: formatGameTime(game.game) },
    { icon: MapPin, label: location.full },
    { icon: ShieldCheck, label: game.detail.eventName ?? game.game.gameType ?? "Game" },
    { icon: Users, label: `${game.game.homeAway} vs. ${game.game.opponent}` },
  ];
  return (
    <div className={`public-game-info-list ${compact ? "public-game-info-list--compact" : ""}`}>
      {items.map(({ icon: Icon, label }) => (
        <p key={label}><Icon size={16} /> {label}</p>
      ))}
    </div>
  );
}

function TeamComparison({ game, title }: { game: PublicGameDetail; title: string }) {
  const metrics = game.detail.comparison.metrics;
  if (!metrics.length) {
    return (
      <article className="public-game-panel">
        <h2>{title}</h2>
        <div className="public-game-empty">No team stats yet.</div>
      </article>
    );
  }
  return (
    <article className="public-game-panel">
      <div className="public-game-panel__heading">
        <h2>{title}</h2>
        <span>
          {game.detail.comparison.teamLabel ?? initials(game.team.name)}
          {" / "}
          {game.detail.comparison.opponentLabel ?? initials(game.game.opponent)}
        </span>
      </div>
      <div className="public-game-comparison">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <strong>{metric.team ?? "--"}</strong>
            <span>{metric.label}</span>
            <strong>{metric.opponent ?? "--"}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function ProbableStarters({ game }: { game: PublicGameDetail }) {
  const teamStarter = game.detail.probableStarters.team;
  const opponentStarter = game.detail.probableStarters.opponent;
  if (!teamStarter && !opponentStarter) {
    return (
      <article className="public-game-panel public-game-wide">
        <h2>Probable Starters</h2>
        <div className="public-game-empty">No probable starter selected.</div>
      </article>
    );
  }
  return (
    <article className="public-game-panel public-game-wide">
      <h2>Probable Starters</h2>
      <div className="public-starter-matchup">
        <StarterCard team={game.team.name} starter={teamStarter} fallback="TBD" />
        <strong>VS.</strong>
        <StarterCard team={game.game.opponent} starter={opponentStarter} fallback="TBD" alignRight />
      </div>
    </article>
  );
}

function StarterCard({
  team,
  starter,
  fallback,
  alignRight = false,
}: {
  team: string;
  starter?: { name?: string; number?: string; role?: string; line?: string };
  fallback: string;
  alignRight?: boolean;
}) {
  return (
    <span className={`public-starter-card ${alignRight ? "public-starter-card--right" : ""}`}>
      <TeamLogo name={team} />
      <span>
        <small>{starter?.number ? `#${starter.number}` : team}</small>
        <strong>{starter?.name ?? fallback}</strong>
        {starter?.role ? <em>{starter.role}</em> : null}
        {starter?.line ? <small>{starter.line}</small> : null}
      </span>
    </span>
  );
}

function RecentMatchup({ game }: { game: PublicGameDetail }) {
  const matchup = game.detail.recentMatchup;
  return (
    <article className="public-game-panel public-game-wide">
      <h2>Recent Matchup</h2>
      {matchup ? (
        <div className="public-recent-matchup">
          <span>{matchup.date}</span>
          <strong>{game.team.name} {matchup.teamScore}</strong>
          <strong>{matchup.opponent ?? game.game.opponent} {matchup.opponentScore}</strong>
        </div>
      ) : (
        <div className="public-game-empty">No recent matchups between these teams.</div>
      )}
    </article>
  );
}

function Linescore({ game }: { game: PublicGameDetail }) {
  const rows = game.detail.linescore;
  if (!rows.length) {
    return (
      <article className="public-game-panel">
        <h2>Score by Innings</h2>
        <div className="public-game-empty">Final score available. Detailed linescore was not recorded.</div>
      </article>
    );
  }
  const inningCount = Math.max(...rows.map((row) => row.innings.length), 0);
  const innings = Array.from({ length: inningCount }, (_, index) => `${index + 1}`);
  return (
    <article className="public-game-panel">
      <h2>Score by Innings</h2>
      <div className="public-linescore-scroll">
        <div className="public-linescore" style={{ "--innings": inningCount } as CSSProperties}>
          <div className="public-linescore__head">
            <span>Team</span>
            {innings.map((inning) => <span key={inning}>{inning}</span>)}
            <span>R</span>
            <span>H</span>
            <span>E</span>
          </div>
          {rows.map((row) => (
            <div key={row.team} className="public-linescore__row">
              <strong>{row.team}</strong>
              {innings.map((_, index) => <span key={`${row.team}-${index}`}>{row.innings[index] ?? "--"}</span>)}
              <strong>{row.runs}</strong>
              <span>{row.hits ?? "--"}</span>
              <span>{row.errors ?? "--"}</span>
            </div>
          ))}
        </div>
      </div>
      {(game.detail.teamTotals.winningPitcher || game.detail.teamTotals.losingPitcher || game.detail.teamTotals.save) ? (
        <p className="public-linescore-notes">
          {game.detail.teamTotals.winningPitcher ? `W: ${game.detail.teamTotals.winningPitcher}` : null}
          {game.detail.teamTotals.losingPitcher ? ` L: ${game.detail.teamTotals.losingPitcher}` : null}
          {game.detail.teamTotals.save ? ` SV: ${game.detail.teamTotals.save}` : null}
        </p>
      ) : null}
    </article>
  );
}

function PlayByPlay({ game, final }: { game: PublicGameDetail; final: boolean }) {
  if (!final) {
    return (
      <article className="public-game-panel">
        <h2>Play by Play</h2>
        <div className="public-game-empty">Play-by-play will appear once the game begins.</div>
      </article>
    );
  }
  if (!game.detail.playByPlay.length) {
    return (
      <article className="public-game-panel">
        <h2>Play by Play</h2>
        <div className="public-game-empty">Final score available. Detailed play-by-play was not recorded.</div>
      </article>
    );
  }
  return (
    <article className="public-game-panel">
      <h2>Play by Play</h2>
      <div className="public-play-timeline">
        {game.detail.playByPlay.map((section) => (
          <section key={section.label}>
            <h3>{section.label}</h3>
            {section.events.map((event, index) => (
              <div key={`${section.label}-${index}`} className="public-play-event">
                <p>{event.text}</p>
                {event.score ? <small>{event.score}</small> : null}
              </div>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}

function BoxScore({ game, final }: { game: PublicGameDetail; final: boolean }) {
  if (!final) {
    return (
      <article className="public-game-panel">
        <h2>Box Score</h2>
        <div className="public-game-empty">Box score will appear once the game starts.</div>
      </article>
    );
  }
  const hasBatting = game.detail.boxScore.batting.some((section) => section.rows.length);
  const hasPitching = game.detail.boxScore.pitching.some((section) => section.rows.length);
  if (!hasBatting && !hasPitching) {
    return (
      <article className="public-game-panel">
        <h2>Box Score</h2>
        <div className="public-game-empty">No public box score was recorded.</div>
      </article>
    );
  }
  return (
    <div className="public-box-score-stack">
      {hasBatting ? <BattingTable sections={game.detail.boxScore.batting} /> : null}
      {hasPitching ? <PitchingTable sections={game.detail.boxScore.pitching} /> : null}
    </div>
  );
}

function BattingTable({ sections }: { sections: Array<PublicTeamBoxScore<PublicBattingRow>> }) {
  return (
    <article className="public-game-panel">
      <h2>Batting</h2>
      {sections.map((section) => (
        <div key={section.team} className="public-box-section">
          <h3>{section.team}</h3>
          <div className="public-box-scroll">
            <table className="public-box-table">
              <thead>
                <tr><th>Player</th><th>AB</th><th>R</th><th>H</th><th>RBI</th><th>BB</th><th>SO</th><th>XBH</th></tr>
              </thead>
              <tbody>
                {section.rows.map((row) => (
                  <tr key={row.player}>
                    <th>{row.player}</th>
                    <td>{row.ab ?? "--"}</td>
                    <td>{row.r ?? "--"}</td>
                    <td>{row.h ?? "--"}</td>
                    <td>{row.rbi ?? "--"}</td>
                    <td>{row.bb ?? "--"}</td>
                    <td>{row.so ?? "--"}</td>
                    <td>{row.extra || "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </article>
  );
}

function PitchingTable({ sections }: { sections: Array<PublicTeamBoxScore<PublicPitchingRow>> }) {
  return (
    <article className="public-game-panel">
      <h2>Pitching</h2>
      {sections.map((section) => (
        <div key={section.team} className="public-box-section">
          <h3>{section.team}</h3>
          <div className="public-box-scroll">
            <table className="public-box-table">
              <thead>
                <tr><th>Pitcher</th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>SO</th><th>Pitches</th></tr>
              </thead>
              <tbody>
                {section.rows.map((row) => (
                  <tr key={row.player}>
                    <th>{row.player}</th>
                    <td>{row.ip ?? "--"}</td>
                    <td>{row.h ?? "--"}</td>
                    <td>{row.r ?? "--"}</td>
                    <td>{row.er ?? "--"}</td>
                    <td>{row.bb ?? "--"}</td>
                    <td>{row.so ?? "--"}</td>
                    <td>{row.pitches ?? "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </article>
  );
}

function GameInfoTab({ game }: { game: PublicGameDetail }) {
  const location = locationParts(game);
  const info = [
    ["Date", formatGameDate(game.game)],
    ["Time", formatGameTime(game.game)],
    ["Venue", location.venue],
    ["Field", location.field ?? "--"],
    ["City/State", location.cityState || "--"],
    ["Home/Away", game.game.homeAway],
    ["Event", game.detail.eventName ?? game.game.gameType ?? "Game"],
    ["Opponent", game.game.opponent],
    ["Organization", game.team.organization.name],
    ["Visibility", "Public"],
  ];
  return (
    <article className="public-game-panel">
      <h2>Info</h2>
      <div className="public-game-info-grid">
        {info.map(([label, value]) => (
          <span key={label}><small>{label}</small><strong>{value}</strong></span>
        ))}
      </div>
    </article>
  );
}

function Highlights({ game }: { game: PublicGameDetail }) {
  return (
    <article className="public-game-panel">
      <h2>Highlights</h2>
      {game.detail.highlights.length ? (
        <div className="public-highlight-list">
          {game.detail.highlights.map((item) => (
            <span key={`${item.name}-${item.line}`}>
              <strong>{item.name}</strong>
              <small>{item.line}</small>
            </span>
          ))}
        </div>
      ) : (
        <div className="public-game-empty">No public highlights recorded.</div>
      )}
    </article>
  );
}

function NextGameCard({ game }: { game: PublicGameDetail }) {
  if (!game.nextGame) {
    return (
      <article className="public-game-panel">
        <h2>Next Game</h2>
        <div className="public-game-empty">No upcoming game scheduled.</div>
      </article>
    );
  }
  return (
    <article className="public-game-panel">
      <h2>Next Game</h2>
      <Link href={`/game/${game.nextGame.id}`} className="public-next-game-row">
        <TeamLogo name={game.nextGame.opponent} />
        <span>
          <strong>{game.nextGame.homeAway === "Away" ? "@" : "vs."} {game.nextGame.opponent}</strong>
          <small>{formatShortDate(game.nextGame)} - {formatGameTime(game.nextGame)}</small>
          <small>{game.nextGame.location ?? "Location TBD"}</small>
        </span>
        <ChevronRight size={17} />
      </Link>
    </article>
  );
}

function RecentGames({ game }: { game: PublicGameDetail }) {
  return (
    <article className="public-game-panel">
      <h2>Recent Games</h2>
      {game.recentGames.length ? (
        <div className="public-recent-games-list">
          {game.recentGames.map((item) => (
            <Link key={item.id} href={`/game/${item.id}`}>
              <span>{formatShortDate(item)}</span>
              <strong>{item.homeAway === "Away" ? "@" : "vs."} {item.opponent}</strong>
              <em className={`public-recent-result public-recent-result--${item.result?.toLowerCase() ?? "final"}`}>{scoreLabel(item)}</em>
            </Link>
          ))}
        </div>
      ) : (
        <div className="public-game-empty">No recent games yet.</div>
      )}
    </article>
  );
}
