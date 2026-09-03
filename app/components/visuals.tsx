import type { LucideIcon } from "lucide-react";
import type React from "react";
import { BRAND_ASSETS } from "../lib/branding";
import type { Player, ZonePoint } from "../types";
import { ClubhouseBaseballField } from "./ClubhouseBaseballField";

type CategorizedZonePoint = ZonePoint & {
  category?: string;
  color?: string;
};

const AVATAR_VARIANTS = ["neutral", "maroon", "steel", "forest", "plum", "navy"] as const;

type AvatarVariant = typeof AVATAR_VARIANTS[number];
type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function avatarVariantForIdentity(id?: string, name?: string): AvatarVariant {
  const seed = (id || name || "clubhouse-9").trim();
  return AVATAR_VARIANTS[stableHash(seed) % AVATAR_VARIANTS.length];
}

export function initialsForName(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function IdentityAvatar({
  id,
  name,
  src,
  size = "md",
  variant: requestedVariant,
  badge,
  className = "",
  as = "span",
  ariaLabel,
  decorative = true,
  children,
}: {
  id?: string;
  name: string;
  src?: string;
  size?: AvatarSize;
  variant?: AvatarVariant;
  badge?: string | number;
  className?: string;
  as?: "span" | "div" | "label";
  ariaLabel?: string;
  decorative?: boolean;
  children?: React.ReactNode;
}) {
  const variant = requestedVariant ?? avatarVariantForIdentity(id, name);
  const classes = [
    "player-avatar",
    `player-avatar--${size}`,
    `player-avatar--tone-${variant}`,
    src ? "player-avatar--image" : "player-avatar--initials",
    className,
  ].filter(Boolean).join(" ");
  const content = (
    <>
      {src ? (
        <img src={src} alt="" />
      ) : (
        <>
          <span>{initialsForName(name)}</span>
          {badge !== undefined && <small>{badge}</small>}
        </>
      )}
      {children}
    </>
  );
  const accessibility = decorative ? { "aria-hidden": true as const } : { "aria-label": ariaLabel ?? name };

  if (as === "label") return <label className={classes} data-avatar-variant={variant} {...accessibility}>{content}</label>;
  if (as === "div") return <div className={classes} data-avatar-variant={variant} {...accessibility}>{content}</div>;
  return <span className={classes} data-avatar-variant={variant} {...accessibility}>{content}</span>;
}

export function PlayerAvatar({
  player,
  size = "md",
  compact = false,
}: {
  player: Player;
  size?: AvatarSize;
  compact?: boolean;
}) {
  return (
    <IdentityAvatar
      id={player.id}
      name={player.name}
      src={player.imageUrl}
      size={size}
      variant="neutral"
      badge={compact ? undefined : `#${player.jerseyNumber}`}
    />
  );
}

export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  accent?: boolean;
}) {
  return (
    <div className={`stat-tile ${accent ? "stat-tile--accent" : ""}`}>
      <div className="stat-tile__top">
        <span>{label}</span>
        {Icon && <Icon aria-hidden="true" size={17} />}
      </div>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

export function MetricBar({
  label,
  value,
  helper,
  max = 100,
}: {
  label: string;
  value: number;
  helper?: string;
  max?: number;
}) {
  const width = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="metric-bar">
      <div className="metric-bar__label">
        <span>{label}</span>
        <strong>{helper ?? `${Math.round(value)}%`}</strong>
      </div>
      <div className="metric-bar__track">
        <span style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function MiniLineChart({ values, labels }: { values: number[]; labels?: string[] }) {
  const width = 280;
  const height = 100;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 100);
  const range = Math.max(1, max - min);
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="mini-chart" aria-label="Trend chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <defs>
          <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-success)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--chart-primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polyline className="mini-chart__ghost" points={`0,${height} ${points} ${width},${height}`} />
        <polyline className="mini-chart__line" points={points} />
        {values.map((value, index) => {
          const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
          const y = height - ((value - min) / range) * height;
          return <circle key={`${value}-${index}`} cx={x} cy={y} r="3.5" />;
        })}
      </svg>
      {labels && (
        <div className="mini-chart__labels">
          <span>{labels[0]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
}

export function DonutChart({ items }: { items: Array<{ label: string; value: number; color: string }> }) {
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  const slices = items.reduce<Array<{ label: string; color: string; length: number; offset: number }>>((segments, item) => {
    const used = segments.reduce((sum, segment) => sum + segment.length, 0);
    const length = (item.value / total) * 100;
    return [...segments, { label: item.label, color: item.color, length, offset: 25 - used }];
  }, []);

  return (
    <div className="donut-wrap">
      <svg className="donut" viewBox="0 0 42 42" aria-label="Pitch mix donut chart">
        <circle className="donut__base" cx="21" cy="21" r="15.915" />
        {slices.map((item) => (
          <circle
            key={item.label}
            className="donut__slice"
            cx="21"
            cy="21"
            r="15.915"
            stroke={item.color}
            strokeDasharray={`${item.length} ${100 - item.length}`}
            strokeDashoffset={item.offset}
          />
        ))}
      </svg>
      <div className="donut-legend">
        {items.map((item) => (
          <span key={item.label}>
            <i style={{ background: item.color }} />
            {item.label} {Math.round((item.value / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

export function StrikeZone({
  points,
  activePoint,
  onSelect,
  compact = false,
  mode = "dots",
}: {
  points?: CategorizedZonePoint[];
  activePoint?: ZonePoint;
  onSelect?: (point: ZonePoint) => void;
  compact?: boolean;
  mode?: "dots" | "count" | "percent" | "heat";
}) {
  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (!onSelect) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onSelect({
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    });
  }

  const distribution = buildStrikeZoneDistribution(points ?? []);
  const contents = <>
      <span className="strike-zone__plate" />
      <span className="strike-zone__box" />
      <span className="strike-zone__grid strike-zone__grid--v1" />
      <span className="strike-zone__grid strike-zone__grid--v2" />
      <span className="strike-zone__grid strike-zone__grid--h1" />
      <span className="strike-zone__grid strike-zone__grid--h2" />
      {mode !== "dots" && (
        <span className={`strike-zone__distribution strike-zone__distribution--${mode}`} aria-hidden="true">
          {distribution.map((cell) => (
            <span
              key={cell.id}
              className="strike-zone__distribution-cell"
              style={{ "--zone-intensity": String(cell.intensity) } as React.CSSProperties}
            >
              {mode === "count" ? cell.count : mode === "percent" ? `${cell.percent}%` : ""}
            </span>
          ))}
        </span>
      )}
      {(mode === "dots" || Boolean(onSelect)) && points?.slice(-42).map((point, index) => (
        <span
          className="strike-zone__dot"
          data-category={point.category}
          key={`${point.x}-${point.y}-${index}`}
          style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%`, opacity: Math.min(0.96, 0.74 + index / 180), "--point-color": point.color } as React.CSSProperties}
        />
      ))}
      {activePoint && <span className="strike-zone__target" style={{ left: `${activePoint.x * 100}%`, top: `${activePoint.y * 100}%` }} />}
    </>;

  if (!onSelect) {
    return <div className={`strike-zone strike-zone--readonly ${compact ? "strike-zone--compact" : ""}`} role="img" aria-label={`${points?.length ?? 0} tracked pitch locations, shown from the pitcher's view`}>{contents}</div>;
  }

  return <button type="button" className={`strike-zone ${compact ? "strike-zone--compact" : ""}`} onClick={handleClick} aria-label="Select pitch location from the pitcher's view">{contents}</button>;
}

function buildStrikeZoneDistribution(points: ZonePoint[]) {
  const cells = Array.from({ length: 9 }, (_, index) => ({ id: `zone-${index}`, count: 0 }));
  for (const point of points) {
    const column = Math.max(0, Math.min(2, Math.floor(point.x * 3)));
    const row = Math.max(0, Math.min(2, Math.floor(point.y * 3)));
    cells[(row * 3) + column].count += 1;
  }
  const total = points.length || 1;
  const max = Math.max(...cells.map((cell) => cell.count), 1);
  return cells.map((cell) => ({
    ...cell,
    percent: Math.round((cell.count / total) * 100),
    intensity: cell.count / max,
  }));
}

export function BaseballField({
  points,
  onSelect,
  activePoint,
}: {
  points?: CategorizedZonePoint[];
  onSelect?: (point: ZonePoint) => void;
  activePoint?: ZonePoint;
}) {
  return (
    <ClubhouseBaseballField
      className="field-chart"
      points={points}
      activePoint={activePoint}
      onSelect={onSelect}
      mode="spray"
      size="large"
      coordinateSpace="game"
      showTrajectory
      ariaLabel={`${points?.length ?? 0} tracked game batted ball locations`}
    />
  );
}

export function Heatmap({ points }: { points: CategorizedZonePoint[] }) {
  return (
    <div className="heatmap">
      <StrikeZone compact />
      {points.slice(-90).map((point, index) => (
        <span
          data-category={point.category}
          key={`${point.x}-${point.y}-${index}`}
          style={{
            left: `${point.x * 100}%`,
            top: `${point.y * 100}%`,
            opacity: Math.min(0.92, 0.46 + index / 180),
            "--point-color": point.color,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <img className="brand-mark-image" src={BRAND_ASSETS.mark} alt="" />
      <strong>{title}</strong>
      <p>{body}</p>
      {action}
    </div>
  );
}
