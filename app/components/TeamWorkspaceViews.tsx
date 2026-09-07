"use client";
import {
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Columns3,
  Dumbbell,
  Handshake,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Trophy,
  Users,
  X
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnalyticsPlayerMetrics } from "../components/AnalyticsPlayerMetrics";
import { AskClubhouseLauncher } from "../components/AskClubhouseDrawer";
import { ChoiceSelect, type ChoiceOption } from "../components/ChoiceSelect";
import { ClubhouseBaseballField } from "../components/ClubhouseBaseballField";
import { DensePlayerIdentity } from "../components/DensePlayerIdentity";
import { ScheduleAgendaRow } from "../components/ScheduleAgendaRow";
import { PlayerAvatar } from "../components/visuals";
import {
  analyticsMetricColumnGroup,
  analyticsPresetsForDomain,
  analyticsSourcesForDomain,
  analyticsPresetColumnIds as catalogPresetColumnIds,
  defaultAnalyticsMetricIds,
  normalizeAnalyticsView,
  serializeAnalyticsContext,
  type AnalyticsColumnPreset,
  type AnalyticsViewId,
} from "../lib/analyticsCatalog";
import { buildAnalyticsInsights } from "../lib/analyticsInsights";
import {
  analyticsEventSummary,
  defaultAnalyticsSort,
  executeAnalyticsQuery,
  type AnalyticsCell,
  type AnalyticsColumn,
  type AnalyticsDevelopmentView,
  type AnalyticsDomain,
  type AnalyticsEventOption,
  type AnalyticsFieldSource,
  type AnalyticsFilterDefinition,
  type AnalyticsFilters,
  type AnalyticsMode,
  type AnalyticsQuery,
  type AnalyticsResult,
  type AnalyticsRow,
  type AnalyticsSource,
  type AnalyticsTimeRange,
} from "../lib/analyticsQuery";
import {
  formatDecimal,
  fullDate,
  shortDate
} from "../lib/stats";
import type {
  AppData,
  Game,
  ID,
  PitchLocationGridZoneId,
  PitchLocationZoneId,
  Player,
  ScheduleEvent,
  ScheduleEventStatus,
  ScheduleEventType,
  ScheduleEventVisibility,
  TeamOption,
  WorkoutSession,
  ZonePoint
} from "../types";
export type ViewKey = "home" | "organizations" | "teams" | "following" | "discover" | "teamHome" | "schedule" | "roster" | "practice" | "weights" | "games" | "analytics" | "profile" | "account" | "teamSettings";

export type ScheduleViewMode = "Calendar" | "Week" | "Agenda";

export type ScheduleSource = "practice" | "game" | "lift" | "event";

export type ScheduleEventFilter = "All" | ScheduleEventType;

export interface ScheduleItem {
  id: ID;
  source: ScheduleSource;
  sourceId: ID;
  eventType: ScheduleEventType;
  title: string;
  startAt: string;
  endAt?: string;
  date: string;
  location?: string;
  notes?: string;
  visibility: ScheduleEventVisibility;
  status: ScheduleEventStatus;
  accent: string;
}

export type PracticeChartMetricMode = "heat" | "dots" | "percent" | "count" | "average";

export type PitchLocationGridAxis = 1 | 2 | 3 | 4 | 5;

export type PitchLocationBucket = {
  id: PitchLocationGridZoneId;
  x: number;
  y: number;
  row: PitchLocationGridAxis;
  column: PitchLocationGridAxis;
  isZone: boolean;
  isCorner: boolean;
};

export const PITCH_LOCATION_BUCKETS: PitchLocationBucket[] = [
  { id: "pitch_r1c1", x: 0.1, y: 0.1, row: 1, column: 1, isZone: false, isCorner: true },
  { id: "pitch_r1c2", x: 0.3, y: 0.1, row: 1, column: 2, isZone: false, isCorner: false },
  { id: "pitch_r1c3", x: 0.5, y: 0.1, row: 1, column: 3, isZone: false, isCorner: false },
  { id: "pitch_r1c4", x: 0.7, y: 0.1, row: 1, column: 4, isZone: false, isCorner: false },
  { id: "pitch_r1c5", x: 0.9, y: 0.1, row: 1, column: 5, isZone: false, isCorner: true },
  { id: "pitch_r2c1", x: 0.1, y: 0.3, row: 2, column: 1, isZone: false, isCorner: false },
  { id: "pitch_r2c2", x: 0.3, y: 0.3, row: 2, column: 2, isZone: true, isCorner: false },
  { id: "pitch_r2c3", x: 0.5, y: 0.3, row: 2, column: 3, isZone: true, isCorner: false },
  { id: "pitch_r2c4", x: 0.7, y: 0.3, row: 2, column: 4, isZone: true, isCorner: false },
  { id: "pitch_r2c5", x: 0.9, y: 0.3, row: 2, column: 5, isZone: false, isCorner: false },
  { id: "pitch_r3c1", x: 0.1, y: 0.5, row: 3, column: 1, isZone: false, isCorner: false },
  { id: "pitch_r3c2", x: 0.3, y: 0.5, row: 3, column: 2, isZone: true, isCorner: false },
  { id: "pitch_r3c3", x: 0.5, y: 0.5, row: 3, column: 3, isZone: true, isCorner: false },
  { id: "pitch_r3c4", x: 0.7, y: 0.5, row: 3, column: 4, isZone: true, isCorner: false },
  { id: "pitch_r3c5", x: 0.9, y: 0.5, row: 3, column: 5, isZone: false, isCorner: false },
  { id: "pitch_r4c1", x: 0.1, y: 0.7, row: 4, column: 1, isZone: false, isCorner: false },
  { id: "pitch_r4c2", x: 0.3, y: 0.7, row: 4, column: 2, isZone: true, isCorner: false },
  { id: "pitch_r4c3", x: 0.5, y: 0.7, row: 4, column: 3, isZone: true, isCorner: false },
  { id: "pitch_r4c4", x: 0.7, y: 0.7, row: 4, column: 4, isZone: true, isCorner: false },
  { id: "pitch_r4c5", x: 0.9, y: 0.7, row: 4, column: 5, isZone: false, isCorner: false },
  { id: "pitch_r5c1", x: 0.1, y: 0.9, row: 5, column: 1, isZone: false, isCorner: true },
  { id: "pitch_r5c2", x: 0.3, y: 0.9, row: 5, column: 2, isZone: false, isCorner: false },
  { id: "pitch_r5c3", x: 0.5, y: 0.9, row: 5, column: 3, isZone: false, isCorner: false },
  { id: "pitch_r5c4", x: 0.7, y: 0.9, row: 5, column: 4, isZone: false, isCorner: false },
  { id: "pitch_r5c5", x: 0.9, y: 0.9, row: 5, column: 5, isZone: false, isCorner: true },
];

export const LEGACY_PITCH_LOCATION_ID_MAP: Partial<Record<PitchLocationZoneId, PitchLocationGridZoneId>> = {
  outside_up_arm: "pitch_r1c2",
  outside_up_middle: "pitch_r1c3",
  outside_up_glove: "pitch_r1c4",
  outside_arm_high: "pitch_r2c1",
  zone_high_arm: "pitch_r2c2",
  zone_high_middle: "pitch_r2c3",
  zone_high_glove: "pitch_r2c4",
  outside_glove_high: "pitch_r2c5",
  outside_arm_middle: "pitch_r3c1",
  zone_middle_arm: "pitch_r3c2",
  zone_middle_middle: "pitch_r3c3",
  zone_middle_glove: "pitch_r3c4",
  outside_glove_middle: "pitch_r3c5",
  outside_arm_low: "pitch_r4c1",
  zone_low_arm: "pitch_r4c2",
  zone_low_middle: "pitch_r4c3",
  zone_low_glove: "pitch_r4c4",
  outside_glove_low: "pitch_r4c5",
  outside_down_arm: "pitch_r5c2",
  outside_down_middle: "pitch_r5c3",
  outside_down_glove: "pitch_r5c4",
};

export const SCHEDULE_EVENT_TYPES: ScheduleEventType[] = ["Game", "Practice", "Lift", "Scrimmage", "Tournament", "Other"];

export const SCHEDULE_EVENT_ACCENTS: Record<ScheduleEventType, string> = {
  Game: "game",
  Practice: "practice",
  Lift: "lift",
  Scrimmage: "scrimmage",
  Meeting: "meeting",
  "Team Event": "team-event",
  Tournament: "tournament",
  Other: "other",
};

export type SvgIconProps = React.SVGProps<SVGSVGElement> & { size?: number | string };

export function BaseballIcon(props: SvgIconProps) {
  // eslint-disable-next-line react/prop-types
  const { size = 18, className, ...svgProps } = props;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...svgProps}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M7.5 4.5c2.2 2.2 3.4 4.7 3.4 7.5s-1.2 5.3-3.4 7.5" />
      <path d="M16.5 4.5c-2.2 2.2-3.4 4.7-3.4 7.5s1.2 5.3 3.4 7.5" />
      <path d="M8.2 7.8h2.1M8.8 10.2h2.1M8.8 13.8h2.1M8.2 16.2h2.1" />
      <path d="M13.7 7.8h2.1M13.1 10.2h2.1M13.1 13.8h2.1M13.7 16.2h2.1" />
    </svg>
  );
}

export function ScheduleView({
  data,
  onAddEvent,
  onView,
  onOpenGame,
  onUpdateScheduleEvent,
}: {
  data: AppData;
  onAddEvent?: (date?: string) => void;
  onView?: (view: ViewKey) => void;
  onOpenGame?: (gameId: ID) => void;
  onUpdateScheduleEvent?: (event: ScheduleEvent) => void;
}) {
  const [mode, setMode] = useState<ScheduleViewMode>(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches ? "Agenda" : "Calendar",
  );
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);
  const [eventFilter, setEventFilter] = useState<ScheduleEventFilter>("All");
  const items = useMemo(() => buildScheduleItems(data), [data]);
  const visibleItems = useMemo(
    () => eventFilter === "All" ? items : items.filter((item) => item.eventType === eventFilter),
    [eventFilter, items],
  );
  const upcomingItems = visibleItems.filter((item) => isUpcomingScheduleItem(item) && item.status !== "Cancelled").slice(0, 6);
  const cursorMonthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const selectedVisibleItem = selectedItem && visibleItems.some((item) => item.id === selectedItem.id) ? selectedItem : null;
  const filterOptions: ChoiceOption[] = useMemo(() => [
    { value: "All", label: "All Events", icon: <CalendarDays size={15} aria-hidden="true" /> },
    ...SCHEDULE_EVENT_TYPES.map((type) => ({ value: type, label: type, icon: <ScheduleTypeIcon type={type} /> })),
  ], []);

  function moveCursor(amount: number) {
    setCursor((current) => {
      const next = new Date(current);
      if (mode === "Week") next.setDate(next.getDate() + amount * 7);
      else next.setMonth(next.getMonth() + amount);
      return next;
    });
  }

  return (
    <div className="page-stack schedule-page">
      <SectionHeader
        title="Schedule"
        context={teamContextLine(data.teamContext?.currentTeam)}
        action={onAddEvent && (
          <button type="button" className="primary-button" onClick={() => onAddEvent()}>
            <CalendarPlus size={16} aria-hidden="true" />
            Add Event
          </button>
        )}
      />

      <section className="panel schedule-toolbar">
        <div className="schedule-toolbar__date">
          <button type="button" className="icon-button schedule-period-button" onClick={() => moveCursor(-1)} aria-label="Previous period"><ChevronLeft size={17} aria-hidden="true" /></button>
          <strong>{mode === "Week" ? weekRangeLabel(cursor) : cursorMonthLabel}</strong>
          <button type="button" className="icon-button schedule-period-button" onClick={() => moveCursor(1)} aria-label="Next period"><ChevronRight size={17} aria-hidden="true" /></button>
        </div>
        <div className="schedule-toolbar__controls">
          <ChoiceSelect
            value={eventFilter}
            className="schedule-filter-choice"
            options={filterOptions}
            onChange={(value) => {
              setEventFilter(value as ScheduleEventFilter);
              setSelectedItem(null);
            }}
            aria-label="Filter schedule by event type"
            mobilePresentation="popover"
          />
          <SegmentedControl values={["Calendar", "Week", "Agenda"] as ScheduleViewMode[]} active={mode} onChange={setMode} />
          <button type="button" className="secondary-button" onClick={() => setCursor(new Date())}>Today</button>
        </div>
      </section>

      <section className="schedule-layout">
        <div className="schedule-main">
          {mode === "Calendar" && <ScheduleMonthView cursor={cursor} items={visibleItems} onSelect={setSelectedItem} onAddEvent={onAddEvent} />}
          {mode === "Week" && <ScheduleWeekView cursor={cursor} items={visibleItems} onSelect={setSelectedItem} />}
          {mode === "Agenda" && <ScheduleAgendaView items={visibleItems} onSelect={setSelectedItem} />}
        </div>
        <aside className="schedule-side">
          <article className="panel schedule-next-card">
            <div className="panel-heading tight">
              <div>
                <span>Next Up</span>
                <h2>Upcoming</h2>
              </div>
              <button type="button" className="text-button" onClick={() => setMode("Agenda")}>Agenda</button>
            </div>
            {upcomingItems.length ? upcomingItems.map((item) => (
              <button key={item.id} type="button" className="schedule-mini-row" onClick={() => setSelectedItem(item)}>
                <ScheduleTypeIcon type={item.eventType} />
                <span>
                  <strong>{item.title}</strong>
                  <small>{shortDate(item.date)} · {formatTime(item.startAt)}</small>
                </span>
              </button>
            )) : (
              <CompactEmpty title="No events scheduled yet." />
            )}
          </article>
          <ScheduleDetailCard
            data={data}
            item={selectedVisibleItem}
            onClose={() => setSelectedItem(null)}
            onView={onView}
            onOpenGame={onOpenGame}
            onUpdateScheduleEvent={onUpdateScheduleEvent}
          />
        </aside>
      </section>
    </div>
  );
}

