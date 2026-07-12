import Image from "next/image";
import { formatDubaiDate } from "@/lib/date-format";

export type StudentCertificatePreviewFacts = {
	certificateBranding: {
		organizationName: string;
		shortName: string;
	};
	caseTitle: string;
	completedAt: number;
	studentDisplayName: string;
};

type StudentCertificatePreviewProps = {
	certificate: StudentCertificatePreviewFacts;
	className?: string;
	density?: "compact" | "standard";
};

export function StudentCertificatePreview({
	certificate,
	className,
	density = "standard",
}: StudentCertificatePreviewProps) {
	const completedDate = formatDubaiDate(certificate.completedAt);
	const classes = certificatePreviewClasses[density];
	const isCompact = density === "compact";

	return (
		<div
			aria-label={`Certificate preview for ${certificate.caseTitle}`}
			className={[
				"w-full overflow-hidden border border-primary-action bg-primary-action text-center",
				classes.frame,
				className,
			]
				.filter(Boolean)
				.join(" ")}
			data-testid="student-certificate-preview"
			style={{
				backgroundImage:
					"radial-gradient(circle at 2px 2px, rgba(255,255,255,0.12) 1px, transparent 0)",
				backgroundSize: "12px 12px",
			}}
		>
			<div
				className={[
					"flex aspect-[916/603] flex-col overflow-hidden bg-white text-primary-text",
					classes.paper,
				].join(" ")}
			>
				<header className={["flex flex-col items-center", classes.header].join(" ")}>
					<Image
						alt={`${certificate.certificateBranding.shortName} logo`}
						className={["h-auto", classes.logo].join(" ")}
						height={35}
						src="/images/logo.png"
						width={150}
					/>
					<p
						className={[
							"font-semibold uppercase text-muted-gray",
							classes.brand,
						].join(" ")}
						data-testid="student-certificate-preview-brand"
					>
						{certificate.certificateBranding.organizationName}
					</p>
				</header>

				<div
					className={[
						"flex min-h-0 flex-1 flex-col justify-center",
						classes.body,
					].join(" ")}
				>
					<h3
						className={[
							"font-semibold leading-tight text-muted-gray",
							classes.title,
						].join(" ")}
					>
						Certificate Of Completion
					</h3>
					{isCompact ? null : (
						<p
							className={[
								"font-semibold uppercase text-muted-gray",
								classes.awardedLabel,
							].join(" ")}
						>
							Awarded To
						</p>
					)}
					<p
						className={[
							"mx-auto max-w-full break-words font-bold leading-tight text-primary-text",
							classes.name,
						].join(" ")}
						data-testid="student-certificate-preview-name"
					>
						{certificate.studentDisplayName}
					</p>
					{isCompact ? null : (
						<>
							<p
								className={[
									"font-semibold uppercase text-muted-gray",
									classes.completedLabel,
								].join(" ")}
							>
								Who Successfully Completed
							</p>
							<p
								className={[
									"mx-auto max-w-2xl break-words font-bold leading-snug text-primary-text",
									classes.caseTitle,
								].join(" ")}
								data-testid="student-certificate-preview-case"
							>
								{certificate.caseTitle}
							</p>
						</>
					)}
				</div>

				{isCompact ? null : (
					<p
						className={["font-semibold text-muted-gray", classes.date].join(" ")}
						data-testid="student-certificate-preview-date"
					>
						Completed {completedDate}
					</p>
				)}
			</div>
		</div>
	);
}

const certificatePreviewClasses = {
	compact: {
		awardedLabel: "",
		body: "py-2",
		brand: "text-[8px] leading-3 sm:text-[10px]",
		caseTitle: "",
		completedLabel: "",
		date: "",
		frame: "p-2.5",
		header: "gap-1.5",
		logo: "w-[88px] sm:w-[108px]",
		name: "mt-3 text-lg sm:text-xl",
		paper: "px-3 py-4",
		title: "text-xs sm:text-sm",
	},
	standard: {
		awardedLabel: "mt-4 text-xs sm:mt-5 sm:text-sm",
		body: "py-3 sm:py-5",
		brand: "text-[10px] leading-4 sm:text-xs",
		caseTitle: "mt-3 text-base sm:text-lg",
		completedLabel: "mt-4 text-xs sm:mt-6 sm:text-sm",
		date: "text-xs leading-5 sm:text-sm",
		frame: "p-3 sm:p-5",
		header: "gap-2",
		logo: "w-[112px] sm:w-[138px]",
		name: "mt-2 text-3xl sm:text-4xl",
		paper: "px-4 py-5 sm:px-10 sm:py-8",
		title: "text-xl sm:text-2xl",
	},
} as const;
