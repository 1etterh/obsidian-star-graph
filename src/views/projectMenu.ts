import { Menu, Notice } from 'obsidian';
import { STORMING_FILE } from '../core/storming/service';
import type SyncDevPlugin from '../main';
import type { Project } from '../types';
import { PromptModal } from './promptModal';

/**
 * SyncDev actions for one project. Shared by the file explorer folder menu,
 * Roadmap cards and the project list block in the hub note.
 */
export function addProjectMenuItems(menu: Menu, plugin: SyncDevPlugin, project: Project): void {
	const { app, settings, storming } = plugin;
	const hidden = settings.hiddenProjects.includes(project.name);

	menu.addItem((item) =>
		item
			.setTitle('New event storming canvas')
			.setIcon('layout-dashboard')
			.onClick(() => promptCanvas(plugin, project)),
	);
	menu.addItem((item) =>
		item
			.setTitle('Create tasks from commands')
			.setIcon('list-plus')
			.onClick(async () => {
				const count = await storming.createCommandTasks(project);
				if (count === 0) new Notice('Every command card already has a task');
			}),
	);
	menu.addSeparator();
	menu.addItem((item) =>
		item
			.setTitle('Open index note')
			.setIcon('file-text')
			.onClick(async () => {
				const index = await plugin.projects.indexNote(project);
				await app.workspace.getLeaf('tab').openFile(index);
			}),
	);
	menu.addItem((item) =>
		item
			.setTitle('Show in roadmap')
			.setIcon('milestone')
			.onClick(() => void plugin.openSyncDev('roadmap')),
	);
	menu.addItem((item) =>
		item
			.setTitle(hidden ? 'Show in filter' : 'Hide from filter')
			.setIcon(hidden ? 'eye' : 'eye-off')
			.onClick(() => {
				settings.hiddenProjects = hidden
					? settings.hiddenProjects.filter((n) => n !== project.name)
					: [...settings.hiddenProjects, project.name];
				void plugin.saveFilter();
			}),
	);
}

export function showProjectMenu(evt: MouseEvent, plugin: SyncDevPlugin, project: Project): void {
	evt.preventDefault();
	const menu = new Menu();
	addProjectMenuItems(menu, plugin, project);
	menu.showAtMouseEvent(evt);
}

function promptCanvas(plugin: SyncDevPlugin, project: Project): void {
	const exists = (name: string) =>
		plugin.app.vault.getAbstractFileByPath(`${project.folder}/${name.trim()}.canvas`) !== null;
	new PromptModal(
		plugin.app,
		'New event storming canvas',
		STORMING_FILE.replace(/\.canvas$/, ''),
		'Create',
		async (name) => {
			const file = await plugin.storming.createTemplate(project.folder, name);
			if (file) await plugin.app.workspace.getLeaf('tab').openFile(file);
		},
		(name) => {
			if (!name.trim()) return 'Enter a canvas name';
			if (/[\\/:]/.test(name)) return 'Name cannot contain / \\ or :';
			return exists(name) ? `${name.trim()}.canvas already exists` : null;
		},
	).open();
}
