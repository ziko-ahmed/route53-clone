"use client";

/** The left-hand navigation, matching the sections of the real Route 53 console. */

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS: { heading?: string; links: { href: string; label: string }[] }[] = [
  {
    links: [{ href: "/dashboard", label: "Dashboard" }],
  },
  {
    heading: "DNS management",
    links: [{ href: "/hosted-zones", label: "Hosted zones" }],
  },
  {
    heading: "Traffic management",
    links: [{ href: "/traffic-policies", label: "Traffic policies" }],
  },
  {
    heading: "Availability monitoring",
    links: [{ href: "/health-checks", label: "Health checks" }],
  },
  {
    heading: "Resolver",
    links: [
      { href: "/resolver", label: "VPCs" },
      { href: "/profiles", label: "Profiles" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="sidebar" aria-label="Route 53 sections">
      <div className="sidebar-title">Route 53</div>
      {SECTIONS.map((section, index) => (
        <div key={section.heading ?? index}>
          {section.heading && <div className="sidebar-group">{section.heading}</div>}
          {section.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              // "starts with" so /hosted-zones/Z123 keeps "Hosted zones" highlighted
              className={
                pathname === link.href || pathname.startsWith(`${link.href}/`)
                  ? "sidebar-link active"
                  : "sidebar-link"
              }
            >
              {link.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
