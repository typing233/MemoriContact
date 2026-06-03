import { z } from "zod";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(str: string): boolean {
  if (!DATE_REGEX.test(str)) return false;
  const d = new Date(str + "T00:00:00Z");
  if (isNaN(d.getTime())) return false;
  const [y, m, day] = str.split("-").map(Number);
  return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m && d.getUTCDate() === day;
}

const customFieldSchema = z.object({
  label: z.string().min(1, "自定义字段名不能为空"),
  value: z.string().min(1, "自定义字段值不能为空"),
});

const importantDateSchema = z.object({
  label: z.string().min(1, "日期标签不能为空"),
  date: z.string().min(1, "日期不能为空").refine(isValidDate, "日期格式无效，请使用 YYYY-MM-DD"),
});

export const createContactSchema = z.object({
  name: z.string().min(1, "姓名不能为空").max(100, "姓名不能超过100字"),
  avatar: z.string().url("头像必须是有效的 URL").optional().or(z.literal("")),
  notes: z.string().max(5000, "备注不能超过5000字").optional().or(z.literal("")),
  tags: z.array(z.string().min(1, "标签不能为空字符串")).optional(),
  customFields: z.array(customFieldSchema).optional(),
  importantDates: z.array(importantDateSchema).optional(),
});

export const updateContactSchema = z.object({
  name: z.string().min(1, "姓名不能为空").max(100, "姓名不能超过100字").optional(),
  avatar: z.string().url("头像必须是有效的 URL").optional().or(z.literal("")),
  notes: z.string().max(5000, "备注不能超过5000字").optional().or(z.literal("")),
  tags: z.array(z.string().min(1, "标签不能为空字符串")).optional(),
  customFields: z.array(customFieldSchema).optional(),
  importantDates: z.array(importantDateSchema).optional(),
});

export const createInteractionSchema = z.object({
  type: z.string().min(1, "互动类型不能为空"),
  note: z.string().max(2000, "备注不能超过2000字").optional().or(z.literal("")),
  location: z.string().max(200, "地点不能超过200字").optional().or(z.literal("")),
  date: z.string().min(1, "日期不能为空").refine(isValidDate, "日期格式无效，请使用 YYYY-MM-DD"),
});

export const updateInteractionSchema = z.object({
  type: z.string().min(1, "互动类型不能为空").optional(),
  note: z.string().max(2000, "备注不能超过2000字").optional().or(z.literal("")),
  location: z.string().max(200, "地点不能超过200字").optional().or(z.literal("")),
  date: z.string().refine((v) => !v || isValidDate(v), "日期格式无效，请使用 YYYY-MM-DD").optional(),
});

export function formatZodError(error: z.ZodError): string {
  return error.issues[0].message;
}
