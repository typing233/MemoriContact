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

interface FormCustomField { label: string; value: string }
interface FormImportantDate { label: string; date: string }

export default function ContactsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sort, setSort] = useState<"name" | "lastInteraction">("name");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");

  const [newName, setNewName] = useState("");
  const [newAvatar, setNewAvatar] = useState("");
  const [newTags, setNewTags] = useState("");
  const [newCustomFields, setNewCustomFields] = useState<FormCustomField[]>([{ label: "", value: "" }]);
  const [newImportantDates, setNewImportantDates] = useState<FormImportantDate[]>([{ label: "", date: "" }]);

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

  const resetForm = () => {
    setNewName("");
    setNewAvatar("");
    setNewTags("");
    setNewCustomFields([{ label: "", value: "" }]);
    setNewImportantDates([{ label: "", date: "" }]);
    setFormError("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!newName.trim()) {
      setFormError("姓名不能为空");
      return;
    }

    const tags = newTags.split(",").map((t) => t.trim()).filter(Boolean);
    const customFields = newCustomFields.filter((f) => f.label || f.value);
    const importantDates = newImportantDates.filter((d) => d.label || d.date);

    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        avatar: newAvatar || undefined,
        tags,
        customFields: customFields.length > 0 ? customFields : undefined,
        importantDates: importantDates.length > 0 ? importantDates : undefined,
      }),
    });

    if (res.ok) {
      const created = await res.json();
      resetForm();
      setShowForm(false);
      router.push(`/contacts/${created.id}`);
    } else {
      const data = await res.json();
      setFormError(data.error || "创建失败");
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
            onClick={() => { setShowForm(!showForm); if (!showForm) resetForm(); }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition whitespace-nowrap"
          >
            + 新建联系人
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl p-6 mb-6 shadow-sm border border-gray-200 space-y-4"
        >
          <h2 className="text-lg font-semibold text-gray-900">新建联系人</h2>

          {formError && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="联系人姓名"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">头像 URL</label>
              <input
                type="text"
                value={newAvatar}
                onChange={(e) => setNewAvatar(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="https://..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">标签（逗号分隔）</label>
            <input
              type="text"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="朋友, 同事, 家人"
            />
          </div>

          {/* Custom Fields */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">自定义字段</label>
            {newCustomFields.map((f, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  placeholder="字段名"
                  value={f.label}
                  onChange={(e) => { const arr = [...newCustomFields]; arr[i] = { ...arr[i], label: e.target.value }; setNewCustomFields(arr); }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
                <input
                  placeholder="值"
                  value={f.value}
                  onChange={(e) => { const arr = [...newCustomFields]; arr[i] = { ...arr[i], value: e.target.value }; setNewCustomFields(arr); }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
                <button
                  type="button"
                  onClick={() => { const arr = newCustomFields.filter((_, idx) => idx !== i); setNewCustomFields(arr.length ? arr : [{ label: "", value: "" }]); }}
                  className="text-red-400 hover:text-red-600 text-sm px-2"
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setNewCustomFields([...newCustomFields, { label: "", value: "" }])} className="text-indigo-600 text-sm hover:underline">
              + 添加字段
            </button>
          </div>

          {/* Important Dates */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">重要日期</label>
            {newImportantDates.map((d, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  placeholder="标签（如生日）"
                  value={d.label}
                  onChange={(e) => { const arr = [...newImportantDates]; arr[i] = { ...arr[i], label: e.target.value }; setNewImportantDates(arr); }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
                <input
                  type="date"
                  value={d.date}
                  onChange={(e) => { const arr = [...newImportantDates]; arr[i] = { ...arr[i], date: e.target.value }; setNewImportantDates(arr); }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
                <button
                  type="button"
                  onClick={() => { const arr = newImportantDates.filter((_, idx) => idx !== i); setNewImportantDates(arr.length ? arr : [{ label: "", date: "" }]); }}
                  className="text-red-400 hover:text-red-600 text-sm px-2"
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setNewImportantDates([...newImportantDates, { label: "", date: "" }])} className="text-indigo-600 text-sm hover:underline">
              + 添加日期
            </button>
          </div>

          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button
              type="submit"
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
            >
              创建联系人
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); resetForm(); }}
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
