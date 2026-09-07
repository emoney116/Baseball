"use client";
import type { ReactNode } from "react";
import { ClipboardList } from "lucide-react";
import type { Game, ID, TeamOption } from "../types";
import { shortDate } from "../lib/stats";
import { OrganizationLogo } from "./TeamContextHeader";
import { matchupPrefix, SectionHeader, SegmentedControl } from "./TeamWorkspaceViews";

export type PracticeWorkspaceTab = "Overview" | "Metrics" | "History";
export function PracticeWorkspaceHeader({ tab, onTab, action }: {
  tab: PracticeWorkspaceTab; onTab: (tab: PracticeWorkspaceTab) => void; action?: ReactNode;
}) {
  return <>
    <SectionHeader title="Practice" action={action} />
    <nav className="practice-tabs" aria-label="Practice sections">
      {(["Overview", "Metrics", "History"] as const).map(item => <button key={item} type="button" className={tab === item ? "active" : ""} onClick={() => onTab(item)}>{item}</button>)}
    </nav>
  </>;
}

export function PracticeWorkspaceSummary({ label, title, detail, children }: {
  label: string; title: string; detail: string; children?: ReactNode;
}) {
  return <section className="practice-summary-strip panel">
    <div className="practice-summary-strip__identity">
      <span className="practice-summary-icon"><ClipboardList size={24} aria-hidden="true" /></span>
      <span><small>{label}</small><strong>{title}</strong><em>{detail}</em></span>
    </div>
    {children}
  </section>;
}

export function WeightRoomWorkspaceHeader<T extends string>({ team, tab, tabs, onTab, action }: {
  team?: TeamOption; tab: T; tabs: T[]; onTab: (tab: T) => void; action?: ReactNode;
}) {
  return <section className="weight-room-shell-header panel">
    <div className="weight-room-shell-header__identity">
      {team && <OrganizationLogo name={team.teamName} imageUrl={team.logoUrl} size="lg" />}
      <span><h2>Weight Room</h2></span>
    </div>
    <SegmentedControl values={tabs} active={tab} onChange={onTab} />
    {action && <div className="weight-room-shell-header__actions">{action}</div>}
  </section>;
}

export function GameLibrary({ games, selectedGameId, onGame }: {
  games: Game[]; selectedGameId?: ID; onGame: (id: ID) => void;
}) {
  return <aside className="panel games-list">
    {games.map(item => <button key={item.id} type="button" className={item.id === selectedGameId ? "active" : ""} onClick={() => onGame(item.id)}>
      <span>{shortDate(item.date)}</span>
      <strong>{matchupPrefix(item.homeAway).replace(".", "")} {item.opponent}</strong>
      <small>{item.result ? `${item.result} ${item.metrolinaScore}-${item.opponentScore}` : `${item.type} - ${item.location}`}</small>
    </button>)}
  </aside>;
}

export function GameScoreRibbon({ game, teamName, children }: { game: Game; teamName: string; children?: ReactNode }) {
  return <header className="game-score-ribbon panel">
    <div className="game-score-team is-primary"><span>{teamName}</span><strong>{game.metrolinaScore}</strong><small>{game.homeAway}</small></div>
    <div className="game-inning-state">
      <span className="game-live-badge">{game.result ? "Final" : "Live"}</span>
      <strong>{game.half} {game.inning}</strong>
      {children}
    </div>
    <div className="game-score-team"><span>{game.opponent}</span><strong>{game.opponentScore}</strong><small>{game.location}</small></div>
  </header>;
}
