import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

const introParagraphs = [
	"e-Clinical Cases Solutions aims to provide category 1 CME in laboratory medicine in the format of interactive clinical cases online. It is suitable for learning for all laboratorians, endocrinologists, rheumatologists, nurses, family and internal medicine physicians, and all users of the clinical laboratory. The cases are authentic, acquired over 20 years of clinical practice. Cases can be accessed online anywhere, and at any time.",
	"Cases will be posted fortnightly. Registered participants earn 1 category 1 CME point per case. Learning is active as participants consider and comment on the case and compare answers to a model answer by the tutor. This is accompanied by a comprehensive teaching on the subject and a test of learning by multiple choice questions (MCQs).",
	"A total of 20 category 1 CME points are offered in one year.",
	"NMC Healthcare is accredited by the Abu Dhabi Department of Health to provide CME/CPD for healthcare providers. This activity is designated for 1 CME/CPD credit per case.",
];

const objectives = [
	"To support laboratorians better provide interpretative comments for lab tests to assist clinicians manage their patients.",
	"To support clinicians, nurses and other users of the clinical laboratory better interpret their patients' test reports.",
	"To guide clinicians in ordering right test for the right patient at the right time.",
	"To provide users with needed CMEs for accreditation and re-licensing.",
];

const workflowSteps = [
	"Review the active clinical case",
	"Submit a personal analysis",
	"Compare with the model answer",
	"Study resources and pass the CME quiz",
	"Download a verifiable certificate",
];

