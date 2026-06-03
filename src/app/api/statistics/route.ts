import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const contacts = await prisma.contact.findMany({
    where: { userId },
    include: {
      interactions: { orderBy: { date: "desc" } },
    },
  });

  const now = new Date();
  const monthlyStats: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyStats[key] = 0;
  }

  const contactRanking: { id: string; name: string; count: number }[] = [];

  for (const contact of contacts) {
    let count = 0;
    for (const interaction of contact.interactions) {
      const d = new Date(interaction.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key in monthlyStats) {
        monthlyStats[key]++;
        count++;
      }
    }
    contactRanking.push({ id: contact.id, name: contact.name, count });
  }

  contactRanking.sort((a, b) => b.count - a.count);

  return NextResponse.json({
    monthlyStats,
    contactRanking: contactRanking.slice(0, 10),
    totalContacts: contacts.length,
    totalInteractions: contacts.reduce((acc, c) => acc + c.interactions.length, 0),
  });
}
