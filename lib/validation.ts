import { z } from "zod";
 
const mcmasterEmail = z
  .string()
  .email("Must be a valid email")
  .refine((v) => v.toLowerCase().endsWith("@mcmaster.ca"), {
    message: "Must be a @mcmaster.ca email address"
  });
 
// ── Auth ──────────────────────────────────────────────────────────────────────
 
export const registerSchema = z.object({
  email: mcmasterEmail,
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["INSTRUCTOR", "STUDENT"])
});
 
export const loginSchema = z.object({
  email: mcmasterEmail,
  password: z.string().min(1, "Password is required")
});
 
// ── Courses ───────────────────────────────────────────────────────────────────
 
export const courseCreateSchema = z.object({
  name: z.string().min(1, "Course name is required").max(120),
  term: z.string().min(1, "Term is required").max(60)
});
 
export const joinCourseSchema = z.object({
  joinCode: z.string().min(1, "Join code is required").max(16).toUpperCase()
});
 
// ── Live sessions ─────────────────────────────────────────────────────────────
 
export const liveSessionCreateSchema = z.object({
  courseId: z.string().cuid("Invalid course ID")
});
 
// ── Polls ─────────────────────────────────────────────────────────────────────
 
export const pollCreateSchema = z.object({
  liveSessionId: z.string().cuid("Invalid session ID"),
  type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "NUMERIC"]),
  questionText: z.string().min(1, "Question is required").max(500),
  options: z
    .array(z.string().min(1).max(200))
    .min(2, "At least 2 options required")
    .max(8)
    .optional(),
  isAnonymous: z.boolean().default(false),
  allowChange: z.boolean().default(true),
  timeLimitSec: z.number().int().positive().optional()
});
 
// ── Responses ─────────────────────────────────────────────────────────────────
 
export const responseSubmitSchema = z.object({
  pollId: z.string().cuid("Invalid poll ID"),
  answer: z.union([z.string().min(1).max(1000), z.number()])
});