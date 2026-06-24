import type { Metadata } from "next";
import { Bricolage_Grotesque, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Display headlines — characterful modern grotesque (variable font).
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  weight: ["400", "600", "700", "800"],
});

// Stats / mono labels.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "CropIntel — Diagnose crop disease from a single photo",
  description:
    "Point your phone at a leaf. CropIntel names the disease, rates the severity, and tells you what to do — in seconds, even offline.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${spaceGrotesk.variable}`}>
      <head>
        {/* Satoshi (body) lives on Fontshare, not Google Fonts. Body font falls
            back to Bricolage in globals.css if this fails to load. */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
