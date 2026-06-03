import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function runReminderCheck() {
  const now = new Date();
  const upcoming = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const contacts = await prisma.contact.findMany({
    include: {
      importantDates: true,
      interactions: { orderBy: { date: "desc" }, take: 1 },
      user: { select: { id: true, email: true, emailReminder: true, name: true } },
    },
  });

  let remindersCreated = 0;
  let notificationsCreated = 0;
  const emailDigests: Map<string, { email: string; userName: string; items: string[] }> = new Map();

  for (const contact of contacts) {
    // --- Important dates check ---
    for (const importantDate of contact.importantDates) {
      const dateStr = importantDate.date;
      if (!dateStr) continue;

      const parts = dateStr.split("-").map(Number);
      if (parts.length < 3) continue;
      const [, month, day] = parts;
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
          const daysLeft = Math.ceil((thisYearDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const title = `${contact.name} 的${importantDate.label}即将到来`;
          const message = `日期: ${dateStr}，还有 ${daysLeft} 天`;

          await prisma.reminder.create({
            data: {
              contactId: contact.id,
              type: "important_date",
              title,
              message,
              dueDate: thisYearDate,
            },
          });
          remindersCreated++;

          await prisma.notification.create({
            data: {
              userId: contact.userId,
              type: "reminder",
              title,
              message,
              link: `/contacts/${contact.id}`,
            },
          });
          notificationsCreated++;

          if (contact.user.emailReminder) {
            const digest = emailDigests.get(contact.userId) || { email: contact.user.email, userName: contact.user.name, items: [] };
            digest.items.push(`[重要日期] ${title} — ${message}`);
            emailDigests.set(contact.userId, digest);
          }
        }
      }
    }

    // --- Overdue contact check (including never-interacted) ---
    if (contact.contactFrequency) {
      const lastInteraction = contact.interactions[0]?.date;
      let daysSince: number;
      let shouldRemind = false;

      if (lastInteraction) {
        daysSince = Math.floor((now.getTime() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60 * 24));
        shouldRemind = daysSince >= contact.contactFrequency;
      } else {
        // Never interacted — use days since contact creation
        daysSince = Math.floor((now.getTime() - new Date(contact.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        shouldRemind = daysSince >= contact.contactFrequency;
      }

      if (shouldRemind) {
        const existingReminder = await prisma.reminder.findFirst({
          where: {
            contactId: contact.id,
            type: "overdue_contact",
            done: false,
            createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
          },
        });

        if (!existingReminder) {
          const neverInteracted = !contact.interactions[0]?.date;
          const title = `该联系 ${contact.name} 了`;
          const message = neverInteracted
            ? `添加后从未互动过（设定频率: 每 ${contact.contactFrequency} 天）`
            : `已经 ${daysSince} 天没有互动了（设定频率: 每 ${contact.contactFrequency} 天）`;

          await prisma.reminder.create({
            data: {
              contactId: contact.id,
              type: "overdue_contact",
              title,
              message,
              dueDate: now,
            },
          });
          remindersCreated++;

          await prisma.notification.create({
            data: {
              userId: contact.userId,
              type: "suggestion",
              title,
              message: neverInteracted ? "添加后从未互动过" : `已经 ${daysSince} 天没有互动`,
              link: `/contacts/${contact.id}`,
            },
          });
          notificationsCreated++;

          if (contact.user.emailReminder) {
            const digest = emailDigests.get(contact.userId) || { email: contact.user.email, userName: contact.user.name, items: [] };
            digest.items.push(`[联系提醒] ${title} — ${message}`);
            emailDigests.set(contact.userId, digest);
          }
        }
      }
    }
  }

  // Send email digests (log-based; plug in real email provider here)
  const emailsSent: string[] = [];
  for (const [userId, digest] of emailDigests) {
    if (digest.items.length > 0) {
      // In production, replace with actual email sending (e.g. nodemailer, resend, etc.)
      console.log(`[EMAIL DIGEST] To: ${digest.email} (${digest.userName})`);
      console.log(`  Subject: MemoriContact 每日提醒摘要`);
      console.log(`  Items:\n    ${digest.items.join("\n    ")}`);
      emailsSent.push(userId);
    }
  }

  return {
    message: "定时任务完成",
    remindersCreated,
    notificationsCreated,
    emailDigestsSent: emailsSent.length,
    checkedAt: todayStr,
  };
}

// GET — designed for cron job schedulers (e.g. Vercel Cron, external scheduler)
// Uses CRON_SECRET via query param or header
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET || "memoricontact-cron-key";
  const paramSecret = req.nextUrl.searchParams.get("secret");
  const headerSecret = req.headers.get("authorization")?.replace("Bearer ", "");

  if (paramSecret !== cronSecret && headerSecret !== cronSecret) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const result = await runReminderCheck();
  return NextResponse.json(result);
}

// POST — manual trigger, same auth
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET || "memoricontact-cron-key";
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const result = await runReminderCheck();
  return NextResponse.json(result);
}
