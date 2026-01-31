import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <section className="mb-10 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3 text-mcmaster-maroon">
          MacPoll
        </h1>
        <p className="text-slate-600 max-w-2xl mx-auto">
          A McMaster-only live classroom polling and attendance platform, inspired
          by iClicker but without hardware remotes or paywalls.
        </p>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Instructors</h2>
          <p className="text-sm text-slate-600 mb-4">
            Create courses, run live sessions, launch polls, and export
            attendance and results.
          </p>
          <div className="flex gap-3">
            <Link
              href="/auth/register?role=instructor"
              className="inline-flex-1 inline-flex items-center justify-center rounded-md bg-mcmaster-maroon px-4 py-2 text-sm font-medium text-white hover:bg-mcmaster-maroon/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mcmaster-gold"
            >
              Instructor sign up
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex-1 inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Log in
            </Link>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Students</h2>
          <p className="text-sm text-slate-600 mb-4">
            Join with your McMaster email, enter a session code, and answer
            polls in two taps on mobile or desktop.
          </p>
          <div className="flex gap-3">
            <Link
              href="/auth/register?role=student"
              className="inline-flex-1 inline-flex items-center justify-center rounded-md bg-mcmaster-maroon px-4 py-2 text-sm font-medium text-white hover:bg-mcmaster-maroon/90"
            >
              Student sign up
            </Link>
            <Link
              href="/student/join"
              className="inline-flex-1 inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Join a session
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-3 text-sm text-slate-600">
        <div className="rounded-lg border bg-white p-4">
          <h3 className="font-semibold mb-1">McMaster-only access</h3>
          <p>Registration locked to <span className="font-mono">@mcmaster.ca</span> emails.</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <h3 className="font-semibold mb-1">Live results</h3>
          <p>Instant bar charts and aggregates powered by WebSockets.</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <h3 className="font-semibold mb-1">Attendance built-in</h3>
          <p>Presence is tracked automatically from live session activity.</p>
        </div>
      </section>
    </div>
  );
}

