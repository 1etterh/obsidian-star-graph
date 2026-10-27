import { App, debounce, Events, normalizePath, Notice, TFile, TFolder } from 'obsidian';
import type { ProjectRegistry } from '../projects';
import type { TaskWriter } from '../taskWriter';
import type { Project } from '../../types';
import { appendToCards, canvasTemplate, parseCanvas } from './canvasAdapter';
import { cardHasTask, cardTitle, StormBoard, TASK_BLOCK_PREFIX } from './model';

export const STORMING_FILE = 'event-storming.canvas';

// Obsidian's canvas has no public API; these are the parts used, checked at runtime
interface CanvasNodeLike {
	id: string;
	text?: string;
	setText?(text: string): void;
}
interface CanvasLike {
	nodes?: Map<string, CanvasNodeLike>;
	requestSave?(): void;
}
interface CanvasViewLike {
	file?: TFile;
	canvas?: CanvasLike;
}

function newBlockId(): string {
	return TASK_BLOCK_PREFIX + Math.random().toString(36).slice(2, 8);
}

/**
 * Reads event storming canvases in project folders and turns cards into tasks.
 * Emits 'changed' when a canvas inside the project root is saved.
 */
export class StormingService extends Events {
	private notify = debounce(() => this.trigger('changed'), 300, true);

	constructor(
		private app: App,
		private projects: ProjectRegistry,
		private writer: TaskWriter,
	) {
		super();
	}

	onFileChanged(file: TFile): void {
		if (file.extension === 'canvas' && file.path.startsWith(`${this.projects.root()}/`)) {
			this.notify();
		}
	}

	canvasesOf(project: Project): TFile[] {
		const files: TFile[] = [];
		const walk = (folder: TFolder) => {
			for (const child of folder.children) {
				if (child instanceof TFolder) walk(child);
				else if (child instanceof TFile && child.extension === 'canvas') files.push(child);
			}
		};
		const folder = this.app.vault.getFolderByPath(project.folder);
		if (folder) walk(folder);
		return files;
	}

	async boardsOf(project: Project): Promise<StormBoard[]> {
		return Promise.all(
			this.canvasesOf(project).map(async (file) =>
				parseCanvas(file.path, await this.app.vault.cachedRead(file)),
			),
		);
	}

	/** Creates a canvas with the color legend; returns null if the name is taken */
	async createTemplate(folder: string, name = STORMING_FILE): Promise<TFile | null> {
		const file = name.endsWith('.canvas') ? name : `${name}.canvas`;
		const path = normalizePath(`${folder}/${file}`);
		if (this.app.vault.getAbstractFileByPath(path)) {
			new Notice(`${file} already exists`);
			return null;
		}
		return this.app.vault.create(path, canvasTemplate());
	}

	/**
	 * Adds a task to today's daily note for each card that has none yet,
	 * then links each card to its task. Returns the number of tasks created.
	 */
	async createTasks(canvas: TFile, cards: { id: string; text: string }[]): Promise<number> {
		const todo = cards.filter((c) => !cardHasTask(c.text) && cardTitle(c.text));
		if (todo.length === 0) return 0;

		const daily = await this.writer.dailyNote();
		const project = this.projects.list().find((p) => canvas.path.startsWith(`${p.folder}/`));
		const tag = project ? ` #${project.tag}` : '';
		const source = this.app.fileManager.generateMarkdownLink(
			canvas,
			daily.path,
			'',
			canvas.basename,
		);

		const suffixes = new Map<string, string>();
		for (const card of todo) {
			const blockId = newBlockId();
			await this.writer.appendTask(daily, `${cardTitle(card.text)}${tag} ${source}`, blockId);
			const link = this.app.fileManager.generateMarkdownLink(
				daily,
				canvas.path,
				`#^${blockId}`,
				'task',
			);
			suffixes.set(card.id, `\n\n→ ${link}`);
		}
		await this.linkCards(canvas, suffixes);
		new Notice(`Created ${todo.length} task(s) in ${daily.basename}`);
		return todo.length;
	}

	/** Creates tasks for every command card in the project that has none yet */
	async createCommandTasks(project: Project): Promise<number> {
		let total = 0;
		for (const file of this.canvasesOf(project)) {
			const board = parseCanvas(file.path, await this.app.vault.read(file));
			total += await this.createTasks(
				file,
				board.cards.filter((c) => c.kind === 'command'),
			);
		}
		return total;
	}

	/** Edits the open canvas in place when possible, otherwise the file */
	private async linkCards(canvas: TFile, suffixes: Map<string, string>): Promise<void> {
		const view = this.app.workspace
			.getLeavesOfType('canvas')
			.map((leaf) => leaf.view as unknown as CanvasViewLike)
			.find((v) => v.file?.path === canvas.path);
		const nodes = view?.canvas?.nodes;

		if (nodes) {
			// Writing the file under an open canvas would be overwritten by its next save
			for (const [id, suffix] of suffixes) {
				const node = nodes.get(id);
				if (node?.setText) node.setText(`${node.text ?? ''}${suffix}`);
			}
			view?.canvas?.requestSave?.();
			return;
		}
		await this.app.vault.process(canvas, (data) => appendToCards(data, suffixes));
	}
}
