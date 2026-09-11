import { notFound } from "next/navigation";
import { AskExperiencePreview } from "./preview";

export default function AskPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <AskExperiencePreview />;
}
