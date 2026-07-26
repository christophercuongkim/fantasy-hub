import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "fantasy-hub",
  description: "Personal NFL fantasy analytics",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
