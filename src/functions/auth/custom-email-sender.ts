import {
	CommitmentPolicy,
	KmsKeyringNode,
	buildClient
} from "@aws-crypto/client-node";
import { Resend } from "resend";
import { Resource } from "sst";

type CognitoCustomEmailSenderEvent = {
	triggerSource: string;
	request: {
		code?: string;
		userAttributes?: {
			email?: string;
		};
	};
};

const { decrypt } = buildClient(
	CommitmentPolicy.REQUIRE_ENCRYPT_ALLOW_DECRYPT
);

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
	const resetUrl = resetPasswordUrl(code);
	const resend = new Resend(Resource.ResendApiKey.value);

	await resend.emails.send({
		from:
			process.env.ECCS_EMAIL_SENDER ?? "no-reply@contact.eccs-online.xyz",
		to: email,
		subject: "Reset your ECCS password",
		text: [
			"Please use this link to reset your E-Clinical Case Solutions password.",
			"This link expires in 60 minutes:",
			resetUrl,
			"",
			"If you did not request a password reset, you can ignore this email."
		].join("\n")
	});

	return event;
}

async function decryptCode(encryptedCode: string) {
	const keyArn = process.env.COGNITO_CUSTOM_SENDER_KEY_ARN;

	if (!keyArn) {
		throw new Error("Missing COGNITO_CUSTOM_SENDER_KEY_ARN.");
	}

	const keyring = new KmsKeyringNode({
		generatorKeyId: keyArn,
		keyIds: [keyArn]
	});
	const { plaintext } = await decrypt(
		keyring,
		Buffer.from(encryptedCode, "base64")
	);

	return Buffer.from(plaintext).toString("utf8");
}

export function resetPasswordUrl(code: string) {
	const url = new URL(
		"/reset-password",
		process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"
	);
	url.searchParams.set("code", code);
	return url.toString();
}
