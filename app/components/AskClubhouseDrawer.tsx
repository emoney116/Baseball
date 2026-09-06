"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { BarChart3, ChevronDown, ChevronRight, ChevronUp, Dumbbell, Gauge, RefreshCw, Send, Sparkles, TrendingUp, Trophy, X, type LucideIcon } from "lucide-react";
import type { ID } from "../types";
import type { AskClubhouseAction, AskClubhouseClientMessage, AskClubhouseEvidenceItem, AskClubhouseRoute, AskClubhouseStatus, AskClubhouseUsageSnapshot, AskClubhouseVisual } from "../lib/askClubhouse/types";
import { ClubhouseBaseballField } from "./ClubhouseBaseballField";
import { StrikeZone } from "./visuals";

const subscribeToDocument = () => () => {};
const getPortalTarget = () => document.body;
const getServerPortalTarget = () => null;

export function AskClubhouseLauncher({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  return (
    <button className={`secondary-button ask-clubhouse-launcher${compact ? " ask-clubhouse-launcher--compact" : ""}`} type="button" onClick={onClick} aria-label="Ask Clubhouse" title="Ask Clubhouse">
      <Sparkles size={15} aria-hidden="true" />
      <span>Ask Clubhouse</span>
    </button>
  );
}

export function AskClubhouseFab({ onClick }: { onClick: () => void }) {
  return (
    <button className="ask-clubhouse-fab" type="button" onClick={onClick} aria-label="Ask Clubhouse" title="Ask Clubhouse">
      <Sparkles size={19} strokeWidth={2.25} aria-hidden="true" />
      <span>Ask Clubhouse</span>
    </button>
  );
}

export type AskClubhouseChatMessage = AskClubhouseClientMessage & {
  id: ID;
  status?: AskClubhouseStatus;
  evidence?: AskClubhouseEvidenceItem[];
  actions?: AskClubhouseAction[];
  followUps?: string[];
  usage?: AskClubhouseUsageSnapshot;
  pending?: boolean;
  pendingStartedAt?: number;
  route?: AskClubhouseRoute;
  ui?: AskClubhouseUiPayload;
  visuals?: AskClubhouseVisual[];
  visualUnavailable?: boolean;
};

type AskClubhouseUiMetric = {
  label: string;
  value: string;
  sub?: string;
};

type AskClubhouseRankingRow = {
  rank: number;
  initials: string;
  name: string;
  value: string;
};

type AskClubhouseComparisonRow = {
  label: string;
  practice: string;
  games: string;
  emphasis?: "practice" | "games";
};

type AskClubhouseTextRankingRow = {
  rank: number;
  initials: string;
  name: string;
  value: string;
};

type AskClubhouseTextAnswerBlocks = {
  primary: string;
  scope?: string;
  ranking: AskClubhouseTextRankingRow[];
  valueLabel: string;
  explanation: string[];
  notes: string[];
  bullets: string[];
};

export type AskClubhouseUiPayload =
  | {
      kind: "ranking";
      headline: string;
      metrics: AskClubhouseUiMetric[];
      explanation: string;
      rankingLabel: string;
      rankingValueLabel: string;
      ranking: AskClubhouseRankingRow[];
      footnote: string;
    }
  | {
      kind: "comparison";
      title: string;
      rows: AskClubhouseComparisonRow[];
      explanation: string;
      barLabel: string;
      practiceValue: number;
      gamesValue: number;
      actionLabel?: string;
    };

export const ASK_CLUBHOUSE_GENERIC_STAGE = "Analyzing your Clubhouse data...";
export const ASK_CLUBHOUSE_SETUP_TITLE = "Ask Clubhouse is finishing setup.";
export const ASK_CLUBHOUSE_SETUP_BODY = "The latest database update needs to complete before team-data questions are available.";
export const ASK_CLUBHOUSE_ERROR_TITLE = "I couldn't complete that analysis right now.";
export const ASK_CLUBHOUSE_ERROR_BODY = "Your Clubhouse data was not changed.";

export const ASK_CLUBHOUSE_UI_SUGGESTIONS: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Who has the highest Practice Contact %?", icon: TrendingUp },
  { label: "Compare Practice vs Games", icon: BarChart3 },
  { label: "What changed in our hitting this month?", icon: Gauge },
  { label: "Who has the best bullpen Strike %?", icon: Trophy },
  { label: "Show our highest exit velocities", icon: Sparkles },
  { label: "Who leads Weight Room Development?", icon: Dumbbell },
];