export function ScheduleMonthView({
  cursor,
  items,
  onSelect,
  onAddEvent,
}: {
  cursor: Date;
  items: ScheduleItem[];
  onSelect: (item: ScheduleItem) => void;
  onAddEvent?: (date?: string) => void;
}) {
  const days = calendarDaysForMonth(cursor);
  const currentMonth = cursor.getMonth();
  return (
    <article className="panel schedule-calendar">
      <div className="schedule-calendar__weekdays">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="schedule-calendar__grid">
        {days.map((date) => {
          const dateKey = isoDate(date);
          const dayItems = items.filter((item) => item.date === dateKey);
          return (
            <div
              key={dateKey}
              className={`schedule-day ${date.getMonth() !== currentMonth ? "schedule-day--muted" : ""} ${isToday(dateKey) ? "schedule-day--today" : ""}`}
              onDoubleClick={(event) => {
                if ((event.target as HTMLElement).closest("button")) return;
                onAddEvent?.(dateKey);
              }}
            >
              <span className="schedule-day__number">{date.getDate()}</span>
              <div className="schedule-day__events">
                {dayItems.slice(0, 3).map((item) => (
                  <button key={item.id} type="button" className={`schedule-chip schedule-chip--${item.accent}`} onClick={() => onSelect(item)}>
                    <small>{formatTime(item.startAt)}</small>
                    <span>{item.title}</span>
                  </button>
                ))}
                {dayItems.length > 3 && <em>+{dayItems.length - 3} more</em>}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export function ScheduleWeekView({ cursor, items, onSelect }: { cursor: Date; items: ScheduleItem[]; onSelect: (item: ScheduleItem) => void }) {
  const days = weekDates(cursor);
  return (
    <article className="panel schedule-week">
      {days.map((date) => {
        const dateKey = isoDate(date);
        const dayItems = items.filter((item) => item.date === dateKey);
        return (
          <section key={dateKey} className={`schedule-week-day ${isToday(dateKey) ? "schedule-week-day--today" : ""}`}>
            <header>
              <strong>{date.toLocaleDateString("en-US", { weekday: "short" })}</strong>
              <span>{date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            </header>
            <div>
              {dayItems.length ? dayItems.map((item) => (
                <button key={item.id} type="button" className={`schedule-week-event schedule-chip--${item.accent}`} onClick={() => onSelect(item)}>
                  <small>{formatTime(item.startAt)}</small>
                  <strong>{item.title}</strong>
                  {item.location && <em>{item.location}</em>}
                </button>
              )) : <span className="schedule-week-empty">No events</span>}
            </div>
          </section>
        );
      })}
    </article>
  );
}

export function ScheduleAgendaView({ items, onSelect }: { items: ScheduleItem[]; onSelect: (item: ScheduleItem) => void }) {
  const upcoming = items.filter((item) => !isPastScheduleItem(item) || item.status !== "Completed").slice(0, 30);
  const groups = groupScheduleItemsByDate(upcoming.length ? upcoming : items.slice(0, 20));
  return (
    <article className="panel schedule-agenda">
      {groups.length ? groups.map((group) => (
        <section key={group.date} className="schedule-agenda-group">
          <h3>{agendaDateLabel(group.date)}</h3>
          {group.items.map((item) => (
            <ScheduleAgendaRow key={item.id} title={item.title} time={formatTime(item.startAt)} type={item.eventType} location={item.location} status={item.status} icon={<ScheduleTypeIcon type={item.eventType} />} onSelect={() => onSelect(item)} />
          ))}
        </section>
      )) : (
        <CompactEmpty title="No events scheduled yet." />
      )}
    </article>
  );
}

export function ScheduleDetailCard({
  data,
  item,
  onClose,
  onView,
  onOpenGame,
  onUpdateScheduleEvent,
}: {
  data: AppData;
  item: ScheduleItem | null;
  onClose: () => void;
  onView?: (view: ViewKey) => void;
  onOpenGame?: (gameId: ID) => void;
  onUpdateScheduleEvent?: (event: ScheduleEvent) => void;
}) {
  if (!item) {
    return (
      <article className="panel schedule-detail-card">
        <CompactEmpty title="Select an event to see details." />
      </article>
    );
  }
  const genericEvent = item.source === "event" ? (data.scheduleEvents ?? []).find((event) => event.id === item.sourceId) : undefined;
  return (
    <article className="panel schedule-detail-card">
      <button className="icon-button schedule-detail-card__close" type="button" onClick={onClose} aria-label="Close event details">
        <X size={16} aria-hidden="true" />
      </button>
      <div className="schedule-detail-card__top">
        <ScheduleTypeIcon type={item.eventType} />
        <span>
          <small>{item.eventType}</small>
          <strong>{item.title}</strong>
        </span>
        <em className={`schedule-status schedule-status--${item.status.toLowerCase()}`}>{item.status}</em>
      </div>
      <div className="schedule-detail-list">
        <span><CalendarDays size={15} aria-hidden="true" />{fullDate(item.date)}</span>
        <span><ClockIcon />{formatTime(item.startAt)}{item.endAt ? ` - ${formatTime(item.endAt)}` : ""}</span>
        {item.location && <span><MapPin size={15} aria-hidden="true" />{item.location}</span>}
        {item.notes && <p>{item.notes}</p>}
      </div>
      <div className="schedule-detail-actions">
        {item.source === "practice" && onView && <button type="button" className="primary-button" onClick={() => onView("practice")}>Open Practice</button>}
        {item.source === "game" && onOpenGame && <button type="button" className="primary-button" onClick={() => onOpenGame(item.sourceId)}>View Game</button>}
        {item.source === "lift" && onView && <button type="button" className="primary-button" onClick={() => onView("weights")}>Open Weight Room</button>}
        {genericEvent && onUpdateScheduleEvent && genericEvent.status !== "Cancelled" && (
          <button type="button" className="secondary-button" onClick={() => onUpdateScheduleEvent({ ...genericEvent, status: "Cancelled", updatedAt: new Date().toISOString() })}>
            Cancel Event
          </button>
        )}
      </div>
    </article>
  );
}

export function ScheduleTypeIcon({ type }: { type: ScheduleEventType }) {
  const className = `schedule-type-icon schedule-type-icon--${SCHEDULE_EVENT_ACCENTS[type]}`;
  if (type === "Practice") return <span className={className}><ClipboardList size={16} aria-hidden="true" /></span>;
  if (type === "Game") return <span className={className}><BaseballIcon size={16} aria-hidden="true" /></span>;
  if (type === "Lift") return <span className={className}><Dumbbell size={16} aria-hidden="true" /></span>;
  if (type === "Scrimmage") return <span className={className}><Swords size={16} aria-hidden="true" /></span>;
  if (type === "Tournament") return <span className={className}><Trophy size={16} aria-hidden="true" /></span>;
  if (type === "Meeting" || type === "Team Event") return <span className={className}><Handshake size={16} aria-hidden="true" /></span>;
  if (type === "Other") return <span className={className}><Sparkles size={16} aria-hidden="true" /></span>;
  return <span className={className}><CalendarDays size={16} aria-hidden="true" /></span>;
}

export function ClockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function chartMetricModeLabel(mode: PracticeChartMetricMode) {
  if (mode === "dots") return "Spray";
  if (mode === "percent") return "%";
  if (mode === "count") return "#";
  if (mode === "average") return "AVG";
  return "Heat";
}

export function normalizePitchLocationZoneId(zoneId?: PitchLocationZoneId): PitchLocationGridZoneId | undefined {
  if (!zoneId) return undefined;
  if (PITCH_LOCATION_BUCKETS.some((bucket) => bucket.id === zoneId)) return zoneId as PitchLocationGridZoneId;
  return LEGACY_PITCH_LOCATION_ID_MAP[zoneId];
}

export function pitchLocationBucketFromPoint(point?: ZonePoint): PitchLocationBucket | undefined {
  if (!point) return undefined;
  if (point.zoneId) {
    const normalizedId = normalizePitchLocationZoneId(point.zoneId);
    const exact = PITCH_LOCATION_BUCKETS.find((bucket) => bucket.id === normalizedId);
    if (exact) return exact;
  }
  return PITCH_LOCATION_BUCKETS
    .map((bucket) => ({
      bucket,
      distance: Math.hypot(point.x - bucket.x, point.y - bucket.y),
    }))
    .sort((left, right) => left.distance - right.distance)[0]?.bucket;
}

export function AnalyticsView({
  data,
  onOpenPlayer,
  onAsk,
  playerScope,
  initialQuery,
}: {
  data: AppData;
  onOpenPlayer?: (playerId: ID) => void;
  onAsk: (analytics: Partial<AnalyticsQuery>) => void;
  playerScope?: { playerId: ID };
  initialQuery?: Partial<AnalyticsQuery>;
}) {
  const [initialState] = useState(() => {
    const route = readInitialAnalyticsState();
    if (!initialQuery) return route;
    const domain = initialQuery.domain ?? route.domain;
    const source = initialQuery.source ?? route.source;
    return { ...route, domain, source,
      fieldSources: initialQuery.fieldSources ?? analyticsFieldSourcesForSource(domain, source),
      timeRange: initialQuery.timeRange ?? route.timeRange,
      customRange: initialQuery.customDateRange ?? route.customRange,
      filters: initialQuery.filters ?? route.filters,
      eventIds: initialQuery.eventIds ?? route.eventIds,
      workspace: domain === "development" ? "overview" as const : route.workspace,
    };
  });
  const [domain, setDomain] = useState<AnalyticsDomain>(initialState.domain);
  const [source, setSource] = useState<AnalyticsSource>(initialState.source);
  const [fieldSources, setFieldSources] = useState<AnalyticsFieldSource[]>(initialState.fieldSources);
  const mode: AnalyticsMode = "box-score";
  const [analyticsView, setAnalyticsView] = useState<AnalyticsViewId>(initialState.analyticsView);
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>(initialState.timeRange);
  const [developmentView, setDevelopmentView] = useState<AnalyticsDevelopmentView>(initialState.developmentView);
  const [eventIds, setEventIds] = useState<ID[]>(initialState.eventIds);
  const [customRange, setCustomRange] = useState<{ start?: string; end?: string }>(initialState.customRange);
  const [filters, setFilters] = useState<AnalyticsFilters>(initialState.filters);
  const [stagedFilters, setStagedFilters] = useState<AnalyticsFilters>(initialState.filters);
  const [sort, setSort] = useState<AnalyticsQuery["sort"]>(() => initialState.sort ?? defaultAnalyticsSort(initialState.domain, initialState.source, initialState.mode));
  const [eventSelectorOpen, setEventSelectorOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [detailPlayerId, setDetailPlayerId] = useState<ID | undefined>(() => readInitialAnalyticsDetailPlayerId(data));
  const [metricIds, setMetricIds] = useState<string[] | undefined>(initialState.metricIds);
  const [columnPreset, setColumnPreset] = useState<AnalyticsColumnPreset>(initialState.columnPreset);
  const [analyticsWorkspace, setAnalyticsWorkspace] = useState<"overview" | "charts" | "insights">(initialState.workspace);
  const [chartSurface, setChartSurface] = useState<"spray" | "location">("spray");
  const [chartMode, setChartMode] = useState<PracticeChartMetricMode>("heat");
  const [chartPlayerIds, setChartPlayerIds] = useState<ID[]>([]);
  const context = useMemo(() => ({
    teamId: data.teamContext?.currentTeam?.teamId,
    seasonId: data.teamContext?.currentTeam?.seasonId,
    organizationId: data.teamContext?.currentTeam?.organizationId,
    role: data.teamContext?.currentTeam?.role,
  }), [data.teamContext?.currentTeam]);
  const query = useMemo<AnalyticsQuery>(() => ({
    domain,
    source: domain === "development" ? "all" : source,
    fieldSources: domain === "development" ? undefined : fieldSources,
    mode: domain === "development" ? "box-score" : mode,
    view: analyticsView,
    timeRange,
    developmentView,
    customDateRange: customRange,
    eventIds,
    // Player datasets are server-projected; retain the approved identity even with altered URL filters.
    playerIds: playerScope ? [playerScope.playerId] : analyticsWorkspace === "charts" && chartPlayerIds.length ? chartPlayerIds : undefined,
    filters,
    metrics: metricIds ?? defaultAnalyticsMetricIds(domain, domain === "development" ? "all" : source, domain === "development" ? undefined : fieldSources),
    groupBy: "player",
    sort,
    context,
  }), [analyticsView, analyticsWorkspace, chartPlayerIds, context, customRange, developmentView, domain, eventIds, fieldSources, filters, metricIds, mode, sort, source, timeRange, playerScope]);
  const result = useMemo(() => executeAnalyticsQuery(data, query), [data, query]);
  const serializedAnalyticsContext = useMemo(
    () => serializeAnalyticsContext(query, result.columns.map((column) => column.metricId)),
    [query, result.columns],
  );
  const selectedDetailRow = detailPlayerId ? result.rows.find((row) => row.player.id === detailPlayerId) : undefined;
  const activeFilterCount = Object.values(filters).reduce((total, value) => total + (Array.isArray(value) ? value.length : typeof value === "number" ? 1 : 0), 0);
  const activeFilterSummary = useMemo(
    () => result.filterDefinitions.flatMap((definition) => {
      if (definition.type === "range") {
        if (filters.pitchVelocityMin === undefined && filters.pitchVelocityMax === undefined) return [];
        const label = filters.pitchVelocityMin !== undefined && filters.pitchVelocityMax !== undefined
          ? `${filters.pitchVelocityMin}-${filters.pitchVelocityMax} mph`
          : filters.pitchVelocityMin !== undefined ? `${filters.pitchVelocityMin}+ mph` : `Up to ${filters.pitchVelocityMax} mph`;
        return [{ id: definition.id, value: "range", label }];
      }
      const values = (filters[definition.id] as string[] | undefined) ?? [];
      return values.map((value) => ({ id: definition.id, value, label: definition.options.find((option) => option.value === value)?.label ?? value }));
    }),
    [filters, result.filterDefinitions],
  );
  const analyticsFieldSourceOptions = analyticsSourcesForDomain(domain === "development" ? "hitting" : domain).filter((candidate): candidate is AnalyticsFieldSource => candidate !== "all");
  const analyticsEventTriggerLabel = eventIds.length
    ? analyticsEventSummary(eventIds, result.availableEvents)
    : timeRange === "7d" ? "Last 7 Days" : timeRange === "30d" ? "Last 30 Days" : "All Events";
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("view", "analytics");
    url.searchParams.set("domain", domain);
    url.searchParams.set("source", domain === "development" ? "all" : source);
    if (domain !== "development" && fieldSources.length > 1) url.searchParams.set("sources", fieldSources.join(","));
    else url.searchParams.delete("sources");
    url.searchParams.delete("mode");
    url.searchParams.set("statView", analyticsView);
    if (playerScope) {
      url.searchParams.set("workspace", "player");
      url.searchParams.set("analyticsWorkspace", analyticsWorkspace);
    } else if (analyticsWorkspace !== "overview") url.searchParams.set("workspace", analyticsWorkspace);
    else url.searchParams.delete("workspace");
    url.searchParams.delete("insightsDomain");
    url.searchParams.set("period", timeRange);
    if (developmentView !== "overview") url.searchParams.set("dev", developmentView);
    else url.searchParams.delete("dev");
    if (eventIds.length) url.searchParams.set("events", eventIds.join(","));
    else url.searchParams.delete("events");
    if (metricIds?.length) url.searchParams.set("columns", metricIds.join(","));
    else url.searchParams.delete("columns");
    if (columnPreset !== "standard") url.searchParams.set("columnPreset", columnPreset);
    else url.searchParams.delete("columnPreset");
    if (sort?.metricId) {
      url.searchParams.set("sort", sort.metricId);
      url.searchParams.set("dir", sort.direction);
    } else {
      url.searchParams.delete("sort");
      url.searchParams.delete("dir");
    }
    const encodedFilters = encodeAnalyticsFilters(filters);
    if (encodedFilters) url.searchParams.set("filters", encodedFilters);
    else url.searchParams.delete("filters");
    if (timeRange === "custom" && customRange.start) url.searchParams.set("start", customRange.start);
    else url.searchParams.delete("start");
    if (timeRange === "custom" && customRange.end) url.searchParams.set("end", customRange.end);
    else url.searchParams.delete("end");
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) window.history.replaceState({}, "", nextUrl);
  }, [analyticsView, analyticsWorkspace, columnPreset, customRange.end, customRange.start, developmentView, domain, eventIds, fieldSources, filters, metricIds, sort, source, timeRange, playerScope]);

  useEffect(() => {
    const handleAnalyticsPopState = () => {
      const next = readInitialAnalyticsState();
      setDomain(next.domain);
      setSource(next.source);
      setFieldSources(next.fieldSources);
      setAnalyticsView(next.analyticsView);
      setAnalyticsWorkspace(next.workspace);
      setTimeRange(next.timeRange);
      setDevelopmentView(next.developmentView);
      setEventIds(next.eventIds);
      setCustomRange(next.customRange);
      setFilters(next.filters);
      setStagedFilters(next.filters);
      setSort(next.sort ?? defaultAnalyticsSort(next.domain, next.source, next.mode));
      setMetricIds(next.metricIds);
      setColumnPreset(next.columnPreset);
      setDetailPlayerId(readInitialAnalyticsDetailPlayerId(data));
      setEventSelectorOpen(false);
      setFiltersOpen(false);
      setColumnsOpen(false);
    };
    window.addEventListener("popstate", handleAnalyticsPopState);
    return () => window.removeEventListener("popstate", handleAnalyticsPopState);
  }, [data]);

  function handleDomain(nextDomain: AnalyticsDomain) {
    setDomain(nextDomain);
    const supportedSources = analyticsSourcesForDomain(nextDomain).filter((candidate): candidate is AnalyticsFieldSource => candidate !== "all");
    const nextFieldSources = nextDomain === "development"
      ? fieldSources
      : fieldSources.filter((candidate) => supportedSources.includes(candidate)).length
        ? normalizeAnalyticsFieldSources(fieldSources.filter((candidate) => supportedSources.includes(candidate)))
        : [supportedSources[0] ?? "practice"];
    const nextSource = nextDomain === "development" ? "all" : analyticsSourceFromFieldSources(nextFieldSources);
    setSource(nextSource);
    setFieldSources(nextFieldSources);
    setAnalyticsView(normalizeAnalyticsView(nextDomain, nextSource));
    if (nextDomain === "development") {
      setDevelopmentView("weight-room");
      setAnalyticsWorkspace("overview");
    }
    setFilters({});
    setStagedFilters({});
    setMetricIds(undefined);
    setColumnPreset("standard");
    setSort(defaultAnalyticsSort(nextDomain, nextSource, "box-score"));
  }

  function openInsightDrill(queryPatch: Partial<AnalyticsQuery>) {
    const nextDomain = queryPatch.domain ?? domain;
    const nextFieldSources = queryPatch.fieldSources?.length
      ? normalizeAnalyticsFieldSources(queryPatch.fieldSources)
      : fieldSources;
    setDomain(nextDomain);
    setSource(queryPatch.source ?? analyticsSourceFromFieldSources(nextFieldSources));
    setFieldSources(nextFieldSources);
    setTimeRange(queryPatch.timeRange ?? timeRange);
    setCustomRange(queryPatch.customDateRange ?? customRange);
    setEventIds(queryPatch.eventIds ?? eventIds);
    setFilters(queryPatch.filters ?? filters);
    setStagedFilters(queryPatch.filters ?? filters);
    setMetricIds(queryPatch.metrics);
    setColumnPreset(queryPatch.metrics?.length ? "custom" : "standard");
    setAnalyticsView(queryPatch.view ?? "overview");
    setSort(queryPatch.sort ?? defaultAnalyticsSort(nextDomain, queryPatch.source ?? analyticsSourceFromFieldSources(nextFieldSources), "box-score"));
    setAnalyticsWorkspace("overview");
    setEventSelectorOpen(false);
    setFiltersOpen(false);
    setColumnsOpen(false);
  }

  function handleFieldSources(nextFieldSources: AnalyticsFieldSource[]) {
    if (!nextFieldSources.length) return;
    const normalizedFieldSources = normalizeAnalyticsFieldSources(nextFieldSources);
    const nextSource = analyticsSourceFromFieldSources(normalizedFieldSources);
    setSource(nextSource);
    setFieldSources(normalizedFieldSources);
    setFilters({});
    setStagedFilters({});
    setEventIds([]);
    setMetricIds(undefined);
    setColumnPreset("standard");
    setAnalyticsView(normalizeAnalyticsView(domain, nextSource, analyticsView));
    setSort(defaultAnalyticsSort(domain, nextSource, "box-score"));
  }

  function handleFieldSourceToggle(nextFieldSource: AnalyticsFieldSource) {
    if (domain === "development") {
      setDomain("hitting");
      setSource(nextFieldSource);
      setFieldSources([nextFieldSource]);
      setDevelopmentView("overview");
      setFilters({});
      setStagedFilters({});
      setEventIds([]);
      setMetricIds(undefined);
      setColumnPreset("standard");
      setAnalyticsView(normalizeAnalyticsView("hitting", nextFieldSource));
      setSort(defaultAnalyticsSort("hitting", nextFieldSource, "box-score"));
      setAnalyticsWorkspace("overview");
      return;
    }
    const nextFieldSources = fieldSources.includes(nextFieldSource)
      ? fieldSources.filter((sourceItem) => sourceItem !== nextFieldSource)
      : [...fieldSources, nextFieldSource];
    handleFieldSources(nextFieldSources);
  }

  function handleSort(metricId: string) {
    setSort((current) => {
      if (current?.metricId === metricId) return { metricId, direction: current.direction === "asc" ? "desc" : "asc" };
      return { metricId, direction: metricId === "player" ? "asc" : "desc" };
    });
  }

  function toggleEvent(eventId: ID) {
    setEventIds((current) => current.includes(eventId) ? current.filter((id) => id !== eventId) : [...current, eventId]);
  }

  function toggleStagedFilter(definition: AnalyticsFilterDefinition, value: string) {
    if (definition.type === "range") return;
    setStagedFilters((current) => {
      const currentValues = new Set(((current[definition.id] as string[] | undefined) ?? []));
      if (currentValues.has(value)) currentValues.delete(value);
      else currentValues.add(value);
      return {
        ...current,
        [definition.id]: [...currentValues],
      };
    });
  }

  function toggleColumn(metricId: string) {
    setColumnPreset("custom");
    setMetricIds((current) => {
      const visibleIds = current ?? result.columns.map((column) => column.metricId);
      const nextIds = visibleIds.includes(metricId)
        ? visibleIds.filter((id) => id !== metricId)
        : [...visibleIds, metricId];
      return nextIds.length ? nextIds : visibleIds;
    });
  }

  function applyColumnPreset(preset: Exclude<AnalyticsColumnPreset, "custom">) {
    const presetIds = catalogPresetColumnIds(result.availableColumns, preset);
    setMetricIds(preset === "standard" ? undefined : presetIds.length ? presetIds : undefined);
    setColumnPreset(preset);
    setColumnsOpen(false);
  }

  function removeFilterValue(id: keyof AnalyticsFilters, value: string) {
    if (id === "pitchVelocityMin") {
      setFilters((current) => ({ ...current, pitchVelocityMin: undefined, pitchVelocityMax: undefined }));
      return;
    }
    setFilters((current) => ({
      ...current,
      [id]: ((current[id] as string[] | undefined) ?? []).filter((item) => item !== value),
    }));
  }

  function setStagedFilterValues(definition: AnalyticsFilterDefinition, nextValues: string[]) {
    setStagedFilters((current) => ({ ...current, [definition.id]: nextValues.length ? nextValues : undefined }));
  }

  function setStagedVelocityRange(minimum?: number, maximum?: number) {
    setStagedFilters((current) => ({ ...current, pitchVelocityMin: minimum, pitchVelocityMax: maximum }));
  }

  function openFilters() {
    setStagedFilters(cloneAnalyticsFilters(filters));
    setFiltersOpen(true);
    setEventSelectorOpen(false);
    setColumnsOpen(false);
  }

  function applyStagedFilters() {
    setFilters(cloneAnalyticsFilters(stagedFilters));
    setFiltersOpen(false);
  }

  function writeAnalyticsDetailRoute(playerId: ID | undefined, options: { replace?: boolean } = {}) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (playerId) url.searchParams.set("detailPlayer", playerId);
    else url.searchParams.delete("detailPlayer");
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl === currentUrl) return;
    window.history[options.replace ? "replaceState" : "pushState"]({ clubhouse: true, view: "analytics" }, "", nextUrl);
  }

  function openAnalyticsPlayerDetail(playerId: ID) {
    setDetailPlayerId(playerId);
    writeAnalyticsDetailRoute(playerId);
  }

  function closeAnalyticsPlayerDetail() {
    setDetailPlayerId(undefined);
    writeAnalyticsDetailRoute(undefined, { replace: true });
  }

  return (
    <div className="page-stack analytics-page">
      <SectionHeader title="Analytics" action={<AskClubhouseLauncher onClick={() => onAsk({ ...query, ...serializedAnalyticsContext })} />} />

      <section className="analytics-controls" aria-label="Analytics controls">
        <div className="analytics-primary-navigation">
          <div className="analytics-domain-tabs">
            <SegmentedControl
              values={["hitting", "pitching", "defense"] as AnalyticsDomain[]}
              active={domain === "development" ? undefined : domain}
              onChange={handleDomain}
              disabled={domain === "development"}
              disabledTitle="Choose a field source to view Hitting, Pitching, or Defense."
            />
          </div>
          <AnalyticsSourceSelector
            domain={domain}
            selectedSources={fieldSources}
            availableSources={analyticsFieldSourceOptions}
            onToggleSource={handleFieldSourceToggle}
            onOpenWeightRoom={() => handleDomain("development")}
          />
        </div>
        <nav className="analytics-view-tabs" aria-label="Analytics workspace">
          {(["overview", "charts", "insights"] as const).map((workspace) => (
            <button
              key={workspace}
              type="button"
              className={analyticsWorkspace === workspace ? "active" : ""}
              onClick={() => setAnalyticsWorkspace(workspace)}
              disabled={domain === "development" && workspace !== "overview"}
              title={domain === "development" && workspace !== "overview" ? "Workouts uses the team and player development table." : undefined}
            >
              {workspace[0].toUpperCase() + workspace.slice(1)}
            </button>
          ))}
        </nav>
        <div className="analytics-controls__row analytics-controls__row--filters">
          <div className="analytics-popover-wrap">
            <button className="secondary-button analytics-control-trigger" type="button" onClick={() => {
              setEventSelectorOpen((open) => !open);
              setFiltersOpen(false);
              setColumnsOpen(false);
            }}>
              {analyticsEventTriggerLabel}
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            {eventSelectorOpen && (
              <AnalyticsEventSelector
                events={result.availableEvents}
                selectedIds={eventIds}
                timeRange={timeRange}
                onToggle={toggleEvent}
                onClear={() => setEventIds([])}
                onTimeRangeChange={setTimeRange}
              />
            )}
          </div>
          <div className="analytics-popover-wrap">
            <button className="secondary-button analytics-control-trigger" type="button" onClick={() => filtersOpen ? setFiltersOpen(false) : openFilters()}>
              <SlidersHorizontal size={14} aria-hidden="true" />
              Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
            </button>
            {filtersOpen && (
              <AnalyticsFilterPanel
                definitions={result.filterDefinitions}
                values={stagedFilters}
                onToggle={toggleStagedFilter}
                onSetValues={setStagedFilterValues}
                onVelocityRange={setStagedVelocityRange}
                onClear={() => setStagedFilters({})}
                onCancel={() => { setStagedFilters(cloneAnalyticsFilters(filters)); setFiltersOpen(false); }}
                onApply={applyStagedFilters}
              />
            )}
          </div>
          <div className="analytics-popover-wrap">
            <button className="secondary-button analytics-control-trigger" type="button" onClick={() => {
              setColumnsOpen((open) => !open);
              setEventSelectorOpen(false);
              setFiltersOpen(false);
            }}>
              <Columns3 size={14} aria-hidden="true" />
              {columnPreset === "custom" ? "Columns: Custom" : `Columns: ${columnPreset.split("-").map((word) => `${word[0].toUpperCase()}${word.slice(1)}`).join(" ")}`}
            </button>
            {columnsOpen && (
              <AnalyticsColumnPanel
                domain={domain}
                columns={result.availableColumns}
                selectedIds={metricIds ?? result.columns.map((column) => column.metricId)}
                activePreset={columnPreset}
                onToggle={toggleColumn}
                onPreset={applyColumnPreset}
                onReset={() => { setMetricIds(undefined); setColumnPreset("standard"); setColumnsOpen(false); }}
              />
            )}
          </div>
        </div>
        {activeFilterSummary.length > 0 && (
          <div className="analytics-active-filter-summary" aria-label="Active analytics filters">
            {activeFilterSummary.map((chip) => (
              <button key={`${chip.id}-${chip.value}`} type="button" onClick={() => removeFilterValue(chip.id, chip.value)}>
                {chip.label}<X size={12} aria-hidden="true" />
              </button>
            ))}
            <button type="button" className="analytics-clear-filter-chip" onClick={() => setFilters({})}>Clear all</button>
          </div>
        )}
      </section>

      {(eventSelectorOpen || filtersOpen || columnsOpen) && (
        <button
          type="button"
          className="analytics-sheet-scrim"
          aria-label="Close Analytics panel"
          onClick={() => { setEventSelectorOpen(false); setFiltersOpen(false); setColumnsOpen(false); }}
        />
      )}

      {analyticsWorkspace === "overview" && <>
        <AnalyticsTable
          result={result}
          showTeamTotals={!playerScope}
          sort={sort}
          onSort={handleSort}
          onOpenPlayer={openAnalyticsPlayerDetail}
          onClearFilters={() => {
            setFilters({});
            setEventIds([]);
          }}
        />
        <AnalyticsMetricKey result={result} />
      </>}

      {analyticsWorkspace === "charts" && (
        <AnalyticsCharts
          result={result}
          surface={chartSurface}
          mode={chartMode}
          playerIds={playerScope ? [playerScope.playerId] : chartPlayerIds}
          allowPlayerSelection={!playerScope}
          players={data.players}
          onSurfaceChange={setChartSurface}
          onModeChange={setChartMode}
          onPlayerIdsChange={setChartPlayerIds}
        />
      )}

      {analyticsWorkspace === "insights" && domain !== "development" && <AnalyticsInsights
        data={data}
        personal={Boolean(playerScope)}
        query={query}
        domain={domain}
        onDrillDown={openInsightDrill}
        onOpenPlayer={openAnalyticsPlayerDetail}
      />}

      {selectedDetailRow && (
        <AnalyticsPlayerDrawer
          row={selectedDetailRow}
          result={result}
          onClose={closeAnalyticsPlayerDetail}
          onOpenProfile={onOpenPlayer ? () => {
            setDetailPlayerId(undefined);
            onOpenPlayer(selectedDetailRow.player.id);
          } : undefined}
          onClearFilters={() => {
            setFilters({});
            setEventIds([]);
          }}
          onViewAllHitting={() => {
            setDomain("hitting");
            setSource("all");
            setFieldSources(["practice", "live-bp"]);
            setAnalyticsView("overview");
            setFilters({});
            setEventIds([]);
            setDetailPlayerId(undefined);
          }}
        />
      )}
    </div>
  );
}

export function AnalyticsCharts({
  result,
  surface,
  mode,
  playerIds,
  players,
  onSurfaceChange,
  onModeChange,
  onPlayerIdsChange,
  allowPlayerSelection = true,
}: {
  result: AnalyticsResult;
  surface: "spray" | "location";
  mode: PracticeChartMetricMode;
  playerIds: ID[];
  players: Player[];
  onSurfaceChange: (surface: "spray" | "location") => void;
  onModeChange: (mode: PracticeChartMetricMode) => void;
  onPlayerIdsChange: (playerIds: ID[]) => void;
  allowPlayerSelection?: boolean;
}) {
  const canShowSpray = Boolean(result.sprayChart);
  const canShowLocation = Boolean(result.pitchLocationChart);
  const resolvedSurface = surface === "spray" && !canShowSpray ? "location" : surface === "location" && !canShowLocation ? "spray" : surface;
  const selectedHitter = playerIds.length === 1 ? players.find((player) => player.id === playerIds[0]) : undefined;
  return (
    <section className="analytics-chart-workspace" aria-label="Analytics charts">
      <div className="analytics-chart-workspace__controls">
        {allowPlayerSelection ? <AnalyticsChartPlayerSelector players={players} selectedIds={playerIds} onChange={onPlayerIdsChange} /> : selectedHitter && <DensePlayerIdentity player={selectedHitter} />}
        <div className="analytics-chart-surface-control" role="group" aria-label="Chart type">
          {canShowSpray && <button type="button" className={resolvedSurface === "spray" ? "active" : ""} onClick={() => onSurfaceChange("spray")}>Spray Chart</button>}
          {canShowLocation && <button type="button" className={resolvedSurface === "location" ? "active" : ""} onClick={() => onSurfaceChange("location")}>Location Chart</button>}
        </div>
      </div>
      {resolvedSurface === "spray" && result.sprayChart && <AnalyticsSprayChart result={result} mode={mode} onModeChange={onModeChange} />}
      {resolvedSurface === "location" && result.pitchLocationChart && <AnalyticsPitchLocationChart result={result} mode={mode} onModeChange={onModeChange} hitter={selectedHitter} />}
      {!canShowSpray && !canShowLocation && <CompactEmpty title="No charted locations for this analytics context" />}
    </section>
  );
}

export function AnalyticsSourceSelector({
  domain,
  selectedSources,
  availableSources,
  onToggleSource,
  onOpenWeightRoom,
}: {
  domain: AnalyticsDomain;
  selectedSources: AnalyticsFieldSource[];
  availableSources: AnalyticsFieldSource[];
  onToggleSource: (source: AnalyticsFieldSource) => void;
  onOpenWeightRoom: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sourceLabels: Record<AnalyticsFieldSource, string> = { games: "Games", practice: "Practice", "live-bp": "Live BP" };
  const summary = domain === "development"
    ? "Workouts"
    : selectedSources.length === 1 ? sourceLabels[selectedSources[0]] : `${selectedSources.length} Sources`;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`analytics-source-selector analytics-scope-select${open ? " open" : ""}`}>
      <button type="button" className="choice-select__button" aria-haspopup="menu" aria-expanded={open} aria-label="Analytics source and Workouts" onClick={() => setOpen((current) => !current)}>
        <strong>{summary}</strong>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && <div className="analytics-source-selector__menu" role="menu" aria-label="Analytics source and Workouts">
        <div className="analytics-source-selector__field-sources" role="group" aria-label="Field sources">
          {availableSources.map((source) => {
            const selected = domain !== "development" && selectedSources.includes(source);
            return <label key={source} className={selected ? "active" : ""}>
              <input type="checkbox" checked={selected} onChange={() => onToggleSource(source)} />
              <span className="analytics-source-selector__checkbox" aria-hidden="true">{selected && <Check size={13} strokeWidth={3} />}</span>
              <span>{sourceLabels[source]}</span>
            </label>;
          })}
        </div>
        <div className="analytics-source-selector__divider" aria-hidden="true" />
        <button type="button" className={domain === "development" ? "active" : ""} role="menuitem" onClick={() => { setOpen(false); onOpenWeightRoom(); }}>
          <Dumbbell size={15} aria-hidden="true" />
          <span>Workouts</span>
        </button>
      </div>}
    </div>
  );
}

export function AnalyticsChartPlayerSelector({ players, selectedIds, onChange }: { players: Player[]; selectedIds: ID[]; onChange: (playerIds: ID[]) => void }) {
  const [open, setOpen] = useState(false);
  const selectedPlayers = players.filter((player) => selectedIds.includes(player.id));
  const label = selectedPlayers.length === 0 ? "Team" : selectedPlayers.length === 1 ? selectedPlayers[0].name : `${selectedPlayers.length} players`;
  return (
    <div className="analytics-chart-player-select">
      <button type="button" className="secondary-button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-haspopup="listbox">
        <Users size={14} aria-hidden="true" /><strong>{label}</strong><ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && <div className="analytics-chart-player-select__menu" role="listbox" aria-multiselectable="true" aria-label="Chart players">
        <button type="button" role="option" aria-selected={selectedIds.length === 0} className={selectedIds.length === 0 ? "active" : ""} onClick={() => onChange([])}><Check size={14} aria-hidden="true" /><span><strong>Team</strong><small>All players</small></span></button>
        {players.map((player) => {
          const selected = selectedIds.includes(player.id);
          return <button key={player.id} type="button" role="option" aria-selected={selected} className={selected ? "active" : ""} onClick={() => onChange(selected ? selectedIds.filter((id) => id !== player.id) : [...selectedIds, player.id])}>
            <Check size={14} aria-hidden="true" /><span><strong>{player.name}</strong>{player.identityLabel && <small className="player-record-label">{player.identityLabel}</small>}<small>#{player.jerseyNumber}</small></span>
          </button>;
        })}
      </div>}
    </div>
  );
}

