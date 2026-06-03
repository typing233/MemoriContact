"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

interface Tag { id: string; name: string }
interface CustomField { id: string; label: string; value: string }
interface ImportantDate { id: string; label: string; date: string }
interface Interaction {
  id: string;
  type: string;
  note: string | null;
  location: string | null;
  date: string;
}
interface Contact {
  id: string;
  name: string;
  avatar: string | null;
  notes: string | null;
  tags: Tag[];
  customFields: CustomField[];
  importantDates: ImportantDate[];
  interactions: Interaction[];
}

const INTERACTION_TYPES = ["通话", "见面", "礼物", "消息", "邮件", "其他"];

export default function ContactDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", avatar: "", notes: "", tags: "", customFields: [] as { label: string; value: string }[], importantDates: [] as { label: string; date: string }[] });
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [interactionForm, setInteractionForm] = useState({ type: "通话", note: "", location: "", date: new Date().toISOString().split("T")[0] });

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchContact = useCallback(async () => {
    const res = await fetch(`/api/contacts/${id}`);
    if (res.ok) {
      const data = await res.json();
      setContact(data);
    } else {
      router.push("/contacts");
    }
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    if (session) fetchContact();
  }, [session, fetchContact]);

  const startEdit = () => {
    if (!contact) return;
    setEditForm({
      name: contact.name,
      avatar: contact.avatar || "",
      notes: contact.notes || "",
      tags: contact.tags.map((t) => t.name).join(", "),
      customFields: contact.customFields.length > 0 ? contact.customFields.map((f) => ({ label: f.label, value: f.value })) : [{ label: "", value: "" }],
      importantDates: contact.importantDates.length > 0 ? contact.importantDates.map((d) => ({ label: d.label, date: d.date })) : [{ label: "", date: "" }],
    });
    setEditing(true);
  };

  const handleSave = async () => {
    const tags = editForm.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const customFields = editForm.customFields.filter((f) => f.label && f.value);
    const importantDates = editForm.importantDates.filter((d) => d.label && d.date);

    const res = await fetch(`/api/contacts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editForm.name, avatar: editForm.avatar, notes: editForm.notes, tags, customFields, importantDates }),
    });

    if (res.ok) {
      setEditing(false);
      fetchContact();
    }
  };

  const handleDelete = async () => {
    if (!confirm("确定要删除此联系人吗？此操作不可撤销。")) return;
    const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/contacts");
  };

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/contacts/${id}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(interactionForm),
    });
    if (res.ok) {
      setShowInteractionForm(false);
      setInteractionForm({ type: "通话", note: "", location: "", date: new Date().toISOString().split("T")[0] });
      fetchContact();
    }
  };

  const handleDeleteInteraction = async (interactionId: string) => {
    if (!confirm("确定删除此互动记录？")) return;
    const res = await fetch(`/api/contacts/${id}/interactions/${interactionId}`, { method: "DELETE" });
    if (res.ok) fetchContact();
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><span className="text-gray-500">加载中...</span></div>;
  }

  if (!contact) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <button onClick={() => router.push("/contacts")} className="text-indigo-600 text-sm mb-4 hover:underline">
        ← 返回联系人列表
      </button>

      {editing ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-bold">编辑联系人</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
              <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">头像 URL</label>
              <input type="text" value={editForm.avatar} onChange={(e) => setEditForm({ ...editForm, avatar: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" placeholder="https://..." />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">标签（逗号分隔）</label>
            <input type="text" value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" rows={3} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">自定义字段</label>
            {editForm.customFields.map((f, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input placeholder="字段名" value={f.label} onChange={(e) => { const cf = [...editForm.customFields]; cf[i] = { ...cf[i], label: e.target.value }; setEditForm({ ...editForm, customFields: cf }); }} className="flex-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                <input placeholder="值" value={f.value} onChange={(e) => { const cf = [...editForm.customFields]; cf[i] = { ...cf[i], value: e.target.value }; setEditForm({ ...editForm, customFields: cf }); }} className="flex-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                <button type="button" onClick={() => { const cf = editForm.customFields.filter((_, idx) => idx !== i); setEditForm({ ...editForm, customFields: cf.length ? cf : [{ label: "", value: "" }] }); }} className="text-red-500 text-sm px-2">删除</button>
              </div>
            ))}
            <button type="button" onClick={() => setEditForm({ ...editForm, customFields: [...editForm.customFields, { label: "", value: "" }] })} className="text-indigo-600 text-sm">+ 添加字段</button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">重要日期</label>
            {editForm.importantDates.map((d, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input placeholder="标签（如生日）" value={d.label} onChange={(e) => { const dates = [...editForm.importantDates]; dates[i] = { ...dates[i], label: e.target.value }; setEditForm({ ...editForm, importantDates: dates }); }} className="flex-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                <input type="date" value={d.date} onChange={(e) => { const dates = [...editForm.importantDates]; dates[i] = { ...dates[i], date: e.target.value }; setEditForm({ ...editForm, importantDates: dates }); }} className="flex-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                <button type="button" onClick={() => { const dates = editForm.importantDates.filter((_, idx) => idx !== i); setEditForm({ ...editForm, importantDates: dates.length ? dates : [{ label: "", date: "" }] }); }} className="text-red-500 text-sm px-2">删除</button>
              </div>
            ))}
            <button type="button" onClick={() => setEditForm({ ...editForm, importantDates: [...editForm.importantDates, { label: "", date: "" }] })} className="text-indigo-600 text-sm">+ 添加日期</button>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">保存</button>
            <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition">取消</button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-2xl flex-shrink-0">
                {contact.avatar ? <img src={contact.avatar} alt="" className="w-16 h-16 rounded-full object-cover" /> : contact.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-gray-900">{contact.name}</h1>
                {contact.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {contact.tags.map((tag) => (
                      <span key={tag.id} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full">{tag.name}</span>
                    ))}
                  </div>
                )}
                {contact.notes && <p className="text-gray-600 text-sm mt-2">{contact.notes}</p>}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={startEdit} className="text-indigo-600 text-sm font-medium hover:underline">编辑</button>
                <button onClick={handleDelete} className="text-red-500 text-sm font-medium hover:underline">删除</button>
              </div>
            </div>
          </div>

          {/* Important Dates */}
          {contact.importantDates.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-3">重要日期</h2>
              <div className="space-y-2">
                {contact.importantDates.map((d) => (
                  <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-gray-700">{d.label}</span>
                    <span className="text-gray-500 text-sm">{d.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Fields */}
          {contact.customFields.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-3">自定义字段</h2>
              <div className="space-y-2">
                {contact.customFields.map((f) => (
                  <div key={f.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-gray-500 text-sm">{f.label}</span>
                    <span className="text-gray-900">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interactions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">互动记录</h2>
              <button onClick={() => setShowInteractionForm(!showInteractionForm)} className="text-indigo-600 text-sm font-medium hover:underline">
                + 添加记录
              </button>
            </div>

            {showInteractionForm && (
              <form onSubmit={handleAddInteraction} className="border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select value={interactionForm.type} onChange={(e) => setInteractionForm({ ...interactionForm, type: e.target.value })} className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                    {INTERACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input type="date" value={interactionForm.date} onChange={(e) => setInteractionForm({ ...interactionForm, date: e.target.value })} className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" required />
                </div>
                <input type="text" placeholder="地点（可选）" value={interactionForm.location} onChange={(e) => setInteractionForm({ ...interactionForm, location: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                <textarea placeholder="备注（可选）" value={interactionForm.note} onChange={(e) => setInteractionForm({ ...interactionForm, note: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" rows={2} />
                <div className="flex gap-2">
                  <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">添加</button>
                  <button type="button" onClick={() => setShowInteractionForm(false)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition">取消</button>
                </div>
              </form>
            )}

            {contact.interactions.length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">暂无互动记录</p>
            ) : (
              <div className="space-y-3">
                {contact.interactions.map((i) => (
                  <div key={i.id} className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">
                      {i.type === "通话" && "📞"}
                      {i.type === "见面" && "🤝"}
                      {i.type === "礼物" && "🎁"}
                      {i.type === "消息" && "💬"}
                      {i.type === "邮件" && "📧"}
                      {i.type === "其他" && "📌"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900">{i.type}</span>
                        <span className="text-xs text-gray-400">{new Date(i.date).toLocaleDateString("zh-CN")}</span>
                      </div>
                      {i.location && <p className="text-xs text-gray-500 mt-0.5">📍 {i.location}</p>}
                      {i.note && <p className="text-sm text-gray-600 mt-1">{i.note}</p>}
                    </div>
                    <button onClick={() => handleDeleteInteraction(i.id)} className="text-red-400 text-xs hover:text-red-600 flex-shrink-0">删除</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
