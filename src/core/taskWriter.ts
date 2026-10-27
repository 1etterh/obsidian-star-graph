import { App, moment, Notice } from 'obsidian';
import type { SyncDevSettings } from '../settings';
import type { Task, TaskStatus } from '../types';
import { BoardColumn, columnOf } from './board';
import { DATE_FORMAT, getDailyNoteConfig, getOrCreateDailyNote } from './dailyNotes';
import { newBlockId } from './blockId';
import { MARKERS, setScheduled, setTaskStatus, withBlockId } from './parser';

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
		// The block id lets the status log link to this exact task
		await this.rewriteLine(task, (raw) => {
			const next = setTaskStatus(raw, status, this.doneDate());
			return next === null ? null : withBlockId(next, newBlockId());
		});
	}

	/**
	 * Today: open and ⏳ today. Todo: open, ⏳ removed. Done: checked, ⏳ kept.
	 * One write, so the status log sees a single change.
	 */
	async moveTo(task: Task, column: BoardColumn): Promise<void> {
		const today = moment().format(DATE_FORMAT);
		if (columnOf(task, today) === column) return;
		await this.rewriteLine(task, (raw) => {
			const status: TaskStatus = column === 'done' ? 'done' : 'todo';
			let next = setTaskStatus(raw, status, this.doneDate());
			if (next === null) return null;
			if (column === 'today') next = setScheduled(next, today);
			if (column === 'todo') next = setScheduled(next);
			return status === task.status ? next : withBlockId(next, newBlockId());
		});
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
		const settings = this.getSettings();
		const file = await getOrCreateDailyNote(
			this.app,
			getDailyNoteConfig(this.app, settings),
			date,
		);
		const created = settings.addCreatedDate
			? ` ${MARKERS.created} ${moment().format(DATE_FORMAT)}`
			: '';
		const line = `- [ ] ${text.trim()}${created}`;
		await this.app.vault.process(file, (data) => {
			if (data === '') return `${line}\n`;
			return data.endsWith('\n') ? `${data}${line}\n` : `${data}\n${line}\n`;
		});
	}
}
