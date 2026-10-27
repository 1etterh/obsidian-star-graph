import { App, Events, normalizePath, Notice, TFile, TFolder } from 'obsidian';
import { DEFAULT_PROJECT_ROOT, type SyncDevSettings } from '../settings';
import type { Project, Task } from '../types';

const COLORS = [
	'--color-blue',
	'--color-green',
	'--color-orange',
	'--color-purple',
	'--color-cyan',
	'--color-pink',
	'--color-yellow',
	'--color-red',
];

/** Folder name → tag: spaces become '-', characters not allowed in tags are dropped */
export function projectTag(name: string): string {
	return name
		.trim()
		.replace(/\s+/g, '-')
		.replace(/[^\p{L}\p{N}_-]/gu, '');
}

/** Code block that renders the project list in the hub note */
export const PROJECT_LIST_BLOCK = 'syncdev-projects';

/** Characters that cannot appear in a folder name become '-' */
function cleanName(name: string): string {
	return name.trim().replace(/[\\/:]/g, '-');
}

// Hash the name so a project keeps its color when others are added or removed
function colorOf(name: string): string {
	let hash = 0;
	for (const ch of name) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) | 0;
	return COLORS[Math.abs(hash) % COLORS.length] ?? COLORS[0]!;
}

/**
 * Projects are the direct subfolders of the project root folder.
 * A task belongs to a project when its note is in that folder,
 * or when the line carries the project's tag.
 * Emits 'changed' when the project list or the project filter changes.
 */
export class ProjectRegistry extends Events {
	private cache: Project[] | null = null;

	constructor(
		private app: App,
		private getSettings: () => SyncDevSettings,
	) {
		super();
	}

	root(): string {
		return normalizePath(this.getSettings().projectRoot.trim() || DEFAULT_PROJECT_ROOT);
	}

	list(): Project[] {
		if (this.cache) return this.cache;
		const root = this.app.vault.getFolderByPath(this.root());
		this.cache = (root?.children ?? [])
			.filter((f): f is TFolder => f instanceof TFolder)
			.map((f) => ({
				name: f.name,
				folder: f.path,
				tag: projectTag(f.name),
				color: colorOf(f.name),
			}))
			.sort((a, b) => a.name.localeCompare(b.name));
		return this.cache;
	}

	byTag(tag: string): Project | undefined {
		const lower = tag.toLowerCase();
		return this.list().find((p) => p.tag.toLowerCase() === lower);
	}

	/** The project whose folder holds the note, regardless of tags */
	folderProjectOf(path: string): Project | undefined {
		return this.list().find((p) => path.startsWith(`${p.folder}/`));
	}

	projectOf(task: Task): Project | undefined {
		const inFolder = this.folderProjectOf(task.path);
		if (inFolder) return inFolder;
		for (const tag of task.tags) {
			const project = this.byTag(tag);
			if (project) return project;
		}
		return undefined;
	}

	/** Applies the project filter shared by all tabs */
	isVisible(task: Task): boolean {
		const { hiddenProjects, showUnassigned } = this.getSettings();
		const project = this.projectOf(task);
		return project ? !hiddenProjects.includes(project.name) : showUnassigned;
	}

	/** True when `path` is a project folder, i.e. a direct child of the root */
	isProjectFolder(path: string): boolean {
		return path.split('/').slice(0, -1).join('/') === this.root();
	}

	/** Returns why `name` cannot be a new project, or null when it can */
	validateName(name: string): string | null {
		const clean = cleanName(name);
		if (!clean) return 'Enter a project name';
		const tag = projectTag(clean);
		if (!tag) return 'Use at least one letter or number';

		const lower = clean.toLowerCase();
		const root = this.app.vault.getFolderByPath(this.root());
		if (root?.children.some((f) => f.name.toLowerCase() === lower)) {
			return `${clean} already exists`;
		}
		// Different names can map to the same tag, e.g. "My shop" and "my-shop"
		const sameTag = this.byTag(tag);
		if (sameTag) return `#${tag} is already used by ${sameTag.name}`;
		return null;
	}

	/** Creates the project folder with an index note and returns the note */
	async create(name: string): Promise<TFile | null> {
		const error = this.validateName(name);
		if (error) {
			new Notice(error);
			return null;
		}
		const clean = cleanName(name);
		const root = this.root();
		const folder = normalizePath(`${root}/${clean}`);
		// Create each missing level, e.g. SyncDev/ then SyncDev/projects/
		const parts = root.split('/');
		for (let i = 1; i <= parts.length; i++) {
			const path = parts.slice(0, i).join('/');
			if (!this.app.vault.getFolderByPath(path)) await this.app.vault.createFolder(path);
		}
		await this.app.vault.createFolder(folder);
		return this.app.vault.create(`${folder}/index.md`, '');
	}

	/** The project's index note, created if it was deleted */
	async indexNote(project: Project): Promise<TFile> {
		const path = `${project.folder}/index.md`;
		return this.app.vault.getFileByPath(path) ?? this.app.vault.create(path, '');
	}

	/** Hub note next to the project root, e.g. SyncDev/index.md for SyncDev/projects */
	hubPath(): string {
		const parts = this.root().split('/');
		const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : parts.join('/');
		return normalizePath(`${folder}/index.md`);
	}

	/** Creates the hub note with the project list block, unless it already exists */
	async ensureHub(): Promise<void> {
		const path = this.hubPath();
		if (this.app.vault.getAbstractFileByPath(path)) return;
		await this.app.vault.create(path, `\`\`\`${PROJECT_LIST_BLOCK}\n\`\`\`\n`);
	}

	/** Call after the folder tree or the filter changed */
	refresh(): void {
		this.cache = null;
		this.trigger('changed');
	}
}
