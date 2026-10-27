import { App, Component, MarkdownRenderer, Menu, moment } from 'obsidian';
import { DATE_FORMAT } from '../core/dailyNotes';
import { stripTag } from '../core/parser';
import { BoardColumn, columnOf, COLUMN_LABELS } from '../core/board';
import type { Project, Task } from '../types';

export interface TaskRowHandlers {
	toggle(task: Task): void;
	move(task: Task, column: BoardColumn): void;
	open(task: Task): void;
	/** Shows "Assign to project…" in the menu when given */
	assign?(task: Task): void;
	/** Rows are draggable only when these are given */
	dragStart?(task: Task): void;
	dragEnd?(): void;
}

/** Opens the note containing the task in a new tab, scrolled to its line */
export async function openTask(app: App, task: Task): Promise<void> {
	const file = app.vault.getFileByPath(task.path);
	if (!file) return;
	// A new tab, so the SyncDev view stays open
	await app.workspace.getLeaf('tab').openFile(file, {
		eState: { line: task.line },
	});
}

/** Shows the project as a colored label */
export function renderProjectLabel(parent: HTMLElement, project: Project): void {
	parent
		.createSpan({ cls: 'syncdev-project', text: project.name })
		.setCssProps({ '--syncdev-project-color': `var(${project.color})` });
}

/** Renders a task row; `component` owns the rendered markdown */
export async function renderTaskRow(
	app: App,
	parent: HTMLElement,
	task: Task,
	component: Component,
	handlers: TaskRowHandlers,
	project?: Project,
): Promise<void> {
	const row = parent.createDiv({ cls: 'syncdev-task' });
	row.toggleClass('is-done', task.status === 'done');
	if (handlers.dragStart) {
		row.draggable = true;
		row.addEventListener('dragstart', (evt) => {
			evt.dataTransfer?.setData('text/plain', task.text);
			if (evt.dataTransfer) evt.dataTransfer.effectAllowed = 'move';
			row.addClass('is-dragging');
			handlers.dragStart?.(task);
		});
		row.addEventListener('dragend', () => {
			row.removeClass('is-dragging');
			handlers.dragEnd?.();
		});
	}
	// Touch devices have no HTML drag and drop, so offer the same moves here
	row.addEventListener('contextmenu', (evt) => {
		evt.preventDefault();
		const menu = new Menu();
		const current = columnOf(task, moment().format(DATE_FORMAT));
		for (const column of Object.keys(COLUMN_LABELS) as BoardColumn[]) {
			if (column === current) continue;
			menu.addItem((item) =>
				item
					.setTitle(`Move to ${COLUMN_LABELS[column].toLowerCase()}`)
					.onClick(() => handlers.move(task, column)),
			);
		}
		if (handlers.assign) {
			menu.addSeparator();
			menu.addItem((item) =>
				item
					.setTitle('Assign to project…')
					.setIcon('folder-input')
					.onClick(() => handlers.assign?.(task)),
			);
		}
		menu.showAtMouseEvent(evt);
	});

	const checkbox = row.createEl('input', {
		type: 'checkbox',
		cls: 'task-list-item-checkbox',
	});
	checkbox.checked = task.status === 'done';
	checkbox.addEventListener('click', (evt) => {
		evt.preventDefault();
		handlers.toggle(task);
	});

	const body = row.createDiv({ cls: 'syncdev-task-body' });
	const textEl = body.createDiv({ cls: 'syncdev-task-text' });
	// The project label replaces the tag in the text
	const text = project ? stripTag(task.text, project.tag) : task.text;
	await MarkdownRenderer.render(app, text, textEl, task.path, component);
	// Rendered internal links are not wired up outside the editor; open them in a new tab
	textEl.addEventListener('click', (evt) => {
		const link = (evt.target as HTMLElement).closest('a.internal-link');
		const href = link?.getAttribute('data-href') ?? link?.getAttribute('href');
		if (!href) return;
		evt.preventDefault();
		void app.workspace.openLinkText(href, task.path, 'tab');
	});

	const meta = body.createDiv({ cls: 'syncdev-task-meta' });
	if (project) renderProjectLabel(meta, project);
	const source = meta.createEl('a', {
		cls: 'syncdev-source',
		text: task.dailyDate ?? task.path.replace(/\.md$/, ''),
	});
	source.addEventListener('click', () => handlers.open(task));
	if (task.scheduled) meta.createSpan({ text: `⏳ ${task.scheduled}` });
	if (task.due) {
		const overdue =
			task.status !== 'done' && task.due < moment().format(DATE_FORMAT);
		meta.createSpan({
			cls: overdue ? 'syncdev-overdue' : '',
			text: `📅 ${task.due}`,
		});
	}
	if (task.completed) meta.createSpan({ text: `✅ ${task.completed}` });
}
