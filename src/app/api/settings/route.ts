import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailReminder: true, email: true, name: true },
  });

  return NextResponse.json(user);
}

export async function PUT(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const { emailReminder } = body;

  if (typeof emailReminder !== "boolean") {
    return NextResponse.json({ error: "emailReminder 必须是布尔值" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { emailReminder },
    select: { emailReminder: true, email: true, name: true },
  });

  return NextResponse.json(user);
}
