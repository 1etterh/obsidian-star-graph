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

	/** Typed subscription to 'file-edited': a note's tasks before and after an edit */
	onFileEdited(callback: (file: TFile, before: Task[], after: Task[]) => void): EventRef {
		return this.on('file-edited', (file, before, after) => {
			if (file instanceof TFile) callback(file, before as Task[], after as Task[]);
		});
	}

	/** Current tasks of one file */
	tasksOf(path: string): Task[] {
		return this.tasks.get(path) ?? [];
	}

	all(): Task[] {
		return [...this.tasks.values()].flat();
	}

	async rebuild(): Promise<void> {
		// Built aside and swapped in, so edits during the rebuild still see the old tasks
		const next = new Map<string, Task[]>();
		const files = this.app.vault
			.getMarkdownFiles()
			.filter((f) => this.inScope(f.path));
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.listItems?.some((i) => i.task !== undefined)) continue;
			const tasks = this.parseFile(file, await this.app.vault.cachedRead(file), cache);
			if (tasks.length > 0) next.set(file.path, tasks);
		}
		this.tasks = next;
		this.notify();
	}

	onChanged(file: TFile, data: string, cache: CachedMetadata): void {
		if (!this.inScope(file.path)) {
			if (this.tasks.delete(file.path)) this.notify();
			return;
		}
		const before = this.tasksOf(file.path);
		const after = this.indexFile(file, data, cache);
		this.trigger('file-edited', file, before, after);
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

	/** Include folders (empty means the whole vault) plus daily notes */
	inScope(path: string): boolean {
		const settings = this.getSettings();
		const include = settings.includeFolders.filter(Boolean);
		if (include.length === 0 || include.some((f) => inFolder(path, f))) return true;
		const file = this.app.vault.getFileByPath(path);
		return !!file && !!dailyDateOf(file, getDailyNoteConfig(this.app, settings));
	}

	private indexFile(file: TFile, data: string, cache: CachedMetadata): Task[] {
		const tasks = this.parseFile(file, data, cache);
		if (tasks.length > 0) this.tasks.set(file.path, tasks);
		else this.tasks.delete(file.path);
		return tasks;
	}

	private parseFile(file: TFile, data: string, cache: CachedMetadata): Task[] {
		const lines = data.split('\n');
		const dailyDate = dailyDateOf(
			file,
			getDailyNoteConfig(this.app, this.getSettings()),
		);
		const tasks: Task[] = [];
		// Tags as Obsidian parsed them, so ones in code spans don't count
		const tagsByLine = new Map<number, string[]>();
		for (const t of cache.tags ?? []) {
			const at = t.position.start.line;
			tagsByLine.set(at, [...(tagsByLine.get(at) ?? []), t.tag.slice(1).toLowerCase()]);
		}

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
				tags: tagsByLine.get(line) ?? [],
				dailyDate,
				fileCtime: file.stat.ctime,
			});
		}

		return tasks;
	}
}
