import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

const updateSchema = z.object({
  type: z.string().min(1).optional(),
  note: z.string().optional(),
  location: z.string().optional(),
  date: z.string().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; interactionId: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id, interactionId } = await params;
  const contact = await prisma.contact.findFirst({ where: { id, userId } });
  if (!contact) return NextResponse.json({ error: "联系人不存在" }, { status: 404 });

  const interaction = await prisma.interaction.findFirst({
    where: { id: interactionId, contactId: id },
  });
  if (!interaction) return NextResponse.json({ error: "记录不存在" }, { status: 404 });

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { type, note, location, date } = parsed.data;
    const updated = await prisma.interaction.update({
      where: { id: interactionId },
      data: {
        ...(type !== undefined && { type }),
        ...(note !== undefined && { note: note || null }),
        ...(location !== undefined && { location: location || null }),
        ...(date !== undefined && { date: new Date(date) }),
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; interactionId: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id, interactionId } = await params;
  const contact = await prisma.contact.findFirst({ where: { id, userId } });
  if (!contact) return NextResponse.json({ error: "联系人不存在" }, { status: 404 });

  const interaction = await prisma.interaction.findFirst({
    where: { id: interactionId, contactId: id },
  });
  if (!interaction) return NextResponse.json({ error: "记录不存在" }, { status: 404 });

  await prisma.interaction.delete({ where: { id: interactionId } });

  return NextResponse.json({ message: "已删除" });
}
