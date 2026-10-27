import { TAbstractFile, TFolder } from 'obsidian';
import { projectTag } from './core/projects';
import type SyncDevPlugin from './main';
import { ConfirmModal } from './views/confirmModal';

function parentOf(path: string): string {
	return path.split('/').slice(0, -1).join('/');
}

/** Keeps the project list in sync with the folder tree */
export function registerProjectEvents(plugin: SyncDevPlugin): void {
	const { app, projects } = plugin;
	const touchesRoot = (path: string) => {
		const root = projects.root();
		return path === root || parentOf(path) === root;
	};

	plugin.registerEvent(
		app.vault.on('create', (file) => {
			if (file instanceof TFolder && touchesRoot(file.path)) projects.refresh();
		}),
	);
	plugin.registerEvent(
		app.vault.on('delete', (file) => {
			if (file instanceof TFolder && touchesRoot(file.path)) projects.refresh();
		}),
	);
	plugin.registerEvent(
		app.vault.on('rename', (file, oldPath) => {
			if (!(file instanceof TFolder)) return;
			if (!touchesRoot(file.path) && !touchesRoot(oldPath)) return;
			if (projects.isProjectFolder(file.path) && projects.isProjectFolder(oldPath)) {
				onProjectRenamed(plugin, file, oldPath);
			}
			projects.refresh();
		}),
	);
}

function onProjectRenamed(
	plugin: SyncDevPlugin,
	file: TAbstractFile,
	oldPath: string,
): void {
	const oldName = oldPath.split('/').pop() ?? '';
	const { settings } = plugin;

	// Keep a hidden project hidden under its new name
	if (settings.hiddenProjects.includes(oldName)) {
		settings.hiddenProjects = settings.hiddenProjects.map((n) =>
			n === oldName ? file.name : n,
		);
		void plugin.saveData(settings);
	}

	// Tags are not updated by Obsidian on rename, so offer to rewrite them
	const from = projectTag(oldName);
	const to = projectTag(file.name);
	if (from.toLowerCase() === to.toLowerCase()) return;
	const tagged = () =>
		plugin.index
			.all()
			.filter((t) => t.tags.some((tag) => tag.toLowerCase() === from.toLowerCase()));
	const count = tagged().length;
	if (count === 0) return;

	new ConfirmModal(
		plugin.app,
		'Rename project tag',
		`Change #${from} to #${to} in ${count} task(s)?`,
		'Rename',
		// Collect again: paths inside the moved folder changed after the modal opened
		() => void plugin.writer.renameTag(tagged(), from, to),
	).open();
}
