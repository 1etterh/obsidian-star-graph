import { Component, setIcon } from 'obsidian';
import { sortTasks } from '../core/sort';
import type SyncDevPlugin from '../main';
import type { Project, Task } from '../types';
import { openTask, renderTaskRow, TaskRowHandlers } from './taskRow';

/** One card per visible project: progress and its open tasks */
export class RoadmapPanel extends Component {
	private listEl!: HTMLElement;
	private rootLabelEl!: HTMLElement;
	private renderToken = 0;
	/** Owns the markdown children of the current cards, replaced on each render */
	private listComponent: Component | null = null;

	constructor(
		private plugin: SyncDevPlugin,
		private containerEl: HTMLElement,
	) {
		super();
	}

	onload(): void {
		const root = this.containerEl.createDiv({ cls: 'syncdev-roadmap' });
		const bar = root.createDiv({ cls: 'syncdev-toolbar' });
		this.rootLabelEl = bar.createSpan();
		this.listEl = root.createDiv({ cls: 'syncdev-roadmap-list' });

		this.registerEvent(
			this.plugin.index.on('updated', () => void this.render()),
		);
		this.registerEvent(
			this.plugin.projects.on('changed', () => void this.render()),
		);
		void this.render();
	}

	private groupByProject(): Map<string, Task[]> {
		const groups = new Map<string, Task[]>();
		for (const task of this.plugin.index.all()) {
			const project = this.plugin.projects.projectOf(task);
			if (!project) continue;
			const list = groups.get(project.name) ?? [];
			list.push(task);
			groups.set(project.name, list);
		}
		return groups;
	}

	private async render(): Promise<void> {
		// Markdown rendering is async; drop renders superseded by a newer one
		const token = ++this.renderToken;
		const component = this.addChild(new Component());
		const { projects, settings } = this.plugin;
		const groups = this.groupByProject();
		const visible = projects
			.list()
			.filter((p) => !settings.hiddenProjects.includes(p.name));
		const list = createDiv({ cls: 'syncdev-roadmap-list' });
		this.rootLabelEl.setText(`Projects in ${projects.root()}`);

		if (visible.length === 0) {
			list.createDiv({
				cls: 'syncdev-empty',
				text: projects.list().length === 0
					? `Create a folder in ${projects.root()} to add a project`
					: 'All projects are hidden by the filter',
			});
		}
		for (const project of visible) {
			await this.renderCard(list, project, groups.get(project.name) ?? [], component);
			if (token !== this.renderToken) {
				this.removeChild(component);
				return;
			}
		}

		this.listEl.replaceWith(list);
		this.listEl = list;
		if (this.listComponent) this.removeChild(this.listComponent);
		this.listComponent = component;
	}

	private async renderCard(
		parent: HTMLElement,
		project: Project,
		tasks: Task[],
		component: Component,
	): Promise<void> {
		const card = parent.createDiv({ cls: 'syncdev-project-card' });
		card.setCssProps({ '--syncdev-project-color': `var(${project.color})` });

		const done = tasks.filter((t) => t.status === 'done').length;
		const doing = tasks.filter((t) => t.status === 'doing').length;
		const todo = tasks.length - done - doing;
		const percent = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100);

		const header = card.createDiv({ cls: 'syncdev-project-header' });
		header.createSpan({ cls: 'syncdev-project-dot' });
		header.createEl('h3', { text: project.name });
		header.createSpan({ cls: 'syncdev-count', text: `#${project.tag}` });
		const reveal = header.createEl('button', {
			cls: 'clickable-icon',
			attr: { 'aria-label': 'Show folder' },
		});
		setIcon(reveal, 'folder-open');
		reveal.addEventListener('click', () => this.revealFolder(project));

		const progress = card.createDiv({ cls: 'syncdev-progress' });
		progress
			.createDiv({ cls: 'syncdev-progress-bar' })
			.setCssProps({ '--syncdev-progress': `${percent}%` });
		card.createDiv({
			cls: 'syncdev-task-meta',
			text: `${percent}% · ${todo} todo · ${doing} in progress · ${done} done`,
		});

		// In progress first, then todo
		const open = [
			...sortTasks(tasks.filter((t) => t.status === 'doing'), 'oldest'),
			...sortTasks(tasks.filter((t) => t.status === 'todo'), 'oldest'),
		];
		const list = card.createDiv({ cls: 'syncdev-list' });
		for (const task of open) {
			// Passing the project strips its tag; the card hides the label itself
			await renderTaskRow(
				this.plugin.app,
				list,
				task,
				component,
				this.rowHandlers,
				project,
			);
		}
	}

	private revealFolder(project: Project): void {
		const folder = this.plugin.app.vault.getFolderByPath(project.folder);
		// The file explorer has no public API for revealing a folder
		const explorer = this.plugin.app.workspace.getLeavesOfType('file-explorer')[0];
		const view = explorer?.view as { revealInFolder?: (f: unknown) => void } | undefined;
		if (folder && view?.revealInFolder) view.revealInFolder(folder);
	}

	private rowHandlers: TaskRowHandlers = {
		toggle: (task) => void this.plugin.writer.toggle(task),
		move: (task, status) => void this.plugin.writer.setStatus(task, status),
		open: (task) => void openTask(this.plugin.app, task),
	};
}
