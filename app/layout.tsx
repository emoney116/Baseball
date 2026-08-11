import type { Metadata } from "next";
import type React from "react";
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE, BRAND_ASSETS } from "./lib/branding";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  applicationName: APP_NAME,
  description: APP_DESCRIPTION,
  icons: {
    icon: [
      { url: BRAND_ASSETS.icon32, sizes: "32x32", type: "image/png" },
      { url: BRAND_ASSETS.icon, sizes: "192x192", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: BRAND_ASSETS.icon180, sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: APP_NAME,
    description: APP_TAGLINE,
    images: [BRAND_ASSETS.emailBanner],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: [BRAND_ASSETS.emailBanner],
  },
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "black-translucent",
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
