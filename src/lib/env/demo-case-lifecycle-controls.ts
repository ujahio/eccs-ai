import "server-only";

export const demoCaseLifecycleControlsEnvName =
	"CASE_LIFECYCLE_DEMO_CONTROLS_ENABLED";

const enabledValues = new Set(["1", "true", "enabled"]);

export function areDemoCaseLifecycleControlsEnabled(
	env: NodeJS.ProcessEnv = process.env,
) {
	const value = env[demoCaseLifecycleControlsEnvName]?.trim().toLowerCase();

	return value ? enabledValues.has(value) : false;
}
