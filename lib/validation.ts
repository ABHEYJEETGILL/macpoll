import { z } from "zod";

const mcmasterEmail = z
  .string()
  .email("Must be a valid email")
  .transform((v) => v.toLowerCase())
  .refine((v) => v.endsWith("@mcmaster.ca"), {
    message: "Must be a @mcmaster.ca email address"
  });

// Auth

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  email: mcmasterEmail,
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  role: z.enum(["INSTRUCTOR", "STUDENT"])
});

export const loginSchema = z.object({
  email: mcmasterEmail,
  password: z.string().min(1, "Password is required")
});

// Courses

export const courseCreateSchema = z.object({
  name: z.string().min(1, "Course name is required").max(120),
  code: z.string().min(1, "Course code is required").max(32),
  description: z.string().max(500).optional(),
  semester: z.string().max(60).optional()
});

export const joinCourseSchema = z.object({
  joinCode: z
    .string()
    .min(1, "Join code is required")
    .max(16)
    .transform((v) => v.toUpperCase())
});

// Class sessions

export const classSessionCreateSchema = z.object({
  courseId: z.string().cuid("Invalid course ID"),
  title: z.string().min(2, "Title is required").max(120),
  description: z.string().max(500).optional(),
  date: z.string().datetime().optional()
});

export const classSessionActionSchema = z.object({
  action: z.enum(["activate", "deactivate"])
});

// Questions (reusable library)

export const questionCreateSchema = z.object({
  title: z.string().min(2).max(120),
  body: z.string().min(3).max(1000),
  type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"]),
  imageUrl: z.string().url().optional().nullable(),
  showContentToStudents: z.boolean().default(true),
  points: z.number().int().min(0).max(100).default(1),
  options: z
    .array(
      z.object({
        text: z.string().min(1).max(200),
        isCorrect: z.boolean().default(false)
      })
    )
    .min(2)
    .max(6)
    .optional()
});

// Polls

export const pollCreateSchema = z.object({
  courseId: z.string().cuid("Invalid course ID"),
  sessionId: z.string().cuid().optional().nullable(),
  questionId: z.string().cuid().optional().nullable(),
  title: z.string().min(1, "Title is required").max(120),
  question: z.string().min(1, "Question is required").max(1000),
  type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"]),
  imageUrl: z.string().url().optional().nullable(),
  showContentToStudents: z.boolean().default(true),
  hideResults: z.boolean().default(false),
  timerSeconds: z.number().int().positive().max(3600).optional().nullable(),
  options: z
    .array(
      z.object({
        text: z.string().min(1).max(200),
        isCorrect: z.boolean().default(false)
      })
    )
    .min(2)
    .max(8)
    .optional()
});

export const pollActionSchema = z.object({
  pollId: z.string().cuid("Invalid poll ID"),
  action: z.enum(["start", "end"])
});

// Responses

export const submitPollResponseSchema = z
  .object({
    pollId: z.string().cuid("Invalid poll ID"),
    optionId: z.string().cuid().optional(),
    shortAnswer: z.string().min(1).max(1000).optional()
  })
  .refine((v) => Boolean(v.optionId) || Boolean(v.shortAnswer), {
    message: "An answer is required."
  });

/** @deprecated use `submitPollResponseSchema` */
export const SubmitPollResponseSchema = submitPollResponseSchema;

// Attendance

export const attendanceOpenSchema = z.object({
  courseId: z.string().cuid("Invalid course ID"),
  label: z.string().min(1, "Label is required").max(120),
  durationMins: z.number().int().positive().max(600).optional()
});
