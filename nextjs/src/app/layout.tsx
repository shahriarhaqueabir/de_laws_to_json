import type { Metadata } from "next";
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import "./globals.css";
import NavBar from "../components/nav-bar";
import { AuthProvider } from "../components/auth-context";
import { ToastProvider } from "../components/toast";

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
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0d0d0d]">
        <AuthProvider>
          <ToastProvider>
            <NavBar />
            <div className="flex-1">
              {children}
            </div>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
