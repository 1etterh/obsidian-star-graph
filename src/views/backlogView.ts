import { Component, ItemView, moment, WorkspaceLeaf } from 'obsidian';
import { DATE_FORMAT } from '../core/dailyNotes';
import type SyncDevPlugin from '../main';
import type { SortOrder, Task, TaskStatus } from '../types';
import { renderTaskRow, STATUS_LABELS, TaskRowHandlers } from './taskRow';

export const BACKLOG_VIEW_TYPE = 'syncdev-backlog';

const COLUMNS: TaskStatus[] = ['todo', 'doing', 'done'];
// Done tasks pile up over time; only the most recently completed are shown
const DONE_LIMIT = 30;

/** Created marker, then daily note date, then file creation date */
function createdKey(task: Task): string {
	return (
		task.created ??
		task.dailyDate ??
		moment(task.fileCtime).format(DATE_FORMAT)
	);
}

export function sortTasks(tasks: Task[], order: SortOrder): Task[] {
	const dir = order === 'newest' ? -1 : 1;
	return [...tasks].sort((a, b) => {
		const byDate = createdKey(a).localeCompare(createdKey(b));
		if (byDate !== 0) return byDate * dir;
		// Same day: keep note order (later lines are newer)
		return (a.path.localeCompare(b.path) || a.line - b.line) * dir;
	});
}

/** Most recently completed first; tasks without a done date go last */
function sortDone(tasks: Task[]): Task[] {
	return sortTasks(tasks, 'newest').sort((a, b) =>
		(b.completed ?? '').localeCompare(a.completed ?? ''),
	);
}

