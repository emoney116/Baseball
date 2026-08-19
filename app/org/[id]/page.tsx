import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicBackButton } from "../../components/PublicBackButton";
import { PublicFollowButton } from "../../components/PublicFollowButton";
import { APP_NAME, BRAND_ASSETS } from "../../lib/branding";
import { hasOrganizationAdminAccess } from "../../lib/organizationManagement";
import { getPublicOrganizationDirectory } from "../../lib/publicDirectory";
import { createAdminClient } from "../../lib/supabase/admin";
import { createClient } from "../../lib/supabase/server";

export default async function OrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organization = await getPublicOrganizationDirectory(id);
  if (!organization) notFound();
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const canManage = authData.user
    ? await hasOrganizationAdminAccess(createAdminClient(), authData.user.id, organization.id).catch(() => false)
    : false;
  const location = [organization.city, organization.state].filter(Boolean).join(", ");

  return (
    <main className="public-shell">
      <header className="public-topbar">
        <div className="public-topbar__left">
          <PublicBackButton />
          <Link href="/" className="public-brand">
            <img className="brand-mark-image" src={BRAND_ASSETS.mark} alt="" />
            <span>{APP_NAME}</span>
          </Link>
        </div>
        <div className="public-topbar__actions">
          {canManage && (
            <Link href={`/org/${organization.slug || organization.id}/manage`} className="primary-button public-manage-link">
              Manage Organization
            </Link>
          )}
          <PublicFollowButton
            organizationId={organization.id}
            label="Follow Org"
            locked={!organization.canFollow}
            lockedLabel="You already have access to this organization"
          />
        </div>
      </header>

      <section className="public-hero public-hero--compact">
        <div className="organization-logo organization-logo--lg" aria-hidden="true">
          {organization.logoUrl ? <img src={organization.logoUrl} alt="" /> : organization.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <span>{organization.authorized ? "Program workspace" : "Public program"}</span>
          <h1>{organization.name}</h1>
          <p>
            {[location, `${organization.teams.length} active team${organization.teams.length === 1 ? "" : "s"}`]
              .filter(Boolean)
              .join(" - ")}
          </p>
        </div>
      </section>

      <section className="public-section public-org-summary">
        <article className="public-panel">
          <strong>{organization.teams.length}</strong>
          <small>Teams</small>
        </article>
        <article className="public-panel">
          <strong>{organization.adminCount}</strong>
          <small>Admins</small>
        </article>
        <article className="public-panel">
          <strong>{organization.memberCount}</strong>
          <small>Staff & members</small>
        </article>
      </section>

      <section className="public-section">
        <div className="public-section__heading">
          <h2>Teams</h2>
        </div>
        <div className="public-card-grid">
          {organization.teams.length ? organization.teams.map((team) => (
            <article key={team.id} className="public-team-card public-team-card--with-action">
              <Link href={team.workspaceAccess ? `/?view=teamHome&team=${team.id}${team.season?.id ? `&season=${team.season.id}` : ""}` : `/team/${team.id}`} className="public-team-card__link">
                <span>{team.season?.name ?? "Current season"}</span>
                <strong>{team.name}</strong>
                <small>{team.level ?? "Baseball"} - {team.visibility.toLowerCase()}</small>
              </Link>
              <PublicFollowButton
                organizationId={organization.id}
                teamId={team.id}
                compact
                locked={team.authorized}
                lockedLabel="You already have access to this team"
              />
            </article>
          )) : (
            <article className="public-empty">No public teams yet.</article>
          )}
        </div>
      </section>
    </main>
  );
}
