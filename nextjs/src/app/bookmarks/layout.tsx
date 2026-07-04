import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bookmarks",
  description: "Your saved German laws and case folders.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function BookmarksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
