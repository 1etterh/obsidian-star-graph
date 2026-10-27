import { ItemView, MarkdownRenderer, moment, WorkspaceLeaf } from 'obsidian';
import { DATE_FORMAT } from '../core/dailyNotes';
import type SyncDevPlugin from '../main';
import type { SortOrder, Task } from '../types';

export const BACKLOG_VIEW_TYPE = 'syncdev-backlog';

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

export class BacklogView extends ItemView {
	private listEl!: HTMLElement;
	private countEl!: HTMLElement;
	private sort: SortOrder;
	private includeDated = false;
	private renderToken = 0;

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

		this.renderAddInput(root);
		this.renderToolbar(root);
		this.listEl = root.createDiv({ cls: 'syncdev-list' });

		this.registerEvent(
			this.plugin.index.on('updated', () => void this.renderList()),
		);
		await this.renderList();
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
		this.countEl = bar.createSpan({ cls: 'syncdev-count' });

		const dated = bar.createEl('label', { cls: 'syncdev-toggle' });
		const checkbox = dated.createEl('input', { type: 'checkbox' });
		dated.appendText('Dated');
		checkbox.addEventListener('change', () => {
			this.includeDated = checkbox.checked;
			void this.renderList();
		});

		const select = bar.createEl('select', { cls: 'dropdown' });
		select.createEl('option', { value: 'newest', text: 'Newest first' });
		select.createEl('option', { value: 'oldest', text: 'Oldest first' });
		select.value = this.sort;
		select.addEventListener('change', () => {
			this.sort = select.value as SortOrder;
			void this.renderList();
		});
	}

	private async renderList(): Promise<void> {
		// Markdown rendering is async; drop renders superseded by a newer one
		const token = ++this.renderToken;
		const tasks = sortTasks(
			this.plugin.index
				.all()
				.filter((t) => !t.done)
				.filter((t) => this.includeDated || (!t.scheduled && !t.due)),
			this.sort,
		);

		this.countEl.setText(`${tasks.length} open`);
		const list = createDiv({ cls: 'syncdev-list' });
		if (tasks.length === 0) {
			list.createDiv({ cls: 'syncdev-empty', text: 'No open tasks' });
		}
		for (const task of tasks) {
			await this.renderTask(list, task);
			if (token !== this.renderToken) return;
		}
		this.listEl.replaceWith(list);
		this.listEl = list;
	}

	private async renderTask(list: HTMLElement, task: Task): Promise<void> {
		const row = list.createDiv({ cls: 'syncdev-task' });

		const checkbox = row.createEl('input', {
			type: 'checkbox',
			cls: 'task-list-item-checkbox',
		});
		checkbox.addEventListener('click', (evt) => {
			evt.preventDefault();
			void this.plugin.writer.toggle(task);
		});

		const body = row.createDiv({ cls: 'syncdev-task-body' });
		const textEl = body.createDiv({ cls: 'syncdev-task-text' });
		await MarkdownRenderer.render(this.app, task.text, textEl, task.path, this);

		const meta = body.createDiv({ cls: 'syncdev-task-meta' });
		const source = meta.createEl('a', {
			cls: 'syncdev-source',
			text: task.dailyDate ?? task.path.replace(/\.md$/, ''),
		});
		source.addEventListener('click', () => void this.openTask(task));
		if (task.scheduled) meta.createSpan({ text: `⏳ ${task.scheduled}` });
		if (task.due) {
			const overdue = task.due < moment().format(DATE_FORMAT);
			meta.createSpan({
				cls: overdue ? 'syncdev-overdue' : '',
				text: `📅 ${task.due}`,
			});
		}
	}

	private async openTask(task: Task): Promise<void> {
		const file = this.app.vault.getFileByPath(task.path);
		if (!file) return;
		await this.app.workspace.getLeaf(false).openFile(file, {
			eState: { line: task.line },
		});
	}
}
