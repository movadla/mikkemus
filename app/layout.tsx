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
  // Zoom and "larger text" are the person's to choose, so neither is switched off. Double-tap zoom is (see touch-action in globals.css), because a quick second tap on the board is a dart.
  maximumScale: 5,
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
        {/* The bar is inside the door: it is not drawn over the keypad, and it leaves out what the limited code cannot open. */}
        <PinGate>
          {children}
          <AppNav />
        </PinGate>
        <ErrorToastStack />
        <TextureSetting />
      </body>
    </html>
  );
}
