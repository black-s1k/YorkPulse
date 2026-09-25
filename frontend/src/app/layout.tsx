import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import { AppShell } from "@/components/layout";
import { NameSetupGuard } from "@/components/NameSetupGuard";
import { SANDBOX_EMAILS } from "@/lib/sandbox";
import "./globals.css";
import "leaflet/dist/leaflet.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "YorkPulse",
    template: "%s | YorkPulse",
  },
  description: "Community and safety platform for York University students",
  keywords: ["York University", "student community", "marketplace", "campus safety"],
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
    shortcut: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#E31837",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Hide the app before hydration for sandbox accounts (see SandboxGate) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=JSON.parse(localStorage.getItem("yorkpulse-auth")||"{}").state.accessToken;var e=JSON.parse(atob(t.split(".")[1])).email.toLowerCase();if(${JSON.stringify(SANDBOX_EMAILS)}.indexOf(e)>-1)document.documentElement.dataset.sandbox="1"}catch(_){}`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <Providers>
          <NameSetupGuard />
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
