import Link from "next/link";

export default function HomePage() {
  return (
    <div className="max-w-4xl px-4 py-10 mx-auto">
      <section className="mb-10 text-center">
        <h1 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl text-mcmaster-maroon">
          MacPoll
        </h1>
        <p className="max-w-2xl mx-auto text-slate-600">
          A McMaster-only live classroom polling and attendance platform, inspired
          by iClicker but without hardware remotes or paywalls.
        </p>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="p-6 bg-white border shadow-sm rounded-xl">
          <h2 className="mb-2 text-lg font-semibold">Instructors</h2>
          <p className="mb-4 text-sm text-slate-600">
            Create courses, run live sessions, launch polls, and export
            attendance and results.
          </p>
          <div className="flex gap-3">
            <Link
              href="/auth/register?role=instructor"
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white rounded-md inline-flex-1 bg-mcmaster-maroon hover:bg-mcmaster-maroon/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mcmaster-gold"
            >
              Instructor sign up
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium bg-white border rounded-md inline-flex-1 border-slate-300 text-slate-800 hover:bg-slate-50"
            >
              Log in
            </Link>
          </div>
        </div>

        <div className="p-6 bg-white border shadow-sm rounded-xl">
          <h2 className="mb-2 text-lg font-semibold">Students</h2>
          <p className="mb-4 text-sm text-slate-600">
            Join with your McMaster email, enter a session code, and answer
            polls in two taps on mobile or desktop.
          </p>
          <div className="flex gap-3">
            <Link
              href="/auth/register?role=student"
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white rounded-md inline-flex-1 bg-mcmaster-maroon hover:bg-mcmaster-maroon/90"
            >
              Student sign up
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium bg-white border rounded-md inline-flex-1 border-slate-300 text-slate-800 hover:bg-slate-50"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 mt-10 text-sm sm:grid-cols-3 text-slate-600">
        <div className="p-4 bg-white border rounded-lg">
          <h3 className="mb-1 font-semibold">McMaster-only access</h3>
          <p>Registration locked to <span className="font-mono">@mcmaster.ca</span> emails.</p>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <h3 className="mb-1 font-semibold">Live results</h3>
          <p>Instant bar charts and aggregates powered by WebSockets.</p>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <h3 className="mb-1 font-semibold">Attendance built-in</h3>
          <p>Presence is tracked automatically from live session activity.</p>
        </div>
      </section>
    </div>
  );
}

