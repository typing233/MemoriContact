import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

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

  return NextResponse.json(exportData);
}
