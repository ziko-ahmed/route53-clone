import type { Metadata } from "next";

import { AuthProvider } from "@/lib/auth";
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/lib/theme";
import { ToastProvider } from "@/lib/toast";

import "./globals.css";

export const metadata: Metadata = {
  title: "Route 53 Management Console",
  description: "A Route 53 clone for managing hosted zones and DNS records.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sets the theme before the first paint, so dark mode never flashes white. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
