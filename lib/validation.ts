import { z } from "zod";

export const MCMASTER_DOMAIN = "@mcmaster.ca";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .refine((email) => email.endsWith(MCMASTER_DOMAIN), {
    message: `Only ${MCMASTER_DOMAIN} email addresses can register.`
  });

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be at most 128 characters.");

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(4, "Code is too short.")
  .max(12, "Code is too long.");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["INSTRUCTOR", "STUDENT"])
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.")
});

export const verifyEmailSchema = z.object({
  email: emailSchema,
  code: z.string().trim().toUpperCase().min(4).max(12)
});

export const courseCreateSchema = z.object({
  name: z.string().trim().min(2, "Course name is too short.").max(120),
  term: z.string().trim().min(2, "Term is too short.").max(50)
});

export const joinCourseSchema = z.object({ joinCode: codeSchema });

export const joinSessionSchema = z.object({ sessionCode: codeSchema });

export const pollCreateSchema = z
  .object({
    liveSessionId: z.string().cuid(),
    type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "NUMERIC"]),
    questionText: z.string().trim().min(3, "Question is too short.").max(500),
    options: z.array(z.string().trim().min(1).max(120)).max(8).optional(),
    isAnonymous: z.boolean().default(false),
    allowChange: z.boolean().default(true),
    timeLimitSec: z.number().int().min(5).max(3600).nullish()
  })
  .superRefine((value, ctx) => {
    if (value.type !== "MULTIPLE_CHOICE") return;

    const options = value.options ?? [];
    if (options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Multiple choice polls need at least 2 options."
      });
      return;
    }
    if (new Set(options).size !== options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Options must be unique."
      });
    }
  });

export const pollUpdateSchema = z.object({
  pollId: z.string().cuid(),
  close: z.boolean()
});

export const responseSubmitSchema = z.object({
  pollId: z.string().cuid(),
  // Shape is checked here; meaning is checked against the poll in normalizeAnswer.
  answer: z.union([z.string().max(240), z.number(), z.boolean()])
});
