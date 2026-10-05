import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import ConfigGate from "@/components/ConfigGate";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "ReelForge – Create and share AI videos",
  description: "Turn your stories and ideas into short AI videos in seconds. Share them publicly or keep them private.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={outfit.variable}>
      <body>
        <div className="shell">
          <Sidebar />
          <main className="main"><ConfigGate>{children}</ConfigGate></main>
        </div>
      </body>
    </html>
  );
}
