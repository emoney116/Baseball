import type { Metadata } from "next";
import type React from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Metrolina Baseball",
  description: "A local-first player development, practice, weight room, and game operations console for Metrolina baseball coaches.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Metrolina Baseball",
    description: "Track player development, practices, weights, games, notes, and fall baseball trends.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Metrolina Baseball",
    description: "A coach-first Metrolina baseball operations console.",
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
