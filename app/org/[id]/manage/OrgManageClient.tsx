"use client";

import {
  Archive,
  Ban,
  CheckCircle2,
  Copy,
  Mail,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Upload,
  X,
  ChevronDown,
} from "lucide-react";
import { useRef, useState, type CSSProperties, type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { cityOptionsForState, US_STATE_OPTIONS } from "../../../lib/locations";
import type { OrgRole, OrganizationManageData, OrganizationVisibility } from "../../../lib/organizationManagement";

type TabKey = "general" | "teams" | "staff" | "invites" | "visibility";
type Status = "idle" | "saving" | "error" | "saved";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "general", label: "General" },
  { key: "teams", label: "Teams" },
  { key: "staff", label: "Staff & Admins" },
  { key: "invites", label: "Invites" },
  { key: "visibility", label: "Visibility" },
];

const TEAM_TYPE_OPTIONS = ["School", "Travel", "Club", "Other"];
const SCHOOL_LEVEL_OPTIONS = ["Varsity", "JV", "Freshman", "Other"];
const AGE_GROUP_OPTIONS = ["18+", "18U", "17U", "16U", "15U", "14U", "13U", "12U", "11U", "10U", "9U", "8U", "7U", "6U", "Other"];
const STAFF_ROLE_OPTIONS = [
  "Head Coach",
  "Assistant Coach",
  "Pitching Coach",
  "Hitting Coach",
  "Strength Coach",
  "Catching Coach",
  "Athletic Trainer",
  "Manager",
  "Volunteer",
  "Other",
];
const SEASON_OPTIONS = buildSeasonOptions();

type ChoiceOption = {
  value: string;
  label: string;
};

type CropState = {
  sourceUrl: string;
  fileName: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
  status: "idle" | "saving" | "error";
  message: string;
};

type AddTeamDraft = {
  teamName: string;
  teamType: string;
  teamLevel: string;
  teamState: string;
  teamCity: string;
  seasonName: string;
};

type TeamDraft = AddTeamDraft & {
  visibility: OrganizationVisibility;
  active: boolean;
};

type InviteDraft = {
  email: string;
  firstName: string;
  lastName: string;
  staffRole: string;
  orgRole: OrgRole;
  accessRole: "ADMIN" | "COACH";
  teamIds: string[];
};

