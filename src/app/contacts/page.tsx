"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Contact {
  id: string;
  name: string;
  avatar: string | null;
  tags: { id: string; name: string }[];
  interactions: { date: string }[];
  updatedAt: string;
}

export default function ContactsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sort, setSort] = useState<"name" | "lastInteraction">("name");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTags, setNewTags] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchContacts = useCallback(async () => {
    const res = await fetch(`/api/contacts?sort=${sort}`);
    if (res.ok) {
      const data = await res.json();
      setContacts(data);
    }
    setLoading(false);
  }, [sort]);

  useEffect(() => {
    if (session) fetchContacts();
  }, [session, sort, fetchContacts]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const tags = newTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, tags }),
    });

    if (res.ok) {
      setNewName("");
      setNewTags("");
      setShowForm(false);
      fetchContacts();
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">联系人</h1>
        <div className="flex items-center gap-3">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "name" | "lastInteraction")}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="name">按姓名排序</option>
            <option value="lastInteraction">按最近互动排序</option>
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition whitespace-nowrap"
          >
            + 新建联系人
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl p-4 mb-6 shadow-sm border border-gray-200"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="姓名 *"
              required
              className="px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              placeholder="标签（逗号分隔）"
              className="px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="submit"
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
            >
              创建
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition"
            >
              取消
            </button>
          </div>
        </form>
      )}

      {contacts.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-gray-400 text-5xl mb-4">👥</div>
          <p className="text-gray-500 text-lg">还没有联系人</p>
          <p className="text-gray-400 text-sm mt-1">点击上方按钮创建第一个联系人</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <Link
              key={contact.id}
              href={`/contacts/${contact.id}`}
              className="block bg-white rounded-xl p-4 shadow-sm border border-gray-200 hover:border-indigo-300 hover:shadow-md transition"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg flex-shrink-0">
                  {contact.avatar ? (
                    <img
                      src={contact.avatar}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    contact.name[0]?.toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {contact.name}
                  </h3>
                  {contact.tags.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {contact.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-400 text-right flex-shrink-0">
                  {contact.interactions[0] ? (
                    <span>
                      最近互动
                      <br />
                      {new Date(contact.interactions[0].date).toLocaleDateString("zh-CN")}
                    </span>
                  ) : (
                    <span>暂无互动</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
