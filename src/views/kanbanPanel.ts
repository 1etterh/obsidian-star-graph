import { Component, moment } from 'obsidian';
import { BoardColumn, columnOf, COLUMN_LABELS } from '../core/board';
import { DATE_FORMAT } from '../core/dailyNotes';
import { createdKey, sortTasks } from '../core/sort';
import type SyncDevPlugin from '../main';
import type { SortOrder, Task } from '../types';
import { createChipInput } from './chipInput';
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

interface ScopeFilter {
	folders: string[];
	tags: string[];
}

/** `projects, #syncdev` → folder `projects`, tag `syncdev`; any match counts */
function parseScopeFilter(value: string): ScopeFilter {
	const filter: ScopeFilter = { folders: [], tags: [] };
	for (const part of value.split(',').map((s) => s.trim())) {
		if (part.startsWith('#')) {
			const tag = part.slice(1).replace(/\/+$/, '').toLowerCase();
			if (tag) filter.tags.push(tag);
		} else {
			const folder = part.replace(/^\/+|\/+$/g, '');
			if (folder) filter.folders.push(folder);
		}
	}
	return filter;
}

/** A folder covers its subfolders and a tag its nested tags (#work → #work/syncdev) */
function matchesScope(task: Task, filter: ScopeFilter): boolean {
	if (filter.folders.length === 0 && filter.tags.length === 0) return true;
	return (
		filter.folders.some((f) => task.path.startsWith(`${f}/`)) ||
		filter.tags.some((f) => task.tags.some((t) => t === f || t.startsWith(`${f}/`)))
	);
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
	private sort: SortOrder;
	private includeDated = false;
	private renderToken = 0;
	/** Owns the markdown children of the current board, replaced on each render */
	private boardComponent: Component | null = null;
	private dragged: Task | null = null;

	constructor(
		private plugin: SyncDevPlugin,
		private containerEl: HTMLElement,
	) {
		super();
		this.sort = plugin.settings.defaultSort;
	}

	onload(): void {
		const root = this.containerEl.createDiv({ cls: 'syncdev-kanban' });
		this.renderToolbar(root);
		this.boardEl = root.createDiv({ cls: 'syncdev-board' });
		for (const status of COLUMNS) this.createColumn(status);

		this.registerEvent(
			this.plugin.index.on('updated', () => void this.renderBoard()),
		);
		void this.renderBoard();
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

		// Stored as one comma separated string, so older settings still load
		const initial = settings.folderFilter.split(',').map((v) => v.trim()).filter(Boolean);
		createChipInput(bar, initial, 'Folder or #tag, then enter', (values) => {
			settings.folderFilter = values.join(', ');
			void this.plugin.saveData(settings);
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

	private groupTasks(): Record<BoardColumn, Task[]> {
		const today = moment().format(DATE_FORMAT);
		const groups: Record<BoardColumn, Task[]> = { todo: [], done: [] };
		const scope = parseScopeFilter(this.plugin.settings.folderFilter);
		for (const task of this.plugin.index.all()) {
			if (!matchesScope(task, scope)) continue;
			const column = columnOf(task);
			// The Dated filter keeps future work out of Todo; tasks due or scheduled by today stay
			const date = task.scheduled ?? task.due;
			if (column === 'todo' && !this.includeDated && date && date > today) continue;
			groups[column].push(task);
		}
		return {
			todo: sortTasks(groups.todo, this.sort),
			done: sortDone(groups.done),
		};
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
