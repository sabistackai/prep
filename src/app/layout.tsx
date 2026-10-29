import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import { ServiceWorker } from "@/components/service-worker";
import "./globals.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PREP",
  description: "Parents' Routine & Errands Planner",
  appleWebApp: { capable: true, title: "PREP", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0A0F14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-NG">
      <body className={`${manrope.variable} ${jetbrains.variable} min-h-dvh antialiased`}>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
