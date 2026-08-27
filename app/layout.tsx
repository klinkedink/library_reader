import type { Metadata, Viewport } from "next";
import { Fraunces, Figtree } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["SOFT", "WONK", "opsz"],
});

const sans = Figtree({
  subsets: ["latin"],
  variable: "--font-sans-body",
});

export const metadata: Metadata = {
  title: "Shelf Pick",
  description:
    "Photograph a bookshelf. Rank the books in front of you using your Goodreads taste.",
  applicationName: "Shelf Pick",
  appleWebApp: {
    capable: true,
    title: "Shelf Pick",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#7A2E2E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}
