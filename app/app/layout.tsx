import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hadar Advertising — Job Management",
  description: "Job/project management for Hadar Advertising signage jobs.",
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
