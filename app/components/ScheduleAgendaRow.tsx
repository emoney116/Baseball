import type { ReactNode } from "react";
import { CalendarDays } from "lucide-react";

export function ScheduleAgendaRow({ title, time, type, location, status, icon, onSelect }: {
  title: string; time: string; type: string; location?: string; status?: string; icon?: ReactNode; onSelect?: () => void;
}) {
  const content = <>
    <time>{time}</time>
    {icon ?? <span className="schedule-type-icon"><CalendarDays size={16} aria-hidden="true" /></span>}
    <span><strong>{title}</strong><small>{type}{location ? ` · ${location}` : ""}</small></span>
    {status && <em className={`schedule-status schedule-status--${status.toLowerCase()}`}>{status}</em>}
  </>;
  return onSelect
    ? <button type="button" className="schedule-agenda-row" onClick={onSelect}>{content}</button>
    : <div className="schedule-agenda-row schedule-agenda-row--readonly">{content}</div>;
}
