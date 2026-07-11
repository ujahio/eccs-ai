import "server-only";

import { randomUUID } from "node:crypto";
import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getSessionAuthResources } from "@/lib/aws/resources";
import {
	deleteE2ECaseMaterial,
	getE2ECaseMaterial,
	isE2EMode,
	saveE2ECaseMaterial,
} from "@/lib/e2e/in-memory-auth";
import type { DraftAttachment } from "@/features/teacher/case-authoring/schema";

export type CaseMaterialDisposition = "inline" | "attachment";

export type StoredCaseMaterial = {
	bytes: Uint8Array;
	contentType: string;
	name: string;
};

export interface CaseMaterialStorage {
	deleteObject(storageKey: string): Promise<void>;
	getObject(storageKey: string): Promise<StoredCaseMaterial | null>;
	getSignedReadUrl(args: {
		disposition: CaseMaterialDisposition;
		name: string;
		storageKey: string;
	}): Promise<string>;
	putObject(args: {
		attachmentId: string;
		bytes: Uint8Array;
		caseId: string;
		contentType: string;
		name: string;
	}): Promise<string>;
}

export type StoredDraftAttachments = {
	attachments: DraftAttachment[];
	uploadedStorageKeys: string[];
};

const signedReadUrlTtlSeconds = 5 * 60;
const s3Client = new S3Client({});

export function getCaseMaterialStorage(): CaseMaterialStorage {
	if (isE2EMode()) {
		return new InMemoryCaseMaterialStorage();
	}

	return new S3CaseMaterialStorage(getSessionAuthResources().caseMaterialBucketName);
}

export async function storeDraftAttachments({
	attachments,
	caseId,
	storage,
}: {
	attachments: DraftAttachment[];
	caseId: string;
	storage?: CaseMaterialStorage;
}): Promise<StoredDraftAttachments> {
	const uploadedStorageKeys: string[] = [];
	const storedAttachments: DraftAttachment[] = [];

	for (const attachment of attachments) {
		const storedAttachment = await storeDraftAttachmentBytes({
			attachment,
			caseId,
			...(storage ? { storage } : {}),
		});

		if (
			storedAttachment.storageKey &&
			storedAttachment.storageKey !== attachment.storageKey
		) {
			uploadedStorageKeys.push(storedAttachment.storageKey);
		}

		storedAttachments.push(storedAttachment);
	}

	return {
		attachments: storedAttachments,
		uploadedStorageKeys,
	};
}

export async function deleteStoredAttachments({
	attachments,
	storage,
}: {
	attachments: DraftAttachment[];
	storage?: CaseMaterialStorage;
}) {
	const storedAttachments = attachments.filter((attachment) => attachment.storageKey);

	if (storedAttachments.length === 0) {
		return;
	}

	const materialStorage = storage ?? getCaseMaterialStorage();

	await Promise.all(
		storedAttachments.flatMap((attachment) =>
			attachment.storageKey
				? [materialStorage.deleteObject(attachment.storageKey)]
				: [],
		),
	);
}

export async function cleanupUploadedAttachments({
	storage,
	storageKeys,
}: {
	storage?: CaseMaterialStorage;
	storageKeys: string[];
}) {
	if (storageKeys.length === 0) {
		return;
	}

	const materialStorage = storage ?? getCaseMaterialStorage();

	await Promise.all(
		storageKeys.map((storageKey) => materialStorage.deleteObject(storageKey)),
	);
}

export async function storeDraftAttachmentBytes({
	attachment,
	caseId,
	storage,
}: {
	attachment: DraftAttachment;
	caseId: string;
	storage?: CaseMaterialStorage;
}): Promise<DraftAttachment> {
	if (attachment.storageKey) {
		return attachmentWithoutDataUrl(attachment);
	}

	if (!attachment.dataUrl) {
		return attachmentWithoutDataUrl(attachment);
	}

	const decoded = pdfDataUrlBytes(attachment.dataUrl);

	if (!decoded) {
		return attachmentWithoutDataUrl(attachment);
	}

	const materialStorage = storage ?? getCaseMaterialStorage();
	const storageKey = await materialStorage.putObject({
		attachmentId: attachment.id,
		bytes: decoded.bytes,
		caseId,
		contentType: decoded.contentType,
		name: attachment.name,
	});

	return attachmentWithoutDataUrl({
		...attachment,
		storageKey,
		type: decoded.contentType,
	});
}

