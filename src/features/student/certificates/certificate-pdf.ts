import { formatDubaiDate } from "@/lib/date-format";

export type CertificatePdfFacts = {
	certificateBranding: {
		organizationName: string;
	};
	caseTitle: string;
	completedAt: number;
	studentDisplayName: string;
};

type FittedLines = {
	fontSize: number;
	lines: string[];
};

const pageWidth = 792;
const centerX = pageWidth / 2;
const maxTextWidth = 600;

export function certificatePdfBytes({
	certificateBranding,
	caseTitle,
	completedAt,
	studentDisplayName,
}: CertificatePdfFacts) {
	const completedDate = formatDubaiDate(completedAt);
	const nameFontSize = fitFontSize(studentDisplayName, 44, 30, maxTextWidth);
	const caseText = fitWrappedText(caseTitle, {
		maxFontSize: 22,
		maxLines: 4,
		maxWidth: maxTextWidth,
		minFontSize: 14,
	});
	const caseLineHeight = caseText.fontSize + 7;
	const caseStartY = 218;
	const dateY = Math.max(
		104,
		caseStartY - caseText.lines.length * caseLineHeight - 14,
	);
	const stream = [
		"q",
		"0.184 0.263 0.345 rg",
		"36 36 720 540 re f",
		"1 1 1 rg",
		"64 64 664 484 re f",
		"Q",
		centeredText({
			font: "F2",
			fontSize: 18,
			text: certificateBranding.organizationName,
			y: 504,
		}),
		centeredText({
			color: "0.290 0.353 0.404",
			font: "F2",
			fontSize: 30,
			text: "Certificate Of Completion",
			y: 428,
		}),
		centeredText({
			color: "0.290 0.353 0.404",
			font: "F2",
			fontSize: 15,
			text: "AWARDED TO",
			y: 360,
		}),
		centeredText({
			color: "0.137 0.196 0.267",
			font: "F2",
			fontSize: nameFontSize,
			text: studentDisplayName,
			y: 310,
		}),
		centeredText({
			color: "0.290 0.353 0.404",
			font: "F2",
			fontSize: 15,
			text: "WHO SUCCESSFULLY COMPLETED",
			y: 246,
		}),
		...caseText.lines.map((line, index) =>
			centeredText({
				color: "0.137 0.196 0.267",
				font: "F2",
				fontSize: caseText.fontSize,
				text: line,
				y: caseStartY - index * caseLineHeight,
			}),
		),
		centeredText({
			color: "0.290 0.353 0.404",
			font: "F2",
			fontSize: 13,
			text: `Completed ${completedDate}`,
			y: dateY,
		}),
	].join("\n");

	return pdfBytesFromStream(stream);
}

export function safeCertificateFilename(caseTitle: string) {
	const slug = caseTitle
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 48);

	return `certificate-${slug || "download"}`;
}

function pdfBytesFromStream(stream: string) {
	const streamLength = new TextEncoder().encode(stream).length;
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
		`<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`,
	];
	let body = "%PDF-1.4\n";
	const offsets = [0];

	for (const [index, object] of objects.entries()) {
		offsets.push(body.length);
		body += `${index + 1} 0 obj\n${object}\nendobj\n`;
	}

	const xrefOffset = body.length;
	body += `xref\n0 ${objects.length + 1}\n`;
	body += "0000000000 65535 f \n";
	for (const offset of offsets.slice(1)) {
		body += `${offset.toString().padStart(10, "0")} 00000 n \n`;
	}
	body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
	body += `startxref\n${xrefOffset}\n%%EOF`;

	return new TextEncoder().encode(body);
}

function centeredText({
	color = "0 0 0",
	font,
	fontSize,
	text,
	y,
}: {
	color?: string;
	font: "F1" | "F2";
	fontSize: number;
	text: string;
	y: number;
}) {
	const x = centerX - estimateTextWidth(text, fontSize) / 2;

	return [
		"BT",
		`/${font} ${pdfNumber(fontSize)} Tf`,
		`${color} rg`,
		`1 0 0 1 ${pdfNumber(x)} ${pdfNumber(y)} Tm`,
		`(${escapePdfText(text)}) Tj`,
		"ET",
	].join("\n");
}

function fitFontSize(
	text: string,
	maxFontSize: number,
	minFontSize: number,
	maxWidth: number,
) {
	let fontSize = maxFontSize;

	while (
		fontSize > minFontSize &&
		estimateTextWidth(text, fontSize) > maxWidth
	) {
		fontSize -= 1;
	}

	return fontSize;
}

function fitWrappedText(
	text: string,
	{
		maxFontSize,
		maxLines,
		maxWidth,
		minFontSize,
	}: {
		maxFontSize: number;
		maxLines: number;
		maxWidth: number;
		minFontSize: number;
	},
): FittedLines {
	let fontSize = maxFontSize;
	let lines = wrapText(text, fontSize, maxWidth);

	while (fontSize > minFontSize && lines.length > maxLines) {
		fontSize -= 1;
		lines = wrapText(text, fontSize, maxWidth);
	}

	return { fontSize, lines };
}

function wrapText(text: string, fontSize: number, maxWidth: number) {
	const words = text.trim().split(/\s+/).filter(Boolean);
	const lines: string[] = [];
	let currentLine = "";

	for (const word of words) {
		const candidate = currentLine ? `${currentLine} ${word}` : word;

		if (estimateTextWidth(candidate, fontSize) <= maxWidth) {
			currentLine = candidate;
			continue;
		}

		if (currentLine) {
			lines.push(currentLine);
			currentLine = word;
		} else {
			lines.push(word);
		}
	}

	if (currentLine) {
		lines.push(currentLine);
	}

	return lines.length > 0 ? lines : [text.trim()];
}

function estimateTextWidth(text: string, fontSize: number) {
	const widthUnits = Array.from(text).reduce((total, character) => {
		if (character === " ") {
			return total + 0.3;
		}

		if ("ilI.,'|!".includes(character)) {
			return total + 0.28;
		}

		if ("mwMW@#%&".includes(character)) {
			return total + 0.78;
		}

		if (/[A-Z0-9]/.test(character)) {
			return total + 0.62;
		}

		return total + 0.52;
	}, 0);

	return widthUnits * fontSize;
}

function escapePdfText(value: string) {
	return value
		.replace(/[^\x20-\x7E]/g, "?")
		.replaceAll("\\", "\\\\")
		.replaceAll("(", "\\(")
		.replaceAll(")", "\\)");
}

function pdfNumber(value: number) {
	return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
