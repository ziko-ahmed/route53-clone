"use client";

/**
 * Left-hand navigation.
 *
 * Two levels, and they are meant to look like two levels: a section is a
 * quiet uppercase label that does nothing when clicked, and the pages
 * beneath it are indented against a hairline guide so the grouping reads
 * at a glance.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "./Icon";

type Item = { href: string; label: string; icon: string };

// A section with no heading renders as a single top-level link.
const SECTIONS: { heading?: string; items: Item[] }[] = [
  { items: [{ href: "/dashboard", label: "Dashboard", icon: "dashboard" }] },
  {
    heading: "DNS management",
    items: [{ href: "/hosted-zones", label: "Hosted zones", icon: "zones" }],
  },
  {
    heading: "Traffic management",
    items: [{ href: "/traffic-policies", label: "Traffic policies", icon: "traffic" }],
  },
  {
    heading: "Availability monitoring",
    items: [{ href: "/health-checks", label: "Health checks", icon: "health" }],
  },
  {
    heading: "Resolver",
    items: [
      { href: "/resolver", label: "VPCs", icon: "resolver" },
      { href: "/profiles", label: "Profiles", icon: "profiles" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="sidebar" aria-label="Route 53 sections">
      <div className="sidebar-title">Route 53</div>

      {SECTIONS.map((section, index) =>
        section.heading ? (
          <div className="sidebar-section" key={section.heading}>
            <h2 className="sidebar-group">{section.heading}</h2>
            <div className="sidebar-children">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={isActive(item.href) ? "sidebar-link active" : "sidebar-link"}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="sidebar-section" key={index}>
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={
                  isActive(item.href) ? "sidebar-link top active" : "sidebar-link top"
                }
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        ),
      )}
    </nav>
  );
}
