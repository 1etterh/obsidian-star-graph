import { App, Editor, MarkdownView, moment, TFile } from 'obsidian';
import type { SyncDevSettings } from '../settings';
import type { Task } from '../types';
import { DATE_FORMAT } from './dailyNotes';
import { withCreated } from './parser';
import type { TaskIndex } from './taskIndex';

/**
 * Adds ➕ today to tasks typed into notes in scope. A task on the line being edited
 * waits until the cursor leaves it (next edit of the note, or switching panes),
 * so the date never lands in the middle of typing.
 */
export class CreatedStamper {
	/** Texts of new tasks still waiting for a date, per file */
	private pending = new Map<string, Set<string>>();

	constructor(
		private app: App,
		private index: TaskIndex,
		private getSettings: () => SyncDevSettings,
	) {}

	onFileEdited(file: TFile, before: Task[], after: Task[]): void {
		if (!this.getSettings().addCreatedDate) {
			this.pending.delete(file.path);
			return;
		}
		// A task is new when its text occurs more often than before the edit
		const seen = new Map<string, number>();
		for (const t of before) seen.set(t.text, (seen.get(t.text) ?? 0) + 1);
		const waiting = this.pending.get(file.path);
		const candidates = after.filter((t) => {
			const count = seen.get(t.text) ?? 0;
			if (count > 0) {
				seen.set(t.text, count - 1);
				return waiting?.has(t.text) ?? false;
			}
			return true;
		});
		void this.stamp(file, candidates);
	}

	/** Retries waiting tasks, e.g. after the cursor may have left them */
	flush(): void {
		if (!this.getSettings().addCreatedDate) {
			this.pending.clear();
			return;
		}
		for (const [path, texts] of this.pending) {
			const file = this.app.vault.getFileByPath(path);
			if (!file) {
				this.pending.delete(path);
				continue;
			}
			void this.stamp(file, this.index.tasksOf(path).filter((t) => texts.has(t.text)));
		}
	}

	private async stamp(file: TFile, candidates: Task[]): Promise<void> {
		const date = moment().format(DATE_FORMAT);
		const editors = this.editorsOf(file);
		const waiting = new Set<string>();
		const ready: Task[] = [];
		for (const task of candidates) {
			if (task.created || !task.text) continue;
			const editing = editors.some((e) => e.hasFocus() && e.getCursor().line === task.line);
			if (editing) waiting.add(task.text);
			else ready.push(task);
		}

		if (ready.length > 0) {
			// An open editor may hold unsaved typing, so write through it when there is one
			const editor = editors[0];
			if (editor) {
				for (const task of ready) {
					if (editor.getLine(task.line) !== task.raw) {
						waiting.add(task.text);
						continue;
					}
					const next = withCreated(task.raw, date);
					editor.replaceRange(
						next,
						{ line: task.line, ch: 0 },
						{ line: task.line, ch: task.raw.length },
					);
				}
			} else {
				await this.app.vault.process(file, (data) => {
					const lines = data.split('\n');
					for (const task of ready) {
						// Skip lines that changed since they were indexed
						if (lines[task.line] === task.raw) {
							lines[task.line] = withCreated(task.raw, date);
						}
					}
					return lines.join('\n');
				});
			}
		}

		if (waiting.size > 0) this.pending.set(file.path, waiting);
		else this.pending.delete(file.path);
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
