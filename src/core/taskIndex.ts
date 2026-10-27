import {
	App,
	CachedMetadata,
	debounce,
	EventRef,
	Events,
	TAbstractFile,
	TFile,
} from 'obsidian';
import type { SyncDevSettings } from '../settings';
import type { Task } from '../types';
import { dailyDateOf, getDailyNoteConfig } from './dailyNotes';
import { parseTaskLine } from './parser';
import { StatusChange, statusChanges } from './statusDiff';

function inFolder(path: string, folder: string): boolean {
	const f = folder.replace(/\/+$/, '');
	return f === '' || path === f || path.startsWith(`${f}/`);
}

/**
 * Keeps an in-memory list of tasks per file.
 * Emits 'updated' (debounced) whenever the set of tasks changes.
 */
export class TaskIndex extends Events {
	private tasks = new Map<string, Task[]>();
	private notify = debounce(() => this.trigger('updated'), 150, true);

	constructor(
		private app: App,
		private getSettings: () => SyncDevSettings,
	) {
		super();
	}

	/** Typed subscription to 'status-changed' */
	onStatusChanged(callback: (changes: StatusChange[]) => void): EventRef {
		return this.on('status-changed', (changes) => callback(changes as StatusChange[]));
	}

	all(): Task[] {
		return [...this.tasks.values()].flat();
	}

	async rebuild(): Promise<void> {
		this.tasks.clear();
		const files = this.app.vault
			.getMarkdownFiles()
			.filter((f) => this.inScope(f.path));
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.listItems?.some((i) => i.task !== undefined)) continue;
			this.indexFile(file, await this.app.vault.cachedRead(file), cache);
		}
		this.notify();
	}

	onChanged(file: TFile, data: string, cache: CachedMetadata): void {
		if (!this.inScope(file.path)) {
			if (this.tasks.delete(file.path)) this.notify();
			return;
		}
		this.indexFile(file, data, cache);
		this.notify();
	}

	onDeleted(file: TAbstractFile): void {
		if (this.tasks.delete(file.path)) this.notify();
	}

	async onRenamed(file: TAbstractFile, oldPath: string): Promise<void> {
		this.tasks.delete(oldPath);
		if (file instanceof TFile && file.extension === 'md' && this.inScope(file.path)) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache) this.indexFile(file, await this.app.vault.cachedRead(file), cache);
		}
		this.notify();
	}

	private inScope(path: string): boolean {
		const { includeFolders, excludeFolders } = this.getSettings();
		if (excludeFolders.some((f) => f && inFolder(path, f))) return false;
		const include = includeFolders.filter(Boolean);
		return include.length === 0 || include.some((f) => inFolder(path, f));
	}

	private indexFile(file: TFile, data: string, cache: CachedMetadata): void {
		const lines = data.split('\n');
		const dailyDate = dailyDateOf(
			file,
			getDailyNoteConfig(this.app, this.getSettings()),
		);
		const tasks: Task[] = [];

		for (const item of cache.listItems ?? []) {
			if (item.task === undefined) continue;
			const line = item.position.start.line;
			const raw = lines[line];
			if (raw === undefined) continue;
			const parsed = parseTaskLine(raw);
			if (!parsed) continue;
			tasks.push({
				...parsed,
				path: file.path,
				line,
				raw,
				dailyDate,
				fileCtime: file.stat.ctime,
			});
		}

		const before = this.tasks.get(file.path);
		if (tasks.length > 0) this.tasks.set(file.path, tasks);
		else this.tasks.delete(file.path);
		// Only re-indexes compare; a rebuild starts empty and reports nothing
		if (before) {
			const changes = statusChanges(before, tasks);
			if (changes.length > 0) this.trigger('status-changed', changes);
		}
	}
}
