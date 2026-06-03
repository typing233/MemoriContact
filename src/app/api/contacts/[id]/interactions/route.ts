import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

const interactionSchema = z.object({
  type: z.string().min(1, "类型不能为空"),
  note: z.string().optional(),
  location: z.string().optional(),
  date: z.string().min(1, "日期不能为空"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const contact = await prisma.contact.findFirst({ where: { id, userId } });
  if (!contact) return NextResponse.json({ error: "联系人不存在" }, { status: 404 });

  try {
    const body = await req.json();
    const parsed = interactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { type, note, location, date } = parsed.data;

    const interaction = await prisma.interaction.create({
      data: {
        contactId: id,
        type,
        note: note || null,
        location: location || null,
        date: new Date(date),
      },
    });

    return NextResponse.json(interaction, { status: 201 });
  } catch {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
