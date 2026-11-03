import { App, moment, Notice, TFile } from 'obsidian';
import type { SyncDevSettings } from '../settings';
import type { Task, TaskStatus } from '../types';
import { DATE_FORMAT, getDailyNoteConfig, getOrCreateDailyNote } from './dailyNotes';
import { MARKERS, setTaskStatus } from './parser';

export class TaskWriter {
	constructor(
		private app: App,
		private getSettings: () => SyncDevSettings,
	) {}

	/** Checking an unfinished task completes it, unchecking a done one reopens it */
	async toggle(task: Task): Promise<void> {
		await this.setStatus(task, task.status === 'done' ? 'todo' : 'done');
	}

	async setStatus(task: Task, status: TaskStatus): Promise<void> {
		if (task.status === status) return;
		await this.rewriteLine(task, (raw) => setTaskStatus(raw, status, this.doneDate()));
	}

	/** Today's date when the ✅ done date is enabled in settings */
	private doneDate(): string | undefined {
		return this.getSettings().addDoneDate ? moment().format(DATE_FORMAT) : undefined;
	}

	private async rewriteLine(task: Task, change: (raw: string) => string | null): Promise<void> {
		const file = this.app.vault.getFileByPath(task.path);
		if (!file) return;
		let stale = false;
		await this.app.vault.process(file, (data) => {
			const lines = data.split('\n');
			// Refuse to write if the line changed since it was indexed
			if (lines[task.line] !== task.raw) {
				stale = true;
				return data;
			}
			const next = change(task.raw);
			if (next === null) return data;
			lines[task.line] = next;
			return lines.join('\n');
		});
		if (stale) new Notice('Task changed in the note. Try again.');
	}

	/** Appends a new task to the daily note of `date` (today by default) */
	async addToDaily(text: string, date: moment.Moment = moment()): Promise<void> {
		const created = this.getSettings().addCreatedDate
			? ` ${MARKERS.created} ${moment().format(DATE_FORMAT)}`
			: '';
		await this.appendToDaily([`- [ ] ${text.trim()}${created}`], date);
	}

	/** Embeds blocks (`#^id` of `source`) in today's daily note */
	async embedInDaily(source: TFile, blockIds: string[]): Promise<void> {
		const daily = await this.dailyNote(moment());
		// No list marker: a block embed renders as its own block, so `- ` left an empty bullet
		const lines = blockIds.map(
			(id) => `!${this.app.fileManager.generateMarkdownLink(source, daily.path, `#^${id}`)}`,
		);
		await this.appendToDaily(lines, moment(), daily);
	}

	private dailyNote(date: moment.Moment): Promise<TFile> {
		return getOrCreateDailyNote(this.app, getDailyNoteConfig(this.app, this.getSettings()), date);
	}

	private async appendToDaily(
		lines: string[],
		date: moment.Moment,
		file?: TFile,
	): Promise<void> {
		const target = file ?? (await this.dailyNote(date));
		const block = lines.join('\n');
		await this.app.vault.process(target, (data) => {
			if (data === '') return `${block}\n`;
			return data.endsWith('\n') ? `${data}${block}\n` : `${data}\n${block}\n`;
		});
	}
}
