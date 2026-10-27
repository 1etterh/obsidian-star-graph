import { debounce, Plugin } from 'obsidian';
import { StatusLog } from './core/statusLog';
import { TaskIndex } from './core/taskIndex';
import { registerIcons, SYNCDEV_ICON } from './icon';
import { TaskWriter } from './core/taskWriter';
import { DEFAULT_SETTINGS, SyncDevSettings, SyncDevSettingTab } from './settings';
import { PromptModal } from './views/promptModal';
import { SYNCDEV_VIEW_TYPE, SyncDevTab, SyncDevView } from './views/syncdevView';

export default class SyncDevPlugin extends Plugin {
	settings!: SyncDevSettings;
	index!: TaskIndex;
	writer!: TaskWriter;
	statusLog!: StatusLog;

	// Folder settings (including the log folder) change the index scope, so rebuild once typing settles
	private rebuildSoon = debounce(() => void this.index.rebuild(), 500, true);

	async onload() {
		await this.loadSettings();
		this.index = new TaskIndex(this.app, () => this.settings);
		this.writer = new TaskWriter(this.app, () => this.settings);
		this.statusLog = new StatusLog(this.app, () => this.settings);

		registerIcons();
		this.registerView(
			SYNCDEV_VIEW_TYPE,
			(leaf) => new SyncDevView(leaf, this),
		);

		this.addRibbonIcon(SYNCDEV_ICON, 'Open SyncDev', () => {
			void this.openSyncDev();
		});

		// IDs kept from when kanban and calendar were separate views
		this.addCommand({
			id: 'open-backlog',
			name: 'Open kanban',
			callback: () => void this.openSyncDev('kanban'),
		});
		this.addCommand({
			id: 'open-calendar',
			name: 'Open calendar',
			callback: () => void this.openSyncDev('calendar'),
		});
		this.addCommand({
			id: 'add-task-today',
			name: 'Add task to today',
			callback: () => {
				new PromptModal(
					this.app,
					'Add task to today',
					'What needs doing?',
					'Add',
					(text) => this.writer.addToDaily(text),
				).open();
			},
		});

		this.addSettingTab(new SyncDevSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			void this.index.rebuild();
			this.registerEvent(
				this.index.onStatusChanged((changes) => void this.statusLog.record(changes)),
			);
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

	/**
	 * Opens SyncDev as a tab in the main area, reusing one if already open.
	 * Without `tab`, an open view keeps its current tab.
	 */
	async openSyncDev(tab?: SyncDevTab): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace
			.getLeavesOfType(SYNCDEV_VIEW_TYPE)
			.find((leaf) => leaf.getRoot() === workspace.rootSplit);
		const leaf = existing ?? workspace.getLeaf('tab');
		if (!existing || tab) {
			await leaf.setViewState({
				type: SYNCDEV_VIEW_TYPE,
				active: true,
				state: tab ? { tab } : {},
			});
		}
		await workspace.revealLeaf(leaf);
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
