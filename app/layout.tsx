import type { Metadata } from "next";
import type React from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Metrolina Fall Ball Lab",
  description: "A local-first practice tracking console for Metrolina baseball coaches.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Metrolina Fall Ball Lab",
    description: "Track bullpens, BP rounds, Live BP reps, player notes, and fall baseball trends.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Metrolina Fall Ball Lab",
    description: "A coach-first Metrolina baseball practice tracker.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
