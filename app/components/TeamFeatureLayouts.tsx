"use client";
import { useId, useRef, useState, type ReactNode } from "react";
import { ClipboardList, Pencil, X } from "lucide-react";
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

export function PracticeWorkspaceSummary({ label, title, detail, children, onRename }: {
  label: string; title: string; detail: string; children?: ReactNode;
  onRename?: (name: string, expectedName: string) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const [draft, setDraft] = useState(title);
  const [original, setOriginal] = useState(title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <section className={`practice-summary-strip panel${children ? "" : " practice-summary-strip--solo"}`}>
    <div className="practice-summary-strip__identity">
      <span className="practice-summary-icon"><ClipboardList size={24} aria-hidden="true" /></span>
      <div className="practice-summary-copy"><small>{label}</small><div className="practice-name-row"><strong>{title}</strong>
        {onRename && <button type="button" className="icon-button" aria-label="Edit Practice name" title="Edit Practice name" onClick={() => { setDraft(title); setOriginal(title); setError(""); dialog.current?.showModal(); nameInput.current?.focus(); }}><Pencil size={16} aria-hidden="true" /></button>}
      </div><em>{detail}</em></div>
    </div>
    {children}
    {onRename && <dialog ref={dialog} className="plan-dialog practice-name-dialog" aria-labelledby={headingId} onCancel={event => { if (busy) event.preventDefault(); }}>
      <header><h2 id={headingId}>Edit Practice Name</h2><button type="button" className="icon-button" aria-label="Close name editor" disabled={busy} onClick={() => dialog.current?.close()}><X size={18} aria-hidden="true" /></button></header>
      <form onSubmit={async event => {
        event.preventDefault(); if (busy || !draft.trim()) return;
        setBusy(true); setError("");
        try { await onRename(draft.trim(), original); dialog.current?.close(); }
        catch (e) { setError(e instanceof Error ? e.message : "Unable to rename Practice."); }
        finally { setBusy(false); }
      }}>
        <div className="plan-dialog-body"><label className="field"><span>Practice name</span><input ref={nameInput} required maxLength={120} value={draft} disabled={busy} onChange={event => setDraft(event.target.value)} /></label>{error && <p role="alert">{error}</p>}</div>
        <footer><button type="button" className="secondary-button" disabled={busy} onClick={() => dialog.current?.close()}>Cancel</button><button type="submit" className="primary-button" disabled={busy || !draft.trim()}>{busy ? "Saving..." : "Save"}</button></footer>
      </form>
    </dialog>}
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
