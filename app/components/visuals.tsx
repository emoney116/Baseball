import type { LucideIcon } from "lucide-react";
import type React from "react";
import { BRAND_ASSETS } from "../lib/branding";
import type { Player, ZonePoint } from "../types";

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
  badge?: string | number;
  className?: string;
  as?: "span" | "div" | "label";
  ariaLabel?: string;
  decorative?: boolean;
  children?: React.ReactNode;
}) {
  const variant = avatarVariantForIdentity(id, name);
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
}: {
  points?: ZonePoint[];
  activePoint?: ZonePoint;
  onSelect?: (point: ZonePoint) => void;
  compact?: boolean;
}) {
  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (!onSelect) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onSelect({
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    });
  }

  const contents = <>
      <span className="strike-zone__plate" />
      <span className="strike-zone__box" />
      <span className="strike-zone__grid strike-zone__grid--v1" />
      <span className="strike-zone__grid strike-zone__grid--v2" />
      <span className="strike-zone__grid strike-zone__grid--h1" />
      <span className="strike-zone__grid strike-zone__grid--h2" />
      {points?.slice(-42).map((point, index) => (
        <span
          className="strike-zone__dot"
          key={`${point.x}-${point.y}-${index}`}
          style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%`, opacity: 0.3 + index / 90 }}
        />
      ))}
      {activePoint && <span className="strike-zone__target" style={{ left: `${activePoint.x * 100}%`, top: `${activePoint.y * 100}%` }} />}
    </>;

  if (!onSelect) {
    return <div className={`strike-zone strike-zone--readonly ${compact ? "strike-zone--compact" : ""}`} role="img" aria-label={`${points?.length ?? 0} tracked pitch locations, shown from the pitcher's view`}>{contents}</div>;
  }

  return <button type="button" className={`strike-zone ${compact ? "strike-zone--compact" : ""}`} onClick={handleClick} aria-label="Select pitch location from the pitcher's view">{contents}</button>;
}

export function BaseballField({
  points,
  onSelect,
  activePoint,
}: {
  points?: ZonePoint[];
  onSelect?: (point: ZonePoint) => void;
  activePoint?: ZonePoint;
}) {
  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (!onSelect) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onSelect({
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    });
  }

  return (
    <button type="button" className="field-chart" onClick={handleClick} aria-label="Tap batted ball direction">
      <svg className="field-chart__field" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="field-grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#347b55" /><stop offset="1" stopColor="#174f38" /></linearGradient>
          <radialGradient id="field-dirt" cx="50%" cy="55%" r="60%"><stop offset="0" stopColor="#b9874f" /><stop offset="1" stopColor="#946435" /></radialGradient>
        </defs>
        <path className="field-chart__outfield" d="M3 91 L7 22 Q50 -9 93 22 L97 91 Z" fill="url(#field-grass)" />
        <path className="field-chart__mow" d="M12 30 Q50 3 88 30" />
        <path className="field-chart__mow" d="M18 43 Q50 20 82 43" />
        <path className="field-chart__mow" d="M24 56 Q50 37 76 56" />
        <path className="field-chart__infield-dirt" d="M50 57 L69 76 L50 95 L31 76 Z" fill="url(#field-dirt)" />
        <path className="field-chart__infield-grass" d="M50 63 L63 76 L50 89 L37 76 Z" />
        <path className="field-chart__foul-line" d="M50 92 L7 22" />
        <path className="field-chart__foul-line" d="M50 92 L93 22" />
        <path className="field-chart__fence" d="M7 22 Q50 -9 93 22" />
        <circle className="field-chart__mound" cx="50" cy="73" r="2.2" />
        <rect className="field-chart__rubber" x="48.8" y="72.4" width="2.4" height="0.7" rx="0.25" />
        <rect className="field-chart__base" x="62.2" y="74.2" width="3.2" height="3.2" transform="rotate(45 63.8 75.8)" />
        <rect className="field-chart__base" x="48.4" y="60" width="3.2" height="3.2" transform="rotate(45 50 61.6)" />
        <rect className="field-chart__base" x="34.6" y="74.2" width="3.2" height="3.2" transform="rotate(45 36.2 75.8)" />
        <path className="field-chart__home-plate" d="M48.2 89.7 H51.8 V91.3 L50 93 L48.2 91.3 Z" />
        {activePoint && <>
          <line className="field-chart__spray-line-glow" x1="50" y1="91.5" x2={activePoint.x * 100} y2={activePoint.y * 100} />
          <line className="field-chart__spray-line" x1="50" y1="91.5" x2={activePoint.x * 100} y2={activePoint.y * 100} />
        </>}
      </svg>
      <span className="field-chart__label field-chart__label--lf">LF</span>
      <span className="field-chart__label field-chart__label--cf">CF</span>
      <span className="field-chart__label field-chart__label--rf">RF</span>
      {points?.slice(-48).map((point, index) => (
        <span
          className="field-chart__dot"
          key={`${point.x}-${point.y}-${index}`}
          style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%`, opacity: 0.35 + index / 100 }}
        />
      ))}
      {activePoint && <span className="field-chart__target" style={{ left: `${activePoint.x * 100}%`, top: `${activePoint.y * 100}%` }} />}
    </button>
  );
}

export function Heatmap({ points }: { points: ZonePoint[] }) {
  return (
    <div className="heatmap">
      <StrikeZone compact />
      {points.slice(-90).map((point, index) => (
        <span
          key={`${point.x}-${point.y}-${index}`}
          style={{
            left: `${point.x * 100}%`,
            top: `${point.y * 100}%`,
            opacity: 0.1 + index / 120,
          }}
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
