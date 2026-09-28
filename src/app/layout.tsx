import type { Metadata, Viewport } from "next";
import { Anton, Outfit } from "next/font/google";
import "./globals.css";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton", display: "swap" });
const outfit = Outfit({ weight: ["500", "600", "700", "800", "900"], subsets: ["latin"], variable: "--font-outfit", display: "swap" });

export const metadata: Metadata = {
  title: "BLIND QUIZZ — le jeu TV multijoueur",
  description: "Un vrai plateau de jeu télévisé en 3D : 12 secondes, trois niveaux d'aide (4, 2 ou SOLO), une roue bonus/malus et vos amis en direct.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#03040b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${anton.variable} ${outfit.variable}`}>
      <body>
        <FontBridge display={anton.style.fontFamily} text={outfit.style.fontFamily} />
        {children}
      </body>
    </html>
  );
}

/** Transmet les familles de polices générées par next/font aux écrans dessinés en canvas. */
function FontBridge({ display, text }: { display: string; text: string }) {
  return <script dangerouslySetInnerHTML={{ __html: `window.__BQ_FONTS=${JSON.stringify({ display, text })}` }} />;
}
