import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";
import {
  NotificationProvider,
  NotificationViewport
} from "@/components/ui/notifications";
import "./globals.css";

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-nunito-sans"
});

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
    <html lang="en" className={nunitoSans.variable}>
      <body>
        <NotificationProvider>
          {children}
          <NotificationViewport />
        </NotificationProvider>
      </body>
    </html>
  );
}
