"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function PublicBackButton() {
  const router = useRouter();

  return (
    <button className="public-back-button" type="button" onClick={() => router.back()} aria-label="Go back">
      <ChevronLeft size={17} aria-hidden="true" />
    </button>
  );
}
