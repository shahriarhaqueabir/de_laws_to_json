import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import NavBar from "../components/nav-bar";
import { AuthProvider } from "../components/auth-context";
import { ToastProvider } from "../components/toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "German Law Vault",
  description: "AI-Assisted German Law Search & Guidance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-full flex flex-col bg-[#0d0d0d] text-[#a3a3a3]">
        <AuthProvider>
          <ToastProvider>
            <NavBar />
            <div className="flex-1">{children}</div>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
