import nodemailer from "nodemailer";

interface DigestItem {
  category: string;
  title: string;
  message: string;
}

interface SendDigestParams {
  to: string;
  userName: string;
  items: DigestItem[];
  date: string;
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function buildHtml(userName: string, items: DigestItem[], date: string): string {
  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#6366f1;font-size:13px;white-space:nowrap">${item.category}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">
          <strong style="color:#111">${item.title}</strong>
          <br/><span style="color:#666;font-size:13px">${item.message}</span>
        </td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
    <div style="background:#4f46e5;padding:20px 24px">
      <h1 style="margin:0;color:#fff;font-size:18px">MemoriContact 每日提醒</h1>
      <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px">${date} · ${userName}</p>
    </div>
    <div style="padding:16px 24px">
      <p style="color:#374151;font-size:14px;margin:0 0 12px">以下是今日生成的提醒汇总：</p>
      <table style="width:100%;border-collapse:collapse">
        ${rows}
      </table>
    </div>
    <div style="padding:12px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center">
      <p style="margin:0;color:#9ca3af;font-size:12px">此邮件由 MemoriContact 自动发送，可在「数据管理 → 提醒设置」中关闭</p>
    </div>
  </div>
</body>
</html>`;
}

function buildText(userName: string, items: DigestItem[], date: string): string {
  const lines = items.map((item) => `[${item.category}] ${item.title} — ${item.message}`);
  return `MemoriContact 每日提醒 (${date})\n\n${userName}，以下是今日提醒：\n\n${lines.join("\n")}\n\n---\n可在「数据管理 → 提醒设置」中关闭邮件摘要。`;
}

export async function sendDigestEmail(params: SendDigestParams): Promise<{ success: boolean; error?: string }> {
  const transporter = getTransporter();

  if (!transporter) {
    return { success: false, error: "SMTP 未配置（缺少 SMTP_HOST / SMTP_USER / SMTP_PASS）" };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const subject = `MemoriContact 每日提醒摘要 — ${params.date}`;

  try {
    await transporter.sendMail({
      from: `MemoriContact <${from}>`,
      to: params.to,
      subject,
      text: buildText(params.userName, params.items, params.date),
      html: buildHtml(params.userName, params.items, params.date),
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    return { success: false, error: message };
  }
}