export default function Home() {
	return (
		<main className="min-h-screen bg-app-canvas text-primary-text">
			<header className="border-b border-border-gray bg-white">
				<nav className="mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-2 md:h-14 md:flex-nowrap md:py-0">
					<Link href="/" aria-label="E-Clinical Case Solutions home">
						<Image
							src="/images/logo.png"
							alt="E-Clinical Case Solutions"
							className="h-7 w-auto"
							width={150}
							height={35}
							priority
						/>
					</Link>
					<div className="hidden h-full items-center gap-9 text-xs font-semibold uppercase md:flex">
						<Link
							className="flex h-full items-center border-b-2 border-primary-action px-1 pt-0.5 transition hover:text-brand-teal"
							href="/"
						>
							Home
						</Link>
						<Link
							className="flex h-full items-center border-b-2 border-transparent px-1 pt-0.5 transition hover:text-brand-teal"
							href="/faculty"
						>
							Faculty
						</Link>
						<a
							className="flex h-full items-center border-b-2 border-transparent px-1 pt-0.5 transition hover:text-brand-teal"
							href="#workflow"
						>
							How It Works
						</a>
					</div>
					<details className="relative md:hidden">
						<summary
							aria-label="Open navigation menu"
							className="flex h-9 w-11 cursor-pointer list-none items-center justify-center rounded border border-border-gray bg-white text-primary-text transition hover:border-primary-action focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal [&::-webkit-details-marker]:hidden"
							data-testid="mobile-nav-toggle"
						>
							<span className="grid gap-1" aria-hidden="true">
								<span className="h-0.5 w-5 bg-current" />
								<span className="h-0.5 w-5 bg-current" />
								<span className="h-0.5 w-5 bg-current" />
							</span>
						</summary>
						<div className="absolute right-0 top-11 z-10 grid w-48 gap-1 rounded border border-border-gray bg-white p-2 text-xs font-semibold uppercase shadow-soft">
							<Link className="px-3 py-2 transition hover:text-brand-teal" href="/">
								Home
							</Link>
							<Link
								className="px-3 py-2 transition hover:text-brand-teal"
								href="/faculty"
							>
								Faculty
							</Link>
							<a
								className="px-3 py-2 transition hover:text-brand-teal"
								href="#workflow"
							>
								How It Works
							</a>
							<Link
								className="px-3 py-2 transition hover:text-brand-teal"
								href="/login"
							>
								Log in
							</Link>
							<Link
								className="px-3 py-2 transition hover:text-brand-teal"
								href="/register"
							>
								Get started
							</Link>
						</div>
					</details>
					<div className="hidden items-center gap-3 md:flex">
						<ButtonLink href="/login" size="sm" variant="secondary">
							Log in
						</ButtonLink>
						<ButtonLink href="/register" size="sm">
							Get started
						</ButtonLink>
					</div>
				</nav>
			</header>

			<section
				className="mx-auto grid w-full max-w-7xl items-center gap-14 px-6 py-16 md:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-24"
				data-testid="home-hero"
			>
				<div>
					<h1
						className="text-4xl font-bold leading-tight md:text-5xl"
						data-testid="home-heading"
					>
						Welcome to e-Clinical Cases Solutions
					</h1>
					<div
						className="mt-8 grid gap-5 text-base leading-7 text-muted-gray md:text-lg md:leading-8"
						data-testid="home-intro-copy"
					>
						{introParagraphs.map((paragraph) => (
							<p key={paragraph}>{paragraph}</p>
						))}
					</div>
					<div className="mt-8 flex flex-col gap-3 sm:flex-row">
						<ButtonLink data-testid="home-hero-get-started" href="/register">
							Get started
						</ButtonLink>
					</div>
				</div>

				<div className="hidden min-h-130 grid-cols-[1fr_0.58fr] items-stretch gap-6 sm:grid">
					<div className="relative mt-8 min-h-105 overflow-hidden rounded">
						<Image
							src="/images/femaledoctor.png"
							alt="Laboratory medicine clinician"
							fill
							priority
							className="object-contain object-bottom"
							sizes="(min-width: 768px) 30vw, 100vw"
						/>
					</div>
					<div className="grid gap-6">
						<div className="relative min-h-80 overflow-hidden rounded">
							<Image
								src="/images/maledoctor3.png"
								alt="Clinical educator"
								fill
								className="object-cover object-top"
								sizes="(min-width: 768px) 18vw, 48vw"
							/>
						</div>
						<div className="relative min-h-42.5 overflow-hidden rounded">
							<Image
								src="/images/femaleassistant.png"
								alt="Clinical laboratory assistant using a microscope"
								fill
								className="object-cover object-center"
								sizes="(min-width: 768px) 18vw, 48vw"
							/>
						</div>
					</div>
				</div>
			</section>

			<section
				id="objectives"
				className="border-y border-border-gray bg-soft-section"
				data-testid="objectives-section"
			>
				<div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-6 py-16 md:grid-cols-[1.08fr_0.92fr] lg:gap-16">
					<div>
						<h2
							className="text-3xl font-bold leading-tight"
							data-testid="objectives-heading"
						>
							Objectives
						</h2>
						<div className="mt-8 grid gap-5" data-testid="objectives-list">
							{objectives.map((objective) => (
								<p
									className="border-l-2 border-brand-teal pl-5 text-base leading-7 text-muted-gray md:text-lg md:leading-8"
									key={objective}
								>
									{objective}
								</p>
							))}
						</div>
						<ButtonLink
							className="mt-8"
							data-testid="objectives-get-started"
							href="/register"
						>
							Get started
						</ButtonLink>
					</div>
					<div className="relative hidden min-h-95 overflow-hidden rounded sm:block">
						<Image
							src="/images/masked-doctor.png"
							alt="Masked laboratory medicine clinician"
							fill
							className="mix-blend-multiply object-cover object-center"
							sizes="(min-width: 768px) 42vw, 100vw"
						/>
					</div>
				</div>
			</section>

			<section
				id="workflow"
				className="bg-white"
				data-testid="workflow-section"
			>
				<div className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-14 lg:grid-cols-[1.08fr_0.86fr] lg:gap-16">
					<div>
						<p className="text-sm font-semibold uppercase text-brand-teal">
							How It Works
						</p>
						<h2
							className="mt-3 text-3xl font-bold leading-tight"
							data-testid="workflow-heading"
						>
							A static walkthrough of the student learning path
						</h2>
						<div className="mt-8 grid gap-4">
							{workflowSteps.map((step, index) => (
								<div
									className="grid grid-cols-[44px_1fr] items-center gap-4 border-b border-border-gray pb-4 last:border-b-0"
									key={step}
								>
									<span className="flex h-11 w-11 items-center justify-center rounded border border-border-gray bg-app-canvas text-sm font-bold">
										{index + 1}
									</span>
									<p className="text-base font-semibold">{step}</p>
								</div>
							))}
						</div>
					</div>
					<div className="rounded border border-border-gray bg-app-canvas p-6">
						<Image
							src="/images/certificate.png"
							alt="ECCS certificate preview"
							className="h-auto w-full rounded"
							width={916}
							height={603}
							sizes="(min-width: 1024px) 36vw, 100vw"
						/>
						<p className="mt-5 text-sm leading-6 text-muted-gray">
							Certificates are created after a learner passes the CME quiz and
							preserve immutable completion details for future download.
						</p>
					</div>
				</div>
			</section>
		</main>
	);
}
