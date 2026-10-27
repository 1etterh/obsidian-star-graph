import { App, moment, Notice } from 'obsidian';
import type { SyncDevSettings } from '../settings';
import type { Task, TaskStatus } from '../types';
import { DATE_FORMAT, getDailyNoteConfig, getOrCreateDailyNote } from './dailyNotes';
import { MARKERS, replaceTag, setTaskStatus } from './parser';

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
			const next = setTaskStatus(
				task.raw,
				status,
				moment().format(DATE_FORMAT),
			);
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

	/** Rewrites `#from` to `#to` on the given task lines, one write per file */
	async renameTag(tasks: Task[], from: string, to: string): Promise<void> {
		const byPath = new Map<string, Set<number>>();
		for (const task of tasks) {
			const lines = byPath.get(task.path) ?? new Set<number>();
			lines.add(task.line);
			byPath.set(task.path, lines);
		}
		for (const [path, lineNumbers] of byPath) {
			const file = this.app.vault.getFileByPath(path);
			if (!file) continue;
			await this.app.vault.process(file, (data) => {
				const lines = data.split('\n');
				for (const n of lineNumbers) {
					const line = lines[n];
					if (line !== undefined) lines[n] = replaceTag(line, from, to);
				}
				return lines.join('\n');
			});
		}
	}
}
