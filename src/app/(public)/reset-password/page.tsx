import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { submitPasswordResetConfirmForm } from "@/features/auth/password-reset/actions";
import { PasswordResetConfirmForm } from "@/features/auth/password-reset/confirm-form";
import { isPasswordResetCodeFormatValid } from "@/features/auth/password-reset/schema";

type ResetPasswordPageProps = {
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ResetPasswordPage({
	searchParams
}: ResetPasswordPageProps) {
	const params = await searchParams;
	const code = Array.isArray(params?.code) ? params.code[0] : params?.code;

	if (!code?.trim() || !isPasswordResetCodeFormatValid(code)) {
		redirect("/forgot-password?reset=invalid");
	}

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
						data-testid="reset-password-heading"
					>
						Create a new password
					</h1>

					<PasswordResetConfirmForm
						action={submitPasswordResetConfirmForm}
						code={code ?? ""}
					/>
				</div>
			</section>
		</main>
	);
}
