import { App, moment, normalizePath, TFile } from 'obsidian';
import type { SyncDevSettings } from '../settings';

export const DATE_FORMAT = 'YYYY-MM-DD';

interface DailyNotesOptions {
	folder?: string;
	format?: string;
	template?: string;
}

interface InternalPlugins {
	getPluginById(
		id: string,
	): { instance?: { options?: DailyNotesOptions } } | null;
}

export interface DailyNoteConfig {
	folder: string;
	format: string;
	template: string;
}

// The core Daily notes plugin has no public API, so its options are read defensively
function readCoreOptions(app: App): DailyNotesOptions {
	const internal = (app as unknown as { internalPlugins?: InternalPlugins })
		.internalPlugins;
	return internal?.getPluginById('daily-notes')?.instance?.options ?? {};
}

export function getDailyNoteConfig(
	app: App,
	settings: SyncDevSettings,
): DailyNoteConfig {
	const core = readCoreOptions(app);
	const folder = settings.dailyFolder.trim() || core.folder?.trim() || '';
	return {
		folder: folder === '/' ? '' : normalizePath(folder).replace(/^\/$/, ''),
		format: settings.dailyFormat.trim() || core.format?.trim() || DATE_FORMAT,
		template: core.template?.trim() ?? '',
	};
}

/** Returns YYYY-MM-DD when the file is a daily note, otherwise undefined */
export function dailyDateOf(
	file: TFile,
	config: DailyNoteConfig,
): string | undefined {
	const prefix = config.folder ? `${config.folder}/` : '';
	if (!file.path.startsWith(prefix) || file.extension !== 'md') return undefined;
	const rel = file.path.slice(prefix.length, -'.md'.length);
	const date = moment(rel, config.format, true);
	return date.isValid() ? date.format(DATE_FORMAT) : undefined;
}

function applyTemplate(content: string, date: moment.Moment): string {
	return content
		.replace(/{{\s*date\s*:\s*([^}]+?)\s*}}/g, (_m, fmt: string) =>
			date.format(fmt),
		)
		.replace(/{{\s*date\s*}}/g, date.format(DATE_FORMAT))
		.replace(/{{\s*title\s*}}/g, date.format(DATE_FORMAT))
		.replace(/{{\s*time\s*}}/g, moment().format('HH:mm'));
}

async function ensureFolder(app: App, path: string): Promise<void> {
	const dir = path.split('/').slice(0, -1).join('/');
	if (dir && !app.vault.getFolderByPath(dir)) {
		await app.vault.createFolder(dir);
	}
}

export async function getOrCreateDailyNote(
	app: App,
	config: DailyNoteConfig,
	date: moment.Moment = moment(),
): Promise<TFile> {
	const name = date.format(config.format);
	const path = normalizePath(
		config.folder ? `${config.folder}/${name}.md` : `${name}.md`,
	);
	const existing = app.vault.getFileByPath(path);
	if (existing) return existing;

	let content = '';
	if (config.template) {
		const templatePath = normalizePath(
			config.template.endsWith('.md')
				? config.template
				: `${config.template}.md`,
		);
		const template = app.vault.getFileByPath(templatePath);
		if (template) {
			content = applyTemplate(await app.vault.read(template), date);
		}
	}
	await ensureFolder(app, path);
	return app.vault.create(path, content);
}
