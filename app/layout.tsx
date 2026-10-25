import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "L'équipe — Soft Vodooz",
  description:
    "Dix visages, un seul bureau : l'équipe Soft Vodooz, présentée comme un plan-séquence.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