export function AskClubhouseDrawer({
  messages,
  input,
  sending,
  stage,
  error,
  scopeControl,
  suggestions: contextualSuggestions,
  includeDefaultSuggestions = true,
  onClose,
  onNewChat,
  onInput,
  onQuestion,
  onSubmit,
  onAction,
}: {
  messages: AskClubhouseChatMessage[];
  input: string;
  sending: boolean;
  stage: string;
  error?: string;
  scopeControl: React.ReactNode;
  includeDefaultSuggestions?: boolean;
  suggestions: Array<{ label: string; icon: LucideIcon }>;
  onClose: () => void;
  onNewChat: () => void;
  onInput: (value: string) => void;
  onQuestion: (question: string) => void;
  onSubmit: () => void;
  onAction: (action: AskClubhouseAction) => void;
}) {
  const portalTarget = useSyncExternalStore(subscribeToDocument, getPortalTarget, getServerPortalTarget);
  const [showAllIdeas, setShowAllIdeas] = useState(() => {
    if (process.env.NODE_ENV === "production" || typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("askIdeas") === "all";
  });
  const visibleMessages = useMemo(() => dedupeAskClubhouseMessages(messages), [messages]);
  const chatRef = useRef<HTMLElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.dataset.askClubhouseOpen = "true";
    const focusFrame = requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLButtonElement>('[aria-label="Close Ask Clubhouse"]')?.focus());
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const controls = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]') ?? []).filter(el => el.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || !drawerRef.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !drawerRef.current?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      delete document.body.dataset.askClubhouseOpen;
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  const shouldFollowChatRef = useRef(true);
  const lastUserQuestion = [...visibleMessages].reverse().find((message) => message.role === "user")?.content;
  const combinedSuggestions = [...contextualSuggestions, ...(includeDefaultSuggestions ? ASK_CLUBHOUSE_UI_SUGGESTIONS : []).filter((item) => !contextualSuggestions.some((suggestion) => suggestion.label === item.label))];
  const suggestions = showAllIdeas ? combinedSuggestions : combinedSuggestions.slice(0, 4);
  const lastAssistantId = [...visibleMessages].reverse().find((message) => message.role === "assistant" && !message.pending)?.id;
  const canSend = input.trim().length > 0 && !sending;
  const shouldShowInlineError = Boolean(
    error
    && !sending
    && !visibleMessages.some((message) => !message.pending && message.role === "assistant" && normalizeAskContent(message.content) === normalizeAskContent(error)),
  );

  useEffect(() => {
    if (!shouldFollowChatRef.current) return;
    const chat = chatRef.current;
    if (!chat) return;
    window.requestAnimationFrame(() => chat.scrollTo({ top: chat.scrollHeight, behavior: "smooth" }));
  }, [visibleMessages.length, sending]);

  return portalTarget ? createPortal(
    <div
      className="analytics-drawer-backdrop analytics-ask-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside ref={drawerRef} className="analytics-drawer analytics-ask-drawer" role="dialog" aria-modal="true" aria-label="Ask Clubhouse">
        <header className="ask-header">
          <button className="icon-button ask-header__new-button" type="button" onClick={onNewChat} aria-label="Start a new Ask Clubhouse chat" title="New Chat">
            <RefreshCw size={15} aria-hidden="true" />
          </button>
          <div className="ask-header__title">
            <strong>Ask Clubhouse</strong>
          </div>
          <div className="ask-header__actions">
            <button className="icon-button ask-header__close-button" type="button" onClick={onClose} aria-label="Close Ask Clubhouse">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </header>
        {scopeControl}
        <section
          className="ask-chat"
          aria-label="Ask Clubhouse chat"
          ref={chatRef}
          onScroll={(event) => {
            const target = event.currentTarget;
            shouldFollowChatRef.current = target.scrollHeight - target.scrollTop - target.clientHeight < 72;
          }}
        >
          {!visibleMessages.length && (
            <AskClubhouseLanding
              suggestions={suggestions}
              showAllIdeas={showAllIdeas}
              sending={sending}
              onQuestion={onQuestion}
              onToggleIdeas={() => setShowAllIdeas((current) => !current)}
            />
          )}
          {visibleMessages.map((message) => (
            <AskClubhouseMessageBubble
              key={message.id}
              message={message.pending ? { ...message, content: stage } : message}
              onAction={onAction}
              onQuestion={onQuestion}
              showFollowUps={message.id === lastAssistantId}
              onRetry={() => {
                if (lastUserQuestion) onQuestion(lastUserQuestion);
              }}
            />
          ))}
          {shouldShowInlineError && (
            <AskClubhouseStatusCard
              tone="error"
              title={ASK_CLUBHOUSE_ERROR_TITLE}
              body={error ?? ASK_CLUBHOUSE_ERROR_BODY}
              actionLabel={lastUserQuestion ? "Try Again" : undefined}
              onAction={lastUserQuestion ? () => onQuestion(lastUserQuestion) : undefined}
            />
          )}
        </section>
        <form
          className="ask-composer"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSend) onSubmit();
          }}
        >
          <textarea
            aria-label="Ask a question"
            value={input}
            onChange={(event) => onInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (canSend) onSubmit();
              }
            }}
            placeholder={visibleMessages.length ? "Ask a follow-up..." : "Ask about your team..."}
            rows={2}
            maxLength={4000}
            disabled={sending}
          />
          <button className="primary-button ask-send-button" type="submit" disabled={!canSend} aria-label="Send Ask Clubhouse message">
            <Send size={16} aria-hidden="true" />
          </button>
        </form>
      </aside>
    </div>, portalTarget
  ) : null;
}

