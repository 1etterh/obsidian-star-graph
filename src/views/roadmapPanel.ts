import { Component, moment, setIcon } from 'obsidian';
import { columnOf } from '../core/board';
import { DATE_FORMAT } from '../core/dailyNotes';
import { groupByProject, statsOf } from '../core/projectStats';
import { sortTasks } from '../core/sort';
import { countKinds } from '../core/storming/model';
import type SyncDevPlugin from '../main';
import type { Project, Task } from '../types';
import { showProjectMenu } from './projectMenu';
import { assignProject } from './assignProjectModal';
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
		this.registerEvent(
			this.plugin.storming.on('changed', () => void this.render()),
		);
		void this.render();
	}

	private async render(): Promise<void> {
		// Markdown rendering is async; drop renders superseded by a newer one
		const token = ++this.renderToken;
		const component = this.addChild(new Component());
		const { projects, settings } = this.plugin;
		const groups = groupByProject(this.plugin.index.all(), projects);
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
		card.addEventListener('contextmenu', (evt) => showProjectMenu(evt, this.plugin, project));
		card.setCssProps({ '--syncdev-project-color': `var(${project.color})` });

		const stats = statsOf(tasks);

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
			.setCssProps({ '--syncdev-progress': `${stats.percent}%` });
		card.createDiv({
			cls: 'syncdev-task-meta',
			text: `${stats.percent}% · ${stats.open} open · ${stats.done} done`,
		});

		await this.renderStorming(card, project);

		// Today first, then the rest of the open tasks
		const today = moment().format(DATE_FORMAT);
		const pending = tasks.filter((t) => t.status === 'todo');
		const open = [
			...sortTasks(pending.filter((t) => columnOf(t, today) === 'today'), 'oldest'),
			...sortTasks(pending.filter((t) => columnOf(t, today) === 'todo'), 'oldest'),
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

	/** Card counts from the project's canvases, with a shortcut to turn commands into tasks */
	private async renderStorming(card: HTMLElement, project: Project): Promise<void> {
		const { storming, app } = this.plugin;
		const files = storming.canvasesOf(project);
		if (files.length === 0) return;
		const boards = await storming.boardsOf(project);
		const counts = countKinds(boards);
		const contexts = new Set(boards.flatMap((b) => b.contexts)).size;
		const pending = boards
			.flatMap((b) => b.cards)
			.filter((c) => c.kind === 'command' && !c.hasTask).length;

		const row = card.createDiv({ cls: 'syncdev-storming' });
		for (const file of files) {
			const link = row.createEl('a', { cls: 'syncdev-source', text: file.basename });
			link.addEventListener('click', () => void app.workspace.getLeaf('tab').openFile(file));
		}
		row.createSpan({
			text:
				`${counts.event} events · ${counts.command} commands · ` +
				`${counts.aggregate} aggregates · ${contexts} contexts`,
		});
		if (pending > 0) {
			const button = row.createEl('button', {
				cls: 'syncdev-filter-button',
				text: `Create ${pending} task(s) from commands`,
			});
			button.addEventListener('click', () => {
				button.disabled = true;
				void storming.createCommandTasks(project);
			});
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
		move: (task, column) => void this.plugin.writer.moveTo(task, column),
		open: (task) => void openTask(this.plugin.app, task),
		assign: (task) => assignProject(this.plugin, task),
	};
}
