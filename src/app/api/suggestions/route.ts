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
      interactions: { orderBy: { date: "desc" }, take: 1 },
    },
  });

  const now = Date.now();
  const suggestions = contacts
    .map((c) => {
      const lastInteraction = c.interactions[0]?.date;
      let daysSinceContact: number;
      let neverInteracted = false;

      if (lastInteraction) {
        daysSinceContact = Math.floor((now - new Date(lastInteraction).getTime()) / (1000 * 60 * 60 * 24));
      } else {
        // Never interacted — use days since creation
        daysSinceContact = Math.floor((now - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        neverInteracted = true;
      }

      const frequency = c.contactFrequency || 30;
      const overdueDays = daysSinceContact - frequency;
      return { ...c, daysSinceContact, frequency, overdueDays, neverInteracted };
    })
    .filter((c) => c.overdueDays > 0)
    .sort((a, b) => b.overdueDays - a.overdueDays);

  return NextResponse.json(suggestions);
}
