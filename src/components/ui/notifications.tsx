"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";

export type NotificationTone = "success" | "info" | "warning" | "error";

export type NotificationInput = {
	tone: NotificationTone;
	title?: string;
	message: string;
	testId?: string;
	autoDismissMs?: number | false;
	dedupeKey?: string;
};

export type AppNotification = NotificationInput & {
	id: string;
	autoDismissMs: number | false;
};

type NotificationContextValue = {
	notifications: AppNotification[];
	notify: (input: NotificationInput) => string;
	dismiss: (id: string) => void;
	dismissByKey: (dedupeKey: string) => void;
};

const DEFAULT_TRANSIENT_DISMISS_MS = 5000;
const NotificationContext = createContext<NotificationContextValue | null>(null);
let notificationCounter = 0;

export function notificationAutoDismissMs({
	autoDismissMs,
	tone,
}: Pick<NotificationInput, "autoDismissMs" | "tone">): number | false {
	if (tone === "warning" || tone === "error") {
		return false;
	}

	if (autoDismissMs !== undefined) {
		return autoDismissMs;
	}

	return DEFAULT_TRANSIENT_DISMISS_MS;
}

export function createNotification(
	input: NotificationInput,
	id = nextNotificationId(),
): AppNotification {
	return {
		...input,
		id,
		autoDismissMs: notificationAutoDismissMs(input),
	};
}

export function addNotification(
	notifications: AppNotification[],
	notification: AppNotification,
) {
	return [
		...notifications.filter(
			(existing) =>
				!notification.dedupeKey ||
				existing.dedupeKey !== notification.dedupeKey,
		),
		notification,
	];
}

export function removeNotification(
	notifications: AppNotification[],
	id: string,
) {
	return notifications.filter((notification) => notification.id !== id);
}

export function removeNotificationsByKey(
	notifications: AppNotification[],
	dedupeKey: string,
) {
	return notifications.filter(
		(notification) => notification.dedupeKey !== dedupeKey,
	);
}

function nextNotificationId() {
	notificationCounter += 1;
	return `notification-${notificationCounter}`;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
	const [notifications, setNotifications] = useState<AppNotification[]>([]);

	const dismiss = useCallback((id: string) => {
		setNotifications((current) => removeNotification(current, id));
	}, []);

	const dismissByKey = useCallback((dedupeKey: string) => {
		setNotifications((current) => removeNotificationsByKey(current, dedupeKey));
	}, []);

	const notify = useCallback((input: NotificationInput) => {
		const notification = createNotification(input);
		setNotifications((current) => addNotification(current, notification));
		return notification.id;
	}, []);

	const value = useMemo(
		() => ({
			notifications,
			notify,
			dismiss,
			dismissByKey,
		}),
		[dismiss, dismissByKey, notifications, notify],
	);

	return (
		<NotificationContext.Provider value={value}>
			{children}
		</NotificationContext.Provider>
	);
}

export function useNotifications() {
	const context = useContext(NotificationContext);

	if (!context) {
		throw new Error("useNotifications must be used within NotificationProvider.");
	}

	return context;
}

export function useSuccessNotification({
	dedupeKey,
	enabled = true,
	message,
	testId,
	trigger,
}: {
	dedupeKey: string;
	enabled?: boolean;
	message: string;
	testId: string;
	trigger?: unknown;
}) {
	const { notify } = useNotifications();

	useEffect(() => {
		if (enabled && message) {
			notify({
				tone: "success",
				message,
				testId,
				dedupeKey,
			});
		}
	}, [dedupeKey, enabled, message, notify, testId, trigger]);
}

export function NotificationViewport() {
	const { dismiss, notifications } = useNotifications();

	if (notifications.length === 0) {
		return null;
	}

	return (
		<ol
			aria-label="Notifications"
			className="pointer-events-none fixed left-4 right-4 top-20 z-50 grid gap-3 sm:left-auto sm:right-6 sm:w-96"
			data-testid="notification-viewport"
		>
			{notifications.map((notification) => (
				<NotificationItem
					dismiss={dismiss}
					key={notification.id}
					notification={notification}
				/>
			))}
		</ol>
	);
}

function NotificationItem({
	dismiss,
	notification,
}: {
	dismiss: (id: string) => void;
	notification: AppNotification;
}) {
	useEffect(() => {
		if (notification.autoDismissMs === false) {
			return;
		}

		const timeout = window.setTimeout(
			() => dismiss(notification.id),
			notification.autoDismissMs,
		);

		return () => window.clearTimeout(timeout);
	}, [dismiss, notification.autoDismissMs, notification.id]);

	return (
		<li
			aria-live={notification.tone === "error" ? "assertive" : "polite"}
			className={`pointer-events-auto border bg-white px-4 py-3 shadow-soft ${notificationToneClasses[notification.tone]}`}
			role={notification.tone === "error" ? "alert" : "status"}
		>
			<div className="flex items-start gap-3">
				<span
					aria-hidden="true"
					className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notificationDotClasses[notification.tone]}`}
				/>
				<div className="min-w-0 flex-1">
					{notification.title ? (
						<p className="text-sm font-semibold leading-5">
							{notification.title}
						</p>
					) : null}
					<p className="text-sm leading-6" data-testid={notification.testId}>
						{notification.message}
					</p>
				</div>
				<button
					aria-label="Close notification"
					className="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-transparent text-xs font-bold uppercase text-primary-action transition hover:border-border-gray hover:text-brand-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal"
					data-testid={
						notification.testId
							? `${notification.testId}-dismiss`
							: undefined
					}
					onClick={() => dismiss(notification.id)}
					type="button"
				>
					x
				</button>
			</div>
		</li>
	);
}

const notificationToneClasses: Record<NotificationTone, string> = {
	success: "border-success-mint bg-success-soft text-primary-text",
	info: "border-brand-teal text-primary-text",
	warning: "border-warning-gold text-primary-text",
	error: "border-error-red text-error-red",
};

const notificationDotClasses: Record<NotificationTone, string> = {
	success: "bg-success-mint",
	info: "bg-brand-teal",
	warning: "bg-warning-gold",
	error: "bg-error-red",
};

export function NotifyOnMount({
	notification,
}: {
	notification?: NotificationInput;
}) {
	const { notify } = useNotifications();

	useEffect(() => {
		if (notification) {
			notify(notification);
		}
	}, [notification, notify]);

	return null;
}
