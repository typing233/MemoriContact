import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes(";")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const format = req.nextUrl.searchParams.get("format") || "json";

  const contacts = await prisma.contact.findMany({
    where: { userId },
    include: {
      tags: true,
      customFields: true,
      importantDates: true,
      interactions: { orderBy: { date: "desc" } },
    },
  });

  const exportData = contacts.map((c) => ({
    name: c.name,
    avatar: c.avatar,
    notes: c.notes,
    contactFrequency: c.contactFrequency,
    tags: c.tags.map((t) => t.name),
    customFields: c.customFields.map((f) => ({ label: f.label, value: f.value })),
    importantDates: c.importantDates.map((d) => ({ label: d.label, date: d.date })),
    interactions: c.interactions.map((i) => ({
      type: i.type,
      note: i.note,
      location: i.location,
      date: new Date(i.date).toISOString().split("T")[0],
    })),
  }));

  if (format === "csv") {
    const headers = [
      "name", "avatar", "notes", "contactFrequency",
      "tags", "customFields", "importantDates", "interactions",
    ];

    const rows = exportData.map((c) => [
      csvEscape(c.name || ""),
      csvEscape(c.avatar || ""),
      csvEscape(c.notes || ""),
      String(c.contactFrequency || ""),
      csvEscape(c.tags.join(";")),
      csvEscape(c.customFields.map((f) => `${f.label}:${f.value}`).join(";")),
      csvEscape(c.importantDates.map((d) => `${d.label}:${d.date}`).join(";")),
      csvEscape(c.interactions.map((i) => `${i.type}|${i.date}|${i.location || ""}|${i.note || ""}`).join(";")),
    ].join(","));

    const csv = [headers.join(","), ...rows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="memoricontact-export.csv"`,
      },
    });
  }

  return NextResponse.json(exportData);
}
