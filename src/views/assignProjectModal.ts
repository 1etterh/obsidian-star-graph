import { FuzzySuggestModal, Notice } from 'obsidian';
import type SyncDevPlugin from '../main';
import type { Project, Task } from '../types';

type Choice = Project | 'none';

/** Picks a project for a task and rewrites its project tag */
export class AssignProjectModal extends FuzzySuggestModal<Choice> {
	private current: Project | undefined;

	constructor(
		private plugin: SyncDevPlugin,
		private task: Task,
	) {
		super(plugin.app);
		this.current = plugin.projects.projectOf(task);
		this.setPlaceholder('Assign to project…');
	}

	getItems(): Choice[] {
		const others = this.plugin.projects
			.list()
			.filter((p) => p.name !== this.current?.name);
		return this.current ? [...others, 'none'] : others;
	}

	getItemText(item: Choice): string {
		return item === 'none' ? 'No project (remove tag)' : item.name;
	}

	onChooseItem(item: Choice): void {
		const remove = this.current?.tag;
		const add = item === 'none' ? undefined : item.tag;
		void this.plugin.writer.setProjectTag(this.task, remove, add);
	}
}

/** Opens the picker, unless the folder fixes the project and a tag cannot change it */
export function assignProject(plugin: SyncDevPlugin, task: Task): void {
	const owner = plugin.projects.folderProjectOf(task.path);
	if (owner) {
		new Notice(`This task is in the ${owner.name} folder, so it always belongs to ${owner.name}`);
		return;
	}
	if (plugin.projects.list().length === 0) {
		new Notice('No projects yet. Create a project first.');
		return;
	}
	new AssignProjectModal(plugin, task).open();
}
