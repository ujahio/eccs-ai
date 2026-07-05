import {
	submitStudentPersonalDetailsForm,
	submitStudentPasswordChangeForm,
} from "@/features/student/profile-security/actions";
import { ProfileSecurityForms } from "@/features/student/profile-security/profile-security-forms";
import { requireStudentSession } from "@/lib/auth/session";

type StudentProfilePageProps = {
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const emailStatusMessages: Record<string, { message: string; tone: string }> = {
	verified: {
		message: "Your email address has been updated.",
		tone: "success",
	},
	expired: {
		message: "This email change link has expired. Request a new one below.",
		tone: "notice",
	},
	invalid: {
		message: "This email change link is invalid. Request a new one below.",
		tone: "error",
	},
	used: {
		message: "This email change link has already been used.",
		tone: "notice",
	},
};

export default async function StudentProfilePage({
	searchParams,
}: StudentProfilePageProps) {
	const { profile } = await requireStudentSession();
	const params = await searchParams;
	const emailStatus = Array.isArray(params?.email)
		? params.email[0]
		: params?.email;
	const emailMessage = emailStatus
		? emailStatusMessages[emailStatus]
		: undefined;

	return (
		<section className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
			<div className="mb-6 sm:mb-8">
				<p className="text-sm font-semibold uppercase text-brand-teal">
					Account Profile
				</p>
				<p className="mt-3 max-w-2xl text-sm leading-6 text-muted-gray">
					Manage your student profile, verified email address, and password.
				</p>
				{emailMessage ? (
					<p
						className={`mt-5 border px-4 py-3 text-sm leading-6 ${
							emailMessage.tone === "success"
								? "border-success-mint bg-success-soft"
								: emailMessage.tone === "notice"
									? "border-warning-gold bg-app-canvas"
									: "border-error-red bg-white text-error-red"
						}`}
						data-testid={`student-email-${emailStatus}-message`}
						role={emailMessage.tone === "error" ? "alert" : "status"}
					>
						{emailMessage.message}
					</p>
				) : null}
			</div>

			<ProfileSecurityForms
				currentEmail={profile.emailNormalized}
				firstName={profile.firstName}
				lastName={profile.lastName}
				personalDetailsAction={submitStudentPersonalDetailsForm}
				passwordAction={submitStudentPasswordChangeForm}
				pendingEmail={profile.pendingEmail}
			/>
		</section>
	);
}
