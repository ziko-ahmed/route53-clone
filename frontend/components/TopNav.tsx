"use client";

/** The dark bar across the top, with the account menu on the right. */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

import { Icon } from "./Icon";

export function TopNav({ onShowShortcuts }: { onShowShortcuts?: () => void }) {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the account menu when you click anywhere else.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <header className="topnav">
      <div className="topnav-left">
        <Link href="/hosted-zones" className="topnav-logo">
          <span className="topnav-logo-mark" aria-hidden="true">
            53
          </span>
          <span>Route 53</span>
        </Link>
      </div>

      <div className="topnav-right" ref={menuRef} style={{ position: "relative" }}>
        <span className="topnav-item topnav-sub" aria-hidden="true">
          Global
        </span>
        {onShowShortcuts && (
          <button
            className="topnav-item"
            onClick={onShowShortcuts}
            title="Keyboard shortcuts (press ?)"
            aria-label="Keyboard shortcuts"
          >
            <Icon name="keyboard" />
          </button>
        )}
        <button
          className="topnav-item"
          onClick={toggle}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} />
        </button>
        <button
          className="topnav-item topnav-account"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          {user?.display_name ?? "Account"} ▾
        </button>

        {menuOpen && (
          <div
            role="menu"
            style={{
              position: "absolute",
              top: 42,
              right: 0,
              minWidth: 240,
              background: "var(--surface)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow-lg)",
              padding: 12,
              zIndex: 50,
            }}
          >
            <div style={{ fontWeight: 700 }}>{user?.email}</div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
              Account ID: {user?.account_id}
            </div>
            <button className="btn btn-sm btn-block" onClick={handleSignOut} role="menuitem">
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
