import type { Metadata } from "next";
import { Geist } from "next/font/google";
import type React from "react";
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE, BRAND_ASSETS } from "./lib/branding";
import { absoluteUrl, productionSiteUrl } from "./lib/siteUrl";
import { THEME_BOOTSTRAP_SCRIPT } from "./lib/themePreference";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(productionSiteUrl()),
  title: APP_NAME,
  applicationName: APP_NAME,
  description: APP_DESCRIPTION,
  alternates: {
    canonical: absoluteUrl("/"),
  },
  icons: {
    icon: [
      { url: BRAND_ASSETS.icon32, sizes: "32x32", type: "image/png" },
      { url: BRAND_ASSETS.icon, sizes: "192x192", type: "image/png" },
    ],
    shortcut: BRAND_ASSETS.icon32,
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
    <html lang="en" data-theme="dark" className={geist.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
