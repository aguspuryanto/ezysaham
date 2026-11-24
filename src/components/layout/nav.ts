import { LayoutDashboard, Filter, Star, Wallet, Newspaper, HandHeart, BookA } from "lucide-react";

/** mobile: false = hanya di sidebar desktop (bottom nav HP dibatasi 5 item) */
export const NAV_ITEMS = [
  { href: "/", label: "Pasar", icon: LayoutDashboard, mobile: true },
  { href: "/screener", label: "Screener", icon: Filter, mobile: true },
  { href: "/watchlist", label: "Watchlist", icon: Star, mobile: true },
  { href: "/portfolio", label: "Portofolio", icon: Wallet, mobile: true },
  { href: "/news", label: "Tips", icon: Newspaper, mobile: true },
  { href: "/glosarium", label: "Glosarium", icon: BookA, mobile: false },
  { href: "/harga", label: "Membership", icon: HandHeart, mobile: false },
] as const;

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
