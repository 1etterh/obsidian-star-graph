import type { TaskStatus } from '../types';

// Date markers follow the Tasks plugin format so notes stay compatible with it
export const MARKERS = {
	created: '➕',
	scheduled: '⏳',
	due: '📅',
	done: '✅',
} as const;

// Checkbox characters, also as in the Tasks plugin ('/' is in progress)
const STATUS_CHAR: Record<TaskStatus, string> = {
	todo: ' ',
	doing: '/',
	done: 'x',
};

const TASK_RE = /^(\s*[-*+] \[)(.)(\]\s+)(.*)$/;
const DATE = '(\\d{4}-\\d{2}-\\d{2})';
const DONE_RE = new RegExp(`\\s*${MARKERS.done}\\uFE0F?\\s*${DATE}`, 'u');

export interface ParsedLine {
	status: TaskStatus;
	text: string;
	created?: string;
	scheduled?: string;
	due?: string;
	completed?: string;
}

function extractDate(body: string, marker: string): string | undefined {
	return new RegExp(`${marker}\\uFE0F?\\s*${DATE}`, 'u').exec(body)?.[1];
}

/** Any other character (x, X, -, …) counts as done */
function statusOf(char: string): TaskStatus {
	if (char === STATUS_CHAR.todo) return 'todo';
	if (char === STATUS_CHAR.doing) return 'doing';
	return 'done';
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
		status: statusOf(status),
		text,
		created: extractDate(body, MARKERS.created),
		scheduled: extractDate(body, MARKERS.scheduled),
		due: extractDate(body, MARKERS.due),
		completed: extractDate(body, MARKERS.done),
	};
}

/** Returns the line with the given status, adding the done date only when done */
export function setTaskStatus(
	raw: string,
	status: TaskStatus,
	today: string,
): string | null {
	const match = TASK_RE.exec(raw);
	if (!match) return null;
	const [, head = '', , mid = '', body = ''] = match;

	const cleaned = body.replace(DONE_RE, '').trimEnd();
	const done = status === 'done' ? ` ${MARKERS.done} ${today}` : '';
	return `${head}${STATUS_CHAR[status]}${mid}${cleaned}${done}`;
}
