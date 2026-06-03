import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { updateInteractionSchema, formatZodError } from "@/lib/validation";

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

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const parsed = updateInteractionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const { type, note, location, date } = parsed.data;
  const updated = await prisma.interaction.update({
    where: { id: interactionId },
    data: {
      ...(type !== undefined && { type }),
      ...(note !== undefined && { note: note || null }),
      ...(location !== undefined && { location: location || null }),
      ...(date !== undefined && date && { date: new Date(date) }),
    },
  });

  return NextResponse.json(updated);
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
