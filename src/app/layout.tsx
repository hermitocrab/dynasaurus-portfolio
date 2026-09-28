import type { Metadata, Viewport } from "next";
import "./globals.css";
import CookieNotice from "@/components/CookieNotice";
import { getAdsConfig } from "@/lib/ads";
import {
  PRODUCT_DESCRIPTION,
  PRODUCT_TITLE,
  SITE_NAME,
  SITE_URL,
  SOCIAL_IMAGE,
} from "@/lib/seo";

// Short title for the home-screen icon label — long titles get truncated by iOS
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: PRODUCT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: PRODUCT_DESCRIPTION,
  keywords: ["language tutor", "AI dictionary", "IELTS coach", "grammar checker", "translator", "vocabulary builder", "language learning", "RUA method", "Kee Lee"],
  authors: [{ name: "Kee Lee" }],
  creator: "Kee Lee",
  publisher: "Kee Lee",
  category: "education",
  referrer: "strict-origin-when-cross-origin",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "DynaSaurus",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: PRODUCT_TITLE,
    description: PRODUCT_DESCRIPTION,
    locale: "en_US",
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: PRODUCT_TITLE,
    description: PRODUCT_DESCRIPTION,
    images: [SOCIAL_IMAGE.url],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0D0D0F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The cookie notice is a prerequisite for advertising and stays invisible
  // while the ad slots are disabled (the default).
  const adsEnabled = getAdsConfig().enabled;

  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('dynasaurus-theme-manual');var t=m?localStorage.getItem('dynasaurus-theme'):(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t||'dark')}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--color-bg)] text-[var(--color-text-primary)] font-sans selection:bg-[var(--color-accent)]/30 selection:text-[var(--color-text-primary)]">
        {children}
        {adsEnabled && <CookieNotice />}
      </body>
    </html>
  );
}
