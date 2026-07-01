import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/arrow-right-icon";
import { Button } from "@/components/ui/button";

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

					<div className="mt-10 grid gap-5">
						<div className="grid items-start gap-5 sm:grid-cols-2">
							<label className="flex flex-col gap-2 text-xs font-medium leading-none text-muted-gray">
								First Name
								<input
									className="h-11 border border-border-gray bg-white px-3 text-sm leading-normal text-primary-text outline-none transition placeholder:text-disabled-gray focus:border-brand-teal"
									data-testid="register-first-name"
									placeholder="Jordan"
									type="text"
									id="register-first-name"
								/>
							</label>
							<label className="flex flex-col gap-2 text-xs font-medium leading-none text-muted-gray">
								Last Name
								<input
									className="h-11 border border-border-gray bg-white px-3 text-sm leading-normal text-primary-text outline-none transition placeholder:text-disabled-gray focus:border-brand-teal"
									data-testid="register-last-name"
									placeholder="Joe"
									type="text"
									id="register-last-name"
								/>
							</label>
						</div>

						<label className="grid gap-2 text-xs font-medium text-muted-gray">
							Email Address
							<input
								className="h-11 border border-border-gray bg-white px-3 text-sm text-primary-text outline-none transition placeholder:text-disabled-gray focus:border-brand-teal"
								data-testid="register-email"
								placeholder="johndoe@gmail.com"
								type="email"
							/>
						</label>
						<label className="grid gap-2 text-xs font-medium text-muted-gray">
							Password
							<span className="flex h-11 items-center border border-border-gray bg-white focus-within:border-brand-teal">
								<input
									className="min-w-0 flex-1 bg-transparent px-3 text-sm text-primary-text outline-none placeholder:text-disabled-gray"
									data-testid="register-password"
									placeholder="Password"
									type="password"
								/>
								<button
									className="h-full px-3 text-[10px] font-bold uppercase text-primary-action"
									type="button"
								>
									Show
								</button>
							</span>
						</label>
					</div>

					<Button
						className="group mt-7 w-full justify-start px-5 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-action-hover"
						data-testid="register-submit"
						type="button"
					>
						<span>Continue</span>
						<span className="ml-auto transition-transform duration-200 group-hover:translate-x-1">
							<ArrowRightIcon />
						</span>
					</Button>
				</div>
			</section>
		</main>
	);
}
