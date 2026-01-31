import { z } from "zod";

export const emailSchema = z
  .string()
  .email()
  .refine((email) => email.toLowerCase().endsWith("@mcmaster.ca"), {
    message: "Only @mcmaster.ca emails are allowed"
  });

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["INSTRUCTOR", "STUDENT"])
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string()
});

export const courseCreateSchema = z.object({
  name: z.string().min(2).max(120),
  term: z.string().min(2).max(50)
});

export const joinCourseSchema = z.object({
  joinCode: z.string().min(4).max(12)
});

export const liveSessionCreateSchema = z.object({
  courseId: z.string().cuid()
});

export const pollCreateSchema = z.object({
  liveSessionId: z.string().cuid(),
  type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "NUMERIC"]),
  questionText: z.string().min(3).max(500),
  options: z.array(z.string().min(1).max(120)).max(6).optional(),
  isAnonymous: z.boolean().default(false),
  allowChange: z.boolean().default(true),
  timeLimitSec: z.number().int().positive().max(3600).optional()
});

export const responseSubmitSchema = z.object({
  pollId: z.string().cuid(),
  answer: z.union([
    z.string().max(240),
    z.number(),
    z.array(z.string()),
    z.boolean()
  ])
});

