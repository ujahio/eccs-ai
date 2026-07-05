import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Img,
	Link,
	Preview,
	Section,
	Text,
	render
} from "jsx-email";
import type { ReactElement } from "react";
import { ECCS_LOGO_SRC } from "./logo-attachment";

type RenderedEmail = {
	html: string;
	text: string;
};

type ActionLink = {
	href: string;
	label: string;
};

type EccsTransactionalEmailProps = {
	action?: ActionLink;
	body: string[];
	eyebrow: string;
	footerNote: string;
	heading: string;
	logoUrl: string;
	preview: string;
	supportingNote?: string;
};

export type RegistrationVerificationEmailTemplateInput = {
	expiresInHours: number;
	firstName: string;
	verificationUrl: string;
};

export type PasswordResetEmailTemplateInput = {
	expiresInMinutes: number;
	resetUrl: string;
};

export type PasswordChangedEmailTemplateInput = {
	forgotPasswordUrl: string;
};

export type EmailChangeVerificationTemplateInput = {
	expiresInHours: number;
	verificationUrl: string;
};

export function forgotPasswordUrl(appBaseUrl: string) {
	return new URL("/forgot-password", appBaseUrl).toString();
}

export function renderRegistrationVerificationEmail(
	input: RegistrationVerificationEmailTemplateInput
) {
	return renderEccsEmail(
		<EccsTransactionalEmail
			action={{
				href: input.verificationUrl,
				label: "Verify account"
			}}
			body={[
				`Hello ${input.firstName},`,
				"Welcome to E-Clinical Case Solutions. Please confirm your account so you can securely access your case-based learning dashboard."
			]}
			eyebrow="Account verification"
			footerNote="If you did not create an ECCS account, you can ignore this email."
			heading="Verify your ECCS account"
			logoUrl={ECCS_LOGO_SRC}
			preview="Confirm your ECCS account to begin your case-based learning."
			supportingNote={`This verification link expires in ${input.expiresInHours} hours.`}
		/>
	);
}

export function renderPasswordResetEmail(input: PasswordResetEmailTemplateInput) {
	return renderEccsEmail(
		<EccsTransactionalEmail
			action={{
				href: input.resetUrl,
				label: "Reset password"
			}}
			body={[
				"We received a request to reset the password for your E-Clinical Case Solutions account.",
				"Use the secure link below to choose a new password and regain access to your account."
			]}
			eyebrow="Password reset"
			footerNote="If you did not request a password reset, you can ignore this email."
			heading="Reset your ECCS password"
			logoUrl={ECCS_LOGO_SRC}
			preview="Use this secure link to reset your ECCS password."
			supportingNote={`This reset link expires in ${input.expiresInMinutes} minutes.`}
		/>
	);
}

export function renderPasswordChangedEmail(
	input: PasswordChangedEmailTemplateInput
) {
	return renderEccsEmail(
		<EccsTransactionalEmail
			action={{
				href: input.forgotPasswordUrl,
				label: "Reset password"
			}}
			body={[
				"Your E-Clinical Case Solutions password was changed successfully.",
				"If this was you, no further action is needed."
			]}
			eyebrow="Security notice"
			footerNote="If you did not make this change, reset your password immediately and contact support."
			heading="Your password was changed"
			logoUrl={ECCS_LOGO_SRC}
			preview="Your ECCS password was changed."
			supportingNote="This notice helps protect your account from unauthorized access."
		/>
	);
}

export function renderEmailChangeVerificationEmail(
	input: EmailChangeVerificationTemplateInput
) {
	return renderEccsEmail(
		<EccsTransactionalEmail
			action={{
				href: input.verificationUrl,
				label: "Verify new email"
			}}
			body={[
				"We received a request to use this email address for your E-Clinical Case Solutions account.",
				"Confirm this address to complete the change. Your current login email stays active until this verification succeeds."
			]}
			eyebrow="Email change"
			footerNote="If you did not request this email change, you can ignore this email."
			heading="Verify your new ECCS email"
			logoUrl={ECCS_LOGO_SRC}
			preview="Confirm your new ECCS email address."
			supportingNote={`This verification link expires in ${input.expiresInHours} hours.`}
		/>
	);
}

async function renderEccsEmail(template: ReactElement): Promise<RenderedEmail> {
	const html = await render(template);
	const text = await render(template, { plainText: true });

	return { html, text };
}

