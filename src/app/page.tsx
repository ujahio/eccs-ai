import Image from "next/image";
import logo from "../../images/logo.png";
import medicalTeam from "../../images/medstaff.jpg";

const platformHighlights = [
  "Structured clinical case delivery",
  "Student progress and certificate records",
  "Teacher-led authoring and review workflows"
];

export default function Home() {
  return (
    <main className="min-h-screen bg-app-canvas text-primary-text">
      <header className="border-b border-border-gray bg-white">
        <nav className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-6">
          <Image
            src={logo}
            alt="E-Clinical Case Solutions"
            className="h-12 w-auto"
            priority
          />
          <div className="hidden items-center gap-8 text-sm font-medium md:flex">
            <a className="transition hover:text-brand-teal" href="#overview">
              Overview
            </a>
            <a className="transition hover:text-brand-teal" href="#workflow">
              Workflow
            </a>
            <a className="transition hover:text-brand-teal" href="#access">
              Access
            </a>
          </div>
        </nav>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-10 px-6 py-12 md:grid-cols-[1fr_0.92fr] lg:py-16">
        <div className="max-w-xl">
          <p className="mb-4 text-sm font-semibold uppercase text-brand-teal">
            Clinical education platform
          </p>
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">
            E-Clinical Case Solutions
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-gray">
            A calm, structured platform for publishing clinical cases, guiding
            student learning, and preserving continuing education records.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a className="inline-flex h-11 items-center justify-center rounded bg-primary-action px-6 text-sm font-bold uppercase text-white transition hover:bg-action-hover" href="#overview">
              Get started
            </a>
            <a className="inline-flex h-11 items-center justify-center rounded border border-border-gray bg-white px-6 text-sm font-bold uppercase text-primary-text transition hover:border-primary-action" href="#workflow">
              View workflow
            </a>
          </div>
        </div>

        <div className="relative min-h-[340px] overflow-hidden rounded border border-border-gray bg-white shadow-soft md:min-h-[460px]">
          <Image
            src={medicalTeam}
            alt="Medical education staff"
            fill
            priority
            className="object-cover"
            sizes="(min-width: 768px) 45vw, 100vw"
          />
        </div>
      </section>

      <section id="overview" className="border-t border-border-gray bg-white">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-12 md:grid-cols-3">
          {platformHighlights.map((highlight) => (
            <article
              className="rounded border border-border-gray bg-white p-6"
              key={highlight}
            >
              <h2 className="text-base font-semibold">{highlight}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-gray">
                Phase 0 establishes the application baseline, scripts, and SST
                stage conventions for implementation work.
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
