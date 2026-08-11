import Link from "next/link";
import { notFound } from "next/navigation";
import { APP_NAME, BRAND_ASSETS } from "../../lib/branding";
import { getPublicOrganizationDirectory } from "../../lib/publicDirectory";

export default async function OrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organization = await getPublicOrganizationDirectory(id);
  if (!organization) notFound();

  return (
    <main className="public-shell">
      <header className="public-topbar">
        <Link href="/" className="public-brand">
          <img src={BRAND_ASSETS.mark} alt="" />
          <span>{APP_NAME}</span>
        </Link>
        <Link href="/" className="secondary-button">Open App</Link>
      </header>

      <section className="public-hero public-hero--compact">
        <div className="organization-logo organization-logo--lg" aria-hidden="true">
          {organization.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <span>{organization.authorized ? "Program workspace" : "Public program"}</span>
          <h1>{organization.name}</h1>
          <p>{organization.teams.length} active team{organization.teams.length === 1 ? "" : "s"}</p>
        </div>
      </section>

      <section className="public-section">
        <div className="public-section__heading">
          <h2>Teams</h2>
        </div>
        <div className="public-card-grid">
          {organization.teams.length ? organization.teams.map((team) => (
            <Link key={team.id} href={`/team/${team.id}`} className="public-team-card">
              <span>{team.season?.name ?? "Current season"}</span>
              <strong>{team.name}</strong>
              <small>{team.level ?? "Baseball"} · {team.visibility.toLowerCase()}</small>
            </Link>
          )) : (
            <article className="public-empty">No public teams yet.</article>
          )}
        </div>
      </section>
    </main>
  );
}
