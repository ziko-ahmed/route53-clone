import Link from "next/link";

import { Breadcrumbs } from "./Breadcrumbs";
import { Icon } from "./Icon";

/**
 * Placeholder used by the sections the assignment allows to be mocked:
 * Dashboard, Traffic policies, Health checks, Resolver and Profiles.
 */
export function ComingSoon({
  title,
  description,
  icon = "clock",
}: {
  title: string;
  description: string;
  icon?: string;
}) {
  return (
    <>
      <Breadcrumbs trail={[{ label: "Route 53", href: "/hosted-zones" }, { label: title }]} />
      <div className="page-header">
        <h1>{title}</h1>
      </div>
      <div className="container">
        <div className="coming-soon">
          <div className="coming-soon-icon">
            <Icon name={icon} size={22} />
          </div>
          <h2>Coming soon</h2>
          <p>{description}</p>
          <Link href="/hosted-zones" className="btn">
            Go to hosted zones
          </Link>
        </div>
      </div>
    </>
  );
}
