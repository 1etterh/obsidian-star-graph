import { App, moment, normalizePath, TFile } from 'obsidian';
import type { Task, TaskStatus } from '../types';
import type { ProjectRegistry } from './projects';
import type { StatusChange } from './statusDiff';

const LABELS: Record<TaskStatus, string> = {
	todo: 'todo',
	done: 'done',
};

/**
 * Appends every task status change to a monthly markdown log, e.g. SyncDev/log/2026-10.md.
 * Append-only, so syncing two devices rarely conflicts.
 */
export class StatusLog {
	constructor(
		private app: App,
		private projects: ProjectRegistry,
	) {}

	folder(): string {
		const hub = this.projects.hubPath();
		const parent = hub.split('/').slice(0, -1).join('/');
		return normalizePath(parent ? `${parent}/log` : 'log');
	}

	async record(changes: StatusChange[]): Promise<void> {
		const now = moment();
		const path = normalizePath(`${this.folder()}/${now.format('YYYY-MM')}.md`);
		const lines = changes.map((c) => this.line(c.after, c.before.status, path, now));
		const file = await this.ensureFile(path);
		await this.app.vault.process(file, (data) => {
			const prefix = data === '' || data.endsWith('\n') ? data : `${data}\n`;
			return `${prefix}${lines.join('\n')}\n`;
		});
	}

	private line(task: Task, from: TaskStatus, logPath: string, now: moment.Moment): string {
		const file = this.app.vault.getFileByPath(task.path);
		// Brackets and pipes would break the link alias
		const alias = task.text.replace(/[[\]|]/g, '').trim() || task.path;
		const link = file
			? this.app.fileManager.generateMarkdownLink(
					file,
					logPath,
					task.blockId ? `#^${task.blockId}` : '',
					alias,
				)
			: alias;
		const project = this.projects.projectOf(task);
		const suffix = project ? ` (${project.name})` : '';
		return `- ${now.format('YYYY-MM-DD HH:mm')} · ${LABELS[from]} → ${LABELS[task.status]} · ${link}${suffix}`;
	}

	private async ensureFile(path: string): Promise<TFile> {
		const existing = this.app.vault.getFileByPath(path);
		if (existing) return existing;
		const parts = path.split('/').slice(0, -1);
		for (let i = 1; i <= parts.length; i++) {
			const dir = parts.slice(0, i).join('/');
			if (!this.app.vault.getFolderByPath(dir)) await this.app.vault.createFolder(dir);
		}
		return this.app.vault.create(path, '');
	}
}