export function attachmentWithoutDataUrl(
	attachment: DraftAttachment,
): DraftAttachment {
	return {
		id: attachment.id,
		name: attachment.name,
		size: attachment.size,
		...(attachment.storageKey ? { storageKey: attachment.storageKey } : {}),
		type: attachment.type,
		lastModified: attachment.lastModified,
	};
}

export function pdfDataUrlBytes(dataUrl: string) {
	const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUrl);

	if (!match) {
		return null;
	}

	const [, contentTypeValue = "application/pdf", encoding = "", payload = ""] =
		match;
	const contentType = contentTypeValue || "application/pdf";

	if (contentType !== "application/pdf") {
		return null;
	}

	try {
		const bytes =
			encoding === ";base64"
				? Buffer.from(payload, "base64")
				: Buffer.from(decodeURIComponent(payload), "utf8");

		return bytes.byteLength > 0 ? { bytes, contentType } : null;
	} catch {
		return null;
	}
}

export class S3CaseMaterialStorage implements CaseMaterialStorage {
	constructor(
		private readonly bucketName: string,
		private readonly client = s3Client,
	) {}

	async putObject({
		attachmentId,
		bytes,
		caseId,
		contentType,
		name,
	}: {
		attachmentId: string;
		bytes: Uint8Array;
		caseId: string;
		contentType: string;
		name: string;
	}) {
		const storageKey = caseMaterialStorageKey({ attachmentId, caseId, name });

		await this.client.send(
			new PutObjectCommand({
				Bucket: this.bucketName,
				Key: storageKey,
				Body: bytes,
				ContentType: contentType,
				Metadata: {
					attachmentId,
					caseId,
				},
			}),
		);

		return storageKey;
	}

	async getObject() {
		return null;
	}

	async getSignedReadUrl({
		disposition,
		name,
		storageKey,
	}: {
		disposition: CaseMaterialDisposition;
		name: string;
		storageKey: string;
	}) {
		return getSignedUrl(
			this.client,
			new GetObjectCommand({
				Bucket: this.bucketName,
				Key: storageKey,
				ResponseContentDisposition: `${disposition}; filename="${safeAttachmentFilename(
					name,
				)}"`,
				ResponseContentType: "application/pdf",
			}),
			{ expiresIn: signedReadUrlTtlSeconds },
		);
	}

	async deleteObject(storageKey: string) {
		await this.client.send(
			new DeleteObjectCommand({
				Bucket: this.bucketName,
				Key: storageKey,
			}),
		);
	}
}

export class InMemoryCaseMaterialStorage implements CaseMaterialStorage {
	async putObject({
		bytes,
		contentType,
		name,
		attachmentId,
		caseId,
	}: {
		attachmentId: string;
		bytes: Uint8Array;
		caseId: string;
		contentType: string;
		name: string;
	}) {
		const storageKey = caseMaterialStorageKey({ attachmentId, caseId, name });

		saveE2ECaseMaterial(storageKey, { bytes, contentType, name });

		return storageKey;
	}

	async getObject(storageKey: string) {
		return getE2ECaseMaterial(storageKey);
	}

	async getSignedReadUrl({
		disposition,
		name,
		storageKey,
	}: {
		disposition: CaseMaterialDisposition;
		name: string;
		storageKey: string;
	}) {
		const params = new URLSearchParams({
			disposition,
			filename: safeAttachmentFilename(name),
			storageKey,
		});

		return `/api/e2e/case-materials?${params.toString()}`;
	}

	async deleteObject(storageKey: string) {
		deleteE2ECaseMaterial(storageKey);
	}
}

function caseMaterialStorageKey({
	attachmentId,
	caseId,
	name,
}: {
	attachmentId: string;
	caseId: string;
	name: string;
}) {
	return [
		"case-materials",
		safeStorageSegment(caseId),
		`${safeStorageSegment(attachmentId)}-${randomUUID()}-${safeStorageSegment(name)}`,
	].join("/");
}

function safeStorageSegment(value: string) {
	const safe = value
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 120);

	return safe || "case-material";
}

function safeAttachmentFilename(filename: string) {
	const safe = filename
		.replace(/[^\x20-\x7E]/g, "")
		.replaceAll("\\", "")
		.replaceAll("/", "")
		.replaceAll('"', "")
		.trim();

	return safe || "case-material.pdf";
}
