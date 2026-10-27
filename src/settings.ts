import { App, PluginSettingTab, Setting } from 'obsidian';
import type SyncDevPlugin from './main';
import type { SortOrder } from './types';

export interface SyncDevSettings {
	/** Empty means the whole vault */
	includeFolders: string[];
	excludeFolders: string[];
	defaultSort: SortOrder;
	showDone: boolean;
	/** Empty means follow the core Daily notes settings */
	dailyFolder: string;
	dailyFormat: string;
	addCreatedDate: boolean;
	addDoneDate: boolean;
	/** Empty turns the status log off */
	logFolder: string;
}

export const DEFAULT_SETTINGS: SyncDevSettings = {
	includeFolders: [],
	excludeFolders: [],
	defaultSort: 'newest',
	showDone: true,
	dailyFolder: '',
	dailyFormat: '',
	addCreatedDate: true,
	addDoneDate: false,
	logFolder: 'SyncDev/logs',
};

function parseFolders(value: string): string[] {
	return value
		.split('\n')
		.map((s) => s.trim().replace(/^\/+|\/+$/g, ''))
		.filter(Boolean);
}

export class SyncDevSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: SyncDevPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		const { settings } = this.plugin;
		containerEl.empty();

		new Setting(containerEl).setName('Task scope').setHeading();

		new Setting(containerEl)
			.setName('Include folders')
			.setDesc('One folder per line. Leave empty to scan the whole vault.')
			.addTextArea((text) =>
				text
					.setPlaceholder('Daily\nProjects')
					.setValue(settings.includeFolders.join('\n'))
					.onChange(async (value) => {
						settings.includeFolders = parseFolders(value);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Exclude folders')
			.setDesc('One folder per line.')
			.addTextArea((text) =>
				text
					.setPlaceholder('Templates\nArchive')
					.setValue(settings.excludeFolders.join('\n'))
					.onChange(async (value) => {
						settings.excludeFolders = parseFolders(value);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Default sort')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('newest', 'Newest first')
					.addOption('oldest', 'Oldest first')
					.setValue(settings.defaultSort)
					.onChange(async (value) => {
						settings.defaultSort = value as SortOrder;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Show done column')
			.setDesc('Also toggled from the backlog toolbar.')
			.addToggle((toggle) =>
				toggle.setValue(settings.showDone).onChange(async (value) => {
					settings.showDone = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl).setName('Daily notes').setHeading();

		new Setting(containerEl)
			.setName('Daily note folder')
			.setDesc('Leave empty to use the core daily notes setting.')
			.addText((text) =>
				text
					.setPlaceholder('Daily')
					.setValue(settings.dailyFolder)
					.onChange(async (value) => {
						settings.dailyFolder = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Daily note date format')
			.setDesc('Moment.js format. Leave empty to use the core daily notes setting.')
			.addText((text) =>
				text
					.setPlaceholder('YYYY-MM-DD')
					.setValue(settings.dailyFormat)
					.onChange(async (value) => {
						settings.dailyFormat = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Add created date')
			.setDesc('Append ➕ with today\'s date to new tasks.')
			.addToggle((toggle) =>
				toggle.setValue(settings.addCreatedDate).onChange(async (value) => {
					settings.addCreatedDate = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName('Add done date')
			.setDesc('Append ✅ with the date when a task is checked. Status changes are logged either way.')
			.addToggle((toggle) =>
				toggle.setValue(settings.addDoneDate).onChange(async (value) => {
					settings.addDoneDate = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl).setName('Status log').setHeading();

		new Setting(containerEl)
			.setName('Log folder')
			.setDesc(
				'Status changes are appended to a monthly note here. Leave empty to turn logging off. ' +
					'To hide it from search and graph, add it to Settings → Files and links → Excluded files.',
			)
			.addText((text) =>
				text
					.setPlaceholder('SyncDev/logs')
					.setValue(settings.logFolder)
					.onChange(async (value) => {
						settings.logFolder = value.trim().replace(/^\/+|\/+$/g, '');
						await this.plugin.saveSettings();
					}),
			);
	}
}
