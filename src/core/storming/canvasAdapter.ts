import { cardHasTask, CardKind, KINDS, LEGEND_LABEL, StormBoard, StormCard } from './model';

// Subset of the JSON Canvas format (https://jsoncanvas.org) that the board needs
interface CanvasNode {
	id: string;
	type: string;
	x: number;
	y: number;
	width: number;
	height: number;
	color?: string;
	text?: string;
	label?: string;
}

export interface CanvasData {
	nodes?: CanvasNode[];
	edges?: unknown[];
}

// Obsidian's built-in color presets, for cards colored with the picker
const PRESET_KINDS: Record<string, CardKind> = {
	'1': 'hotspot',
	'2': 'event',
	'3': 'aggregate',
	'4': 'readModel',
	'5': 'command',
	'6': 'policy',
};

function kindOf(color: string | undefined): CardKind {
	if (!color) return 'other';
	const preset = PRESET_KINDS[color];
	if (preset) return preset;
	const hex = color.toUpperCase();
	return KINDS.find((k) => k.color === hex)?.kind ?? 'other';
}

function contains(group: CanvasNode, node: CanvasNode): boolean {
	const cx = node.x + node.width / 2;
	const cy = node.y + node.height / 2;
	return (
		cx >= group.x &&
		cx <= group.x + group.width &&
		cy >= group.y &&
		cy <= group.y + group.height
	);
}

export function parseCanvas(path: string, json: string): StormBoard {
	let data: CanvasData;
	try {
		data = JSON.parse(json) as CanvasData;
	} catch {
		return { path, cards: [], contexts: [] };
	}
	const nodes = data.nodes ?? [];
	// Smallest first, so the innermost group wins for nested contexts
	const groups = nodes
		.filter((n) => n.type === 'group')
		.sort((a, b) => a.width * a.height - b.width * b.height);

	const cards: StormCard[] = [];
	for (const node of nodes) {
		if (node.type !== 'text') continue;
		const group = groups.find((g) => contains(g, node));
		if (group?.label === LEGEND_LABEL) continue;
		const text = node.text ?? '';
		cards.push({
			id: node.id,
			kind: kindOf(node.color),
			text,
			context: group?.label || undefined,
			hasTask: cardHasTask(text),
		});
	}
	const contexts = groups
		.map((g) => g.label ?? '')
		.filter((label) => label && label !== LEGEND_LABEL);
	return { path, cards, contexts: [...new Set(contexts)] };
}

/** Appends `suffix` to the text of the given cards; returns the new file content */
export function appendToCards(json: string, suffixes: Map<string, string>): string {
	const data = JSON.parse(json) as CanvasData;
	for (const node of data.nodes ?? []) {
		const suffix = suffixes.get(node.id);
		if (suffix !== undefined) node.text = `${node.text ?? ''}${suffix}`;
	}
	// Obsidian writes canvas files with tab indentation
	return JSON.stringify(data, null, '\t');
}

/** A new board with a color legend explaining each card kind */
export function canvasTemplate(): string {
	const cardW = 220;
	const cardH = 80;
	const gap = 20;
	const perRow = 4;
	const nodes: CanvasNode[] = KINDS.map((k, i) => ({
		id: `legend-${k.kind}`,
		type: 'text',
		text: `**${k.label}**\n${k.hint}`,
		x: gap + (i % perRow) * (cardW + gap),
		y: gap + 20 + Math.floor(i / perRow) * (cardH + gap),
		width: cardW,
		height: cardH,
		color: k.color,
	}));
	const rows = Math.ceil(KINDS.length / perRow);
	nodes.unshift({
		id: 'legend',
		type: 'group',
		label: LEGEND_LABEL,
		x: 0,
		y: 0,
		width: gap + perRow * (cardW + gap),
		height: gap * 2 + 20 + rows * (cardH + gap) - gap,
	});
	return JSON.stringify({ nodes, edges: [] }, null, '\t');
}