export function AnalyticsChartModes({ mode, onChange, includeAverage = false }: { mode: PracticeChartMetricMode; onChange: (mode: PracticeChartMetricMode) => void; includeAverage?: boolean }) {
  const displayMode = mode === "dots" ? "heat" : mode;
  const nextMode = displayMode === "heat" ? "count" : displayMode === "count" ? "percent" : displayMode === "percent" && includeAverage ? "average" : "heat";
  return <button className="analytics-chart-mode-cycle" type="button" onClick={() => onChange(nextMode)} aria-label={`Chart display: ${chartMetricModeLabel(displayMode)}. Activate to change view.`}>{chartMetricModeLabel(displayMode)}</button>;
}

export function AnalyticsSprayChart({ result, mode = "heat", onModeChange }: { result: AnalyticsResult; mode?: PracticeChartMetricMode; onModeChange?: (mode: PracticeChartMetricMode) => void }) {
  const chart = result.sprayChart;
  if (!chart) return null;
  const displayMode = mode === "average" ? "heat" : mode;
  const hasTrackedLocations = chart.trackedLocations > 0;
  return (
    <section className="panel analytics-spray-chart" aria-label="Hitting spray chart">
      <div className="analytics-spray-chart__header">
        <span>Team Spray Chart</span>
        <AnalyticsChartModes mode={displayMode} onChange={onModeChange ?? (() => undefined)} />
      </div>
      <ClubhouseBaseballField
        points={chart.points}
        mode={hasTrackedLocations ? (displayMode === "dots" ? "spray" : displayMode) : "blank"}
        size="standard"
        ariaLabel={`${chart.trackedLocations} tracked hitting locations in the current analytics selection`}
      />
    </section>
  );
}

