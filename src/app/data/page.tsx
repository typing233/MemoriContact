"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";

export default function DataPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [emailReminder, setEmailReminder] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.emailReminder === "boolean") {
          setEmailReminder(data.emailReminder);
        }
        setSettingsLoading(false);
      });
  }, [session]);

  const toggleEmailReminder = async () => {
    const newVal = !emailReminder;
    setEmailReminder(newVal);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailReminder: newVal }),
    });
  };

  const handleExport = async (format: "json" | "csv") => {
    setExporting(true);

    if (format === "csv") {
      const res = await fetch("/api/data/export?format=csv");
      const text = await res.text();
      const blob = new Blob([text], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `memoricontact-export-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const res = await fetch("/api/data/export");
      const data = await res.json();
      const content = JSON.stringify(data, null, 2);
      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `memoricontact-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }

    setExporting(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    const text = await file.text();
    const isJson = file.name.endsWith(".json") || text.trim().startsWith("[") || text.trim().startsWith("{");

    const res = await fetch("/api/data/import", {
      method: "POST",
      headers: { "Content-Type": isJson ? "application/json" : "text/csv" },
      body: text,
    });

    const result = await res.json();
    setImportResult(result);
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">数据管理</h1>

      {/* Export */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">导出数据</h2>
        <p className="text-sm text-gray-600 mb-4">导出所有联系人及其互动记录、标签、重要日期等数据。</p>
        <div className="flex gap-3">
          <button
            onClick={() => handleExport("json")}
            disabled={exporting}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
          >
            导出 JSON
          </button>
          <button
            onClick={() => handleExport("csv")}
            disabled={exporting}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
          >
            导出 CSV
          </button>
        </div>
      </div>

      {/* Import */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">导入数据</h2>
        <p className="text-sm text-gray-600 mb-4">
          支持 JSON 和 CSV 格式。JSON 格式与导出格式相同。CSV 字段：name, avatar, notes, contactFrequency, tags（分号分隔）, customFields（格式 label:value 分号分隔）, importantDates（格式 label:date 分号分隔）, interactions（格式 type|date|location|note 分号分隔）。
          导入时会自动跳过已存在的同名联系人。
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv"
          onChange={handleImport}
          disabled={importing}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
        />
        {importing && <p className="text-sm text-gray-500 mt-3">导入中...</p>}
        {importResult && (
          <div className="mt-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
            <div className="flex gap-4 text-sm">
              <span className="text-green-600 font-medium">成功: {importResult.imported}</span>
              <span className="text-orange-500 font-medium">跳过: {importResult.skipped}</span>
            </div>
            {importResult.errors.length > 0 && (
              <div className="mt-2 space-y-1">
                {importResult.errors.slice(0, 10).map((err, i) => (
                  <p key={i} className="text-xs text-gray-500">{err}</p>
                ))}
                {importResult.errors.length > 10 && (
                  <p className="text-xs text-gray-400">...还有 {importResult.errors.length - 10} 条信息</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Email Reminder Settings */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">提醒设置</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-900 font-medium">邮件摘要</p>
            <p className="text-xs text-gray-500 mt-1">
              开启后，系统会将每日提醒以邮件摘要形式发送到注册邮箱。关闭时仅发送应用内通知。
            </p>
          </div>
          <button
            onClick={toggleEmailReminder}
            disabled={settingsLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${emailReminder ? "bg-indigo-600" : "bg-gray-300"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${emailReminder ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
