import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { createContactSchema, formatZodError } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort") || "name";

  let contacts;
  if (sort === "lastInteraction") {
    contacts = await prisma.contact.findMany({
      where: { userId },
      include: {
        tags: true,
        interactions: { orderBy: { date: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });
    contacts.sort((a, b) => {
      const aDate = a.interactions[0]?.date?.getTime() ?? 0;
      const bDate = b.interactions[0]?.date?.getTime() ?? 0;
      return bDate - aDate;
    });
  } else {
    contacts = await prisma.contact.findMany({
      where: { userId },
      include: {
        tags: true,
        interactions: { orderBy: { date: "desc" }, take: 1 },
      },
      orderBy: { name: "asc" },
    });
  }

  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const parsed = createContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const { name, avatar, notes, tags, customFields, importantDates } = parsed.data;

  const contact = await prisma.contact.create({
    data: {
      userId,
      name,
      avatar: avatar || null,
      notes: notes || null,
      tags: tags?.length ? { create: tags.map((t) => ({ name: t })) } : undefined,
      customFields: customFields?.length ? { create: customFields } : undefined,
      importantDates: importantDates?.length ? { create: importantDates } : undefined,
    },
    include: { tags: true, customFields: true, importantDates: true },
  });

  return NextResponse.json(contact, { status: 201 });
}