export class BacklogView extends ItemView {
	private boardEl!: HTMLElement;
	private sort: SortOrder;
	private includeDated = false;
	private renderToken = 0;
	/** Owns the markdown children of the current board, replaced on each render */
	private boardComponent: Component | null = null;
	private dragged: Task | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: SyncDevPlugin,
	) {
		super(leaf);
		this.sort = plugin.settings.defaultSort;
	}

	getViewType(): string {
		return BACKLOG_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Backlog';
	}

	getIcon(): string {
		return 'list-checks';
	}

	async onOpen(): Promise<void> {
		const root = this.contentEl;
		root.empty();
		root.addClass('syncdev-backlog');

		root.createEl('h2', { cls: 'syncdev-title', text: 'Backlog' });
		this.renderAddInput(root);
		this.renderToolbar(root);
		this.boardEl = root.createDiv({ cls: 'syncdev-board' });

		this.registerEvent(
			this.plugin.index.on('updated', () => void this.renderBoard()),
		);
		await this.renderBoard();
	}

	private renderAddInput(root: HTMLElement): void {
		const input = root.createEl('input', {
			type: 'text',
			cls: 'syncdev-add',
			placeholder: 'Add a task to today…',
		});
		input.addEventListener('keydown', (evt) => {
			// Skip Enter while an IME (e.g. Korean) is still composing
			if (evt.key !== 'Enter' || evt.isComposing) return;
			const text = input.value.trim();
			if (!text) return;
			input.value = '';
			void this.plugin.writer.addToToday(text);
		});
	}

	private renderToolbar(root: HTMLElement): void {
		const bar = root.createDiv({ cls: 'syncdev-toolbar' });

		this.renderToggle(bar, 'Dated', this.includeDated, (checked) => {
			this.includeDated = checked;
		});
		// Remembered across sessions, unlike the other toolbar controls
		const { settings } = this.plugin;
		this.renderToggle(bar, 'Done', settings.showDone, (checked) => {
			settings.showDone = checked;
			void this.plugin.saveData(settings);
		});

		const select = bar.createEl('select', { cls: 'dropdown' });
		select.createEl('option', { value: 'newest', text: 'Newest first' });
		select.createEl('option', { value: 'oldest', text: 'Oldest first' });
		select.value = this.sort;
		select.addEventListener('change', () => {
			this.sort = select.value as SortOrder;
			void this.renderBoard();
		});
	}

	private renderToggle(
		bar: HTMLElement,
		label: string,
		value: boolean,
		onChange: (checked: boolean) => void,
	): void {
		const el = bar.createEl('label', { cls: 'syncdev-toggle' });
		const checkbox = el.createEl('input', { type: 'checkbox' });
		checkbox.checked = value;
		el.appendText(label);
		checkbox.addEventListener('change', () => {
			onChange(checkbox.checked);
			void this.renderBoard();
		});
	}

	private groupTasks(): Record<TaskStatus, Task[]> {
		const groups: Record<TaskStatus, Task[]> = { todo: [], doing: [], done: [] };
		for (const task of this.plugin.index.all()) {
			if (!this.includeDated && (task.scheduled || task.due)) continue;
			groups[task.status].push(task);
		}
		return {
			todo: sortTasks(groups.todo, this.sort),
			doing: sortTasks(groups.doing, this.sort),
			done: sortDone(groups.done),
		};
	}

	private async renderBoard(): Promise<void> {
		// Markdown rendering is async; drop renders superseded by a newer one
		const token = ++this.renderToken;
		const component = this.addChild(new Component());
		const groups = this.groupTasks();
		const board = createDiv({ cls: 'syncdev-board' });

		const columns = this.plugin.settings.showDone
			? COLUMNS
			: COLUMNS.filter((s) => s !== 'done');
		for (const status of columns) {
			const tasks = groups[status];
			const shown = status === 'done' ? tasks.slice(0, DONE_LIMIT) : tasks;
			const list = this.renderColumn(board, status, tasks.length);
			if (shown.length === 0) {
				list.createDiv({ cls: 'syncdev-empty', text: 'No tasks' });
			}
			for (const task of shown) {
				await renderTaskRow(this.app, list, task, component, this.rowHandlers);
				if (token !== this.renderToken) {
					this.removeChild(component);
					return;
				}
			}
		}

		this.boardEl.replaceWith(board);
		this.boardEl = board;
		if (this.boardComponent) this.removeChild(this.boardComponent);
		this.boardComponent = component;
	}

	/** Creates a column that accepts dropped tasks and returns its list element */
	private renderColumn(
		board: HTMLElement,
		status: TaskStatus,
		count: number,
	): HTMLElement {
		const column = board.createDiv({ cls: 'syncdev-column' });
		column.dataset.status = status;
		const header = column.createDiv({ cls: 'syncdev-column-header' });
		header.createSpan({ text: STATUS_LABELS[status] });
		header.createSpan({ cls: 'syncdev-count', text: String(count) });

		column.addEventListener('dragover', (evt) => {
			if (!this.dragged || this.dragged.status === status) return;
			evt.preventDefault();
			if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'move';
			column.addClass('is-drop-target');
		});
		column.addEventListener('dragleave', (evt) => {
			// dragleave also fires when moving onto a child element
			if (!column.contains(evt.relatedTarget as Node | null)) {
				column.removeClass('is-drop-target');
			}
		});
		column.addEventListener('drop', (evt) => {
			evt.preventDefault();
			column.removeClass('is-drop-target');
			const task = this.dragged;
			this.dragged = null;
			if (task) void this.plugin.writer.setStatus(task, status);
		});

		return column.createDiv({ cls: 'syncdev-list' });
	}

	private rowHandlers: TaskRowHandlers = {
		toggle: (task) => void this.plugin.writer.toggle(task),
		move: (task, status) => void this.plugin.writer.setStatus(task, status),
		open: (task) => void this.openTask(task),
		dragStart: (task) => {
			this.dragged = task;
		},
		dragEnd: () => {
			this.dragged = null;
			this.boardEl
				.querySelectorAll('.is-drop-target')
				.forEach((el) => el.removeClass('is-drop-target'));
		},
	};

	private async openTask(task: Task): Promise<void> {
		const file = this.app.vault.getFileByPath(task.path);
		if (!file) return;
		await this.app.workspace.getLeaf(false).openFile(file, {
			eState: { line: task.line },
		});
	}
}
