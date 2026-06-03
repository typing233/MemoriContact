import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { updateContactSchema, formatZodError } from "@/lib/validation";

async function verifyOwnership(contactId: string, userId: string) {
  return prisma.contact.findFirst({ where: { id: contactId, userId } });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const contact = await prisma.contact.findFirst({
    where: { id, userId },
    include: {
      tags: true,
      customFields: true,
      importantDates: true,
      interactions: { orderBy: { date: "desc" } },
      reminders: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!contact) return NextResponse.json({ error: "联系人不存在" }, { status: 404 });

  return NextResponse.json(contact);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const existing = await verifyOwnership(id, userId);
  if (!existing) return NextResponse.json({ error: "联系人不存在" }, { status: 404 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const parsed = updateContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const { name, avatar, notes, tags, customFields, importantDates, contactFrequency } = parsed.data;

  if (tags !== undefined) {
    await prisma.tag.deleteMany({ where: { contactId: id } });
  }
  if (customFields !== undefined) {
    await prisma.customField.deleteMany({ where: { contactId: id } });
  }
  if (importantDates !== undefined) {
    await prisma.importantDate.deleteMany({ where: { contactId: id } });
  }

  const contact = await prisma.contact.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(avatar !== undefined && { avatar: avatar || null }),
      ...(notes !== undefined && { notes: notes || null }),
      ...(contactFrequency !== undefined && { contactFrequency: contactFrequency }),
      ...(tags !== undefined && {
        tags: { create: tags.map((t) => ({ name: t })) },
      }),
      ...(customFields !== undefined && {
        customFields: { create: customFields },
      }),
      ...(importantDates !== undefined && {
        importantDates: { create: importantDates },
      }),
    },
    include: { tags: true, customFields: true, importantDates: true, interactions: true },
  });

  return NextResponse.json(contact);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const existing = await verifyOwnership(id, userId);
  if (!existing) return NextResponse.json({ error: "联系人不存在" }, { status: 404 });

  await prisma.contact.delete({ where: { id } });

  return NextResponse.json({ message: "已删除" });
}
