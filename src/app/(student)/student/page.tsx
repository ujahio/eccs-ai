const studentSummary = [
  {
    label: "Active case",
    value: "Coming soon"
  },
  {
    label: "Recent certificates",
    value: "No certificates yet"
  },
  {
    label: "Access",
    value: "Verified student preview"
  }
];

export default function StudentDashboardPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase text-brand-teal">
          Student area
        </p>
        <h1
          className="mt-3 text-2xl font-semibold"
          data-testid="student-dashboard-heading"
        >
          Dashboard
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-gray">
          This shell establishes the learner route where active cases,
          certificate records, and account status will live in future slices.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {studentSummary.map((item) => (
          <article
            className="rounded border border-border-gray bg-white p-5"
            key={item.label}
          >
            <p className="text-xs font-semibold uppercase text-muted-gray">
              {item.label}
            </p>
            <p className="mt-3 text-base font-semibold">{item.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
