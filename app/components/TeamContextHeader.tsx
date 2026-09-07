"use client";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus
} from "lucide-react";
import { useState } from "react";
import { ViewKey } from "../components/TeamWorkspaceViews";
import type {
  ID,
  TeamContext,
  TeamOption
} from "../types";
export function TeamWorkspaceHeader({
  context,
  view,
  onSwitch,
  onClubhouseHome,
  hasOpenPractice,
  onStartPractice,
  onStartGame,
}: {
  context?: TeamContext;
  view: ViewKey;
  onSwitch: (team: TeamOption) => void | Promise<void>;
  onClubhouseHome: () => void;
  hasOpenPractice?: boolean;
  onStartPractice?: () => void;
  onStartGame?: () => void;
}) {
  const current = context?.currentTeam;
  if (!current) return null;
  const isTeamHome = view === "teamHome";
  if (!isTeamHome) {
    return (
      <section className="team-workspace-header team-workspace-header--compact">
        <OrganizationLogo name={current.organizationName} logoUrl={teamOrganizationLogo(current, context)} />
        <div className="team-workspace-header__identity">
          <span>{current.organizationName}</span>
        <TeamIdentitySwitcher context={context} current={current} onSwitch={onSwitch} compact />
          <small>{current.seasonName ?? "Current season"}</small>
        </div>
      </section>
    );
  }
  return (
    <section className="team-workspace-header team-workspace-header--home">
      <button className="icon-button team-workspace-back" type="button" onClick={onClubhouseHome} aria-label="Back to Clubhouse Home" title="Clubhouse Home">
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <OrganizationLogo name={current.organizationName} logoUrl={teamOrganizationLogo(current, context)} />
      <div className="team-workspace-header__identity">
        <span>{current.organizationName}</span>
        <TeamIdentitySwitcher context={context} current={current} onSwitch={onSwitch} />
        <small>{current.seasonName ?? "Current season"}</small>
      </div>
      {(onStartPractice || onStartGame) && <div className="team-workspace-header__actions">
        {onStartPractice && <button type="button" className="primary-button" onClick={onStartPractice}>
          {hasOpenPractice ? <ChevronRight size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
          {hasOpenPractice ? "Open Practice" : "Practice"}
        </button>}
        {onStartGame && <button type="button" className="secondary-button" onClick={onStartGame}>
          <Plus size={16} aria-hidden="true" />
          Game
        </button>}
      </div>}
    </section>
  );
}

export function TeamIdentitySwitcher({
  context,
  current,
  onSwitch,
  compact = false,
}: {
  context?: TeamContext;
  current: TeamOption;
  onSwitch: (team: TeamOption) => void | Promise<void>;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const organizations = organizationSummariesFromContext(context).filter((organization) => organization.teams.length > 0);
  const selectedValue = teamValue(current);

  return (
    <div
      className={`team-identity-switcher ${compact ? "team-identity-switcher--compact" : ""}`}
      onBlur={(event) => {
        const nextFocus = event.relatedTarget instanceof Node ? event.relatedTarget : null;
        if (!nextFocus || !event.currentTarget.contains(nextFocus)) setOpen(false);
      }}
    >
      <button type="button" className="team-identity-switcher__button" onClick={() => setOpen((value) => !value)} aria-haspopup="dialog" aria-expanded={open}>
        <strong>{current.teamName}</strong>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="team-identity-switcher__panel">
          {organizations.map((organization) => (
            <div className="team-switcher-group" key={organization.id}>
              <div className="team-switcher-group__heading">
                <OrganizationLogo name={organization.name} logoUrl={organization.logoUrl} />
                <strong>{organization.name}</strong>
              </div>
              {organization.teams.map((team) => (
                <button
                  key={teamValue(team)}
                  type="button"
                  className={teamValue(team) === selectedValue ? "active" : ""}
                  onClick={() => {
                    setOpen(false);
                    void onSwitch(team);
                  }}
                >
                  <span>
                    <strong>{team.teamName}</strong>
                    <small>{team.seasonName ?? "Current season"} - {teamContextRole(team)}</small>
                  </span>
                  {teamValue(team) === selectedValue ? <Check size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type OrganizationSummary = {
  id: ID;
  name: string;
  slug?: string;
  teams: TeamOption[];
  location?: string;
  logoUrl?: string;
  role?: string;
};

export function OrganizationLogo({ name, logoUrl, imageUrl, size = "md" }: { name: string; logoUrl?: string; imageUrl?: string; size?: "sm" | "md" | "lg" }) {
  const metrolina = /metrolina/i.test(name);
  const resolvedLogoUrl = logoUrl ?? imageUrl;
  return (
    <span className={`organization-logo organization-logo--${size}`} aria-hidden="true">
      {resolvedLogoUrl ? <img src={resolvedLogoUrl} alt="" /> : metrolina ? <img src="/brand/metrolina-baseball-alpha.png" alt="" /> : initialsFor(name)}
    </span>
  );
}

export function organizationSummariesFromContext(context?: TeamContext) {
  const organizations = new Map<ID, OrganizationSummary>();
  for (const organization of context?.organizations ?? []) {
    const location = [organization.city, organization.state].filter(Boolean).join(", ") || undefined;
    organizations.set(organization.id, {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      teams: [],
      location,
      logoUrl: organization.logoUrl,
      role: organization.role,
    });
  }
  for (const team of displayWorkspaceTeams(context?.availableTeams ?? [])) {
    if (!team.organizationId) continue;
    const current = organizations.get(team.organizationId) ?? {
      id: team.organizationId,
      name: team.organizationName,
      teams: [],
    };
    current.teams.push(team);
    organizations.set(team.organizationId, current);
  }
  return [...organizations.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function displayWorkspaceTeams(teams: TeamOption[]) {
  const visible = teams.filter((team) => !isProgramContainerTeam(team));
  return visible.length ? visible : teams;
}

export function isProgramContainerTeam(team: TeamOption) {
  const level = (team.teamLevel ?? "").trim().toLowerCase();
  const name = team.teamName.trim().toLowerCase();
  return level === "program" || name === "baseball" || name.endsWith(" baseball program") || name.includes(" program");
}

export function initialsFor(value: string) {
  return value
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "ST";
}

export function teamValue(team?: TeamOption) {
  return team ? `${team.teamId}:${team.seasonId ?? "all"}${team.playerContextId ? `:player:${team.playerContextId}` : ""}` : "";
}

export function teamContextRole(team: TeamOption) {
  return team.playerContextId ? `Player: ${team.playerContextName ?? "My profile"}` : roleLabel(team.role);
}

export function teamOrganizationLogo(team: TeamOption, context?: TeamContext) {
  return context?.organizations?.find((organization) => organization.id === team.organizationId)?.logoUrl;
}

export function roleLabel(role?: string) {
  return (role ?? "STAFF")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
