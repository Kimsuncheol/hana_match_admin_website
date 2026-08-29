"use client";

import { useState } from "react";
import type { AdminRole } from "@/lib/firebase/claims";

type NavLink = {
  href: string;
  label: string;
  roles: readonly AdminRole[];
};

const NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "대시보드", roles: ["admin", "moderator"] },
  { href: "/moderation", label: "모더레이션 큐", roles: ["admin", "moderator"] },
  { href: "/users", label: "사용자 운영", roles: ["admin", "moderator"] },
  { href: "/dashboard#model-health", label: "AI 모델 상태", roles: ["admin"] },
];

const ROLE_LABELS: Record<AdminRole, string> = {
  admin: "관리자",
  moderator: "모더레이터",
};

type Props = {
  role: AdminRole;
  email: string | null | undefined;
  onSignOut: () => void;
};

export function AdminNav({ role, email, onSignOut }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const links = NAV_LINKS.filter((link) => link.roles.includes(role));

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-zinc-900">Hana Match 관리자</span>
          <nav aria-label="주 메뉴" className="hidden gap-4 sm:flex">
            {links.map((link) => (
              <a key={link.href} href={link.href} className="text-sm text-zinc-600 hover:text-zinc-900">
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-3 sm:flex">
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
            {ROLE_LABELS[role]}
          </span>
          <span className="text-sm text-zinc-500">{email}</span>
          <button
            onClick={onSignOut}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            로그아웃
          </button>
        </div>

        <button
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-admin-nav"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 sm:hidden"
        >
          메뉴
        </button>
      </div>

      {menuOpen ? (
        <nav id="mobile-admin-nav" aria-label="주 메뉴 (모바일)" className="border-t border-zinc-200 px-4 py-3 sm:hidden">
          <ul className="flex flex-col gap-3">
            {links.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="text-sm text-zinc-700" onClick={() => setMenuOpen(false)}>
                  {link.label}
                </a>
              </li>
            ))}
            <li className="flex items-center justify-between border-t border-zinc-100 pt-3">
              <span className="text-sm text-zinc-500">
                {ROLE_LABELS[role]} · {email}
              </span>
              <button onClick={onSignOut} className="text-sm font-medium text-red-700">
                로그아웃
              </button>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
