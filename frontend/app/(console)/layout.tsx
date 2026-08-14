"use client";

/**
 * The shell every signed-in page sits inside: top bar, left navigation,
 * the auth guard, and the two shortcuts that work on every page.
 */

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ShortcutsHelp } from "@/components/ShortcutsHelp";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useShortcuts, type Shortcut } from "@/lib/useShortcuts";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { toggle } = useTheme();
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const shortcuts = useMemo<Shortcut[]>(
    () => [
      { key: "?", description: "Show shortcuts", run: () => setHelpOpen(true) },
      { key: "d", description: "Toggle dark mode", run: toggle },
    ],
    [toggle],
  );

  useShortcuts(shortcuts, Boolean(user));

  // While we check the saved token, show a spinner rather than a flash of
  // the console followed by a redirect.
  if (loading || !user) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <span className="spinner" style={{ width: 24, height: 24, color: "var(--link)" }} />
      </div>
    );
  }

  return (
    <>
      <TopNav onShowShortcuts={() => setHelpOpen(true)} />
      <div className="console">
        <Sidebar />
        <main className="main">
          <div className="main-inner">{children}</div>
        </main>
      </div>
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
