'use client';

import { LogOut, User as UserIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuthUser } from './useAuthUser';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3.01h3.88c2.27-2.09 3.57-5.17 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.88-3.01c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.11C3.25 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.62H1.27a12 12 0 0 0 0 10.76l4-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.35.6 4.6 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.62l4 3.11C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

function initialsOf(name: string | undefined, email: string | undefined) {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }
  return email?.[0]?.toUpperCase() ?? '?';
}

export function AuthButton() {
  const { user, loading, signInWithGoogle, signOut } = useAuthUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  if (loading) {
    return <div className="size-9 shrink-0 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />;
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={signInWithGoogle}
        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        <GoogleIcon />
        <span className="hidden sm:inline">Masuk dengan Google</span>
      </button>
    );
  }

  const displayName = user.user_metadata?.full_name ?? user.email ?? '';
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="Menu akun"
        aria-expanded={menuOpen}
        className="flex size-9 items-center justify-center overflow-hidden rounded-full border border-zinc-200 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={displayName} className="size-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          initialsOf(user.user_metadata?.full_name, user.email)
        )}
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-11 z-30 w-52 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
            <UserIcon className="size-4 shrink-0 text-zinc-400" />
            <span className="truncate text-sm text-zinc-700 dark:text-zinc-200">{displayName}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              signOut();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <LogOut className="size-4" />
            Keluar
          </button>
        </div>
      )}
    </div>
  );
}
