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
// Characters Obsidian allows in a tag
export const TAG_CHARS = '[\\p{L}\\p{N}_\\-/]';
const TAG_RE = new RegExp(`(?:^|\\s)#(${TAG_CHARS}+)`, 'gu');

export interface ParsedLine {
	status: TaskStatus;
	text: string;
	created?: string;
	scheduled?: string;
	due?: string;
	completed?: string;
	tags: string[];
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
		tags: [...body.matchAll(TAG_RE)].map((m) => m[1] ?? ''),
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

function tagPattern(tag: string): RegExp {
	// '-' must stay unescaped: the 'u' flag rejects an escaped '-' outside a class
	const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	// Tags are case-insensitive in Obsidian; stop where the tag would continue
	return new RegExp(`(^|\\s)#${escaped}(?!${TAG_CHARS})`, 'giu');
}

/** Replaces every occurrence of `#from` in the line with `#to` */
export function replaceTag(line: string, from: string, to: string): string {
	return line.replace(tagPattern(from), `$1#${to}`);
}

/** Removes `#tag` from task text, e.g. when the tag is shown as a label instead */
export function stripTag(text: string, tag: string): string {
	return text.replace(tagPattern(tag), '$1').replace(/\s{2,}/g, ' ').trim();
}
