import { App, Editor, MarkdownView, moment, TFile } from 'obsidian';
import type { SyncDevSettings } from '../settings';
import type { Task } from '../types';
import { newBlockId } from './blockId';
import { DATE_FORMAT, dailyDateOf, getDailyNoteConfig } from './dailyNotes';
import { withBlockId, withCreated } from './parser';
import type { TaskIndex } from './taskIndex';
import type { TaskWriter } from './taskWriter';

/**
 * Handles tasks newly typed into notes in scope: adds ➕ today and, outside daily notes,
 * embeds the task's block in today's daily note. A task on the line being edited waits
 * until the cursor leaves it (next edit of the note, or switching panes), so nothing
 * lands in the middle of typing. A task with ➕ counts as already handled.
 */
export class CreatedStamper {
	/** Texts of new tasks still waiting, per file */
	private pending = new Map<string, Set<string>>();

	constructor(
		private app: App,
		private index: TaskIndex,
		private writer: TaskWriter,
		private getSettings: () => SyncDevSettings,
	) {}

	private enabled(): boolean {
		const { addCreatedDate, embedInDaily } = this.getSettings();
		return addCreatedDate || embedInDaily;
	}

	onFileEdited(file: TFile, before: Task[], after: Task[]): void {
		if (!this.enabled()) {
			this.pending.clear();
			return;
		}
		const waiting = this.pending.get(file.path) ?? new Set<string>();

		// Pair tasks by text first; what is left over was added or edited
		const byText = new Map<string, Task[]>();
		for (const t of before) byText.set(t.text, [...(byText.get(t.text) ?? []), t]);
		const unpaired: Task[] = [];
		const candidates: Task[] = [];
		for (const t of after) {
			const same = byText.get(t.text);
			if (same?.length) {
				same.shift();
				if (waiting.has(t.text)) candidates.push(t);
			} else {
				unpaired.push(t);
			}
		}
		// An unpaired task on the line of an unpaired old one is that task edited:
		// new only if the old one was still waiting (e.g. being typed)
		const editedFrom = new Map([...byText.values()].flat().map((t) => [t.line, t]));
		for (const t of unpaired) {
			const old = editedFrom.get(t.line);
			if (!old || waiting.has(old.text)) candidates.push(t);
		}
		void this.handle(file, candidates);
	}

	/** Retries waiting tasks, e.g. after the cursor may have left them */
	flush(): void {
		if (!this.enabled()) {
			this.pending.clear();
			return;
		}
		for (const [path, texts] of this.pending) {
			const file = this.app.vault.getFileByPath(path);
			if (!file) {
				this.pending.delete(path);
				continue;
			}
			void this.handle(file, this.index.tasksOf(path).filter((t) => texts.has(t.text)));
		}
	}

	private async handle(file: TFile, candidates: Task[]): Promise<void> {
		const settings = this.getSettings();
		const date = moment().format(DATE_FORMAT);
		const embed =
			settings.embedInDaily &&
			!dailyDateOf(file, getDailyNoteConfig(this.app, settings));
		const editors = this.editorsOf(file);
		const waiting = new Set<string>();
		const ready: Task[] = [];
		for (const task of candidates) {
			if (task.created) continue;
			const editing = editors.some((e) => e.hasFocus() && e.getCursor().line === task.line);
			// An empty task is still being written
			if (editing || !task.text) waiting.add(task.text);
			else ready.push(task);
		}

		const embedIds: string[] = [];
		const change = (raw: string): string => {
			let next = settings.addCreatedDate ? withCreated(raw, date) : raw;
			if (embed) {
				next = withBlockId(next, newBlockId());
				const id = /\^([A-Za-z0-9-]+)\s*$/.exec(next)?.[1];
				if (id) embedIds.push(id);
			}
			return next;
		};

		if (ready.length > 0) {
			// An open editor may hold unsaved typing, so write through it when there is one
			const editor = editors[0];
			if (editor) {
				for (const task of ready) {
					if (editor.getLine(task.line) !== task.raw) {
						waiting.add(task.text);
						continue;
					}
					editor.replaceRange(
						change(task.raw),
						{ line: task.line, ch: 0 },
						{ line: task.line, ch: task.raw.length },
					);
				}
			} else {
				await this.app.vault.process(file, (data) => {
					const lines = data.split('\n');
					embedIds.length = 0;
					for (const task of ready) {
						// Skip lines that changed since they were indexed
						if (lines[task.line] === task.raw) lines[task.line] = change(task.raw);
					}
					return lines.join('\n');
				});
			}
		}

		if (waiting.size > 0) this.pending.set(file.path, waiting);
		else this.pending.delete(file.path);
		if (embedIds.length > 0) await this.writer.embedInDaily(file, embedIds);
	}

	private editorsOf(file: TFile): Editor[] {
		return this.app.workspace
			.getLeavesOfType('markdown')
			.map((leaf) => leaf.view)
			.filter((view): view is MarkdownView => view instanceof MarkdownView)
			.filter((view) => view.file?.path === file.path)
			.map((view) => view.editor);
	}
}
