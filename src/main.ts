import { debounce, Plugin } from 'obsidian';
import { TaskIndex } from './core/taskIndex';
import { TaskWriter } from './core/taskWriter';
import { DEFAULT_SETTINGS, SyncDevSettings, SyncDevSettingTab } from './settings';
import { AddTaskModal } from './views/addTaskModal';
import { BACKLOG_VIEW_TYPE, BacklogView } from './views/backlogView';

export default class SyncDevPlugin extends Plugin {
	settings!: SyncDevSettings;
	index!: TaskIndex;
	writer!: TaskWriter;

	// Folder settings change the index scope, so rebuild once typing settles
	private rebuildSoon = debounce(() => void this.index.rebuild(), 500, true);

	async onload() {
		await this.loadSettings();
		this.index = new TaskIndex(this.app, () => this.settings);
		this.writer = new TaskWriter(this.app, () => this.settings);

		this.registerView(
			BACKLOG_VIEW_TYPE,
			(leaf) => new BacklogView(leaf, this),
		);

		this.addRibbonIcon('list-checks', 'Open backlog', () => {
			void this.openBacklog();
		});

		this.addCommand({
			id: 'open-backlog',
			name: 'Open backlog',
			callback: () => void this.openBacklog(),
		});
		this.addCommand({
			id: 'add-task-today',
			name: 'Add task to today',
			callback: () => {
				new AddTaskModal(this.app, (text) =>
					this.writer.addToToday(text),
				).open();
			},
		});

		this.addSettingTab(new SyncDevSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			void this.index.rebuild();
			this.registerEvent(
				this.app.metadataCache.on('changed', (file, data, cache) =>
					this.index.onChanged(file, data, cache),
				),
			);
			this.registerEvent(
				this.app.vault.on('delete', (file) => this.index.onDeleted(file)),
			);
			this.registerEvent(
				this.app.vault.on(
					'rename',
					(file, oldPath) => void this.index.onRenamed(file, oldPath),
				),
			);
		});
	}

	async openBacklog(): Promise<void> {
		const leaf = await this.app.workspace.ensureSideLeaf(
			BACKLOG_VIEW_TYPE,
			'right',
			{ reveal: true },
		);
		await this.app.workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<SyncDevSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.rebuildSoon();
	}
}