export function AnalyticsTable({
  result,
  sort,
  onSort,
  onOpenPlayer,
  onClearFilters,
  showTeamTotals = true,
}: {
  result: AnalyticsResult;
  sort?: AnalyticsQuery["sort"];
  onSort: (metricId: string) => void;
  onOpenPlayer: (playerId: ID) => void;
  onClearFilters: () => void;
  showTeamTotals?: boolean;
}) {
  const gridTemplateColumns = `minmax(132px, 1.35fr) repeat(${result.columns.length}, minmax(64px, 0.72fr))`;
  const minTableWidth = Math.max(676, 144 + result.columns.length * 64);
  const rowStyle: React.CSSProperties = { gridTemplateColumns, minWidth: minTableWidth };
  const hasTrackedData = result.rows.some((row) => row.sampleCount > 0) || Boolean(result.teamTotals?.sampleCount);
  const visibleRows = hasTrackedData ? result.rows : [];
  const groupedView = visibleRows.some((row) => row.rowKind === "group");
  const hasActiveFilters = Boolean(result.query.eventIds?.length) || Object.values(result.query.filters ?? {}).some((value) => (Array.isArray(value) && value.length > 0) || typeof value === "number");
  return (
    <section className="panel analytics-table-panel">
      {!hasTrackedData && (
        <div className="analytics-no-data">
          <div>
            <strong>No tracked data for this selection yet.</strong>
            <small>{hasActiveFilters ? "Clear filters or choose a wider event range." : "Change source or date range when more events are logged."}</small>
          </div>
          {hasActiveFilters && <button type="button" className="text-button" onClick={onClearFilters}>Clear Filters</button>}
        </div>
      )}
      {hasTrackedData && (
        <>
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Box-score grids need keyboard access for horizontal and vertical scrolling. */}
          <div className="analytics-scroll-panel analytics-box-score" role="region" tabIndex={0} aria-label={`${result.title} box score`}>
        <div className="analytics-box-score__row analytics-box-score__row--head" role="row" style={rowStyle}>
          <button type="button" className="analytics-box-score__cell analytics-box-score__cell--player" onClick={() => onSort("player")} role="columnheader">
            {groupedView ? "Split" : "Player"} {sort?.metricId === "player" ? sortIndicator(sort.direction) : ""}
          </button>
          {result.columns.map((column) => (
            <button
              key={column.metricId}
              type="button"
              className="analytics-box-score__cell analytics-box-score__cell--center"
              onClick={() => column.sortable && onSort(column.metricId)}
              title={column.definition}
              role="columnheader"
            >
              {analyticsColumnDisplayLabel(column.label)} {sort?.metricId === column.metricId ? sortIndicator(sort.direction) : ""}
            </button>
          ))}
        </div>
        {visibleRows.length ? visibleRows.map((row) => (
          <button key={row.player.id} type="button" className={`analytics-box-score__row${row.rowKind === "group" ? " analytics-box-score__row--group" : ""}`} role="row" style={rowStyle} onClick={() => row.rowKind !== "group" && onOpenPlayer(row.player.id)} aria-label={row.rowKind === "group" ? `${row.groupLabel} analytics split` : `Open ${row.player.name} analytics`}>
            <span className="analytics-box-score__cell analytics-box-score__cell--player analytics-player-cell" role="cell">
              {row.rowKind === "group"
                ? <span><strong>{row.groupLabel}</strong><small>{row.sampleCount} tracked</small></span>
                : <DensePlayerIdentity player={row.player} />}
            </span>
            {result.columns.map((column) => (
              <AnalyticsCellView key={column.metricId} cell={row.cells[column.metricId]} />
            ))}
          </button>
        )) : (
          <div className="analytics-empty-table">
            <strong>No matching data</strong>
            <small>Change source, date range, events, or clear filters.</small>
          </div>
        )}
        {showTeamTotals && result.teamTotals && (
          <div className="analytics-box-score__row analytics-box-score__row--team" role="row" style={rowStyle}>
            <span className="analytics-box-score__cell analytics-box-score__cell--player analytics-player-cell">
              <span className="analytics-team-mark">TM</span>
              <span><strong>TEAM</strong><small>Weighted totals</small></span>
            </span>
            {result.columns.map((column) => (
              <AnalyticsCellView key={column.metricId} cell={result.teamTotals?.cells[column.metricId]} />
            ))}
          </div>
        )}
          </div>
        </>
      )}
    </section>
  );
}

