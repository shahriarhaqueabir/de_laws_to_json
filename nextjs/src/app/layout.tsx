import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import NavBar from "../components/nav-bar";
import { AuthProvider } from "../components/auth-context";
import { ChatProvider } from "../components/chat-context";
import { ToastProvider } from "../components/toast";
import { Providers } from "../components/providers";

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
    <html lang="en" className={`${GeistSans.variable}`}>
      <body className="min-h-full flex flex-col bg-[#0d0d0d] text-[#a3a3a3]">
        <Providers>
          <AuthProvider>
            <ChatProvider>
              <ToastProvider>
                <NavBar />
                <div className="flex-1">{children}</div>
              </ToastProvider>
            </ChatProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
