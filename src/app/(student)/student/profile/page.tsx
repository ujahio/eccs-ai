import {
	submitStudentPersonalDetailsForm,
	submitStudentPasswordChangeForm,
} from "@/features/student/profile-security/actions";
import { ProfileEmailStatus } from "@/features/profile-security/profile-email-status";
import { ProfileSecurityForms } from "@/features/profile-security/profile-security-forms";
import { requireStudentSession } from "@/lib/auth/session";

type StudentProfilePageProps = {
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StudentProfilePage({
	searchParams,
}: StudentProfilePageProps) {
	const { profile } = await requireStudentSession();
	const params = await searchParams;
	const emailStatus = Array.isArray(params?.email)
		? params.email[0]
		: params?.email;

	return (
		<section className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
			<div className="mb-6 sm:mb-8">
				<p className="text-sm font-semibold uppercase text-brand-teal">
					Account Profile
				</p>
				<p className="mt-3 max-w-2xl text-sm leading-6 text-muted-gray">
					Manage your student profile, verified email address, and password.
				</p>
				<ProfileEmailStatus emailStatus={emailStatus} profileKind="student" />
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