export function AnalyticsCellView({ cell }: { cell?: AnalyticsCell }) {
  const display = cell?.display?.endsWith("%") ? cell.display.slice(0, -1) : cell?.display ?? "—";
  return (
    <span className={`analytics-box-score__cell analytics-box-score__cell--center ${cell?.kind === "insufficient-sample" ? "is-low-sample" : ""}`} role="cell">
      <strong>{display}</strong>
    </span>
  );
}

export function AnalyticsInsights({
  data,
  query,
  domain,
  onDrillDown,
  onOpenPlayer,
  personal = false,
}: {
  data: AppData;
  query: AnalyticsQuery;
  domain: "hitting" | "pitching" | "defense";
  onDrillDown: (query: Partial<AnalyticsQuery>) => void;
  onOpenPlayer: (playerId: ID) => void;
  personal?: boolean;
}) {
  const [detailSectionId, setDetailSectionId] = useState<string>();
  const model = useMemo(() => buildAnalyticsInsights(data, query, domain), [data, domain, query]);
  const detailSection = detailSectionId ? model.sections.find((section) => section.id === detailSectionId) : undefined;
  const sections = detailSection ? [detailSection] : model.sections;
  const sectionTitle = `${domain === "hitting" ? "Offense" : domain[0].toUpperCase() + domain.slice(1)} Insights`;
  const handleRow = (row: { drillQuery?: Partial<AnalyticsQuery> }) => {
    const playerId = row.drillQuery?.playerIds?.[0];
    if (playerId) {
      onOpenPlayer(playerId);
      return;
    }
    if (row.drillQuery) onDrillDown(row.drillQuery);
  };
  return (
    <section className="analytics-insights" aria-label={personal ? "My insights" : "Team insights"}>
      <div className="analytics-insights__head">
        <h2>{detailSection ? detailSection.detailTitle ?? detailSection.title : sectionTitle}</h2>
      </div>
      {detailSection && (
        <button className="analytics-insights__back" type="button" onClick={() => setDetailSectionId(undefined)}>
          <ChevronLeft size={15} aria-hidden="true" /> All Insights
        </button>
      )}
      <div className="analytics-insights__sections">
        {sections.map((section) => (
          <section key={section.id} className="analytics-insights__section panel">
            <div className="analytics-insights__section-head">
              <h3>{section.title}</h3>
              {!detailSection && section.rows.length > 4 && <button type="button" onClick={() => setDetailSectionId(section.id)}>View All</button>}
            </div>
            {section.rows.length ? <>
              <div className="analytics-insights__labels" aria-hidden="true"><span>Metric</span><span>{personal ? "You" : "Team"}</span></div>
              <div className="analytics-insights__rows">
                {(detailSection ? section.rows : section.rows.slice(0, 5)).map((row) => (
                  <button key={row.id} type="button" className="analytics-insights__row" onClick={() => handleRow(row)}>
                    <span>{row.label}</span>
                    <strong>{row.primary.display}</strong>
                  </button>
                ))}
              </div>
            </> : <p className="analytics-insights__empty">{section.emptyMessage ?? "Not enough data yet."}</p>}
          </section>
        ))}
      </div>
      {!detailSection && model.takeaways.length > 0 && (
        <section className="analytics-insights__takeaways" aria-label="Key takeaways">
          <h3>Key Takeaways</h3>
          {model.takeaways.map((takeaway) => <p key={takeaway.id} className={`is-${takeaway.tone}`}>{takeaway.text}</p>)}
        </section>
      )}
    </section>
  );
}

export function AnalyticsMetricKey({ result }: { result: AnalyticsResult }) {
  if (!result.columns.length) return null;
  return (
    <section className="analytics-metric-key" aria-label="Analytics metric key">
      <strong>Key</strong>
      <div>
        {result.columns.map((column) => (
          <span key={column.metricId}>
            <b>{analyticsColumnDisplayLabel(column.label)}</b>
            <em>{analyticsMetricKeyLabel(column)}</em>
          </span>
        ))}
      </div>
    </section>
  );
}

export function analyticsMetricKeyLabel(column: AnalyticsColumn) {
  const labels: Record<string, string> = {
    opportunities: "Opportunities",
    takes: "Taken Pitches",
    swings: "Swings",
    contacts: "Contacts",
    bip: "Balls In Play",
    misses: "Whiffs",
    fouls: "Foul Balls",
    contactPct: "Contact Percentage",
    hardPct: "Hard Contact Percentage",
    swingPct: "Swing Percentage",
    bipPct: "Balls In Play Percentage",
    swingMissPct: "Whiff Percentage",
    foulPct: "Foul Percentage",
    takePct: "Take Percentage",
    zoneSwingPct: "In-Zone Swing Percentage",
    zoneContactPct: "In-Zone Contact Percentage",
    chasePct: "Chase Percentage",
    outZoneContactPct: "Out-of-Zone Contact Percentage",
    avgEv: "Average Exit Velocity",
    medianEv: "Median Exit Velocity",
    maxEv: "Maximum Exit Velocity",
    ev90: "90th Percentile Exit Velocity",
    ev95: "95th Percentile Exit Velocity",
    pa: "Plate Appearances",
    trackedBip: "Tracked Balls In Play",
    ab: "At Bats",
    hits: "Hits",
    singles: "Singles",
    doubles: "Doubles",
    triples: "Triples",
    homeRuns: "Home Runs",
    walks: "Walks",
    strikeouts: "Strikeouts",
    hitByPitch: "Hit By Pitch",
    outs: "Outs",
    xbh: "Extra-Base Hits",
    totalBases: "Total Bases",
    avg: "Batting Average",
    obp: "On-Base Percentage",
    slg: "Slugging Percentage",
    ops: "On-Base Plus Slugging",
    iso: "Isolated Power",
    babip: "Batting Average on Balls In Play",
    hrPct: "Home Run Percentage",
    xbhPct: "Extra-Base Hit Percentage",
    tbPerAb: "Total Bases Per At Bat",
  };
  return labels[column.metricId] ?? column.definition?.replace(/\.$/, "") ?? column.label.replace(/%$/, " Percentage");
}

