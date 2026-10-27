import { App, moment, normalizePath, TFile } from 'obsidian';
import type { Task } from '../types';
import type { ProjectRegistry } from './projects';
import type { StatusChange } from './statusDiff';

const TABLE_HEADER =
	'| updatedAt | taskId | content | status | project |\n' +
	'| --- | --- | --- | --- | --- |\n';

/**
 * Appends every task status change as a table row to a monthly log, e.g. SyncDev/log/2026-10.md.
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
		const rows = changes.map((c) => this.row(c.after, path, now));
		const file = await this.ensureFile(path);
		await this.app.vault.process(file, (data) => {
			const text = data === '' || data.endsWith('\n') ? data : `${data}\n`;
			// Rows can only be appended directly under a table; start one if the file ends otherwise
			const last = text.trimEnd().split('\n').pop() ?? '';
			const head = last.startsWith('|') ? '' : `${text.trim() ? '\n' : ''}${TABLE_HEADER}`;
			return `${text}${head}${rows.join('\n')}\n`;
		});
	}

	private row(task: Task, logPath: string, now: moment.Moment): string {
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
		const cells = [
			now.format('YYYY-MM-DD HH:mm'),
			task.blockId ?? '—',
			link,
			task.status,
			project?.name ?? '',
		];
		// A pipe inside a cell (e.g. a link alias) must be escaped in a table
		return `| ${cells.map((c) => c.replace(/(?<!\\)\|/g, '\\|')).join(' | ')} |`;
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
