import { Component } from 'obsidian';
import { BoardColumn, columnOf, COLUMN_LABELS } from '../core/board';
import { filterTasks } from '../core/scope';
import { createdKey, sortTasks } from '../core/sort';
import type SyncDevPlugin from '../main';
import type { Task } from '../types';
import { createTaskComposer } from './taskComposer';
import { openTask, renderTaskRow, TaskRowHandlers } from './taskRow';

const COLUMNS: BoardColumn[] = ['todo', 'done'];
// Done tasks pile up over time; only the most recently completed are shown
const DONE_LIMIT = 30;

/** Most recently completed first; without a ✅ date the created date stands in */
function sortDone(tasks: Task[]): Task[] {
	const key = (t: Task) => t.completed ?? createdKey(t);
	return sortTasks(tasks, 'newest').sort((a, b) => key(b).localeCompare(key(a)));
}

interface ColumnEls {
	column: HTMLElement;
	count: HTMLElement;
	list: HTMLElement;
}

/** Todo / Done board, shown in the Kanban tab */
export class KanbanPanel extends Component {
	private boardEl!: HTMLElement;
	/** Columns are built once; renders only swap their lists, so the add input survives */
	private columns = new Map<BoardColumn, ColumnEls>();
	private renderToken = 0;
	/** Owns the markdown children of the current board, replaced on each render */
	private boardComponent: Component | null = null;
	private dragged: Task | null = null;

	constructor(
		private plugin: SyncDevPlugin,
		private containerEl: HTMLElement,
	) {
		super();
	}

	onload(): void {
		const root = this.containerEl.createDiv({ cls: 'syncdev-kanban' });
		this.boardEl = root.createDiv({ cls: 'syncdev-board' });
		for (const status of COLUMNS) this.createColumn(status);

		this.registerEvent(
			this.plugin.index.on('updated', () => void this.renderBoard()),
		);
		void this.renderBoard();
	}

	private groupTasks(): Record<BoardColumn, Task[]> {
		const groups: Record<BoardColumn, Task[]> = { todo: [], done: [] };
		const { settings } = this.plugin;
		for (const task of filterTasks(this.plugin.index.all(), settings.folderFilter)) {
			groups[columnOf(task)].push(task);
		}
		return {
			todo: sortTasks(groups.todo, settings.defaultSort),
			done: sortDone(groups.done),
		};
	}

	/** Called by the view when the shared filter changes */
	refresh(): void {
		void this.renderBoard();
	}

	private async renderBoard(): Promise<void> {
		// Markdown rendering is async; drop renders superseded by a newer one
		const token = ++this.renderToken;
		const component = this.addChild(new Component());
		const groups = this.groupTasks();
		const { showDone } = this.plugin.settings;
		const lists = new Map<BoardColumn, HTMLElement>();

		for (const status of COLUMNS) {
			if (status === 'done' && !showDone) continue;
			const tasks = groups[status];
			const shown = status === 'done' ? tasks.slice(0, DONE_LIMIT) : tasks;
			const list = createDiv({ cls: 'syncdev-list' });
			if (shown.length === 0) {
				list.createDiv({ cls: 'syncdev-empty', text: 'No tasks' });
			}
			for (const task of shown) {
				await renderTaskRow(
					this.plugin.app,
					list,
					task,
					component,
					this.rowHandlers,
				);
				if (token !== this.renderToken) {
					this.removeChild(component);
					return;
				}
			}
			lists.set(status, list);
		}

		for (const [status, els] of this.columns) {
			els.column.toggle(status !== 'done' || showDone);
			els.count.setText(String(groups[status].length));
			const list = lists.get(status);
			if (list) {
				els.list.replaceWith(list);
				els.list = list;
			}
		}
		if (this.boardComponent) this.removeChild(this.boardComponent);
		this.boardComponent = component;
	}

	/** Builds a column that accepts dropped tasks; Todo also gets the add button */
	private createColumn(status: BoardColumn): void {
		const column = this.boardEl.createDiv({ cls: 'syncdev-column' });
		column.dataset.status = status;
		const header = column.createDiv({ cls: 'syncdev-column-header' });
		header.createSpan({ text: COLUMN_LABELS[status] });
		const count = header.createSpan({ cls: 'syncdev-count' });

		if (status === 'todo') {
			createTaskComposer(header, column, 'Add a task to today', (text) => {
				void this.plugin.writer.addToDaily(text);
			});
		}

		column.addEventListener('dragover', (evt) => {
			if (!this.dragged || columnOf(this.dragged) === status) return;
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

		const list = column.createDiv({ cls: 'syncdev-list' });
		this.columns.set(status, { column, count, list });
	}

	private rowHandlers: TaskRowHandlers = {
		toggle: (task) => void this.plugin.writer.toggle(task),
		move: (task, column) => void this.plugin.writer.setStatus(task, column),
		open: (task) => void openTask(this.plugin.app, task),
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
}
