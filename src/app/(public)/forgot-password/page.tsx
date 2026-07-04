import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { submitPasswordResetRequestForm } from "@/features/auth/password-reset/actions";
import { PasswordResetRequestForm } from "@/features/auth/password-reset/request-form";
import {
	initialPasswordResetRequestFormState,
	type PasswordResetRequestFormState
} from "@/features/auth/password-reset/state";

type ForgotPasswordPageProps = {
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const resetMessages: Record<
	string,
	Pick<PasswordResetRequestFormState, "status" | "message">
> = {
	invalid: {
		status: "notice",
		message:
			"This reset link is invalid, expired, or already used. Request a new reset link."
	}
};

export default async function ForgotPasswordPage({
	searchParams
}: ForgotPasswordPageProps) {
	const params = await searchParams;
	const reset = Array.isArray(params?.reset) ? params.reset[0] : params?.reset;
	const hasResetParam = params?.reset !== undefined;
	const resetState = reset ? resetMessages[reset] : undefined;

	if (hasResetParam && !resetState) {
		redirect("/forgot-password");
	}

	const initialState: PasswordResetRequestFormState = resetState
		? {
				...initialPasswordResetRequestFormState,
				...resetState
			}
		: initialPasswordResetRequestFormState;

	return (
		<main className="min-h-screen bg-app-canvas text-primary-text">
			<section className="mx-auto flex min-h-screen w-full max-w-[430px] items-center px-5 py-10 sm:px-6">
				<div className="w-full border border-border-gray bg-white px-7 py-8 sm:px-8">
					<Link className="inline-flex" href="/">
						<Image
							src="/images/logo.png"
							alt="E-Clinical Case Solutions"
							className="h-auto w-[118px]"
							width={150}
							height={35}
							priority
						/>
					</Link>

					<h1
						className="mt-8 text-base font-semibold"
						data-testid="forgot-password-heading"
					>
						Reset your password
					</h1>

					<PasswordResetRequestForm
						action={submitPasswordResetRequestForm}
						initialState={initialState}
					/>
				</div>
			</section>
		</main>
	);
}
