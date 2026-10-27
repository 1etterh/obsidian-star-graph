import { EventRef, Menu, Notice, TFile } from 'obsidian';
import { parseCanvas } from './core/storming/canvasAdapter';
import { cardHasTask } from './core/storming/model';
import type SyncDevPlugin from './main';

// The canvas menu events and objects are not in the public API; only these parts are used
interface CanvasNodeLike {
	id: string;
	text?: string;
	canvas?: CanvasLike;
}
interface CanvasLike {
	selection?: Set<CanvasNodeLike>;
	view?: { file?: TFile };
}

interface CanvasMenuEvents {
	on(name: 'canvas:node-menu', cb: (menu: Menu, node: CanvasNodeLike) => void): EventRef;
	on(name: 'canvas:selection-menu', cb: (menu: Menu, canvas: CanvasLike) => void): EventRef;
}

function isTextNode(node: CanvasNodeLike): node is CanvasNodeLike & { text: string } {
	return typeof node.text === 'string';
}

/** Right-click "Create task" on canvas cards, plus the bulk command */
export function registerStormingEvents(plugin: SyncDevPlugin): void {
	const { app, storming } = plugin;
	const workspace = app.workspace as unknown as CanvasMenuEvents;

	const addItem = (menu: Menu, canvas: CanvasLike | undefined, nodes: CanvasNodeLike[]) => {
		const file = canvas?.view?.file;
		const cards = nodes.filter(isTextNode).filter((n) => !cardHasTask(n.text));
		if (!file || cards.length === 0) return;
		menu.addItem((item) =>
			item
				.setTitle(cards.length === 1 ? 'Create task' : `Create ${cards.length} tasks`)
				.setIcon('list-plus')
				.onClick(() => void storming.createTasks(file, cards)),
		);
	};

	plugin.registerEvent(
		workspace.on('canvas:node-menu', (menu: Menu, node: CanvasNodeLike) =>
			addItem(menu, node.canvas, [node]),
		),
	);
	plugin.registerEvent(
		workspace.on('canvas:selection-menu', (menu: Menu, canvas: CanvasLike) =>
			addItem(menu, canvas, [...(canvas.selection ?? [])]),
		),
	);

	plugin.registerEvent(
		app.vault.on('modify', (file) => {
			if (file instanceof TFile) storming.onFileChanged(file);
		}),
	);

	plugin.addCommand({
		id: 'create-storming-tasks',
		name: 'Create tasks from command cards in this canvas',
		checkCallback: (checking) => {
			const file = app.workspace.getActiveFile();
			if (file?.extension !== 'canvas') return false;
			if (!checking) {
				void (async () => {
					const board = parseCanvas(file.path, await app.vault.read(file));
					const count = await storming.createTasks(
						file,
						board.cards.filter((c) => c.kind === 'command'),
					);
					if (count === 0) new Notice('Every command card already has a task');
				})();
			}
			return true;
		},
	});
}
