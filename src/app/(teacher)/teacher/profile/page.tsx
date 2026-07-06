import {
	submitTeacherPasswordChangeForm,
	submitTeacherPersonalDetailsForm,
} from "@/features/teacher/profile-security/actions";
import { ProfileEmailStatus } from "@/features/profile-security/profile-email-status";
import { ProfileSecurityForms } from "@/features/profile-security/profile-security-forms";
import { requireTeacherSession } from "@/lib/auth/session";

type TeacherProfilePageProps = {
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeacherProfilePage({
	searchParams,
}: TeacherProfilePageProps) {
	const { profile } = await requireTeacherSession();
	const params = await searchParams;
	const emailStatus = Array.isArray(params?.email)
		? params.email[0]
		: params?.email;

	return (
		<section className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
			<div className="mb-6 sm:mb-8">
				<p className="text-sm font-semibold uppercase text-brand-teal">
					Account profile
				</p>
				<p className="mt-3 max-w-2xl text-sm leading-6 text-muted-gray">
					Manage your teacher profile, verified email address, and password.
				</p>
				<ProfileEmailStatus emailStatus={emailStatus} profileKind="teacher" />
			</div>

			<ProfileSecurityForms
				currentEmail={profile.emailNormalized}
				firstName={profile.firstName}
				lastName={profile.lastName}
				personalDetailsAction={submitTeacherPersonalDetailsForm}
				passwordAction={submitTeacherPasswordChangeForm}
				pendingEmail={profile.pendingEmail}
				profileKind="teacher"
			/>
		</section>
	);
}
