import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ contacts: [], interactions: [] });

  const contacts = await prisma.contact.findMany({
    where: {
      userId,
      OR: [
        { name: { contains: q } },
        { notes: { contains: q } },
        { tags: { some: { name: { contains: q } } } },
      ],
    },
    include: { tags: true, interactions: { orderBy: { date: "desc" }, take: 1 } },
    take: 20,
  });

  const interactions = await prisma.interaction.findMany({
    where: {
      contact: { userId },
      OR: [
        { note: { contains: q } },
        { type: { contains: q } },
        { location: { contains: q } },
      ],
    },
    include: { contact: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
    take: 20,
  });

  return NextResponse.json({ contacts, interactions });
}
