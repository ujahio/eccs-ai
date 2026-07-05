import {
	CommitmentPolicy,
	KmsKeyringNode,
	buildClient,
} from "@aws-crypto/client-node";
import { Resend } from "resend";
import { Resource } from "sst";
import { eccsLogoAttachment } from "@/lib/email-templates/logo-attachment";
import { renderPasswordResetEmail } from "@/lib/email-templates/transactional";
import type { LinkedResources } from "@/lib/aws/resources";

type CognitoCustomEmailSenderEvent = {
	triggerSource: string;
	request: {
		code?: string;
		userAttributes?: {
			email?: string;
		};
	};
};

const { decrypt } = buildClient(CommitmentPolicy.REQUIRE_ENCRYPT_ALLOW_DECRYPT);
const linkedResources = Resource as unknown as Partial<LinkedResources>;

export async function handler(event: CognitoCustomEmailSenderEvent) {
	if (event.triggerSource !== "CustomEmailSender_ForgotPassword") {
		return event;
	}

	const email = event.request.userAttributes?.email;
	const encryptedCode = event.request.code;

	if (!email || !encryptedCode) {
		throw new Error("Forgot-password email sender requires email and code.");
	}

	const code = await decryptCode(encryptedCode);
	const appBaseUrl = appUrl();
	const resetUrl = resetPasswordUrl(code, appBaseUrl);
	const resend = new Resend(resendApiKey());
	const content = await renderPasswordResetEmail({
		resetUrl,
		expiresInMinutes: 60,
	});

	await resend.emails.send({
		attachments: [eccsLogoAttachment()],
		from: process.env.ECCS_EMAIL_SENDER ?? "no-reply@contact.eccs-online.xyz",
		to: email,
		subject: "Reset your ECCS password",
		html: content.html,
		text: content.text,
	});

	return event;
}

function resendApiKey() {
	const apiKey = linkedResources.ResendApiKey?.value;

	if (!apiKey) {
		throw new Error("Missing required auth resource: ResendApiKey.value");
	}

	return apiKey;
}

async function decryptCode(encryptedCode: string) {
	const keyArn = process.env.COGNITO_CUSTOM_SENDER_KEY_ARN;

	if (!keyArn) {
		throw new Error("Missing COGNITO_CUSTOM_SENDER_KEY_ARN.");
	}

	const keyring = new KmsKeyringNode({
		generatorKeyId: keyArn,
		keyIds: [keyArn],
	});
	const { plaintext } = await decrypt(
		keyring,
		Buffer.from(encryptedCode, "base64"),
	);

	return Buffer.from(plaintext).toString("utf8");
}

export function resetPasswordUrl(code: string, appBaseUrl = appUrl()) {
	const url = new URL("/reset-password", appBaseUrl);
	url.searchParams.set("code", code);
	return url.toString();
}

function appUrl() {
	return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
}
