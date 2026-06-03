import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

interface ImportContact {
  name?: string;
  avatar?: string;
  notes?: string;
  contactFrequency?: number;
  tags?: string[];
  customFields?: { label: string; value: string }[];
  importantDates?: { label: string; date: string }[];
  interactions?: { type: string; note?: string; location?: string; date: string }[];
}

function parseCSV(text: string): ImportContact[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const results: ImportContact[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = values[idx] || ""; });

    const contact: ImportContact = { name: obj.name || obj["姓名"] || "" };
    if (obj.avatar || obj["头像"]) contact.avatar = obj.avatar || obj["头像"];
    if (obj.notes || obj["备注"]) contact.notes = obj.notes || obj["备注"];
    if (obj.contactFrequency || obj["联系频率"]) {
      const freq = parseInt(obj.contactFrequency || obj["联系频率"]);
      if (!isNaN(freq) && freq > 0) contact.contactFrequency = freq;
    }
    if (obj.tags || obj["标签"]) {
      contact.tags = (obj.tags || obj["标签"]).split(";").map((t) => t.trim()).filter(Boolean);
    }
    results.push(contact);
  }

  return results;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const contentType = req.headers.get("content-type") || "";
  let contacts: ImportContact[] = [];

  try {
    if (contentType.includes("application/json")) {
      const body = await req.json();
      contacts = Array.isArray(body) ? body : [body];
    } else {
      const text = await req.text();
      if (text.trim().startsWith("[") || text.trim().startsWith("{")) {
        const parsed = JSON.parse(text);
        contacts = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        contacts = parseCSV(text);
      }
    }
  } catch {
    return NextResponse.json({ error: "数据格式解析失败" }, { status: 400 });
  }

  if (!contacts.length) {
    return NextResponse.json({ error: "没有可导入的数据" }, { status: 400 });
  }

  const results = { imported: 0, skipped: 0, errors: [] as string[] };

  for (const c of contacts) {
    if (!c.name || !c.name.trim()) {
      results.skipped++;
      results.errors.push("跳过缺少姓名的记录");
      continue;
    }

    const existingContact = await prisma.contact.findFirst({
      where: { userId, name: c.name.trim() },
    });

    if (existingContact) {
      results.skipped++;
      results.errors.push(`联系人 "${c.name}" 已存在，已跳过`);
      continue;
    }

    try {
      await prisma.contact.create({
        data: {
          userId,
          name: c.name.trim(),
          avatar: c.avatar || null,
          notes: c.notes || null,
          contactFrequency: c.contactFrequency || null,
          tags: c.tags?.length
            ? { create: c.tags.map((t) => ({ name: t })) }
            : undefined,
          customFields: c.customFields?.length
            ? { create: c.customFields.filter((f) => f.label && f.value) }
            : undefined,
          importantDates: c.importantDates?.length
            ? { create: c.importantDates.filter((d) => d.label && d.date) }
            : undefined,
          interactions: c.interactions?.length
            ? {
                create: c.interactions
                  .filter((i) => i.type && i.date)
                  .map((i) => ({
                    type: i.type,
                    note: i.note || null,
                    location: i.location || null,
                    date: new Date(i.date),
                  })),
              }
            : undefined,
        },
      });
      results.imported++;
    } catch (err) {
      results.skipped++;
      results.errors.push(`导入 "${c.name}" 失败: ${err instanceof Error ? err.message : "未知错误"}`);
    }
  }

  return NextResponse.json(results);
}