function AskClubhouseLanding({
  suggestions,
  showAllIdeas,
  sending,
  onQuestion,
  onToggleIdeas,
}: {
  suggestions: Array<{ label: string; icon: LucideIcon }>;
  showAllIdeas: boolean;
  sending: boolean;
  onQuestion: (question: string) => void;
  onToggleIdeas: () => void;
}) {
  return (
    <div className="ask-empty-state">
      <div className="ask-empty-state__intro">
        <span className="ask-mark" aria-hidden="true">
          <Sparkles size={19} />
        </span>
        <h3>Ask Clubhouse</h3>
        <strong>What do you want to know?</strong>
        <p>Ask anything about your team, players, practices, games, development, or baseball.</p>
      </div>
      <div className="ask-suggestion-stack" aria-label="Suggested questions">
        {suggestions.map(({ label, icon: Icon }) => (
          <button key={label} type="button" onClick={() => onQuestion(label)} disabled={sending}>
            <Icon size={16} aria-hidden="true" />
            <span>{label}</span>
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        ))}
      </div>
      <button className="ask-show-more" type="button" onClick={onToggleIdeas}>
        {showAllIdeas ? "Show fewer ideas" : "Show more ideas"}
        {showAllIdeas ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
      </button>
    </div>
  );
}

function AskClubhouseMessageBubble({
  message,
  onAction,
  onQuestion,
  showFollowUps,
  onRetry,
}: {
  message: AskClubhouseChatMessage;
  onAction: (action: AskClubhouseAction) => void;
  onQuestion: (question: string) => void;
  showFollowUps: boolean;
  onRetry: () => void;
}) {
  const isAssistant = message.role === "assistant";
  return (
    <article className={`ask-message ask-message--${message.role}${message.pending ? " ask-message--thinking" : ""}`}>
      <header className="ask-message__meta">
        <span>
          {isAssistant && <Sparkles size={15} aria-hidden="true" />}
          {isAssistant ? "Ask Clubhouse" : "You"}
        </span>
        {message.createdAt && <time dateTime={message.createdAt}>{formatAskMessageTime(message.createdAt)}</time>}
      </header>
      {message.pending ? (
        <AskClubhouseThinking stage={message.content} startedAt={message.pendingStartedAt} />
      ) : isAssistant ? (
        <AskClubhouseAssistantAnswer message={message} onAction={onAction} onQuestion={onQuestion} showFollowUps={showFollowUps} onRetry={onRetry} />
      ) : (
        <p className="ask-user-question">{message.content}</p>
      )}
    </article>
  );
}

function AskClubhouseAssistantAnswer({
  message,
  onAction,
  onQuestion,
  showFollowUps,
  onRetry,
}: {
  message: AskClubhouseChatMessage;
  onAction: (action: AskClubhouseAction) => void;
  onQuestion: (question: string) => void;
  showFollowUps: boolean;
  onRetry: () => void;
}) {
  if (isAskSetupMessage(message)) {
    return (
      <AskClubhouseStatusCard
        tone="setup"
        title={ASK_CLUBHOUSE_SETUP_TITLE}
        body={ASK_CLUBHOUSE_SETUP_BODY}
        actionLabel="Try Again"
        onAction={onRetry}
      />
    );
  }

  if (message.status === "failed" || message.status === "unavailable") {
    return (
      <AskClubhouseStatusCard
        tone="error"
        title={ASK_CLUBHOUSE_ERROR_TITLE}
        body={ASK_CLUBHOUSE_ERROR_BODY}
        actionLabel="Try Again"
        onAction={onRetry}
      />
    );
  }

  if (message.status === "no_data") {
    return (
      <AskClubhouseStatusCard
        tone="notice"
        title={stripAskMarkdownInline(message.content)}
        body="Try a broader date range, another data source, or all tracked sessions."
      />
    );
  }

  if (message.status === "refused") {
    return <AskClubhouseTextAnswer content={message.content} />;
  }

  return (
    <>
      {message.ui?.kind === "ranking" && <AskClubhouseRankingAnswer payload={message.ui} />}
      {message.ui?.kind === "comparison" && <AskClubhouseComparisonAnswer payload={message.ui} />}
      {!message.ui && <AskClubhouseTextAnswer content={message.content} />}
      {message.visuals?.length ? <AskClubhouseVisualAnswers visuals={message.visuals} actions={message.actions} onAction={onAction} /> : null}
      {message.visualUnavailable && <p className="ask-visual-unavailable">Visual unavailable for this answer.</p>}
      <AskClubhouseEvidence message={message} />
      <AskClubhouseActions message={message} onAction={onAction} />
      {showFollowUps && <AskClubhouseFollowUps message={message} onQuestion={onQuestion} />}
    </>
  );

}

function AskClubhouseVisualAnswers({
  visuals,
  actions,
  onAction,
}: {
  visuals: AskClubhouseVisual[];
  actions?: AskClubhouseAction[];
  onAction: (action: AskClubhouseAction) => void;
}) {
  return (
    <div className="ask-visual-answers" aria-label="Analytics visuals">
      {visuals.map((visual, index) => (
        <AskClubhouseVisualCard
          key={`${visual.type}-${visual.playerId ?? "team"}-${index}`}
          visual={visual}
          action={actions?.find((candidate) => candidate.type === "open_analytics" && (!visual.playerId || candidate.playerId === visual.playerId))}
          onAction={onAction}
        />
      ))}
    </div>
  );
}

function AskClubhouseVisualCard({
  visual,
  action,
  onAction,
}: {
  visual: AskClubhouseVisual;
  action?: AskClubhouseAction;
  onAction: (action: AskClubhouseAction) => void;
}) {
  const [mode, setMode] = useState(visual.mode);
  const isField = visual.type === "spray_chart";
  const isZone = visual.type === "pitch_location";
  const modes = isField
    ? (["spray", "count", "percent", "heat"] as const)
    : (["dots", "count", "percent", "heat"] as const);
  const label = visual.coverage.trackedEvents === visual.coverage.qualifyingEvents
    ? `${visual.coverage.trackedEvents} ${visual.coverage.label}`
    : `${visual.coverage.trackedEvents} of ${visual.coverage.qualifyingEvents} ${visual.coverage.label} tracked`;

  if (visual.type === "metric_summary") {
    const metrics = visual.metrics?.slice(0, 5) ?? [];
    return (
      <div
        className="ask-metric-strip ask-visual-metric-strip"
        aria-label={visual.title}
        style={{ "--ask-visual-metric-count": metrics.length } as React.CSSProperties}
      >
        {metrics.map((metric) => (
          <div key={metric.id}>
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
          </div>
        ))}
      </div>
    );
  }

  if (!isField && !isZone) return null;
  return (
    <section className="ask-visual-card">
      <header className="ask-visual-card__head">
        <div>
          <small>Analytics</small>
          <strong>{visual.title}</strong>
        </div>
        <div className="ask-visual-card__modes" role="group" aria-label={`${visual.title} display mode`}>
          {modes.map((nextMode) => (
            <button key={nextMode} type="button" className={mode === nextMode ? "active" : ""} onClick={() => setMode(nextMode)}>
              {askVisualModeLabel(nextMode)}
            </button>
          ))}
        </div>
      </header>
      {isField ? (
        <ClubhouseBaseballField
          className="ask-visual-card__field"
          points={visual.points}
          mode={mode === "dots" ? "spray" : mode}
          size="standard"
          coordinateSpace="practice"
          showTrajectory={mode === "spray"}
          showTrajectories={mode === "spray"}
          ariaLabel={`${label} shown on the Clubhouse baseball field`}
        />
      ) : (
        <StrikeZone points={visual.points} mode={mode === "spray" ? "dots" : mode} compact />
      )}
      <footer className="ask-visual-card__foot">
        <span>{label}</span>
        {visual.sample !== "qualified" && <em>Limited sample</em>}
        {action && <button type="button" onClick={() => onAction(action)}>View in Analytics <ChevronRight size={14} aria-hidden="true" /></button>}
      </footer>
    </section>
  );
}

function askVisualModeLabel(mode: AskClubhouseVisual["mode"]) {
  return ({ spray: "Spray", dots: "Dots", count: "#", percent: "%", heat: "Heat" })[mode];
}

function AskClubhouseThinking({ stage, startedAt }: { stage: string; startedAt?: number }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(() => startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0);
  useEffect(() => {
    if (!startedAt) return;
    const timer = window.setInterval(() => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return (
    <div className="ask-thinking-block" aria-live="polite">
      <span aria-hidden="true" />
      <strong>{stage || ASK_CLUBHOUSE_GENERIC_STAGE}</strong>
      <time>{Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, "0")}</time>
    </div>
  );
}

function AskClubhouseTextAnswer({ content }: { content: string }) {
  const blocks = parseAskClubhouseTextAnswer(content);
  return (
    <div className="ask-answer-copy">
      {blocks.primary && <p className="ask-answer-primary">{blocks.primary}</p>}
      {blocks.scope && <p className="ask-answer-scope">{blocks.scope}</p>}
      {blocks.ranking.length > 0 && <AskClubhouseTextRanking rows={blocks.ranking} valueLabel={blocks.valueLabel} />}
      {blocks.explanation.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      {blocks.notes.map((note) => (
        <div className="ask-data-note" key={note}>
          <span>Data note</span>
          <p>{note}</p>
        </div>
      ))}
      {blocks.bullets.length > 0 && (
        <ul className="ask-answer-list">
          {blocks.bullets.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
    </div>
  );
}

function AskClubhouseTextRanking({
  rows,
  valueLabel,
}: {
  rows: AskClubhouseTextRankingRow[];
  valueLabel: string;
}) {
  return (
    <div className="ask-ranking ask-ranking--text">
      <div className="ask-ranking__head">
        <span>Data</span>
        <span>{valueLabel}</span>
      </div>
      {rows.map((row) => (
        <div key={`${row.rank}-${row.name}-${row.value}`} className="ask-ranking__row">
          <b>{row.rank}</b>
          <span className="ask-ranking__avatar">{row.initials}</span>
          <strong>{row.name}</strong>
          <em>{row.value}</em>
        </div>
      ))}
    </div>
  );
}

function AskClubhouseRankingAnswer({ payload }: { payload: Extract<AskClubhouseUiPayload, { kind: "ranking" }> }) {
  return (
    <div className="ask-structured-answer">
      <h3>{payload.headline}</h3>
      <div className="ask-metric-strip" aria-label="Key metrics">
        {payload.metrics.map((metric) => (
          <div key={metric.label}>
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
            {metric.sub && <small>{metric.sub}</small>}
          </div>
        ))}
      </div>
      <p>{payload.explanation}</p>
      <div className="ask-ranking">
        <div className="ask-ranking__head">
          <span>{payload.rankingLabel}</span>
          <span>{payload.rankingValueLabel}</span>
        </div>
        {payload.ranking.map((row) => (
          <div key={`${row.rank}-${row.name}`} className="ask-ranking__row">
            <b>{row.rank}</b>
            <span className="ask-ranking__avatar">{row.initials}</span>
            <strong>{row.name}</strong>
            <em>{row.value}</em>
          </div>
        ))}
      </div>
      <small className="ask-answer-footnote">{payload.footnote}</small>
    </div>
  );
}

function AskClubhouseComparisonAnswer({ payload }: { payload: Extract<AskClubhouseUiPayload, { kind: "comparison" }> }) {
  const maxValue = Math.max(payload.practiceValue, payload.gamesValue, 1);
  return (
    <div className="ask-structured-answer">
      <h3>{payload.title}</h3>
      <div className="ask-comparison">
        <div className="ask-comparison__head">
          <span />
          <span>Practice</span>
          <span>Games</span>
        </div>
        {payload.rows.map((row) => (
          <div key={row.label} className="ask-comparison__row">
            <strong>{row.label}</strong>
            <span className={row.emphasis === "practice" ? "active" : ""}>{row.practice}</span>
            <span className={row.emphasis === "games" ? "active" : ""}>{row.games}</span>
          </div>
        ))}
      </div>
      <p>{payload.explanation}</p>
      <div className="ask-bar-compare" aria-label={payload.barLabel}>
        <span>{payload.barLabel}</span>
        <div>
          <i style={{ width: `${Math.max(8, (payload.practiceValue / maxValue) * 100)}%` }} />
          <b>{payload.practiceValue}%</b>
        </div>
        <div>
          <i style={{ width: `${Math.max(8, (payload.gamesValue / maxValue) * 100)}%` }} />
          <b>{payload.gamesValue}%</b>
        </div>
      </div>
    </div>
  );
}

function AskClubhouseEvidence({ message }: { message: AskClubhouseChatMessage }) {
  const evidence = (message.evidence ?? []).filter((item) => (
    !message.visuals?.length
    || Boolean(item.url)
    || item.title.startsWith("Baseball Knowledge")
  ));
  if (!evidence.length) return null;
  return (
    <div className="ask-evidence-list">
      {evidence.map((item) => (
        <div key={`${message.id}-${item.title}`}>
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
          ) : <strong>{item.title}</strong>}
          <small>{item.summary}</small>
        </div>
      ))}
    </div>
  );
}

function AskClubhouseFollowUps({
  message,
  onQuestion,
}: {
  message: AskClubhouseChatMessage;
  onQuestion: (question: string) => void;
}) {
  const followUps = (message.followUps ?? []).slice(0, 3);
  if (!followUps.length) return null;
  return (
    <div className="ask-followup-list">
      <span>You might also ask</span>
      {followUps.map((question) => (
        <button key={`${message.id}-${question}`} type="button" onClick={() => onQuestion(question)}>
          <span>{question}</span>
          <ChevronRight size={13} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function AskClubhouseActions({
  message,
  onAction,
}: {
  message: AskClubhouseChatMessage;
  onAction: (action: AskClubhouseAction) => void;
}) {
  if (!message.actions?.length) return null;
  return (
    <div className="ask-action-list">
      {message.actions.map((action) => (
        <button key={`${message.id}-${action.label}`} type="button" onClick={() => onAction(action)}>
          <BarChart3 size={15} aria-hidden="true" />
          <span>{formatAskActionLabel(action.label)}</span>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function AskClubhouseStatusCard({
  tone,
  title,
  body,
  actionLabel,
  onAction,
}: {
  tone: "setup" | "error" | "notice";
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className={`ask-status-card ask-status-card--${tone}`}>
      <strong>{title}</strong>
      <p>{body}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function dedupeAskClubhouseMessages(messages: AskClubhouseChatMessage[]): AskClubhouseChatMessage[] {
  return messages.reduce<AskClubhouseChatMessage[]>((deduped, message) => {
    const previous = deduped[deduped.length - 1];
    if (
      previous
      && previous.role === message.role
      && previous.status === message.status
      && normalizeAskContent(previous.content) === normalizeAskContent(message.content)
    ) {
      return deduped;
    }
    return [...deduped, message];
  }, []);
}

export function normalizeAskContent(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function stripAskMarkdownInline(value: string | undefined): string {
  return (value ?? "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function parseAskClubhouseTextAnswer(content: string): AskClubhouseTextAnswerBlocks {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const paragraphs: string[] = [];
  const bullets: string[] = [];
  const ranking: AskClubhouseTextRankingRow[] = [];
  let primary = "";
  let currentParagraph: string[] = [];

  function flushParagraph() {
    if (!currentParagraph.length) return;
    const paragraph = stripAskMarkdownInline(currentParagraph.join(" ")).replace(/\s+/g, " ").trim();
    if (paragraph) paragraphs.push(paragraph);
    currentParagraph = [];
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushParagraph();
      continue;
    }
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      const cleanBullet = stripAskMarkdownInline(bulletMatch[1]);
      const rankingRow = parseAskRankingLine(cleanBullet, ranking.length + 1);
      if (rankingRow) {
        ranking.push(rankingRow);
      } else if (cleanBullet) {
        bullets.push(cleanBullet);
      }
      continue;
    }
    if (!primary) {
      primary = stripAskMarkdownInline(trimmed);
      continue;
    }
    currentParagraph.push(trimmed);
  }
  flushParagraph();

  const primaryRanking = parseAskPrimaryRanking(primary);
  if (primaryRanking && !ranking.some((row) => normalizeAskContent(row.name) === normalizeAskContent(primaryRanking.name))) {
    ranking.unshift(primaryRanking);
    ranking.forEach((row, index) => {
      row.rank = index + 1;
    });
  }

  const scopeIndex = paragraphs.findIndex(isAskScopeSentence);
  const scope = scopeIndex >= 0 ? paragraphs.splice(scopeIndex, 1)[0] : undefined;
  const notes = paragraphs.filter(isAskDataNoteSentence);
  const explanation = paragraphs.filter((paragraph) => !isAskDataNoteSentence(paragraph));

  return {
    primary,
    scope,
    ranking,
    valueLabel: inferAskRankingValueLabel(content),
    explanation,
    notes,
    bullets,
  };
}

function parseAskRankingLine(value: string, rank: number): AskClubhouseTextRankingRow | undefined {
  const match = value.match(/^(.+?)\s*:\s*([0-9][\d.,%]*(?:\s*[A-Za-z%]+)?)$/);
  if (!match) return undefined;
  // Named metric bullets are not player leaderboard entries.
  if (/^(?:contact(?: percentage|%)?|hard contact|(?:(?:avg|average|max|maximum) )?(?:exit velocity|ev|velocity)|strike(?: percentage|%)?|swings?|pitches?|whiffs?|chase(?: percentage|%)?)$/i.test(match[1].trim())) return undefined;
  return {
    rank,
    initials: getAskInitials(match[1]),
    name: match[1].trim(),
    value: match[2].trim(),
  };
}

function parseAskPrimaryRanking(primary: string): AskClubhouseTextRankingRow | undefined {
  const match = primary.match(/^([A-Z][A-Za-z.' -]+?)\s+(?:had|has|took|leads|led|recorded|finished)\b.+?:\s*([0-9][^.]+?)(?:\.|$)/);
  if (!match) return undefined;
  return {
    rank: 1,
    initials: getAskInitials(match[1]),
    name: match[1].trim(),
    value: match[2].trim(),
  };
}

function inferAskRankingValueLabel(content: string): string {
  const normalized = content.toLowerCase();
  if (normalized.includes("contact")) return "Contact";
  if (normalized.includes("exit velocity") || normalized.includes("avg ev") || normalized.includes(" ev")) return "EV";
  if (normalized.includes("hard")) return "Hard %";
  if (normalized.includes("rep")) return "Reps";
  if (normalized.includes("swing")) return "Swings";
  if (normalized.includes("strike")) return "Strike %";
  return "Value";
}

function getAskInitials(name: string): string {
  const parts = name
    .replace(/[^A-Za-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "C9";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function isAskScopeSentence(value: string): boolean {
  return /\b(based on|available data covers|tracked swings|tracked events|players|practices|fall 20\d{2}|season)\b/i.test(value);
}

function isAskDataNoteSentence(value: string): boolean {
  return /\b(not enough|does not|doesn't|cannot|can't|limitation|sample|confidently|reliably)\b/i.test(value);
}

function formatAskActionLabel(label: string): string {
  const cleanLabel = stripAskMarkdownInline(label);
  if (/^open hitting analytics$/i.test(cleanLabel)) return "View Hitting Analytics";
  if (/^open analytics$/i.test(cleanLabel)) return "View Analytics";
  return cleanLabel.replace(/^Open\s+/i, "View ");
}

function isAskSetupMessage(message: AskClubhouseChatMessage): boolean {
  return message.status === "unavailable" && normalizeAskContent(message.content).includes("ask clubhouse is finishing setup");
}

function formatAskMessageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
