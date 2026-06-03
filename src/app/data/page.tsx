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
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const handleExport = async (format: "json" | "csv") => {
    setExporting(true);
    const res = await fetch("/api/data/export");
    const data = await res.json();

    let content: string;
    let filename: string;
    let mime: string;

    if (format === "json") {
      content = JSON.stringify(data, null, 2);
      filename = `memoricontact-export-${new Date().toISOString().split("T")[0]}.json`;
      mime = "application/json";
    } else {
      const headers = ["name", "avatar", "notes", "contactFrequency", "tags"];
      const rows = data.map((c: Record<string, unknown>) => [
        csvEscape(String(c.name || "")),
        csvEscape(String(c.avatar || "")),
        csvEscape(String(c.notes || "")),
        String(c.contactFrequency || ""),
        csvEscape((c.tags as string[] || []).join(";")),
      ].join(","));
      content = [headers.join(","), ...rows].join("\n");
      filename = `memoricontact-export-${new Date().toISOString().split("T")[0]}.csv`;
      mime = "text/csv";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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
          支持 JSON 和 CSV 格式。JSON 格式与导出格式相同。CSV 格式需包含 name 列。
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
    </div>
  );
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
