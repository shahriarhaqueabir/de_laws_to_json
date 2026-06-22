import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Playfair_Display } from "next/font/google";

const serif = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif-playfair",
  display: "swap",
});
import "./globals.css";
import NavBar from "../components/nav-bar";
import { AuthProvider } from "../components/auth-context";
import { LangProvider } from "../components/lang-provider";
import { ChatProvider } from "../components/chat-context";
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
    <html lang="en" className={`${GeistSans.variable} ${serif.variable}`}>
      <body className="min-h-full flex flex-col bg-background text-zinc-400">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-accent-gold focus:text-black focus:outline-none focus:text-xs focus:font-bold focus:uppercase focus:tracking-widest"
        >
          Skip to content
        </a>
        <LangProvider>
          <Providers>
            <AuthProvider>
              <ChatProvider>
                <NavBar />
                <div id="main-content" className="flex-1">
                  {children}
                </div>
              </ChatProvider>
            </AuthProvider>
          </Providers>
        </LangProvider>
      </body>
    </html>
  );
}
