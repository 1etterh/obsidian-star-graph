import { App, moment, Notice } from 'obsidian';
import type { SyncDevSettings } from '../settings';
import type { Task } from '../types';
import { DATE_FORMAT, getDailyNoteConfig, getOrCreateDailyNote } from './dailyNotes';
import { MARKERS, toggleTaskLine } from './parser';

export class TaskWriter {
	constructor(
		private app: App,
		private getSettings: () => SyncDevSettings,
	) {}

	async toggle(task: Task): Promise<void> {
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
			const next = toggleTaskLine(task.raw, moment().format(DATE_FORMAT));
			if (next === null) return data;
			lines[task.line] = next;
			return lines.join('\n');
		});
		if (stale) new Notice('Task changed in the note. Try again.');
	}

	/** Appends a new task to today's daily note */
	async addToToday(text: string): Promise<void> {
		const settings = this.getSettings();
		const file = await getOrCreateDailyNote(
			this.app,
			getDailyNoteConfig(this.app, settings),
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
