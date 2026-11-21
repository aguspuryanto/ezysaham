import { LayoutDashboard, Filter, Wallet, Newspaper } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Pasar", icon: LayoutDashboard },
  { href: "/screener", label: "Screener", icon: Filter },
  { href: "/portfolio", label: "Portofolio", icon: Wallet },
  { href: "/news", label: "Tips", icon: Newspaper },
] as const;

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
