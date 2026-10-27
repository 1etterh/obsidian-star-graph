/**
 * Event storming board, independent of the drawing tool it was read from.
 * Adapters (e.g. canvasAdapter) turn a file into a StormBoard.
 */

export type CardKind =
	| 'event'
	| 'command'
	| 'actor'
	| 'aggregate'
	| 'policy'
	| 'readModel'
	| 'external'
	| 'hotspot'
	| 'other';

export interface StormCard {
	id: string;
	kind: CardKind;
	text: string;
	/** Label of the innermost group (bounded context) the card sits in */
	context?: string;
	/** True when the card already links to a task created from it */
	hasTask: boolean;
}

export interface StormBoard {
	path: string;
	cards: StormCard[];
	contexts: string[];
}

export const KINDS: { kind: Exclude<CardKind, 'other'>; label: string; hint: string; color: string }[] = [
	{ kind: 'event', label: 'Domain event', hint: 'Something that happened', color: '#FFA94D' },
	{ kind: 'command', label: 'Command', hint: 'Intent that triggers an event', color: '#74C0FC' },
	{ kind: 'actor', label: 'Actor', hint: 'Who issues the command', color: '#FFE066' },
	{ kind: 'aggregate', label: 'Aggregate', hint: 'Handles commands, emits events', color: '#FFD43B' },
	{ kind: 'policy', label: 'Policy', hint: 'Whenever X, then Y', color: '#B197FC' },
	{ kind: 'readModel', label: 'Read model', hint: 'Data needed for a decision', color: '#8CE99A' },
	{ kind: 'external', label: 'External system', hint: 'Outside our control', color: '#F783AC' },
	{ kind: 'hotspot', label: 'Hotspot', hint: 'Question or problem', color: '#FF6B6B' },
];

/** Group label whose cards are a color legend, not part of the model */
export const LEGEND_LABEL = 'Legend';

/** Prefix of block ids created from cards, so a card's task link can be recognised */
export const TASK_BLOCK_PREFIX = 'sd-';

const TASK_LINK_RE = new RegExp(`#\\^${TASK_BLOCK_PREFIX}[a-z0-9]+`, 'i');

export function cardHasTask(text: string): boolean {
	return TASK_LINK_RE.test(text);
}

/** First meaningful line of a card, used as the task description */
export function cardTitle(text: string): string {
	const line = text
		.split('\n')
		.map((l) => l.replace(/^#+\s*/, '').trim())
		.find((l) => l && !l.startsWith('→'));
	return line ?? '';
}

export function countKinds(boards: StormBoard[]): Record<CardKind, number> {
	const counts = Object.fromEntries(
		[...KINDS.map((k) => k.kind), 'other'].map((k) => [k, 0]),
	) as Record<CardKind, number>;
	for (const card of boards.flatMap((b) => b.cards)) counts[card.kind]++;
	return counts;
}
