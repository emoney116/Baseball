import { notFound } from "next/navigation";
import { PlanPreview } from "./PlanPreview";
export const dynamic = "force-dynamic";
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PlanPreview />;
}
