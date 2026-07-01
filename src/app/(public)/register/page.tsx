import Image from "next/image";
import Link from "next/link";
import { submitRegistrationForm } from "@/features/auth/registration/actions";
import { RegistrationForm } from "@/features/auth/registration/registration-form";
import { initialRegistrationFormState } from "@/features/auth/registration/state";

export default function RegisterPage() {
	return (
		<main className="min-h-screen bg-app-canvas text-primary-text">
			<section className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col justify-center px-5 py-10 sm:px-6">
				<div className="w-full border border-border-gray bg-white px-7 py-10 sm:px-10 sm:py-11">
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

					<div className="mt-9">
						<h1
							className="text-lg font-semibold leading-tight"
							data-testid="register-heading"
						>
							Create your student account
						</h1>
						<p className="mt-3 text-sm leading-6 text-muted-gray">
							Verification is required before you can sign in.
						</p>
					</div>

					<RegistrationForm
						action={submitRegistrationForm}
						initialState={initialRegistrationFormState}
					/>

					<p className="mt-7 border-t border-border-gray pt-5 text-sm text-muted-gray">
						Already registered?{" "}
						<Link
							className="font-semibold text-primary-text underline"
							data-testid="register-login-link"
							href="/login"
						>
							Sign in
						</Link>
					</p>
				</div>
			</section>
		</main>
	);
}
