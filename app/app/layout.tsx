import type { Metadata, Viewport } from "next";
// Fonts ship inside the app (npm packages) instead of next/font/google:
// downloading them from Google at build time on the host occasionally
// produced a page and stylesheet with mismatched font class names, so the
// app silently fell back to the device's default font.
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hadar Advertising — Job Management",
  description: "Job/project management for Hadar Advertising signage jobs.",
};

/** Locks out pinch/double-tap zoom on phones so the app behaves like a
 * native app rather than a zoomable web page (browsers don't let a page
 * disable Ctrl+scroll/Ctrl+±/desktop-native zoom — only touch-gesture
 * zoom on mobile is under the page's control via the viewport meta). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