export function OrgManageClient({ initialData }: { initialData: OrganizationManageData }) {
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState<TabKey>("general");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [generalDraft, setGeneralDraft] = useState({
    name: initialData.organization.name,
    state: initialData.organization.state ?? "",
    city: initialData.organization.city ?? "",
    logoUrl: initialData.organization.logoUrl ?? "",
  });
  const [visibilityDraft, setVisibilityDraft] = useState<OrganizationVisibility>(initialData.organization.visibility);
  const [addTeamDraft, setAddTeamDraft] = useState<AddTeamDraft>(() => defaultTeamDraft(initialData.organization));
  const [editingTeamId, setEditingTeamId] = useState("");
  const [teamDrafts, setTeamDrafts] = useState<Record<string, TeamDraft>>(() => teamDraftsFromData(initialData));
  const [inviteDraft, setInviteDraft] = useState<InviteDraft>(() => defaultInviteDraft(initialData));
  const [showAllInvites, setShowAllInvites] = useState(false);
  const [cropState, setCropState] = useState<CropState | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const orgLocation = [data.organization.city, data.organization.state].filter(Boolean).join(", ");
  const activeTeams = data.teams.filter((team) => team.active && !isProgramContainerTeam(team));

  async function refresh() {
    const response = await fetch(`/api/organizations/${data.organization.id}/manage`, { cache: "no-store" });
    const result = (await response.json()) as { ok: boolean; data?: OrganizationManageData; message?: string };
    if (!response.ok || !result.ok || !result.data) throw new Error(result.message ?? "Unable to refresh organization.");
    applyData(result.data);
  }

  function applyData(nextData: OrganizationManageData) {
    setData(nextData);
    setGeneralDraft({
      name: nextData.organization.name,
      state: nextData.organization.state ?? "",
      city: nextData.organization.city ?? "",
      logoUrl: nextData.organization.logoUrl ?? "",
    });
    setVisibilityDraft(nextData.organization.visibility);
    setTeamDrafts(teamDraftsFromData(nextData));
    setInviteDraft((current) => ({
      ...current,
      teamIds: current.teamIds.filter((teamId) => nextData.teams.some((team) => team.id === teamId && team.active)),
    }));
  }

  async function patchOrganization(payload: Record<string, unknown>) {
    setStatus("saving");
    setMessage("");
    const response = await fetch(`/api/organizations/${data.organization.id}/manage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { ok: boolean; data?: OrganizationManageData; message?: string };
    if (!response.ok || !result.ok || !result.data) throw new Error(result.message ?? "Unable to save organization.");
    applyData(result.data);
    setStatus("saved");
    setMessage("Saved");
  }

  async function saveGeneral(event: FormEvent) {
    event.preventDefault();
    try {
      await patchOrganization({
        type: "general",
        name: generalDraft.name,
        city: generalDraft.city,
        state: generalDraft.state,
        logoUrl: generalDraft.logoUrl || null,
      });
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to save organization.");
    }
  }

  async function saveVisibility(nextVisibility = visibilityDraft) {
    try {
      setVisibilityDraft(nextVisibility);
      await patchOrganization({ type: "general", visibility: nextVisibility });
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to update visibility.");
    }
  }

  async function createTeam(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    try {
      if (!addTeamDraft.teamName.trim()) throw new Error("Team name is required.");
      const response = await fetch("/api/teams/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: data.organization.id,
          teamName: addTeamDraft.teamName,
          teamType: addTeamDraft.teamType,
          teamLevel: addTeamDraft.teamLevel,
          ageGroup: addTeamDraft.teamType === "School" ? undefined : addTeamDraft.teamLevel,
          teamState: addTeamDraft.teamState,
          teamCity: addTeamDraft.teamCity,
          seasonName: addTeamDraft.seasonName,
        }),
      });
      const result = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Unable to create team.");
      setAddTeamDraft(defaultTeamDraft(data.organization));
      await refresh();
      setStatus("saved");
      setMessage("Team created");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to create team.");
    }
  }

  async function updateTeam(teamId: string, overrides: Partial<TeamDraft> = {}) {
    const currentDraft = teamDrafts[teamId];
    if (!currentDraft) return;
    const draft = { ...currentDraft, ...overrides };
    if (!draft.teamName.trim()) {
      setStatus("error");
      setMessage("Team name is required.");
      return;
    }
    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch(`/api/organizations/${data.organization.id}/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.teamName,
          teamType: draft.teamType,
          level: draft.teamLevel,
          ageGroup: draft.teamType === "School" ? undefined : draft.teamLevel,
          city: draft.teamCity,
          state: draft.teamState,
          seasonName: draft.seasonName,
          active: draft.active,
        }),
      });
      const result = (await response.json()) as { ok: boolean; data?: OrganizationManageData; message?: string };
      if (!response.ok || !result.ok || !result.data) throw new Error(result.message ?? "Unable to update team.");
      applyData(result.data);
      setEditingTeamId("");
      setStatus("saved");
      setMessage(overrides.active === false ? "Team archived" : "Team saved");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to update team.");
    }
  }

  async function removeTeamFromOrganization(teamId: string) {
    if (!window.confirm("Remove this team from this organization? The team and its history will stay available outside the organization.")) return;
    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch(`/api/organizations/${data.organization.id}/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeFromOrganization: true }),
      });
      const result = (await response.json()) as { ok: boolean; data?: OrganizationManageData; message?: string };
      if (!response.ok || !result.ok || !result.data) throw new Error(result.message ?? "Unable to remove team from organization.");
      applyData(result.data);
      setEditingTeamId("");
      setStatus("saved");
      setMessage("Team removed from organization");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to remove team from organization.");
    }
  }

  async function updateMember(profileId: string, role: OrgRole, active = true) {
    if (!active && !window.confirm("Remove this person from the organization? Team memberships and history are not deleted.")) return;
    if (role !== "ADMIN" && !window.confirm("Change this person to Org Member? They will lose organization-management access.")) return;
    setStatus("saving");
    setMessage("");
    try {
      await patchOrganization({ type: "member", profileId, role, active });
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to update staff access.");
    }
  }

  async function inviteStaff(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    try {
      if (!inviteDraft.email.trim()) throw new Error("Email is required.");
      if (!inviteDraft.teamIds.length) throw new Error("Choose at least one team.");
      const response = await fetch("/api/staff/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteDraft.email,
          firstName: inviteDraft.firstName,
          lastName: inviteDraft.lastName,
          staffRole: inviteDraft.staffRole,
          accessRole: inviteDraft.accessRole,
          orgRole: inviteDraft.orgRole,
          teams: inviteDraft.teamIds.map((teamId) => {
            const team = data.teams.find((item) => item.id === teamId);
            return { teamId, seasonId: team?.season?.id };
          }),
        }),
      });
      const result = (await response.json()) as { ok: boolean; message?: string; invitation?: { inviteLink?: string }; email?: { ok?: boolean; message?: string } };
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Unable to invite staff.");
      setInviteDraft(defaultInviteDraft(data));
      await refresh();
      setStatus("saved");
      setMessage(result.email?.ok === false ? "Invite created. Copy the link to share it." : "Invite sent");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to invite staff.");
    }
  }

  async function copyInvite(invitationId: string) {
    try {
      const response = await fetch(`/api/staff/invitations/${invitationId}/link`, { method: "POST" });
      const result = (await response.json()) as { ok: boolean; inviteLink?: string; message?: string };
      if (!response.ok || !result.ok || !result.inviteLink) throw new Error(result.message ?? "Unable to create link.");
      await navigator.clipboard.writeText(result.inviteLink);
      await refresh();
      setStatus("saved");
      setMessage("Invite link copied");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to copy invite link.");
    }
  }

  async function resendInvite(invitationId: string) {
    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch(`/api/staff/invitations/${invitationId}/resend`, { method: "POST" });
      const result = (await response.json()) as { ok: boolean; message?: string; email?: { ok?: boolean } };
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Unable to resend invitation.");
      await refresh();
      setStatus("saved");
      setMessage(result.email?.ok === false ? "Invite refreshed. Copy the link to share it." : "Invite resent");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to resend invitation.");
    }
  }

  async function revokeInvite(invitationId: string) {
    if (!window.confirm("Revoke this invitation? The invite link will stop working.")) return;
    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch(`/api/staff/invitations/${invitationId}/revoke`, { method: "POST" });
      const result = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Unable to revoke invitation.");
      await refresh();
      setStatus("saved");
      setMessage("Invite revoked");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to revoke invitation.");
    }
  }

  function handleLogoFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage("");
    if (!file.type.startsWith("image/")) {
      setStatus("error");
      setMessage("Choose an image file.");
      return;
    }
    if (file.size > 8_000_000) {
      setStatus("error");
      setMessage("Choose an image under 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const sourceUrl = typeof reader.result === "string" ? reader.result : "";
      setCropState({ sourceUrl, fileName: file.name, zoom: 1, offsetX: 0, offsetY: 0, status: "idle", message: "" });
      setStatus("idle");
    };
    reader.onerror = () => {
      setStatus("error");
      setMessage("Unable to read that image.");
    };
    reader.readAsDataURL(file);
  }

  async function applyLogoCrop() {
    if (!cropState) return;
    setCropState((current) => current ? { ...current, status: "saving", message: "" } : current);
    try {
      const logoUrl = await cropImage(cropState);
      setGeneralDraft((current) => ({ ...current, logoUrl }));
      setCropState(null);
    } catch (error) {
      setCropState((current) => current ? {
        ...current,
        status: "error",
        message: error instanceof Error ? error.message : "Unable to crop image.",
      } : current);
    }
  }

  function renderTabContent() {
    if (tab === "general") {
      return (
        <GeneralTab
          draft={generalDraft}
          status={status}
          onSubmit={saveGeneral}
          onChange={setGeneralDraft}
          onPickLogo={() => logoInputRef.current?.click()}
          onRemoveLogo={() => setGeneralDraft((current) => ({ ...current, logoUrl: "" }))}
        />
      );
    }
    if (tab === "teams") {
      return (
        <TeamsTab
          teams={data.teams}
          draft={addTeamDraft}
          teamDrafts={teamDrafts}
          editingTeamId={editingTeamId}
          onCreate={createTeam}
          onDraftChange={setAddTeamDraft}
          onTeamDraftChange={setTeamDrafts}
          onEdit={setEditingTeamId}
          onSaveTeam={(teamId) => void updateTeam(teamId)}
          onRemoveTeam={(teamId) => void removeTeamFromOrganization(teamId)}
          onRestoreTeam={(teamId) => void updateTeam(teamId, { active: true })}
        />
      );
    }
    if (tab === "staff") {
      return <StaffTab currentProfileId={data.currentProfileId} members={data.members} onUpdateMember={(profileId, role, active) => void updateMember(profileId, role, active)} />;
    }
    if (tab === "invites") {
      return (
        <InvitesTab
          teams={activeTeams}
          invitations={data.invitations}
          showAll={showAllInvites}
          onShowAll={() => setShowAllInvites(true)}
          draft={inviteDraft}
          onChange={setInviteDraft}
          onInvite={inviteStaff}
          onCopy={(id) => void copyInvite(id)}
          onResend={(id) => void resendInvite(id)}
          onRevoke={(id) => void revokeInvite(id)}
        />
      );
    }
    return <VisibilityTab value={visibilityDraft} onChange={(next) => void saveVisibility(next)} />;
  }

  return (
    <div className="org-manage">
      <section className="panel org-manage-hero">
        <OrgLogo name={data.organization.name} logoUrl={data.organization.logoUrl} large />
        <div>
          <span>Organization Management</span>
          <h1>{data.organization.name}</h1>
          <p>{[orgLocation, `${data.teams.length} team${data.teams.length === 1 ? "" : "s"}`].filter(Boolean).join(" - ")}</p>
        </div>
        <span className={`visibility-badge visibility-badge--${data.organization.visibility.toLowerCase()}`}>
          {visibilityLabel(data.organization.visibility)}
        </span>
      </section>

      <div className="org-manage-tabs" role="tablist" aria-label="Organization management">
        {TABS.map((item) => (
          <button key={item.key} type="button" className={tab === item.key ? "active" : ""} onClick={() => setTab(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      {message && (
        <div className={`org-manage-message org-manage-message--${status}`} role="status">
          {message}
        </div>
      )}

      {renderTabContent()}

      <input ref={logoInputRef} type="file" accept="image/*" className="visually-hidden-input" onChange={handleLogoFile} />
      {cropState && (
        <ImageCropModal
          title="Organization Logo"
          state={cropState}
          onChange={setCropState}
          onCancel={() => setCropState(null)}
          onPickDifferent={() => logoInputRef.current?.click()}
          onApply={() => void applyLogoCrop()}
        />
      )}
    </div>
  );
}

function GeneralTab({
  draft,
  status,
  onSubmit,
  onChange,
  onPickLogo,
  onRemoveLogo,
}: {
  draft: { name: string; state: string; city: string; logoUrl: string };
  status: Status;
  onSubmit: (event: FormEvent) => void;
  onChange: (value: SetStateAction<{ name: string; state: string; city: string; logoUrl: string }>) => void;
  onPickLogo: () => void;
  onRemoveLogo: () => void;
}) {
  return (
    <form className="panel org-manage-panel" onSubmit={onSubmit}>
      <div className="panel-heading tight">
        <div>
          <h2>General</h2>
        </div>
        <button className="primary-button" type="submit" disabled={status === "saving"}>
          <Save size={15} aria-hidden="true" />
          {status === "saving" ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="org-general-grid">
        <div className="org-logo-editor">
          <OrgLogo name={draft.name} logoUrl={draft.logoUrl} large />
          <div>
            <button className="secondary-button" type="button" onClick={onPickLogo}>
              <Upload size={15} aria-hidden="true" />
              Replace Logo
            </button>
            {draft.logoUrl && (
              <button className="ghost-button" type="button" onClick={onRemoveLogo}>
                Remove
              </button>
            )}
          </div>
        </div>

        <label className="form-field team-creator-span">
          <span>Organization Name</span>
          <input value={draft.name} onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))} />
        </label>
        <div className="form-field">
          <span>State</span>
          <ChoiceSelect
            aria-label="Organization state"
            className="form-choice"
            value={draft.state}
            options={[{ value: "", label: "Select state" }, ...US_STATE_OPTIONS.map((state) => ({ value: state, label: state }))]}
            onChange={(state) => onChange((current) => ({ ...current, state, city: "" }))}
          />
        </div>
        <div className="form-field">
          <span>City</span>
          <ChoiceSelect
            aria-label="Organization city"
            className="form-choice"
            value={draft.city}
            disabled={!draft.state}
            options={[
              { value: "", label: draft.state ? "Select city" : "Select state first" },
              ...cityOptionsForState(draft.state).map((city) => ({ value: city, label: city })),
            ]}
            onChange={(city) => onChange((current) => ({ ...current, city }))}
          />
        </div>
      </div>
    </form>
  );
}

function TeamsTab({
  teams,
  draft,
  teamDrafts,
  editingTeamId,
  onCreate,
  onDraftChange,
  onTeamDraftChange,
  onEdit,
  onSaveTeam,
  onRemoveTeam,
  onRestoreTeam,
}: {
  teams: OrganizationManageData["teams"];
  draft: AddTeamDraft;
  teamDrafts: Record<string, TeamDraft>;
  editingTeamId: string;
  onCreate: (event: FormEvent) => void;
  onDraftChange: (value: SetStateAction<AddTeamDraft>) => void;
  onTeamDraftChange: (value: SetStateAction<Record<string, TeamDraft>>) => void;
  onEdit: (teamId: string) => void;
  onSaveTeam: (teamId: string) => void;
  onRemoveTeam: (teamId: string) => void;
  onRestoreTeam: (teamId: string) => void;
}) {
  return (
    <section className="org-manage-grid">
      <form className="panel org-manage-panel org-add-team-panel" onSubmit={onCreate}>
        <div className="panel-heading tight">
          <div>
            <h2>Add Team</h2>
          </div>
          <button className="primary-button" type="submit">
            <Plus size={15} aria-hidden="true" />
            Create Team
          </button>
        </div>
        <TeamFields draft={draft} onChange={onDraftChange} />
      </form>

      <article className="panel org-manage-panel">
        <div className="panel-heading tight">
          <div>
            <h2>Teams</h2>
            <p>Remove teams from this organization without deleting history.</p>
          </div>
        </div>
        <div className="org-team-list">
          {teams.map((team) => {
            const draftValue = teamDrafts[team.id] ?? teamDraftFromTeam(team);
            const editing = editingTeamId === team.id;
            return (
              <div key={team.id} className={`org-team-admin-card ${team.active ? "" : "is-archived"}`}>
                <div className="org-team-admin-card__summary">
                  <OrgLogo name={team.name} logoUrl={team.logoUrl} />
                  <span>
                    <strong>{team.name}</strong>
                    <small>{[team.season?.name, team.level, team.active ? "Active" : "Archived"].filter(Boolean).join(" - ")}</small>
                  </span>
                  <button className="secondary-button" type="button" onClick={() => onEdit(editing ? "" : team.id)}>
                    {editing ? "Close" : "Edit Team"}
                  </button>
                </div>
                {editing && (
                  <div className="org-team-edit-grid">
                    <TeamFields
                      draft={draftValue}
                      onChange={(next) => onTeamDraftChange((current) => ({
                        ...current,
                        [team.id]: typeof next === "function" ? next(current[team.id] ?? draftValue) : next,
                      }))}
                    />
                    <div className="org-team-edit-actions">
                      <button className="primary-button" type="button" onClick={() => onSaveTeam(team.id)}>
                        Save Team
                      </button>
                      {team.active ? (
                        <button className="secondary-button" type="button" onClick={() => onRemoveTeam(team.id)}>
                          <Archive size={15} aria-hidden="true" />
                          Remove from Org
                        </button>
                      ) : (
                        <button className="secondary-button" type="button" onClick={() => onRestoreTeam(team.id)}>
                          <CheckCircle2 size={15} aria-hidden="true" />
                          Restore Team
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </article>
    </section>
  );
}

function TeamFields<T extends AddTeamDraft | TeamDraft>({
  draft,
  onChange,
}: {
  draft: T;
  onChange: (value: SetStateAction<T>) => void;
}) {
  return (
    <div className="team-creator-grid org-team-form-grid">
      <label className="form-field team-creator-span">
        <span>Team Name</span>
        <input value={draft.teamName} onChange={(event) => onChange((current) => ({ ...current, teamName: event.target.value }))} />
      </label>
      <div className="form-field">
        <span>Team Type</span>
        <ChoiceSelect
          aria-label="Team type"
          className="form-choice"
          value={draft.teamType}
          options={TEAM_TYPE_OPTIONS.map((type) => ({ value: type, label: type }))}
          onChange={(teamType) => onChange((current) => ({ ...current, teamType, teamLevel: defaultLevelForTeamType(teamType) }))}
        />
      </div>
      <div className="form-field">
        <span>{draft.teamType === "School" ? "Level" : "Age"}</span>
        <ChoiceSelect
          aria-label="Team level"
          className="form-choice"
          value={draft.teamLevel}
          options={levelOptionsForTeamType(draft.teamType).map((level) => ({ value: level, label: level }))}
          onChange={(teamLevel) => onChange((current) => ({ ...current, teamLevel }))}
        />
      </div>
      <div className="form-field">
        <span>Season</span>
        <ChoiceSelect
          aria-label="Season"
          className="form-choice"
          value={draft.seasonName}
          options={SEASON_OPTIONS.map((season) => ({ value: season, label: season }))}
          onChange={(seasonName) => onChange((current) => ({ ...current, seasonName }))}
        />
      </div>
      <div className="form-field">
        <span>Team State</span>
        <ChoiceSelect
          aria-label="Team state"
          className="form-choice"
          value={draft.teamState}
          options={[{ value: "", label: "Optional" }, ...US_STATE_OPTIONS.map((state) => ({ value: state, label: state }))]}
          onChange={(teamState) => onChange((current) => ({ ...current, teamState, teamCity: "" }))}
        />
      </div>
      <div className="form-field">
        <span>Team City</span>
        <ChoiceSelect
          aria-label="Team city"
          className="form-choice"
          value={draft.teamCity}
          disabled={!draft.teamState}
          options={[
            { value: "", label: draft.teamState ? "Optional" : "Select state first" },
            ...cityOptionsForState(draft.teamState).map((city) => ({ value: city, label: city })),
          ]}
          onChange={(teamCity) => onChange((current) => ({ ...current, teamCity }))}
        />
      </div>
    </div>
  );
}

function StaffTab({
  currentProfileId,
  members,
  onUpdateMember,
}: {
  currentProfileId?: string;
  members: OrganizationManageData["members"];
  onUpdateMember: (profileId: string, role: OrgRole, active?: boolean) => void;
}) {
  const activeAdminCount = members.filter((member) => member.active && member.role === "ADMIN").length;
  return (
    <article className="panel org-manage-panel">
      <div className="panel-heading tight">
        <div>
          <h2>Staff & Admins</h2>
          <p>Organization access is separate from team staff titles.</p>
        </div>
      </div>
      <div className="org-member-table">
        {members.map((member) => {
          const isCurrentLastAdmin = member.profileId === currentProfileId && member.active && member.role === "ADMIN" && activeAdminCount <= 1;
          return (
            <div key={member.profileId} className={`org-member-row ${member.active ? "" : "is-archived"}`}>
              <OrgLogo name={member.displayName} logoUrl={member.avatarUrl} />
              <span className="org-member-row__person">
                <strong>{member.displayName}</strong>
                <small>{member.email ?? "No email"}</small>
              </span>
              <span className="team-chip-row">
                {member.teams.length ? member.teams.slice(0, 3).map((team) => <small key={team.id}>{team.name}</small>) : <small>No teams</small>}
                {member.teams.length > 3 && <small>+{member.teams.length - 3}</small>}
              </span>
              <ChoiceSelect
                aria-label={`Organization role for ${member.displayName}`}
                className="form-choice org-role-choice"
                value={member.role}
                options={[
                  { value: "ADMIN", label: "Org Admin" },
                  { value: "MEMBER", label: "Org Member" },
                ]}
                disabled={isCurrentLastAdmin}
                onChange={(role) => onUpdateMember(member.profileId, role as OrgRole, member.active)}
              />
              <button
                className="icon-button danger-icon-button"
                type="button"
                disabled={isCurrentLastAdmin}
                title={isCurrentLastAdmin ? "Add another org admin before removing your own admin access." : undefined}
                onClick={() => onUpdateMember(member.profileId, member.role, false)}
                aria-label={`Remove ${member.displayName}`}
              >
                <Ban size={15} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function InvitesTab({
  teams,
  invitations,
  showAll,
  onShowAll,
  draft,
  onChange,
  onInvite,
  onCopy,
  onResend,
  onRevoke,
}: {
  teams: OrganizationManageData["teams"];
  invitations: OrganizationManageData["invitations"];
  showAll: boolean;
  onShowAll: () => void;
  draft: InviteDraft;
  onChange: (value: SetStateAction<InviteDraft>) => void;
  onInvite: (event: FormEvent) => void;
  onCopy: (id: string) => void;
  onResend: (id: string) => void;
  onRevoke: (id: string) => void;
}) {
  const visibleInvites = invitations.filter((invite) => invite.status !== "REVOKED");
  const displayedInvites = showAll ? visibleInvites : visibleInvites.slice(0, 5);
  return (
    <section className="org-manage-grid">
      <form className="panel org-manage-panel" onSubmit={onInvite}>
        <div className="panel-heading tight">
          <div>
            <h2>Invite Staff</h2>
            <p>Create a secure staff invitation link.</p>
          </div>
          <button className="primary-button" type="submit">
            <Mail size={15} aria-hidden="true" />
            Send Invite
          </button>
        </div>
        <div className="team-creator-grid">
          <label className="form-field team-creator-span">
            <span>Email</span>
            <input type="email" value={draft.email} onChange={(event) => onChange((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label className="form-field">
            <span>First Name</span>
            <input value={draft.firstName} onChange={(event) => onChange((current) => ({ ...current, firstName: event.target.value }))} />
          </label>
          <label className="form-field">
            <span>Last Name</span>
            <input value={draft.lastName} onChange={(event) => onChange((current) => ({ ...current, lastName: event.target.value }))} />
          </label>
          <div className="form-field">
            <span>Org Role</span>
            <ChoiceSelect
              aria-label="Organization role"
              className="form-choice"
              value={draft.orgRole}
              options={[
                { value: "MEMBER", label: "Org Member" },
                { value: "ADMIN", label: "Org Admin" },
              ]}
              onChange={(orgRole) => onChange((current) => ({ ...current, orgRole: orgRole as OrgRole }))}
            />
          </div>
          <div className="form-field">
            <span>Staff Role</span>
            <ChoiceSelect
              aria-label="Staff role"
              className="form-choice"
              value={draft.staffRole}
              options={STAFF_ROLE_OPTIONS.map((role) => ({ value: role, label: role }))}
              onChange={(staffRole) => onChange((current) => ({ ...current, staffRole }))}
            />
          </div>
          <div className="form-field">
            <span>App Access</span>
            <ChoiceSelect
              aria-label="Application access"
              className="form-choice"
              value={draft.accessRole}
              options={[
                { value: "COACH", label: "Coach" },
                { value: "ADMIN", label: "Admin" },
              ]}
              onChange={(accessRole) => onChange((current) => ({ ...current, accessRole: accessRole as "ADMIN" | "COACH" }))}
            />
          </div>
        </div>
        <div className="org-team-checkboxes" aria-label="Teams">
          {teams.map((team) => (
            <label key={team.id}>
              <span className="sr-only">Invite to {team.name}</span>
              <input
                type="checkbox"
                checked={draft.teamIds.includes(team.id)}
                onChange={(event) => onChange((current) => ({
                  ...current,
                  teamIds: event.target.checked
                    ? [...current.teamIds, team.id]
                    : current.teamIds.filter((teamId) => teamId !== team.id),
                }))}
              />
              <span>
                <strong>{team.name}</strong>
                <small>{team.season?.name ?? "Current season"}</small>
              </span>
            </label>
          ))}
        </div>
      </form>

      <article className="panel org-manage-panel">
        <div className="panel-heading tight">
          <div>
            <h2>Invites</h2>
            <p>Pending, accepted, and expired links.</p>
          </div>
          {!showAll && visibleInvites.length > 5 && (
            <button className="text-button" type="button" onClick={onShowAll}>
              View all
            </button>
          )}
        </div>
        <div className="org-invite-list">
          {displayedInvites.length ? displayedInvites.map((invite) => (
            <div key={invite.id} className="org-invite-row">
              <span>
                <strong>{invite.email}</strong>
                <small>{invite.teamNames.join(", ") || "No teams"} - {invite.staffRole}</small>
              </span>
              <span className={`staff-status-badge staff-status-badge--${invite.status.toLowerCase().replace("_", "-")}`}>
                {invite.status.replace("_", " ")}
              </span>
              <small>{invite.orgRole === "ADMIN" ? "Org Admin" : "Org Member"}</small>
              <div className="org-invite-actions">
                <button className="icon-button" type="button" onClick={() => onCopy(invite.id)} aria-label={`Copy invite link for ${invite.email}`}>
                  <Copy size={15} aria-hidden="true" />
                </button>
                <button className="icon-button" type="button" onClick={() => onResend(invite.id)} aria-label={`Resend invite to ${invite.email}`}>
                  <RefreshCw size={15} aria-hidden="true" />
                </button>
                {invite.status === "PENDING" && (
                  <button className="icon-button danger-icon-button" type="button" onClick={() => onRevoke(invite.id)} aria-label={`Revoke invite to ${invite.email}`}>
                    <Ban size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          )) : <CompactEmpty title="No invitations yet" />}
        </div>
      </article>
    </section>
  );
}

function VisibilityTab({ value, onChange }: { value: OrganizationVisibility; onChange: (value: OrganizationVisibility) => void }) {
  const items: Array<{ value: OrganizationVisibility; title: string; copy: string }> = [
    { value: "PUBLIC", title: "Public", copy: "Discoverable on Clubhouse 9." },
    { value: "UNLISTED", title: "Unlisted", copy: "Visible by direct link only." },
    { value: "PRIVATE", title: "Private", copy: "Members only." },
  ];
  return (
    <article className="panel org-manage-panel">
      <div className="panel-heading tight">
        <div>
          <h2>Visibility</h2>
          <p>Public pages never expose private coaching data.</p>
        </div>
      </div>
      <div className="visibility-choice-grid">
        {items.map((item) => (
          <button key={item.value} type="button" className={value === item.value ? "active" : ""} onClick={() => onChange(item.value)}>
            <ShieldCheck size={17} aria-hidden="true" />
            <strong>{item.title}</strong>
            <small>{item.copy}</small>
          </button>
        ))}
      </div>
    </article>
  );
}

function ChoiceSelect({
  label,
  value,
  options,
  onChange,
  className,
  disabled = false,
  "aria-label": ariaLabel,
}: {
  label?: string;
  value: string;
  options: ChoiceOption[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div
      className={["choice-select", open ? "open" : "", className].filter(Boolean).join(" ")}
      onBlur={(event) => {
        const nextFocus = event.relatedTarget instanceof Node ? event.relatedTarget : null;
        if (!nextFocus || !event.currentTarget.contains(nextFocus)) setOpen(false);
      }}
    >
      {label && <span className="choice-select__label">{label}</span>}
      <button
        type="button"
        className="choice-select__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? label}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <strong>{selected?.label ?? "Select"}</strong>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && !disabled && (
        <div className="choice-select__menu" role="listbox" aria-label={ariaLabel ?? label}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === value ? "active" : ""}
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OrgLogo({ name, logoUrl, large = false }: { name: string; logoUrl?: string; large?: boolean }) {
  const resolvedLogoUrl = logoUrl || (/metrolina/i.test(name) ? "/brand/metrolina-baseball-alpha.png" : "");
  return (
    <span className={`organization-logo ${large ? "organization-logo--lg" : ""}`} aria-hidden="true">
      {resolvedLogoUrl ? <img src={resolvedLogoUrl} alt="" /> : initialsFor(name)}
    </span>
  );
}

function isProgramContainerTeam(team: { name?: string; level?: string; teamType?: string }) {
  const name = (team.name ?? "").trim().toLowerCase();
  const level = (team.level ?? "").trim().toLowerCase();
  const teamType = (team.teamType ?? "").trim().toLowerCase();
  return teamType === "program" || level === "program" || name === "baseball" || name.endsWith(" baseball program") || name.includes(" program");
}

function ImageCropModal({
  state,
  title,
  onChange,
  onCancel,
  onPickDifferent,
  onApply,
}: {
  state: CropState;
  title: string;
  onChange: Dispatch<SetStateAction<CropState | null>>;
  onCancel: () => void;
  onPickDifferent: () => void;
  onApply: () => void;
}) {
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const previewStyle: CSSProperties = {
    transform: `translate(calc(-50% + ${state.offsetX}px), calc(-50% + ${state.offsetY}px)) scale(${state.zoom})`,
  };

  function moveCrop(clientX: number, clientY: number) {
    const drag = dragRef.current;
    if (!drag) return;
    const maxOffset = 150;
    onChange((current) => current ? {
      ...current,
      offsetX: clamp(drag.originX + clientX - drag.startX, -maxOffset, maxOffset),
      offsetY: clamp(drag.originY + clientY - drag.startY, -maxOffset, maxOffset),
    } : current);
  }

  return (
    <div className="modal-backdrop avatar-crop-backdrop" role="dialog" aria-modal="true" aria-label="Crop organization logo">
      <div className="modal-panel avatar-crop-modal">
        <div className="modal-title">
          <div>
            <h2>{title}</h2>
            <p>{state.fileName}</p>
          </div>
          <button className="icon-button modal-close-button" type="button" onClick={onCancel} aria-label="Close">
            <X size={17} aria-hidden="true" />
          </button>
        </div>
        <div
          className="avatar-crop-stage"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: state.offsetX, originY: state.offsetY };
          }}
          onPointerMove={(event) => moveCrop(event.clientX, event.clientY)}
          onPointerUp={(event) => {
            if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          <img src={state.sourceUrl} alt="" style={previewStyle} draggable={false} />
          <div className="avatar-crop-mask" aria-hidden="true" />
        </div>
        <div className="avatar-crop-controls">
          <label>
            <span>Zoom</span>
            <input
              type="range"
              min="1"
              max="2.8"
              step="0.01"
              value={state.zoom}
              onChange={(event) => onChange((current) => current ? { ...current, zoom: Number(event.target.value) } : current)}
            />
          </label>
        </div>
        {state.message && <span className="profile-save-message profile-save-message--error">{state.message}</span>}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onPickDifferent}>Choose Different</button>
          <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button>
          <button className="primary-button" type="button" onClick={onApply} disabled={state.status === "saving"}>
            {state.status === "saving" ? "Cropping..." : "Use Logo"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompactEmpty({ title }: { title: string }) {
  return (
    <div className="compact-empty">
      <span>{title}</span>
    </div>
  );
}

async function cropImage(state: CropState) {
  const image = await loadImage(state.sourceUrl);
  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  if (!sourceSize) throw new Error("Unable to read that image.");
  const outputSize = 320;
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to crop that image.");

  const scale = outputSize / sourceSize;
  const drawnWidth = image.naturalWidth * scale * state.zoom;
  const drawnHeight = image.naturalHeight * scale * state.zoom;
  const drawX = (outputSize - drawnWidth) / 2 + state.offsetX;
  const drawY = (outputSize - drawnHeight) / 2 + state.offsetY;

  context.save();
  context.beginPath();
  context.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = "#11151b";
  context.fillRect(0, 0, outputSize, outputSize);
  context.imageSmoothingQuality = "high";
  context.drawImage(image, drawX, drawY, drawnWidth, drawnHeight);
  context.restore();

  return canvas.toDataURL("image/webp", 0.78);
}

function loadImage(sourceUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to read that image."));
    image.src = sourceUrl;
  });
}

function defaultTeamDraft(organization?: OrganizationManageData["organization"]): AddTeamDraft {
  return {
    teamName: "",
    teamType: "School",
    teamLevel: "Varsity",
    teamState: organization?.state ?? "",
    teamCity: organization?.city ?? "",
    seasonName: SEASON_OPTIONS[0] ?? "Summer 2026",
  };
}

function defaultInviteDraft(data: OrganizationManageData): InviteDraft {
  const firstTeam = data.teams.find((team) => team.active);
  return {
    email: "",
    firstName: "",
    lastName: "",
    staffRole: "Assistant Coach",
    orgRole: "MEMBER",
    accessRole: "COACH",
    teamIds: firstTeam ? [firstTeam.id] : [],
  };
}

function teamDraftsFromData(data: OrganizationManageData) {
  return Object.fromEntries(data.teams.map((team) => [team.id, teamDraftFromTeam(team)]));
}

function teamDraftFromTeam(team: OrganizationManageData["teams"][number]): TeamDraft {
  const teamType = team.teamType ?? "School";
  return {
    teamName: team.name,
    teamType,
    teamLevel: team.teamType && team.teamType !== "School" ? team.ageGroup ?? team.level ?? "17U" : team.level ?? "Varsity",
    teamState: team.state ?? "",
    teamCity: team.city ?? "",
    seasonName: team.season?.name ?? SEASON_OPTIONS[0] ?? "Summer 2026",
    visibility: team.visibility,
    active: team.active,
  };
}

function buildSeasonOptions() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const startingSeason = month >= 8 ? "Fall" : month >= 5 ? "Summer" : "Spring";
  const seasons = new Set<string>();
  const seasonNames = ["Spring", "Summer", "Fall"];
  seasons.add(`${startingSeason} ${currentYear}`);
  for (let year = currentYear; year <= currentYear + 2; year += 1) {
    for (const season of seasonNames) seasons.add(`${season} ${year}`);
  }
  return [...seasons];
}

function levelOptionsForTeamType(teamType: string) {
  return teamType === "School" ? SCHOOL_LEVEL_OPTIONS : AGE_GROUP_OPTIONS;
}

function defaultLevelForTeamType(teamType: string) {
  return teamType === "School" ? "Varsity" : "17U";
}

function visibilityLabel(visibility: OrganizationVisibility) {
  return visibility.charAt(0) + visibility.slice(1).toLowerCase();
}

function initialsFor(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : value.slice(0, 2).toUpperCase();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
