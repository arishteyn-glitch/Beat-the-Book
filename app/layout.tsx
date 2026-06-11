import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { Sidebar, MobileNav } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export const metadata: Metadata = {
  title: "Beat the Book — Sports Betting OS",
  description:
    "Professional sports betting analytics, bankroll management, promotion optimization, and an AI betting agent.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <StoreProvider>
          <Sidebar />
          <MobileNav />
          <div className="md:pl-56">
            <Topbar />
            <main className="mx-auto max-w-[1400px] p-4 pb-20 md:p-6 md:pb-8">
              {children}
            </main>
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