function EccsTransactionalEmail({
	action,
	body,
	eyebrow,
	footerNote,
	heading,
	logoUrl,
	preview,
	supportingNote
}: EccsTransactionalEmailProps) {
	return (
		<Html lang="en">
			<Head />
			<Preview>{preview}</Preview>
			<Body style={styles.body}>
				<Container style={styles.shell}>
					<Section style={styles.card}>
						<Img
							alt="E-Clinical Case Solutions"
							height="35"
							src={logoUrl}
							style={styles.logo}
							width="150"
						/>
						<Text style={styles.eyebrow}>{eyebrow}</Text>
						<Heading as="h1" style={styles.heading}>
							{heading}
						</Heading>

						{body.map((paragraph) => (
							<Text key={paragraph} style={styles.text}>
								{paragraph}
							</Text>
						))}

						{action ? (
							<Section style={styles.actionWrap}>
								<Button
									height={44}
									href={action.href}
									style={styles.button}
									width={176}
								>
									{action.label}
								</Button>
							</Section>
						) : null}

						{supportingNote ? (
							<Section style={styles.noticeBox}>
								<Text style={styles.noticeText}>{supportingNote}</Text>
							</Section>
						) : null}

						{action ? (
							<Text style={styles.fallbackText}>
								If the button does not work, copy and paste this link into your
								browser:{" "}
								<Link href={action.href} style={styles.fallbackLink}>
									{action.href}
								</Link>
							</Text>
						) : null}

						<Hr style={styles.divider} />
						<Text style={styles.footerNote}>{footerNote}</Text>
					</Section>
					<Text style={styles.footer}>
						E-Clinical Case Solutions sends account security emails
						automatically.
					</Text>
				</Container>
			</Body>
		</Html>
	);
}

const styles = {
	actionWrap: {
		margin: "28px 0 26px"
	},
	body: {
		backgroundColor: "#F8FAFB",
		fontFamily:
			"Nunito Sans, Montserrat, Avenir, Inter, Arial, sans-serif",
		margin: "0",
		padding: "0"
	},
	button: {
		backgroundColor: "#2F4358",
		borderRadius: "4px",
		color: "#FFFFFF",
		display: "inline-block",
		fontSize: "13px",
		fontWeight: "700",
		lineHeight: "1",
		padding: "14px 20px",
		textDecoration: "none"
	},
	card: {
		backgroundColor: "#FFFFFF",
		border: "1px solid #E5EBEF",
		borderTop: "4px solid #159A9C",
		padding: "34px 32px 30px"
	},
	divider: {
		borderColor: "#E5EBEF",
		margin: "28px 0 20px"
	},
	eyebrow: {
		color: "#159A9C",
		fontSize: "12px",
		fontWeight: "700",
		lineHeight: "1.4",
		margin: "28px 0 8px",
		textTransform: "uppercase" as const
	},
	fallbackLink: {
		color: "#2F4358",
		textDecoration: "underline",
		wordBreak: "break-all" as const
	},
	fallbackText: {
		color: "#4B5A67",
		fontSize: "12px",
		lineHeight: "1.7",
		margin: "0"
	},
	footer: {
		color: "#72808C",
		fontSize: "11px",
		lineHeight: "1.6",
		margin: "18px 0 0",
		textAlign: "center" as const
	},
	footerNote: {
		color: "#4B5A67",
		fontSize: "13px",
		lineHeight: "1.6",
		margin: "0"
	},
	heading: {
		color: "#223244",
		fontSize: "24px",
		fontWeight: "700",
		lineHeight: "1.3",
		margin: "0 0 18px"
	},
	logo: {
		display: "block",
		height: "auto",
		width: "150px"
	},
	noticeBox: {
		backgroundColor: "#F2F7F8",
		border: "1px solid #E5EBEF",
		margin: "0 0 22px",
		padding: "13px 15px"
	},
	noticeText: {
		color: "#223244",
		fontSize: "13px",
		fontWeight: "600",
		lineHeight: "1.55",
		margin: "0"
	},
	shell: {
		margin: "0 auto",
		maxWidth: "560px",
		padding: "34px 18px"
	},
	text: {
		color: "#223244",
		fontSize: "15px",
		lineHeight: "1.7",
		margin: "0 0 14px"
	}
};
