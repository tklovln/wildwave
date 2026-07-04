"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const NAV_ITEMS = [
  { href: "/paper", label: "Paper" },
  { href: "/member", label: "Member" },
];

export default function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className="site-nav" aria-label="全站導覽">
      <div className="site-nav-left">
        <Link href="/" className="site-nav-brand" aria-label="回到首頁">
          WILDWAVE
        </Link>
        <ul className="site-nav-links">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`site-nav-link ${active ? "is-active" : ""}`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="site-nav-right">
        <Link href="/#listen" className="site-nav-cta">
          Listen
        </Link>
        <ThemeToggle />
      </div>
    </nav>
  );
}
