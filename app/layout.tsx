import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Fraunces } from "next/font/google";
import { AppNav } from "@/components/AppNav";
import { ErrorToastStack } from "@/components/ErrorToastStack";
import { PinGate } from "@/components/PinGate";
import { TextureSetting } from "@/components/TextureSetting";
import { THEME_BOOT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Mikke Mus",
  description: "Dartsapp for Mikke Mus",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mikke Mus",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c110e",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="no"
      suppressHydrationWarning
      className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <head>
        {/* The chosen theme is on the page before it is drawn, so Dag does not flash dark first. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <PinGate>{children}</PinGate>
        <AppNav />
        <ErrorToastStack />
        <TextureSetting />
      </body>
    </html>
  );
}
