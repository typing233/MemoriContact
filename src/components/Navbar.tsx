"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";

interface SearchResult {
  contacts: { id: string; name: string; tags: { name: string }[] }[];
  interactions: { id: string; note: string | null; type: string; contact: { id: string; name: string } }[];
}

export default function Navbar() {
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) return;
    fetch("/api/notifications?unread=true")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setUnreadCount(data.length); });
  }, [session]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults(null); return; }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        setResults(await res.json());
        setShowResults(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  if (!session) return null;

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
      <Link href="/contacts" className="text-xl font-bold text-indigo-600">
        MemoriContact
      </Link>

      <div className="flex items-center gap-3 flex-1 max-w-xl mx-4" ref={searchRef}>
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="搜索联系人、标签、互动..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results && setShowResults(true)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {showResults && results && (results.contacts.length > 0 || results.interactions.length > 0) && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto z-50">
              {results.contacts.length > 0 && (
                <div className="p-2">
                  <div className="text-xs font-medium text-gray-500 px-2 py-1">联系人</div>
                  {results.contacts.map((c) => (
                    <Link
                      key={c.id}
                      href={`/contacts/${c.id}`}
                      onClick={() => { setShowResults(false); setQuery(""); }}
                      className="block px-2 py-1.5 rounded hover:bg-indigo-50 text-sm text-gray-800"
                    >
                      {c.name}
                      {c.tags.length > 0 && (
                        <span className="text-xs text-gray-400 ml-2">
                          {c.tags.map((t) => t.name).join(", ")}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
              {results.interactions.length > 0 && (
                <div className="p-2 border-t border-gray-100">
                  <div className="text-xs font-medium text-gray-500 px-2 py-1">互动记录</div>
                  {results.interactions.map((i) => (
                    <Link
                      key={i.id}
                      href={`/contacts/${i.contact.id}`}
                      onClick={() => { setShowResults(false); setQuery(""); }}
                      className="block px-2 py-1.5 rounded hover:bg-indigo-50 text-sm text-gray-800"
                    >
                      <span className="font-medium">{i.contact.name}</span>
                      <span className="text-gray-500 ml-1">- {i.type}</span>
                      {i.note && <span className="text-gray-400 ml-1 text-xs">{i.note.slice(0, 40)}</span>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-gray-600 hover:text-indigo-600">
          仪表盘
        </Link>
        <Link href="/data" className="text-sm text-gray-600 hover:text-indigo-600">
          数据
        </Link>
        <Link href="/notifications" className="relative text-sm text-gray-600 hover:text-indigo-600">
          通知
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
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
