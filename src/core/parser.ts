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
// Characters Obsidian allows in a tag
export const TAG_CHARS = '[\\p{L}\\p{N}_\\-/]';
const TAG_RE = new RegExp(`(?:^|\\s)#(${TAG_CHARS}+)`, 'gu');
const BLOCK_ID_RE = /\s\^([A-Za-z0-9-]+)\s*$/;

export interface ParsedLine {
	status: TaskStatus;
	text: string;
	created?: string;
	scheduled?: string;
	due?: string;
	completed?: string;
	tags: string[];
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
		tags: [...body.matchAll(TAG_RE)].map((m) => m[1] ?? ''),
		blockId: BLOCK_ID_RE.exec(body)?.[1],
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

	// A trailing block id must stay last, or links to the block break
	const cleaned = body.replace(DONE_RE, '').trimEnd();
	const block = BLOCK_ID_RE.exec(cleaned);
	const text = block ? cleaned.slice(0, block.index) : cleaned;
	const done = status === 'done' ? ` ${MARKERS.done} ${today}` : '';
	return `${head}${STATUS_CHAR[status]}${mid}${text}${done}${block ? block[0] : ''}`;
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

// Where an added tag goes: before the first date marker or a trailing block id
const TAIL_RE = new RegExp(
	`\\s+(?:${Object.values(MARKERS).join('|')})\\uFE0F?\\s*\\d{4}-\\d{2}-\\d{2}|\\s+\\^[A-Za-z0-9-]+\\s*$`,
	'u',
);

/** Removes `#remove` and/or adds `#add` on a task line, keeping dates and block id last */
export function setLineTag(raw: string, remove?: string, add?: string): string {
	const match = TASK_RE.exec(raw);
	if (!match) return raw;
	const [, head = '', status = ' ', mid = ''] = match;
	let body = match[4] ?? '';
	if (remove) body = body.replace(tagPattern(remove), '$1').replace(/\s{2,}/g, ' ').trim();
	if (add) {
		const tail = TAIL_RE.exec(body);
		const at = tail ? tail.index : body.trimEnd().length;
		body = `${body.slice(0, at).trimEnd()} #${add}${body.slice(at)}`;
	}
	return `${head}${status}${mid}${body}`;
}

/** Appends a block id unless the line already ends with one */
export function withBlockId(raw: string, id: string): string {
	return BLOCK_ID_RE.test(raw) ? raw : `${raw.trimEnd()} ^${id}`;
}

const SCHEDULED_RE = new RegExp(`\\s*${MARKERS.scheduled}\\uFE0F?\\s*${DATE}`, 'u');
// A new scheduled date goes before the done date and the block id
const SCHEDULED_TAIL_RE = new RegExp(
	`\\s+${MARKERS.done}\\uFE0F?\\s*\\d{4}-\\d{2}-\\d{2}|\\s+\\^[A-Za-z0-9-]+\\s*$`,
	'u',
);

/** Sets (or with no date, removes) the ⏳ scheduled date on a task line */
export function setScheduled(raw: string, date?: string): string {
	const match = TASK_RE.exec(raw);
	if (!match) return raw;
	const [, head = '', status = ' ', mid = ''] = match;
	let body = (match[4] ?? '').replace(SCHEDULED_RE, '');
	if (date) {
		const tail = SCHEDULED_TAIL_RE.exec(body);
		const at = tail ? tail.index : body.trimEnd().length;
		body = `${body.slice(0, at).trimEnd()} ${MARKERS.scheduled} ${date}${body.slice(at)}`;
	}
	return `${head}${status}${mid}${body}`;
}
