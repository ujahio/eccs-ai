"use client";

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
	if (!state.message) {
		return null;
	}

	const config = statusMessageConfig[state.status];

	return (
		<AuthStatusMessage
			role={state.status === "error" ? "alert" : "status"}
			testId={`${testIdPrefix}-${config.suffix}-message`}
			tone={config.tone}
		>
			{state.message}
		</AuthStatusMessage>
	);
}
