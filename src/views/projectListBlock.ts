import { debounce, MarkdownRenderChild } from 'obsidian';
import { groupByProject, ProjectStats, statsOf } from '../core/projectStats';
import type SyncDevPlugin from '../main';
import type { Project } from '../types';
import { showProjectMenu } from './projectMenu';

/** Live project list rendered in place of a ```syncdev-projects``` code block */
export class ProjectListBlock extends MarkdownRenderChild {
	// Several events can fire together (e.g. folder created, then its index note)
	private renderSoon = debounce(() => this.render(), 100, true);

	constructor(
		containerEl: HTMLElement,
		private plugin: SyncDevPlugin,
	) {
		super(containerEl);
	}

	onload(): void {
		const { index, projects, storming } = this.plugin;
		this.registerEvent(index.on('updated', () => this.renderSoon()));
		this.registerEvent(projects.on('changed', () => this.renderSoon()));
		this.registerEvent(storming.on('changed', () => this.renderSoon()));
		this.render();
	}

	private render(): void {
		const { projects, index } = this.plugin;
		const groups = groupByProject(index.all(), projects);
		const list = createDiv({ cls: 'syncdev-project-list' });

		const all = projects.list();
		if (all.length === 0) {
			list.createDiv({
				cls: 'syncdev-empty',
				text: `No projects yet. Folders in ${projects.root()} become projects.`,
			});
		}
		for (const project of all) {
			this.renderRow(list, project, statsOf(groups.get(project.name) ?? []));
		}

		const add = list.createEl('button', { cls: 'syncdev-filter-button', text: 'New project' });
		add.addEventListener('click', () => {
			add.blur();
			this.plugin.promptNewProject();
		});

		this.containerEl.empty();
		this.containerEl.appendChild(list);
	}

	private renderRow(list: HTMLElement, project: Project, stats: ProjectStats): void {
		const { app, storming } = this.plugin;
		const row = list.createDiv({ cls: 'syncdev-project-row' });
		row.setCssProps({ '--syncdev-project-color': `var(${project.color})` });
		row.addEventListener('contextmenu', (evt) => showProjectMenu(evt, this.plugin, project));

		row.createSpan({ cls: 'syncdev-project-dot' });
		const name = row.createEl('a', { cls: 'syncdev-project-name', text: project.name });
		name.addEventListener('click', () => {
			void (async () => {
				const note = await this.plugin.projects.indexNote(project);
				await app.workspace.getLeaf('tab').openFile(note);
			})();
		});

		const progress = row.createDiv({ cls: 'syncdev-progress' });
		progress
			.createDiv({ cls: 'syncdev-progress-bar' })
			.setCssProps({ '--syncdev-progress': `${stats.percent}%` });

		const meta = row.createSpan({ cls: 'syncdev-task-meta' });
		meta.setText(`${stats.percent}% · ${stats.open} open`);
		for (const file of storming.canvasesOf(project)) {
			const link = meta.createEl('a', { cls: 'syncdev-source', text: file.basename });
			link.addEventListener('click', () => void app.workspace.getLeaf('tab').openFile(file));
		}
	}
}
