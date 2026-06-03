"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Notification {
  id: string;
  title: string;
  message: string | null;
  read: boolean;
  type: string;
  link: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setNotifications(data);
        setLoading(false);
      });
  }, [session]);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><span className="text-gray-500">加载中...</span></div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">通知</h1>
        {notifications.some((n) => !n.read) && (
          <button onClick={markAllRead} className="text-sm text-indigo-600 hover:underline">
            全部标记已读
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400">暂无通知</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`bg-white rounded-xl p-4 border shadow-sm transition ${n.read ? "border-gray-200" : "border-indigo-300 bg-indigo-50/30"}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${n.read ? "bg-gray-300" : "bg-indigo-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900">{n.title}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(n.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                  {n.message && <p className="text-sm text-gray-600 mt-1">{n.message}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    {n.link && (
                      <Link href={n.link} className="text-xs text-indigo-600 hover:underline">
                        查看详情
                      </Link>
                    )}
                    {!n.read && (
                      <button onClick={() => markRead(n.id)} className="text-xs text-gray-500 hover:text-gray-700">
                        标记已读
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
