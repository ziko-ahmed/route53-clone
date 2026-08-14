"use client";

/**
 * The shell every signed-in page sits inside: top bar, left navigation,
 * and the guard that bounces you to /login if you are not signed in.
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { useAuth } from "@/lib/auth";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // While we are checking the saved token, show nothing rather than a
  // flash of the console followed by a redirect.
  if (loading || !user) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <span className="spinner" style={{ width: 24, height: 24, color: "var(--link)" }} />
      </div>
    );
  }

  return (
    <>
      <TopNav />
      <div className="console">
        <Sidebar />
        <main className="main">
          <div className="main-inner">{children}</div>
        </main>
      </div>
    </>
  );
}
