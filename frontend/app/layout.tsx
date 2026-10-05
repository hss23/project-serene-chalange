import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Serene Mentors",
  description: "Transparent mentor matching and a programme assistant grounded in a knowledge base.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="page-glow flex min-h-full flex-col bg-no-repeat">
        <AuthProvider>
          <NavBar />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
          <footer className="border-t border-line py-6 text-center text-xs text-subtle">
            Serene Mentors is a demo with fictional people and organisations. It does not provide medical, legal or
            financial advice.
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
