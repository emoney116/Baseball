import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicBackButton } from "../../../components/PublicBackButton";
import { APP_NAME, BRAND_ASSETS } from "../../../lib/branding";
import {
  hasOrganizationAdminAccess,
  readOrganizationManageData,
  resolveOrganizationByIdentifier,
} from "../../../lib/organizationManagement";
import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient } from "../../../lib/supabase/server";
import { OrgManageClient } from "./OrgManageClient";

export default async function OrganizationManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const organization = await resolveOrganizationByIdentifier(admin, id);
  if (!organization) notFound();

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const canManage = authData.user
    ? await hasOrganizationAdminAccess(admin, authData.user.id, organization.id).catch(() => false)
    : false;

  if (!canManage) {
    return (
      <main className="public-shell">
        <header className="public-topbar">
          <div className="public-topbar__left">
            <PublicBackButton />
            <Link href="/" className="public-brand">
              <img src={BRAND_ASSETS.mark} alt="" />
              <span>{APP_NAME}</span>
            </Link>
          </div>
        </header>
        <section className="public-hero public-hero--compact">
          <div>
            <span>Organization access</span>
            <h1>Admin access required</h1>
            <p>Only organization admins can manage {organization.name}.</p>
          </div>
        </section>
      </main>
    );
  }

  const data = await readOrganizationManageData(admin, organization.id);

  return (
    <main className="public-shell org-manage-shell">
      <header className="public-topbar">
        <div className="public-topbar__left">
          <PublicBackButton />
          <Link href="/" className="public-brand">
            <img src={BRAND_ASSETS.mark} alt="" />
            <span>{APP_NAME}</span>
          </Link>
        </div>
        <Link href={`/org/${organization.slug || organization.id}`} className="secondary-button">
          View Organization
        </Link>
      </header>
      <OrgManageClient initialData={data} />
    </main>
  );
}
