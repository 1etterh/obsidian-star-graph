import { App, PluginSettingTab, Setting } from 'obsidian';
import type SyncDevPlugin from './main';
import type { SortOrder } from './types';

export interface SyncDevSettings {
	/** Empty means the whole vault; daily notes are always included */
	includeFolders: string[];
	defaultSort: SortOrder;
	showDone: boolean;
	/** Kanban filter as typed in the toolbar: folders and #tags, comma separated */
	folderFilter: string;
	/** Empty means follow the core Daily notes settings */
	dailyFolder: string;
	dailyFormat: string;
	addCreatedDate: boolean;
	addDoneDate: boolean;
	/** New tasks outside daily notes are also embedded in today's daily note */
	embedInDaily: boolean;
}

export const DEFAULT_SETTINGS: SyncDevSettings = {
	includeFolders: [],
	defaultSort: 'newest',
	showDone: true,
	folderFilter: '',
	dailyFolder: '',
	dailyFormat: '',
	addCreatedDate: true,
	addDoneDate: false,
	embedInDaily: true,
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
			.setDesc('One folder per line. Daily notes are always included. Leave empty to scan the whole vault.')
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
			.setDesc('Append ➕ with today\'s date to new tasks, including ones typed in included folders and daily notes.')
			.addToggle((toggle) =>
				toggle.setValue(settings.addCreatedDate).onChange(async (value) => {
					settings.addCreatedDate = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName('Add done date')
			.setDesc('Append ✅ with the date when a task is checked.')
			.addToggle((toggle) =>
				toggle.setValue(settings.addDoneDate).onChange(async (value) => {
					settings.addDoneDate = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName('Embed new tasks in daily note')
			.setDesc('Tasks typed in included folders are embedded in today\'s daily note, so there is still one checkbox.')
			.addToggle((toggle) =>
				toggle.setValue(settings.embedInDaily).onChange(async (value) => {
					settings.embedInDaily = value;
					await this.plugin.saveSettings();
				}),
			);
	}
}