export function AnalyticsEventSelector({
  events,
  selectedIds,
  timeRange,
  onToggle,
  onClear,
  onTimeRangeChange,
}: {
  events: AnalyticsEventOption[];
  selectedIds: ID[];
  timeRange: AnalyticsTimeRange;
  onToggle: (eventId: ID) => void;
  onClear: () => void;
  onTimeRangeChange: (range: AnalyticsTimeRange) => void;
}) {
  const [search, setSearch] = useState("");
  const today = new Date();
  const isIncludedByRange = (event: AnalyticsEventOption) => {
    if (selectedIds.length) return selectedIds.includes(event.id);
    if (timeRange === "season") return true;
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : undefined;
    if (!days || !event.date) return false;
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - days);
    return new Date(event.date) >= cutoff;
  };
  const normalizedSearch = search.trim().toLowerCase();
  const filteredEvents = normalizedSearch
    ? events.filter((eventOption) => [eventOption.label, eventOption.meta, eventOption.source].filter(Boolean).join(" ").toLowerCase().includes(normalizedSearch))
    : events;
  const groups = groupAnalyticsEvents(filteredEvents);
  return (
    <div className="analytics-popover" role="dialog" aria-label="Analytics events">
      <div className="analytics-popover__head">
        <strong>Events</strong>
        <button type="button" className="text-button" onClick={() => { onClear(); onTimeRangeChange("season"); }}>All Events</button>
      </div>
      <div className="analytics-event-range-options" role="group" aria-label="Event range">
        <button type="button" className={timeRange === "season" && !selectedIds.length ? "active" : ""} onClick={() => { onClear(); onTimeRangeChange("season"); }}>All</button>
        <button type="button" className={timeRange === "7d" && !selectedIds.length ? "active" : ""} onClick={() => { onClear(); onTimeRangeChange("7d"); }}>Last 7</button>
        <button type="button" className={timeRange === "30d" && !selectedIds.length ? "active" : ""} onClick={() => { onClear(); onTimeRangeChange("30d"); }}>Last 30</button>
      </div>
      <label className="analytics-popover-search">
        <span>Search events</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search games or practices..." />
      </label>
      <div className="analytics-popover__body">
        {groups.length ? groups.map((group) => (
          <div key={group.label} className="analytics-event-group">
            <span>{group.label}</span>
            {group.events.map((eventOption) => (
              <button key={eventOption.id} type="button" className={isIncludedByRange(eventOption) ? "active" : ""} onClick={() => onToggle(eventOption.id)}>
                <Check size={13} aria-hidden="true" />
                <strong>{eventOption.label}</strong>
                {eventOption.meta && <small>{eventOption.meta}</small>}
              </button>
            ))}
          </div>
        )) : <CompactEmpty title="No events available for this source" />}
      </div>
    </div>
  );
}

