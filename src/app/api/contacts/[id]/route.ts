import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  avatar: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  importantDates: z.array(z.object({ label: z.string(), date: z.string() })).optional(),
});

async function verifyOwnership(contactId: string, userId: string) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, userId },
  });
  return contact;
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

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { name, avatar, notes, tags, customFields, importantDates } = parsed.data;

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
  } catch {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
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
