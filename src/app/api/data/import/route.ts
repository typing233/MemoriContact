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
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(text: string): ImportContact[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ""));
  const results: ImportContact[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = (values[idx] || "").trim(); });

    const name = obj.name || obj["姓名"] || "";
    if (!name) continue;

    const contact: ImportContact = { name };

    if (obj.avatar || obj["头像"]) contact.avatar = obj.avatar || obj["头像"];
    if (obj.notes || obj["备注"]) contact.notes = obj.notes || obj["备注"];

    const freqStr = obj.contactFrequency || obj["联系频率"] || "";
    if (freqStr) {
      const freq = parseInt(freqStr);
      if (!isNaN(freq) && freq > 0) contact.contactFrequency = freq;
    }

    const tagsStr = obj.tags || obj["标签"] || "";
    if (tagsStr) {
      contact.tags = tagsStr.split(";").map((t) => t.trim()).filter(Boolean);
    }

    // customFields format: "label1:value1;label2:value2"
    const cfStr = obj.customFields || obj["自定义字段"] || "";
    if (cfStr) {
      contact.customFields = cfStr.split(";")
        .map((pair) => {
          const idx = pair.indexOf(":");
          if (idx === -1) return null;
          return { label: pair.slice(0, idx).trim(), value: pair.slice(idx + 1).trim() };
        })
        .filter((f): f is { label: string; value: string } => f !== null && f.label !== "" && f.value !== "");
    }

    // importantDates format: "label1:2000-01-01;label2:2005-06-15"
    const idStr = obj.importantDates || obj["重要日期"] || "";
    if (idStr) {
      contact.importantDates = idStr.split(";")
        .map((pair) => {
          const idx = pair.indexOf(":");
          if (idx === -1) return null;
          return { label: pair.slice(0, idx).trim(), date: pair.slice(idx + 1).trim() };
        })
        .filter((d): d is { label: string; date: string } => d !== null && d.label !== "" && d.date !== "");
    }

    // interactions format: "type|date|location|note;type|date|location|note"
    const intStr = obj.interactions || obj["互动记录"] || "";
    if (intStr) {
      contact.interactions = intStr.split(";")
        .map((entry) => {
          const parts = entry.split("|");
          if (parts.length < 2 || !parts[0] || !parts[1]) return null;
          return {
            type: parts[0].trim(),
            date: parts[1].trim(),
            location: parts[2]?.trim() || undefined,
            note: parts[3]?.trim() || undefined,
          };
        })
        .filter((i): i is NonNullable<typeof i> => i !== null);
    }

    results.push(contact);
  }

  return results;
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