export function AnalyticsColumnPanel({
  domain,
  columns,
  selectedIds,
  activePreset,
  onToggle,
  onPreset,
  onReset,
}: {
  domain: AnalyticsDomain;
  columns: AnalyticsColumn[];
  selectedIds: string[];
  activePreset: AnalyticsColumnPreset;
  onToggle: (metricId: string) => void;
  onPreset: (preset: Exclude<AnalyticsColumnPreset, "custom">) => void;
  onReset: () => void;
}) {
  const selected = new Set(selectedIds);
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const matchingColumns = normalizedSearch
    ? columns.filter((column) => `${column.label} ${column.fullName} ${column.key}`.toLowerCase().includes(normalizedSearch))
    : columns;
  const groups = Object.entries(matchingColumns.reduce<Record<string, AnalyticsColumn[]>>((grouped, column) => {
    (grouped[analyticsColumnGroup(column.metricId)] ??= []).push(column);
    return grouped;
  }, {}));
  return (
    <div className="analytics-popover analytics-popover--columns" role="dialog" aria-label="Analytics columns">
      <div className="analytics-popover__head">
        <strong>Stat View</strong>
        <button type="button" className="text-button" onClick={onReset}>Default</button>
      </div>
      <div className="analytics-column-presets" aria-label="Column presets">
        {analyticsPresetsForDomain(domain).map((preset) => (
          <button key={preset} type="button" className={activePreset === preset ? "active" : ""} onClick={() => onPreset(preset)}>
            {preset[0].toUpperCase() + preset.slice(1)}
          </button>
        ))}
      </div>
      <div className="analytics-popover__body analytics-column-list">
        <label className="analytics-column-search">
          <Search size={14} aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search metrics" aria-label="Search analytics metrics" />
        </label>
        {groups.map(([groupLabel, groupColumns]) => (
          <section key={groupLabel} className="analytics-column-group">
            <span>{groupLabel}</span>
            {(groupColumns ?? []).map((column) => (
              <button key={column.metricId} type="button" className={selected.has(column.metricId) ? "active" : ""} onClick={() => onToggle(column.metricId)} title={column.definition}>
                <Check size={13} aria-hidden="true" />
                <span>
                  <strong>{column.label} - {column.fullName}</strong>
                </span>
              </button>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

export function analyticsColumnGroup(metricId: string) {
  return analyticsMetricColumnGroup(metricId);
}

export function analyticsColumnDisplayLabel(label: string) {
  const labels: Record<string, string> = {
    Opportunities: "Opp",
    Takes: "Take",
    Swings: "SW",
    Contacts: "CT",
    Contact: "CT",
    Miss: "WHF",
    Whiff: "WHF",
    "Contact %": "CT%",
    "Contact%": "CT%",
    "Whiff %": "WHF%",
    "Whiff%": "WHF%",
    "Take %": "TK%",
    "Take%": "TK%",
    "Swing%": "SW%",
    "Zone CT%": "ZCT%",
    "Chase%": "CH%",
    "Hard %": "HD%",
    "Hard%": "HD%",
    "Impact %": "IMP%",
    "Impact%": "IMP%",
    "Avg EV": "AEV",
    "Max EV": "MEV",
    "Avg Pitch Velo": "AVV",
    "Max Pitch Velo": "MVV",
    "Avg Velo": "AVV",
    "Max Velo": "MVV",
    Strike: "STR",
    "Strike%": "STR%",
    "Zone%": "ZN%",
    "Position / Station": "Pos",
    "Acc Throws": "ACC",
    "Throw Acc.": "ACC%",
    "Throw%": "ACC%",
    Clean: "CLN",
    "Clean%": "CLN%",
    Great: "GRT",
    "Weight Room Score": "WGT",
    Weight: "WGT",
    Workouts: "WKO",
    "Workout Completion": "WK%",
    "Workout%": "WK%",
    "Attend%": "ATT%",
    "Practice Reps": "Reps",
  };
  return labels[label] ?? label;
}

export function cloneAnalyticsFilters(filters: AnalyticsFilters): AnalyticsFilters {
  return Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value])) as AnalyticsFilters;
}

export function analyticsFilterValueSummary(definition: AnalyticsFilterDefinition, values: AnalyticsFilters) {
  if (definition.type === "range") {
    const { pitchVelocityMin: minimum, pitchVelocityMax: maximum } = values;
    if (minimum === undefined && maximum === undefined) return "Any";
    if (minimum !== undefined && maximum !== undefined) return `${minimum}-${maximum}`;
    return minimum !== undefined ? `${minimum}+` : `Up to ${maximum}`;
  }
  const selected = (values[definition.id] as string[] | undefined) ?? [];
  if (!selected.length) return "All";
  if (definition.type === "pitch-location") {
    const directTiles = selected.filter((value) => value.startsWith("pitch_r"));
    if (directTiles.length === selected.length) return directTiles.length === 1 ? "1 tile" : `${directTiles.length} tiles`;
    if (selected.length === 1) return definition.options.find((option) => option.value === selected[0])?.label ?? selected[0];
    return `${selected.length} selections`;
  }
  if (selected.length === 1) return definition.options.find((option) => option.value === selected[0])?.label ?? selected[0];
  return `${selected.length} selected`;
}

export function AnalyticsFilterPanel({
  definitions,
  values,
  onToggle,
  onSetValues,
  onVelocityRange,
  onClear,
  onCancel,
  onApply,
}: {
  definitions: AnalyticsFilterDefinition[];
  values: AnalyticsFilters;
  onToggle: (definition: AnalyticsFilterDefinition, value: string) => void;
  onSetValues: (definition: AnalyticsFilterDefinition, values: string[]) => void;
  onVelocityRange: (minimum?: number, maximum?: number) => void;
  onClear: () => void;
  onCancel: () => void;
  onApply: () => void;
}) {
  const sections = definitions.reduce<Record<string, AnalyticsFilterDefinition[]>>((groups, definition) => {
    (groups[definition.section] ??= []).push(definition);
    return groups;
  }, {});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set(["Pitch", "Count"]));
  const activeFilterGroups = definitions.filter((definition) => analyticsFilterValueSummary(definition, values) !== (definition.type === "range" ? "Any" : "All")).length;
  const sectionEntries = Object.entries(sections).map(([label, sectionDefinitions]) => ({
    label,
    definitions: sectionDefinitions,
    activeCount: sectionDefinitions.filter((definition) => analyticsFilterValueSummary(definition, values) !== (definition.type === "range" ? "Any" : "All")).length,
  }));
  return (
    <div className="analytics-popover analytics-popover--wide analytics-filter-sheet" role="dialog" aria-modal="true" aria-label="Analytics filters">
      <div className="analytics-filter-sheet__head">
        <strong>Filters</strong>
        <button type="button" className="text-button" onClick={onClear} disabled={!activeFilterGroups}>Clear All</button>
      </div>
      <div className="analytics-filter-sheet__body">
        {definitions.length ? sectionEntries.map(({ label: sectionLabel, definitions: sectionDefinitions, activeCount }) => {
          const isOpen = expandedSections.has(sectionLabel) || activeCount > 0;
          return (
          <section key={sectionLabel} className={`analytics-filter-section${isOpen ? " is-open" : ""}`}>
            <button type="button" className="analytics-filter-section__toggle" onClick={() => setExpandedSections((current) => {
              const next = new Set(current);
              if (next.has(sectionLabel)) next.delete(sectionLabel);
              else next.add(sectionLabel);
              return next;
            })} aria-expanded={isOpen}>
              <span>{sectionLabel === "Game State" ? "Game Situation" : sectionLabel}</span>
              {activeCount > 0 && <small>{activeCount} active</small>}
              <ChevronDown size={15} aria-hidden="true" />
            </button>
            {isOpen && sectionDefinitions.map((definition) => {
              const selected = new Set(
                definition.type === "range" ? [] : ((values[definition.id] as string[] | undefined) ?? []),
              );
              const summary = analyticsFilterValueSummary(definition, values);
              return (
                <div key={`${definition.domains.join("-")}-${definition.id}`} className="analytics-filter-field">
                  <div className="analytics-filter-field__head">
                    <strong>{definition.type === "range" ? `${definition.label} (mph)` : definition.label}</strong>
                    <span>{summary}</span>
                  </div>
                  {definition.type === "range" ? (
                    <div className="analytics-filter-range">
                      <label><span>Min</span><input type="number" inputMode="decimal" min="0" value={values.pitchVelocityMin ?? ""} placeholder="Any" onChange={(event) => onVelocityRange(event.target.value ? Number(event.target.value) : undefined, values.pitchVelocityMax)} /></label>
                      <span>to</span>
                      <label><span>Max</span><input type="number" inputMode="decimal" min="0" value={values.pitchVelocityMax ?? ""} placeholder="Any" onChange={(event) => onVelocityRange(values.pitchVelocityMin, event.target.value ? Number(event.target.value) : undefined)} /></label>
                    </div>
                  ) : definition.type === "pitch-location" ? (
                    <>
                      <div className="analytics-zone-state-options analytics-zone-state-options--three">
                        <button type="button" className={!selected.size ? "active" : ""} onClick={() => onSetValues(definition, [])}>All</button>
                        {definition.options.slice(0, 2).map((option) => (
                          <button key={option.value} type="button" className={selected.has(option.value) ? "active" : ""} onClick={() => onToggle(definition, option.value)}>{option.label}</button>
                        ))}
                      </div>
                      <AnalyticsPitchLocationSelector definition={definition} selected={selected} onToggle={onToggle} />
                    </>
                  ) : (
                    <div className={`analytics-filter-options${definition.id === "exactCounts" ? " analytics-filter-options--counts" : ""}${definition.id === "drillTypes" ? " analytics-filter-options--drills" : ""}`}>
                      {definition.options.map((option) => (
                        <button key={option.value} type="button" className={selected.has(option.value) ? "active" : ""} onClick={() => onToggle(definition, option.value)}>
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        );
        }) : <CompactEmpty title="No supported filters for this source yet" />}
      </div>
      <div className="analytics-filter-sheet__footer">
        <span>Active Filters <strong>{activeFilterGroups}</strong></span>
        <div>
          <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
          <button type="button" className="primary-button" onClick={onApply}>Apply Filters <b>{activeFilterGroups}</b></button>
        </div>
      </div>
    </div>
  );
}

export function AnalyticsPitchLocationChart({ result, mode, onModeChange, hitter }: { result: AnalyticsResult; mode: PracticeChartMetricMode; onModeChange: (mode: PracticeChartMetricMode) => void; hitter?: Player }) {
  const chart = result.pitchLocationChart;
  if (!chart) return null;
  const bucketStats = chart.points.reduce<Partial<Record<PitchLocationGridZoneId, { count: number; outcomes: number; successes: number; atBats: number; hits: number }>>>((counts, point) => {
    const bucket = pitchLocationBucketFromPoint(point);
    if (!bucket) return counts;
    const stats = (counts[bucket.id] ?? { count: 0, outcomes: 0, successes: 0, atBats: 0, hits: 0 }) as { count: number; outcomes: number; successes: number; atBats: number; hits: number };
    stats.count += 1;
    if (point.chartOutcome) {
      stats.outcomes += 1;
      if (point.chartOutcome === "hit" || point.chartOutcome === "contact") stats.successes += 1;
      if (point.chartOutcome === "hit" || point.chartOutcome === "out") {
        stats.atBats += 1;
        if (point.chartOutcome === "hit") stats.hits += 1;
      }
    }
    counts[bucket.id] = stats;
    return counts;
  }, {});
  const maxCount = Math.max(1, ...Object.values(bucketStats).map((stats) => stats?.count ?? 0));
  const batsLeft = hitter?.bats === "L";
  return <section className="panel analytics-pitch-location-chart" aria-label="Team pitch location chart">
    <div className="analytics-spray-chart__header">
      <span>Team Pitch Location</span>
      <AnalyticsChartModes mode={mode} onChange={onModeChange} includeAverage />
    </div>
    <div className={`practice-pitch-location-grid practice-pitch-location-grid--analytics practice-pitch-location-grid--${mode === "dots" ? "dots" : mode} analytics-pitch-location-chart__grid`} role="img" aria-label={`${chart.trackedLocations} tracked pitch locations, catcher view`}>
      <span className="practice-pitch-location-grid__axis practice-pitch-location-grid__axis--up">Up</span>
      <span className="practice-pitch-location-grid__axis practice-pitch-location-grid__axis--down">Down</span>
      <span className="practice-pitch-location-grid__axis practice-pitch-location-grid__axis--left">{batsLeft ? "Away" : "In"}</span>
      <span className="practice-pitch-location-grid__axis practice-pitch-location-grid__axis--right">{batsLeft ? "In" : "Away"}</span>
      <div className="practice-pitch-location-grid__stage">
        <span className="practice-pitch-location-grid__zone" aria-hidden="true" />
        <span className="practice-pitch-location-grid__plate" aria-hidden="true" />
        {PITCH_LOCATION_BUCKETS.map((bucket) => {
          const stats = bucketStats[bucket.id];
          const count = stats?.count ?? 0;
          const intensity = count / maxCount;
          const outcomeRate = stats?.outcomes ? stats.successes / stats.outcomes : undefined;
          const average = stats?.atBats ? stats.hits / stats.atBats : undefined;
          const colorScore = mode === "average"
            ? Math.min(1, (average ?? 0) / 0.5)
            : outcomeRate ?? intensity;
          const metric = mode === "average" ? average : chart.metricLabel === "Pitch density" ? (count / Math.max(1, chart.trackedLocations)) : outcomeRate;
          const metricLabel = mode === "count" && count > 0 ? String(count) : mode === "percent" && metric !== undefined ? `${Math.round(metric * 100)}%` : mode === "average" && average !== undefined ? formatDecimal(average) : undefined;
          return <span key={bucket.id} className={`practice-pitch-location-grid__bucket ${bucket.isZone ? "practice-pitch-location-grid__bucket--zone" : "practice-pitch-location-grid__bucket--outside"}`} style={{ gridColumn: bucket.column, gridRow: bucket.row, "--pitch-heat-opacity": count ? 0.22 + intensity * 0.62 : 0, "--pitch-heat-color": colorScore >= 0.72 ? "#ef5b5b" : colorScore >= 0.42 ? "#c99245" : "#4b91d1" } as React.CSSProperties}><i className="practice-pitch-location-grid__heat" aria-hidden="true" />{metricLabel && <b className="practice-pitch-location-grid__bucket-metric">{metricLabel}</b>}</span>;
        })}
      </div>
    </div>
  </section>;
}

export function AnalyticsPitchLocationSelector({
  definition,
  selected,
  onToggle,
}: {
  definition: AnalyticsFilterDefinition;
  selected: Set<string>;
  onToggle: (definition: AnalyticsFilterDefinition, value: string) => void;
}) {
  const pitcherRelative = definition.options.some((option) => option.value === "arm_side");
  return (
    <div className="analytics-pitch-location-view" aria-label="Catcher view pitch location selector">
      <div className="analytics-pitch-location-view__label"><span>Catcher View</span><small>Tap one or more tiles</small></div>
      <div className="practice-pitch-location-grid practice-pitch-location-grid--entry practice-pitch-location-grid--interactive analytics-pitch-location-grid">
        <span className="practice-pitch-location-grid__axis practice-pitch-location-grid__axis--up">Up</span>
        <span className="practice-pitch-location-grid__axis practice-pitch-location-grid__axis--down">Down</span>
        <span className="practice-pitch-location-grid__axis practice-pitch-location-grid__axis--left">{pitcherRelative ? "Arm" : "In"}</span>
        <span className="practice-pitch-location-grid__axis practice-pitch-location-grid__axis--right">{pitcherRelative ? "Glove" : "Away"}</span>
        <div className="practice-pitch-location-grid__stage">
          <span className="practice-pitch-location-grid__zone" aria-hidden="true" />
          <span className="practice-pitch-location-grid__plate" aria-hidden="true" />
          {PITCH_LOCATION_BUCKETS.map((bucket) => {
            const value = bucket.id;
            const label = analyticsPitchLocationTileLabel(bucket, pitcherRelative);
            const isSelected = analyticsPitchLocationBucketSelected(selected, bucket, pitcherRelative);
            return <button
              key={bucket.id}
              type="button"
              className={`practice-pitch-location-grid__bucket ${bucket.isZone ? "practice-pitch-location-grid__bucket--zone" : "practice-pitch-location-grid__bucket--outside"}${isSelected ? " active" : ""}`}
              style={{ gridColumn: bucket.column, gridRow: bucket.row } as React.CSSProperties}
              onClick={() => onToggle(definition, value)}
              aria-label={label}
              aria-pressed={isSelected}
              title={label}
            />;
          })}
        </div>
      </div>
    </div>
  );
}

export function analyticsPitchLocationBucketSelected(selected: Set<string>, bucket: PitchLocationBucket, pitcherRelative: boolean) {
  return selected.has(bucket.id) || selected.has(bucket.isZone ? "in_zone" : "out_of_zone") || selected.has(analyticsLocationRegionForBucket(bucket, pitcherRelative));
}

export function analyticsPitchLocationTileLabel(bucket: PitchLocationBucket, pitcherRelative: boolean) {
  const vertical = bucket.row < 3 ? "Up" : bucket.row > 3 ? "Down" : "Middle";
  const horizontal = bucket.column < 3 ? (pitcherRelative ? "Arm Side" : "In") : bucket.column > 3 ? (pitcherRelative ? "Glove Side" : "Away") : "Middle";
  const position = vertical === "Middle" && horizontal === "Middle" ? "Middle" : vertical === "Middle" ? horizontal : horizontal === "Middle" ? vertical : `${vertical} & ${horizontal}`;
  return `${position}, ${bucket.isZone ? "in-zone" : "out-of-zone"} tile`;
}

export function analyticsLocationRegionForBucket(bucket: PitchLocationBucket, pitcherRelative: boolean) {
  const vertical = bucket.y < 0.34 ? "up" : bucket.y > 0.66 ? "down" : "middle";
  const horizontal = bucket.x < 0.34 ? (pitcherRelative ? "arm_side" : "in") : bucket.x > 0.66 ? (pitcherRelative ? "glove_side" : "away") : "middle";
  if (vertical === "middle" && horizontal === "middle") return "middle";
  if (vertical === "middle") return horizontal;
  if (horizontal === "middle") return vertical;
  return `${vertical}_${pitcherRelative ? "" : "and_"}${horizontal}`.replace("_and_arm", "_arm").replace("_and_glove", "_glove");
}

export function AnalyticsPlayerDrawer({
  row,
  result,
  onClose,
  onOpenProfile,
  onClearFilters,
  onViewAllHitting,
}: {
  row: AnalyticsRow;
  result: AnalyticsResult;
  onClose: () => void;
  onOpenProfile?: () => void;
  onClearFilters: () => void;
  onViewAllHitting: () => void;
}) {
  return (
    <div className="analytics-drawer-backdrop" role="presentation">
      <aside className="analytics-drawer analytics-player-drawer" aria-label={`${row.player.name} analytics detail`}>
        <div className="analytics-drawer__head">
          <div className="analytics-player-drawer__identity">
            <PlayerAvatar player={row.player} size="md" />
            <span>
              <small>{result.scopeLabel}</small>
              <h2>{row.player.name}</h2>
              <em>#{row.player.jerseyNumber} · {row.player.primaryPosition}{row.player.secondaryPosition ? ` / ${row.player.secondaryPosition}` : ""}</em>
            </span>
          </div>
          <button className="ghost-button" type="button" onClick={onClose} aria-label="Close player analytics">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <AnalyticsPlayerMetrics result={result} row={row} />
        <div className="analytics-drawer-actions">
          <button className="secondary-button" type="button" onClick={onClearFilters}>Clear Filters</button>
          <button className="secondary-button" type="button" onClick={onViewAllHitting}>View All Hitting</button>
          {onOpenProfile && <button className="primary-button" type="button" onClick={onOpenProfile}>Open Profile</button>}
        </div>
      </aside>
    </div>
  );
}

export function readInitialAnalyticsState(): {
  domain: AnalyticsDomain;
  source: AnalyticsSource;
  fieldSources: AnalyticsFieldSource[];
  mode: AnalyticsMode;
  analyticsView: AnalyticsViewId;
  timeRange: AnalyticsTimeRange;
  developmentView: AnalyticsDevelopmentView;
  eventIds: ID[];
  customRange: { start?: string; end?: string };
  filters: AnalyticsFilters;
  sort?: AnalyticsQuery["sort"];
  metricIds?: string[];
  columnPreset: AnalyticsColumnPreset;
  workspace: "overview" | "charts" | "insights";
} {
  if (typeof window === "undefined") {
    return { domain: "hitting", source: "games", fieldSources: ["games"], mode: "box-score", analyticsView: "overview", timeRange: "season", developmentView: "overview", eventIds: [], customRange: {}, filters: {}, columnPreset: "standard", workspace: "overview" };
  }
  const params = new URLSearchParams(window.location.search);
  const domain = parseAnalyticsParam(params.get("domain"), ["hitting", "pitching", "defense", "development"], "hitting");
  const requestedSource = parseAnalyticsParam(params.get("source"), ["games", "practice", "live-bp", "all"], "games");
  const supportedSources = analyticsSourcesForDomain(domain);
  const requestedFieldSources = params.get("sources")?.split(",").filter((source): source is AnalyticsFieldSource => source === "games" || source === "practice" || source === "live-bp") ?? [];
  const fieldSources = domain === "development"
    ? []
    : requestedFieldSources.filter((candidate) => supportedSources.includes(candidate)).length
      ? [...new Set(requestedFieldSources.filter((candidate) => supportedSources.includes(candidate)))]
      : analyticsFieldSourcesForSource(domain, supportedSources.includes(requestedSource) ? requestedSource : supportedSources[0]);
  const source = domain === "development" ? "all" : analyticsSourceFromFieldSources(fieldSources);
  const mode = parseAnalyticsParam(params.get("mode"), ["box-score", "situational"], "box-score");
  const analyticsView = normalizeAnalyticsView(domain, domain === "development" ? "all" : source, params.get("statView") ?? undefined);
  const timeRange = parseAnalyticsParam(params.get("period"), ["7d", "30d", "season", "custom"], "season");
  const developmentView = parseAnalyticsParam(params.get("dev"), ["overview", "weight-room", "attendance", "trends"], domain === "development" ? "weight-room" : "overview");
  const requestedMetricIds = params.get("columns")?.split(",").filter(Boolean);
  const metricIds = isLegacyAnalyticsStandardColumns(requestedMetricIds) ? undefined : requestedMetricIds?.length ? requestedMetricIds : undefined;
  const columnPreset = parseAnalyticsParam(params.get("columnPreset"), ["standard", "advanced", "approach", "contact", "batted-ball", "baserunning", "command", "efficiency", "velocity", "pitch-mix", "development", "position", "custom"], metricIds?.length ? "custom" : "standard");
  const requestedWorkspace = parseAnalyticsParam(params.get("analyticsWorkspace") ?? params.get("workspace"), ["overview", "charts", "insights"], "overview");
  const workspace = domain === "development" ? "overview" : requestedWorkspace;
  return {
    domain,
    source,
    fieldSources,
    mode: domain === "development" ? "box-score" : mode,
    analyticsView,
    timeRange,
    developmentView,
    eventIds: params.get("events")?.split(",").filter(Boolean) ?? [],
    metricIds,
    columnPreset,
    workspace,
    filters: parseAnalyticsFilters(params.get("filters")),
    sort: params.get("sort") ? { metricId: params.get("sort") ?? "player", direction: params.get("dir") === "asc" ? "asc" : "desc" } : undefined,
    customRange: {
      start: params.get("start") ?? undefined,
      end: params.get("end") ?? undefined,
    },
  };
}

export function analyticsFieldSourcesForSource(domain: AnalyticsDomain, source: AnalyticsSource): AnalyticsFieldSource[] {
  if (source !== "all") return [source];
  if (domain === "pitching") return ["games", "practice", "live-bp"];
  return domain === "defense" ? ["practice"] : ["practice", "live-bp"];
}

export function normalizeAnalyticsFieldSources(fieldSources: AnalyticsFieldSource[]): AnalyticsFieldSource[] {
  const requested = new Set(fieldSources);
  return (["games", "practice", "live-bp"] as AnalyticsFieldSource[]).filter((source) => requested.has(source));
}

export function analyticsSourceFromFieldSources(fieldSources: AnalyticsFieldSource[]): AnalyticsSource {
  return fieldSources.length === 1 ? fieldSources[0] : "all";
}

export function readInitialAnalyticsDetailPlayerId(data: AppData): ID | undefined {
  if (typeof window === "undefined") return undefined;
  const detailPlayerId = new URLSearchParams(window.location.search).get("detailPlayer");
  return detailPlayerId && data.players.some((player) => player.id === detailPlayerId) ? detailPlayerId : undefined;
}

export function parseAnalyticsParam<T extends string>(value: string | null, allowed: T[], fallback: T): T {
  return value && allowed.includes(value as T) ? value as T : fallback;
}

export const ANALYTICS_FILTER_PARAM_KEYS: Array<keyof AnalyticsFilters> = [
  "pitcherHands",
  "batterHands",
  "pitchTypes",
  "exactCounts",
  "countGroups",
  "drillTypes",
  "liveBpThrowerSources",
  "battedBallTypes",
  "defenseStations",
  "defensePositions",
  "defenseDrills",
  "defenseRepTypes",
  "defenseRepSubtypes",
  "defenseResults",
  "defenseThrowResults",
  "pitchLocationRegions",
  "directions",
  "gameStates",
  "innings",
  "outs",
  "runnerStates",
  "opponents",
  "homeAway",
  "gamePitchOutcomes",
  "gameBipOutcomes",
];

export function encodeAnalyticsFilters(filters: AnalyticsFilters): string {
  const arrays = ANALYTICS_FILTER_PARAM_KEYS
    .map((key) => {
      const value = filters[key];
      if (!Array.isArray(value) || !value.length) return "";
      return `${key}:${value.map((item) => encodeURIComponent(item)).join("|")}`;
    })
    .filter(Boolean)
    .join(";");
  const ranges = [
    filters.pitchVelocityMin !== undefined ? `pitchVelocityMin:${filters.pitchVelocityMin}` : "",
    filters.pitchVelocityMax !== undefined ? `pitchVelocityMax:${filters.pitchVelocityMax}` : "",
  ].filter(Boolean).join(";");
  return [arrays, ranges].filter(Boolean).join(";");
}

export function parseAnalyticsFilters(value: string | null): AnalyticsFilters {
  if (!value) return {};
  const parsed: Record<string, string[] | number> = {};
  for (const segment of value.split(";")) {
    const [rawKey, rawValues] = segment.split(":");
    const key = rawKey as keyof AnalyticsFilters;
    if (!rawKey || !rawValues) continue;
    if (rawKey === "pitchVelocityMin" || rawKey === "pitchVelocityMax") {
      const numericValue = Number(rawValues);
      if (Number.isFinite(numericValue)) parsed[rawKey] = numericValue;
      continue;
    }
    if (!ANALYTICS_FILTER_PARAM_KEYS.includes(key)) continue;
    const values = rawValues.split("|").map((item) => decodeURIComponent(item)).filter(Boolean);
    if (values.length) parsed[key] = values;
  }
  return parsed as AnalyticsFilters;
}

export function sortIndicator(direction?: "asc" | "desc") {
  return direction === "asc" ? "↑" : "↓";
}

export function groupAnalyticsEvents(events: AnalyticsEventOption[]) {
  const groups = new Map<string, AnalyticsEventOption[]>();
  for (const eventOption of events) {
    const date = eventOption.date ? new Date(`${eventOption.date}T12:00:00`) : undefined;
    const label = date
      ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date)
      : "Sessions";
    groups.set(label, [...(groups.get(label) ?? []), eventOption]);
  }
  return [...groups.entries()].map(([label, groupEvents]) => ({ label, events: groupEvents }));
}

export const LEGACY_ANALYTICS_STANDARD_COLUMNS = ["opportunities", "swings", "contacts", "contactPct", "hardPct", "avgEv", "maxEv"];

export function isLegacyAnalyticsStandardColumns(metricIds: string[] | undefined): boolean {
  return Boolean(metricIds?.length === LEGACY_ANALYTICS_STANDARD_COLUMNS.length
    && metricIds.every((metricId, index) => metricId === LEGACY_ANALYTICS_STANDARD_COLUMNS[index]));
}

export function SectionHeader({
  className,
  eyebrow,
  title,
  titleAdornment,
  body,
  context,
  action,
}: {
  className?: string;
  eyebrow?: string;
  title: string;
  titleAdornment?: React.ReactNode;
  body?: string;
  context?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={`section-header ${className ?? ""}`}>
      <div>
        {eyebrow && <span>{eyebrow}</span>}
        <div className="section-header__title-row">
          <h2>{title}</h2>
          {titleAdornment}
        </div>
        {context && <small>{context}</small>}
        {body && <p>{body}</p>}
      </div>
      {action}
    </section>
  );
}

export function SegmentedControl<T extends string>({ values, active, onChange, disabled = false, disabledTitle }: { values: T[]; active?: T; onChange: (value: T) => void; disabled?: boolean; disabledTitle?: string }) {
  return (
    <div className="segmented-control">
      {values.map((value) => (
        <button key={value} type="button" className={value === active ? "active" : ""} onClick={() => onChange(value)} disabled={disabled} title={disabled ? disabledTitle : undefined}>
          {formatSegment(value)}
        </button>
      ))}
    </div>
  );
}

export function CompactEmpty({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="compact-empty"><span>{title}</span>{action}</div>;
}

export function buildScheduleItems(data: AppData): ScheduleItem[] {
  const practiceItems: ScheduleItem[] = data.practices.map((practice) => ({
    id: `practice-${practice.id}`,
    source: "practice",
    sourceId: practice.id,
    eventType: "Practice",
    title: practice.name || practice.type,
    startAt: practice.startedAt,
    endAt: practice.endedAt,
    date: practice.date,
    location: practice.location,
    notes: practice.notes,
    visibility: "TEAM_ONLY",
    status: practice.endedAt ? "Completed" : "Scheduled",
    accent: SCHEDULE_EVENT_ACCENTS.Practice,
  }));

  const gameItems: ScheduleItem[] = data.games.map((game) => ({
    id: `game-${game.id}`,
    source: "game",
    sourceId: game.id,
    eventType: "Game",
    title: `${matchupPrefix(game.homeAway).replace(".", "")} ${game.opponent}`,
    startAt: game.startsAt ?? toLocalIso(game.date, "18:00"),
    date: game.date,
    location: game.location,
    notes: game.type,
    visibility: defaultScheduleVisibility("Game", data.teamContext?.currentTeam),
    status: game.result ? "Completed" : "Scheduled",
    accent: SCHEDULE_EVENT_ACCENTS.Game,
  }));

  const workoutsByDate = new Map<string, WorkoutSession[]>();
  for (const session of data.workoutSessions) {
    const dateSessions = workoutsByDate.get(session.date) ?? [];
    dateSessions.push(session);
    workoutsByDate.set(session.date, dateSessions);
  }
  const liftItems: ScheduleItem[] = [...workoutsByDate.entries()].map(([date, sessions]) => ({
    id: `lift-${date}`,
    source: "lift",
    sourceId: sessions[0]?.id ?? date,
    eventType: "Lift",
    title: sessions.length > 1 ? `Team Lift (${sessions.length})` : "Team Lift",
    startAt: toLocalIso(date, "16:00"),
    date,
    location: "Weight Room",
    visibility: "TEAM_ONLY",
    status: sessions.every((session) => session.completed) ? "Completed" : "Scheduled",
    accent: SCHEDULE_EVENT_ACCENTS.Lift,
  }));

  const genericItems: ScheduleItem[] = (data.scheduleEvents ?? [])
    .filter((event) => !event.practiceId && !event.gameId && !event.workoutSessionId)
    .map((event) => ({
      id: `event-${event.id}`,
      source: "event",
      sourceId: event.id,
      eventType: event.eventType,
      title: event.title,
      startAt: event.startAt,
      endAt: event.endAt,
      date: dateKeyFromIso(event.startAt),
      location: event.location,
      notes: event.notes,
      visibility: event.visibility,
      status: event.status,
      accent: SCHEDULE_EVENT_ACCENTS[event.eventType],
    }));

  return [...practiceItems, ...gameItems, ...liftItems, ...genericItems].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}

export function toLocalIso(date: string, time = "12:00") {
  const safeTime = time || "12:00";
  return new Date(`${date}T${safeTime}:00`).toISOString();
}

export function dateKeyFromIso(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return localDateKey(date);
}

export function todayKey() {
  return localDateKey(new Date());
}

export function isUpcomingScheduleItem(item: ScheduleItem) {
  return Date.parse(item.startAt) >= Date.parse(`${todayKey()}T00:00:00`);
}

export function isPastScheduleItem(item: ScheduleItem) {
  return Date.parse(item.startAt) < Date.parse(`${todayKey()}T00:00:00`);
}

export function isoDate(date: Date) {
  return localDateKey(date);
}

export function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isToday(dateKey: string) {
  return dateKey === todayKey();
}

export function calendarDaysForMonth(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function weekDates(cursor: Date) {
  const start = new Date(cursor);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function weekRangeLabel(cursor: Date) {
  const days = weekDates(cursor);
  const first = days[0];
  const last = days[6];
  return `${first.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${last.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

export function groupScheduleItemsByDate(items: ScheduleItem[]) {
  const groups = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const group = groups.get(item.date) ?? [];
    group.push(item);
    groups.set(item.date, group);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, groupItems]) => ({
      date,
      items: groupItems.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)),
    }));
}

export function agendaDateLabel(date: string) {
  const today = todayKey();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);
  if (date === today) return "Today";
  if (date === tomorrowKey) return "Tomorrow";
  return fullDate(date);
}

export function teamContextLine(team?: TeamOption) {
  if (!team) return "Current team";
  return `${team.teamName} - ${team.seasonName ?? "Current season"}`;
}

export function defaultScheduleVisibility(type: ScheduleEventType, team?: TeamOption): ScheduleEventVisibility {
  void team;
  if (type === "Game" || type === "Tournament") return "PUBLIC";
  return "TEAM_ONLY";
}

export function matchupPrefix(homeAway: Game["homeAway"]) {
  return homeAway === "Away" ? "at" : "vs.";
}

export function formatTime(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatSegment(value: string) {
  if (value === "overview") return "Overview";
  if (value === "box-score") return "Box Score";
  if (value === "situational") return "Situational";
  if (value === "all") return "All";
  if (value === "live-bp") return "Live BP";
  if (value === "weight-room") return "Weight Room";
  if (value === "attendance") return "Attendance";
  if (value === "trends") return "Trends";
  if (value === "practice") return "Practice";
  if (value === "games") return "Games";
  if (value === "pitching") return "Pitching";
  if (value === "hitting") return "Hitting";
  if (value === "defense") return "Defense";
  if (value === "development") return "Development";
  if (value === "weights") return "Weight Room";
  if (value === "notes") return "Notes";
  return value.split(/[-_]/).filter(Boolean).map((segment) => `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`).join(" ");
}
