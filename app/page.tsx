import Link from "next/link";

const FEATURES = [
  {
    title: "McMaster-only access",
    body: "Registration is locked to @mcmaster.ca addresses with email verification."
  },
  {
    title: "Live results",
    body: "Answers stream in over websockets and the chart updates as students tap."
  },
  {
    title: "Attendance built in",
    body: "Answering a poll marks a student present. Export the roster as CSV."
  },
  {
    title: "Four question types",
    body: "Multiple choice, true/false, short answer and numeric with live statistics."
  },
  {
    title: "One vote per student",
    body: "Responses are unique per student, and you decide whether answers can change."
  },
  {
    title: "No hardware",
    body: "Students use the phone already in their pocket. Nothing to buy or charge."
  }
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <section className="mb-12 text-center">
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-mcmaster-maroon sm:text-5xl">
          Live polling for McMaster lectures
        </h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          MacPoll runs classroom polls and takes attendance in the same tap — inspired by iClicker,
          without the hardware remotes or the paywall.
        </p>
      </section>

      <section className="mb-12 grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">Instructors</h2>
          <p className="mb-4 text-sm text-slate-600">
            Create a course, start a session, and launch polls from the podium. Export attendance
            and results when the lecture ends.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/auth/register?role=instructor"
              className="inline-flex items-center justify-center rounded-md bg-mcmaster-maroon px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-mcmaster-maroon-dark"
            >
              Instructor sign up
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Log in
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">Students</h2>
          <p className="mb-4 text-sm text-slate-600">
            Sign in with your McMaster email, enter the code on the projector, and answer in two
            taps. Your attendance is recorded automatically.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/auth/register?role=student"
              className="inline-flex items-center justify-center rounded-md bg-mcmaster-maroon px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-mcmaster-maroon-dark"
            >
              Student sign up
            </Link>
            <Link
              href="/student/join"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Join a session
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="features" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <h2 id="features" className="sr-only">
          Features
        </h2>
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="rounded-lg border border-slate-200 bg-white p-4 text-sm"
          >
            <h3 className="mb-1 font-semibold text-slate-900">{feature.title}</h3>
            <p className="text-slate-600">{feature.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
