"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Suggestion {
  id: string;
  name: string;
  avatar: string | null;
  daysSinceContact: number;
  frequency: number;
  overdueDays: number;
  tags: { id: string; name: string }[];
}

interface Statistics {
  monthlyStats: Record<string, number>;
  contactRanking: { id: string; name: string; count: number }[];
  totalContacts: number;
  totalInteractions: number;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    Promise.all([
      fetch("/api/suggestions").then((r) => r.json()),
      fetch("/api/statistics").then((r) => r.json()),
    ]).then(([sug, st]) => {
      setSuggestions(sug);
      setStats(st);
      setLoading(false);
    });
  }, [session]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><span className="text-gray-500">加载中...</span></div>;
  }

  const maxMonthly = stats ? Math.max(...Object.values(stats.monthlyStats), 1) : 1;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>

      {/* Stats overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm text-center">
            <div className="text-3xl font-bold text-indigo-600">{stats.totalContacts}</div>
            <div className="text-sm text-gray-500 mt-1">联系人总数</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm text-center">
            <div className="text-3xl font-bold text-indigo-600">{stats.totalInteractions}</div>
            <div className="text-sm text-gray-500 mt-1">互动总次数</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm text-center">
            <div className="text-3xl font-bold text-orange-500">{suggestions.length}</div>
            <div className="text-sm text-gray-500 mt-1">待联系</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm text-center">
            <div className="text-3xl font-bold text-green-600">
              {stats.monthlyStats[Object.keys(stats.monthlyStats).pop()!] || 0}
            </div>
            <div className="text-sm text-gray-500 mt-1">本月互动</div>
          </div>
        </div>
      )}

      {/* Monthly chart */}
      {stats && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">月度互动次数</h2>
          <div className="flex items-end gap-2 h-40">
            {Object.entries(stats.monthlyStats).map(([month, count]) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-500">{count}</span>
                <div
                  className="w-full bg-indigo-500 rounded-t"
                  style={{ height: `${(count / maxMonthly) * 100}%`, minHeight: count > 0 ? "4px" : "0" }}
                />
                <span className="text-xs text-gray-400">{month.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Suggestions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">建议联系</h2>
          {suggestions.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">所有联系人都在互动频率内</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {suggestions.map((s) => (
                <Link
                  key={s.id}
                  href={`/contacts/${s.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-indigo-50 transition"
                >
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold flex-shrink-0">
                    {s.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">{s.name}</div>
                    <div className="text-xs text-gray-500">
                      已 {s.daysSinceContact === Infinity ? "从未互动" : `${s.daysSinceContact} 天`}未联系
                      <span className="text-orange-500 ml-1">(超期 {s.overdueDays} 天)</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Ranking */}
        {stats && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">活跃度排名（近6月）</h2>
            {stats.contactRanking.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">暂无数据</p>
            ) : (
              <div className="space-y-2">
                {stats.contactRanking.map((r, idx) => (
                  <Link
                    key={r.id}
                    href={`/contacts/${r.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx < 3 ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"}`}>
                      {idx + 1}
                    </span>
                    <span className="flex-1 text-sm text-gray-900">{r.name}</span>
                    <span className="text-sm text-gray-500">{r.count} 次</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
