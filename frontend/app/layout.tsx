import type { Metadata } from "next";

import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/lib/toast";

import "./globals.css";

export const metadata: Metadata = {
  title: "Route 53 Management Console",
  description: "A Route 53 clone for managing hosted zones and DNS records.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
