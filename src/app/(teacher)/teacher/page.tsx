const teacherSummary = [
  {
    label: "Active case",
    value: "None published"
  },
  {
    label: "Drafts",
    value: "Authoring starts in Phase 5"
  },
  {
    label: "Responses",
    value: "No student activity yet"
  }
];

export default function TeacherDashboardPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase text-brand-teal">
          Teacher area
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Dashboard</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-gray">
          This shell establishes the educator route where case authoring,
          publishing status, and learner responses will live in future slices.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {teacherSummary.map((item) => (
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
