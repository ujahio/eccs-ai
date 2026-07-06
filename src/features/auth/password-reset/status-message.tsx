"use client";

import { useSuccessNotification } from "@/components/ui/notifications";
import {
	AuthStatusMessage,
	type StatusTone
} from "@/features/auth/form-helpers";

type PasswordResetStatus = "idle" | "error" | "success" | "notice";

type PasswordResetStatusState = {
	status: PasswordResetStatus;
	message: string;
};

const statusMessageConfig: Record<
	PasswordResetStatus,
	{ suffix: "error" | "notice" | "success"; tone: StatusTone }
> = {
	error: { suffix: "error", tone: "error" },
	idle: { suffix: "error", tone: "error" },
	notice: { suffix: "notice", tone: "warning" },
	success: { suffix: "success", tone: "success" }
};

export function PasswordResetStatusMessage({
	state,
	testIdPrefix
}: {
	state: PasswordResetStatusState;
	testIdPrefix: "forgot-password" | "reset-password";
}) {
	const config = statusMessageConfig[state.status];
	const testId = `${testIdPrefix}-${config.suffix}-message`;
	const isSuccess = state.status === "success";
	useSuccessNotification({
		enabled: isSuccess,
		message: state.message,
		testId,
		dedupeKey: `${testIdPrefix}-status`,
		trigger: state,
	});

	if (!state.message || isSuccess) {
		return null;
	}

	return (
		<AuthStatusMessage
			role={state.status === "error" ? "alert" : "status"}
			testId={testId}
			tone={config.tone}
		>
			{state.message}
		</AuthStatusMessage>
	);
}
