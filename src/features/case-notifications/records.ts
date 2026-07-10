import type { AppProfileRecord } from "@/features/auth/registration/repository";
import { teacherCaseRecordType } from "@/features/teacher/cases/case-lifecycle";
import {
	isEligibleForCaseLifecycleEmail,
	isReadyForDeadlineReminder,
	type CaseLifecycleEmailRecipient,
	type CaseLifecycleNotificationCase,
} from "./service";

export type StoredTeacherCaseRecord = CaseLifecycleNotificationCase & {
	deadlineReminderSentAt?: number;
	lifecycle: "published" | "archived" | "draft";
	recordType?: string;
};

export type StoredStudentCertificateRecord = {
	caseId: string;
	studentProfileId: string;
};

export function caseLifecycleEmailRecipientsFromProfiles(
	profiles: unknown[],
): CaseLifecycleEmailRecipient[] {
	return profiles
		.filter(isAppProfileRecord)
		.filter(isEligibleForCaseLifecycleEmail)
		.map((profile) => ({
			email: profile.emailNormalized,
			firstName: profile.firstName,
			profileId: profile.profileId,
		}));
}

export function deadlineReminderCasesFromRecords(
	records: unknown[],
	now: number,
): CaseLifecycleNotificationCase[] {
	return records
		.filter(isStoredTeacherCaseRecord)
		.filter((caseRecord) => isReadyForDeadlineReminder(caseRecord, now))
		.map(notificationCaseFromRecord);
}

function notificationCaseFromRecord(
	record: StoredTeacherCaseRecord,
): CaseLifecycleNotificationCase {
	return {
		caseId: record.caseId,
		deadlineAt: record.deadlineAt,
		title: record.title,
	};
}

function isAppProfileRecord(record: unknown): record is AppProfileRecord {
	if (typeof record !== "object" || record === null) {
		return false;
	}

	const candidate = record as Partial<AppProfileRecord>;

	return (
		typeof candidate.profileId === "string" &&
		typeof candidate.emailNormalized === "string" &&
		typeof candidate.firstName === "string" &&
		(candidate.role === "student" || candidate.role === "teacher")
	);
}

function isStoredTeacherCaseRecord(
	record: unknown,
): record is StoredTeacherCaseRecord {
	if (typeof record !== "object" || record === null) {
		return false;
	}

	const candidate = record as Partial<StoredTeacherCaseRecord>;

	return (
		candidate.recordType === teacherCaseRecordType &&
		candidate.lifecycle === "published" &&
		typeof candidate.caseId === "string" &&
		typeof candidate.deadlineAt === "number" &&
		typeof candidate.title === "string"
	);
}
