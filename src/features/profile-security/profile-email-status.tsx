import { InlineMessage } from "@/components/ui/inline-message";
import {
	NotifyOnMount,
	type NotificationInput,
} from "@/components/ui/notifications";

type ProfileKind = "student" | "teacher";
type EmailStatusTone = "success" | "notice" | "error";

const emailStatusMessages: Record<
	string,
	{ message: string; tone: EmailStatusTone }
> = {
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

export function ProfileEmailStatus({
	emailStatus,
	profileKind,
}: {
	emailStatus?: string;
	profileKind: ProfileKind;
}) {
	const emailMessage = emailStatus ? emailStatusMessages[emailStatus] : undefined;

	if (!emailMessage) {
		return null;
	}

	const testId = `${profileKind}-email-${emailStatus}-message`;
	const emailNotification: NotificationInput | undefined =
		emailMessage.tone === "success"
			? {
					tone: "success",
					message: emailMessage.message,
					testId,
					dedupeKey: `${profileKind}-email-status`,
				}
			: undefined;

	return (
		<>
			<NotifyOnMount notification={emailNotification} />
			{emailMessage.tone !== "success" ? (
				<InlineMessage
					className="mt-5"
					role={emailMessage.tone === "error" ? "alert" : "status"}
					testId={testId}
					tone={emailMessage.tone === "notice" ? "warning" : "error"}
				>
					{emailMessage.message}
				</InlineMessage>
			) : null}
		</>
	);
}
