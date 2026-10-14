import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Career Ops | Your next move",
  description: "Find better-fit roles, prepare with evidence, and keep your job search moving. A private workspace adapted from Career Ops.",
  icons: {
    icon: "/favicon-career.svg",
    shortcut: "/favicon-career.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
