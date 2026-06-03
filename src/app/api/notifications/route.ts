import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const unreadOnly = req.nextUrl.searchParams.get("unread") === "true";

  const notifications = await prisma.notification.findMany({
    where: { userId, ...(unreadOnly ? { read: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(notifications);
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

  if (body.markAllRead) {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return NextResponse.json({ message: "已全部标记已读" });
  }

  if (body.id) {
    await prisma.notification.updateMany({
      where: { id: body.id, userId },
      data: { read: true },
    });
    return NextResponse.json({ message: "已标记已读" });
  }

  return NextResponse.json({ error: "无效操作" }, { status: 400 });
}
