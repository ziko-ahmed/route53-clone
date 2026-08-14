import Link from "next/link";
import { Fragment } from "react";

/** "Route 53 › Hosted zones › example.com" above the page title. */
export function Breadcrumbs({ trail }: { trail: { label: string; href?: string }[] }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumbs">
      {trail.map((crumb, index) => (
        <Fragment key={`${crumb.label}-${index}`}>
          {index > 0 && (
            <span className="sep" aria-hidden="true">
              /
            </span>
          )}
          {crumb.href && index < trail.length - 1 ? (
            <Link href={crumb.href}>{crumb.label}</Link>
          ) : (
            <span>{crumb.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
