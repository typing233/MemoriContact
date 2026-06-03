import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "memoricontact-cron-key";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const now = new Date();
  const upcoming = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const contacts = await prisma.contact.findMany({
    include: {
      importantDates: true,
      interactions: { orderBy: { date: "desc" }, take: 1 },
      user: { select: { id: true } },
    },
  });

  let remindersCreated = 0;
  let notificationsCreated = 0;

  for (const contact of contacts) {
    for (const importantDate of contact.importantDates) {
      const dateStr = importantDate.date;
      if (!dateStr) continue;

      const [, month, day] = dateStr.split("-").map(Number);
      const thisYearDate = new Date(now.getFullYear(), month - 1, day);
      if (thisYearDate < now) {
        thisYearDate.setFullYear(now.getFullYear() + 1);
      }

      if (thisYearDate <= upcoming) {
        const existingReminder = await prisma.reminder.findFirst({
          where: {
            contactId: contact.id,
            type: "important_date",
            title: { contains: importantDate.label },
            dueDate: thisYearDate,
          },
        });

        if (!existingReminder) {
          await prisma.reminder.create({
            data: {
              contactId: contact.id,
              type: "important_date",
              title: `${contact.name} 的${importantDate.label}即将到来`,
              message: `${importantDate.label}: ${dateStr}`,
              dueDate: thisYearDate,
            },
          });
          remindersCreated++;

          await prisma.notification.create({
            data: {
              userId: contact.userId,
              type: "reminder",
              title: `${contact.name} 的${importantDate.label}即将到来`,
              message: `日期: ${dateStr}，还有 ${Math.ceil((thisYearDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} 天`,
              link: `/contacts/${contact.id}`,
            },
          });
          notificationsCreated++;
        }
      }
    }

    if (contact.contactFrequency) {
      const lastInteraction = contact.interactions[0]?.date;
      if (lastInteraction) {
        const daysSince = Math.floor((now.getTime() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince >= contact.contactFrequency) {
          const existingReminder = await prisma.reminder.findFirst({
            where: {
              contactId: contact.id,
              type: "overdue_contact",
              done: false,
              createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
            },
          });

          if (!existingReminder) {
            await prisma.reminder.create({
              data: {
                contactId: contact.id,
                type: "overdue_contact",
                title: `该联系 ${contact.name} 了`,
                message: `已经 ${daysSince} 天没有互动了（设定频率: 每 ${contact.contactFrequency} 天）`,
                dueDate: now,
              },
            });
            remindersCreated++;

            await prisma.notification.create({
              data: {
                userId: contact.userId,
                type: "suggestion",
                title: `该联系 ${contact.name} 了`,
                message: `已经 ${daysSince} 天没有互动`,
                link: `/contacts/${contact.id}`,
              },
            });
            notificationsCreated++;
          }
        }
      }
    }
  }

  return NextResponse.json({
    message: "定时任务完成",
    remindersCreated,
    notificationsCreated,
    checkedAt: todayStr,
  });
}
