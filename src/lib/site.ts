export const SITE_NAME = 'EzySaham AI';
export const SITE_SLOGAN = 'Trade dengan Rencana, Bukan Expektasi';
// export const SITE_DESCRIPTION = 'AI Stock Screener yang dirancang khusus untuk membantu trader saham di Indonesia membuat keputusan trading yang lebih baik dan terukur, didukung teknologi canggih dan komunitas yang saling menguatkan.';

// ─── Brand colors (EzySaham aesthetic) ────────────────────────────────────────
export const BRAND = {
    bg: 'bg-[#e43d23]',
    text: 'text-[#e43d23]',
    border: 'border-[#e43d23]',
};


import { Home, Activity, BookOpen, Info } from 'lucide-react';

// ─── Navigation ────────────────────────────────────────────────────────────────
export const NAV_ITEMS = [
    {
        label: 'Beranda',
        href: '/',
        icon: Home,
    },
    {
        label: 'Screener',
        href: '/screener',
        icon: Activity,
    },
    {
        label: 'Tutorial',
        href: '/tutorial',
        icon: BookOpen,
    },
    {
        label: 'Panduan',
        href: '/panduan',
        icon: BookOpen,
    },
    {
        label: 'Tentang',
        href: '/tentang',
        icon: Info,
    },
] as const;

// ─── Social links ──────────────────────────────────────────────────────────────
// export const SOCIALS = [
//     {
//         name: 'YouTube',
//         href: 'https://www.youtube.com/@ezysaham',
//         icon: Youtube,
//     },
//     {
//         name: 'Instagram',
//         href: 'https://www.instagram.com/ezysaham',
//         icon: Instagram,
//     },
//     {
//         name: 'Twitter',
//         href: 'https://twitter.com/ezysaham',
//         icon: Twitter,
//     },
//     {
//         name: 'TikTok',
//         href: 'https://www.tiktok.com/@ezysaham',
//         icon: Tiktok,
//     },
// ] as const;