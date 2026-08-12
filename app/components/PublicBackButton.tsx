"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function PublicBackButton({ href, label = "Go back" }: { href?: string; label?: string }) {
  const router = useRouter();

  if (href) {
    return (
      <Link className="public-back-button" href={href} aria-label={label}>
        <ChevronLeft size={17} aria-hidden="true" />
      </Link>
    );
  }

  return (
    <button className="public-back-button" type="button" onClick={() => router.back()} aria-label={label}>
      <ChevronLeft size={17} aria-hidden="true" />
    </button>
  );
}
