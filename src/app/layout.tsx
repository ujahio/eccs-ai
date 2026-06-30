import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "E-Clinical Case Solutions",
  description: "Clinical case delivery and recordkeeping for continuing education."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
