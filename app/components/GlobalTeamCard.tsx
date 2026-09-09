import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export function GlobalTeamCard({ name, subtitle, logo, action, onOpen }: {
  name: string;
  subtitle: string;
  logo: ReactNode;
  action?: ReactNode;
  onOpen: () => void;
}) {
  return (
    <article className="global-team-card">
      <button className="global-team-card__main" type="button" onClick={onOpen}>
        {logo}
        <span><strong>{name}</strong><small>{subtitle}</small></span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
      {action && <div className="global-team-card__action">{action}</div>}
    </article>
  );
}
