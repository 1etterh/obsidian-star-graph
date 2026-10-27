// Date markers follow the Tasks plugin format so notes stay compatible with it
export const MARKERS = {
	created: '➕',
	scheduled: '⏳',
	due: '📅',
	done: '✅',
} as const;

const TASK_RE = /^(\s*[-*+] \[)(.)(\]\s+)(.*)$/;
const DATE = '(\\d{4}-\\d{2}-\\d{2})';

export interface ParsedLine {
	done: boolean;
	text: string;
	created?: string;
	scheduled?: string;
	due?: string;
}

function extractDate(body: string, marker: string): string | undefined {
	return new RegExp(`${marker}\\uFE0F?\\s*${DATE}`, 'u').exec(body)?.[1];
}

export function parseTaskLine(raw: string): ParsedLine | null {
	const match = TASK_RE.exec(raw);
	if (!match) return null;
	const status = match[2] ?? ' ';
	const body = match[4] ?? '';

	const text = Object.values(MARKERS)
		.reduce(
			(acc, marker) =>
				acc.replace(new RegExp(`${marker}\\uFE0F?\\s*${DATE}`, 'gu'), ''),
			body,
		)
		.replace(/\s{2,}/g, ' ')
		.trim();

	return {
		done: status !== ' ',
		text,
		created: extractDate(body, MARKERS.created),
		scheduled: extractDate(body, MARKERS.scheduled),
		due: extractDate(body, MARKERS.due),
	};
}

/** Returns the line with its checkbox flipped, adding or removing the done date */
export function toggleTaskLine(raw: string, today: string): string | null {
	const match = TASK_RE.exec(raw);
	if (!match) return null;
	const [, head = '', status = ' ', mid = '', body = ''] = match;

	if (status === ' ') {
		return `${head}x${mid}${body.trimEnd()} ${MARKERS.done} ${today}`;
	}
	const cleaned = body
		.replace(new RegExp(`\\s*${MARKERS.done}\\uFE0F?\\s*${DATE}`, 'u'), '')
		.trimEnd();
	return `${head} ${mid}${cleaned}`;
}
