import type { TaskStatus } from '../types';

// Date markers follow the Tasks plugin format so notes stay compatible with it
export const MARKERS = {
	created: '➕',
	scheduled: '⏳',
	due: '📅',
	done: '✅',
} as const;

const STATUS_CHAR: Record<TaskStatus, string> = {
	todo: ' ',
	done: 'x',
};

const TASK_RE = /^(\s*[-*+] \[)(.)(\]\s+)(.*)$/;
const DATE = '(\\d{4}-\\d{2}-\\d{2})';
const DONE_RE = new RegExp(`\\s*${MARKERS.done}\\uFE0F?\\s*${DATE}`, 'u');
const BLOCK_ID_RE = /\s\^([A-Za-z0-9-]+)\s*$/;

export interface ParsedLine {
	status: TaskStatus;
	text: string;
	created?: string;
	scheduled?: string;
	due?: string;
	completed?: string;
	blockId?: string;
}

function extractDate(body: string, marker: string): string | undefined {
	return new RegExp(`${marker}\\uFE0F?\\s*${DATE}`, 'u').exec(body)?.[1];
}

/**
 * '/' (in progress in the Tasks plugin) is still open; any other character
 * (x, X, -, …) counts as done. A '/' becomes ' ' the next time the task changes.
 */
function statusOf(char: string): TaskStatus {
	return char === STATUS_CHAR.todo || char === '/' ? 'todo' : 'done';
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
		// A trailing block id (^abc) is a link target, not part of the text
		.replace(/\s\^[A-Za-z0-9-]+\s*$/, '')
		.replace(/\s{2,}/g, ' ')
		.trim();

	return {
		status: statusOf(status),
		text,
		created: extractDate(body, MARKERS.created),
		scheduled: extractDate(body, MARKERS.scheduled),
		due: extractDate(body, MARKERS.due),
		completed: extractDate(body, MARKERS.done),
		blockId: BLOCK_ID_RE.exec(body)?.[1],
	};
}

/**
 * Returns the line with the given status. An existing done date is always removed;
 * a new one is added only when `doneDate` is given and the task is done.
 */
export function setTaskStatus(
	raw: string,
	status: TaskStatus,
	doneDate?: string,
): string | null {
	const match = TASK_RE.exec(raw);
	if (!match) return null;
	const [, head = '', , mid = '', body = ''] = match;

	// A trailing block id must stay last, or links to the block break
	const cleaned = body.replace(DONE_RE, '').trimEnd();
	const block = BLOCK_ID_RE.exec(cleaned);
	const text = block ? cleaned.slice(0, block.index) : cleaned;
	const done = status === 'done' && doneDate ? ` ${MARKERS.done} ${doneDate}` : '';
	return `${head}${STATUS_CHAR[status]}${mid}${text}${done}${block ? block[0] : ''}`;
}

/** Appends a block id unless the line already ends with one */
export function withBlockId(raw: string, id: string): string {
	return BLOCK_ID_RE.test(raw) ? raw : `${raw.trimEnd()} ^${id}`;
}

/** Adds a ➕ created date before any trailing block id, unless the line has one */
export function withCreated(raw: string, date: string): string {
	if (!TASK_RE.test(raw) || extractDate(raw, MARKERS.created)) return raw;
	const trimmed = raw.trimEnd();
	const block = BLOCK_ID_RE.exec(trimmed);
	const at = block ? block.index : trimmed.length;
	return `${trimmed.slice(0, at)} ${MARKERS.created} ${date}${trimmed.slice(at)}`;
}
