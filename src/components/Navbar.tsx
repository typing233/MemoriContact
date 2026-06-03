"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function Navbar() {
  const { data: session } = useSession();

  if (!session) return null;

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
      <Link href="/contacts" className="text-xl font-bold text-indigo-600">
        MemoriContact
      </Link>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600 hidden sm:inline">
          {session.user?.name}
        </span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-red-600 hover:text-red-800 font-medium"
        >
          退出
        </button>
      </div>
    </nav>
  );
}
