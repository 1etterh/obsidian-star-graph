import { App, moment, normalizePath, TFile } from 'obsidian';
import type { Task } from '../types';
import type { StatusChange } from './statusDiff';

const LOG_FOLDER = 'SyncDev/log';

const TABLE_HEADER =
	'| updatedAt | taskId | content | status |\n' +
	'| --- | --- | --- | --- |\n';

/**
 * Appends every task status change as a table row to a monthly log, e.g. SyncDev/log/2026-10.md.
 * Append-only, so syncing two devices rarely conflicts.
 */
export class StatusLog {
	constructor(private app: App) {}

	async record(changes: StatusChange[]): Promise<void> {
		const now = moment();
		const path = normalizePath(`${LOG_FOLDER}/${now.format('YYYY-MM')}.md`);
		const rows = changes.map((c) => this.row(c.after, path, now));
		const file = await this.ensureFile(path);
		await this.app.vault.process(file, (data) => {
			const text = data === '' || data.endsWith('\n') ? data : `${data}\n`;
			// Rows go directly under a table with the current columns; otherwise start a new one
			const lines = text.trimEnd().split('\n');
			const last = lines[lines.length - 1] ?? '';
			const lastHeader = [...lines].reverse().find((l) => l.startsWith('| updatedAt'));
			const continues = last.startsWith('|') && lastHeader === TABLE_HEADER.split('\n')[0];
			const head = continues ? '' : `${text.trim() ? '\n' : ''}${TABLE_HEADER}`;
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
		const cells = [
			now.format('YYYY-MM-DD HH:mm'),
			task.blockId ?? '—',
			link,
			task.status,
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
