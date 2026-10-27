import { debounce, MarkdownView, Plugin, TFile } from 'obsidian';
import { PROJECT_LIST_BLOCK, ProjectRegistry } from './core/projects';
import { StormingService } from './core/storming/service';
import { TaskIndex } from './core/taskIndex';
import { registerIcons, SYNCDEV_ICON } from './icon';
import { TaskWriter } from './core/taskWriter';
import { registerProjectEvents } from './projectEvents';
import { registerStormingEvents } from './stormingEvents';
import { DEFAULT_SETTINGS, SyncDevSettings, SyncDevSettingTab } from './settings';
import { ProjectListBlock } from './views/projectListBlock';
import { PromptModal } from './views/promptModal';
import { SYNCDEV_VIEW_TYPE, SyncDevTab, SyncDevView } from './views/syncdevView';

export default class SyncDevPlugin extends Plugin {
	settings!: SyncDevSettings;
	index!: TaskIndex;
	writer!: TaskWriter;
	projects!: ProjectRegistry;
	storming!: StormingService;

	// Folder settings change the index scope, so rebuild once typing settles
	private rebuildSoon = debounce(() => void this.index.rebuild(), 500, true);

	async onload() {
		await this.loadSettings();
		this.index = new TaskIndex(this.app, () => this.settings);
		this.writer = new TaskWriter(this.app, () => this.settings);
		this.projects = new ProjectRegistry(this.app, () => this.settings);
		this.storming = new StormingService(this.app, this.projects, this.writer);

		registerIcons();
		this.registerMarkdownCodeBlockProcessor(PROJECT_LIST_BLOCK, (_source, el, ctx) => {
			ctx.addChild(new ProjectListBlock(el, this));
		});
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
			id: 'open-roadmap',
			name: 'Open roadmap',
			callback: () => void this.openSyncDev('roadmap'),
		});
		this.addCommand({
			id: 'new-project',
			name: 'New project',
			callback: () => this.promptNewProject(),
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
			this.projects.refresh();
			registerProjectEvents(this);
			registerStormingEvents(this);
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

	promptNewProject(): void {
		new PromptModal(
			this.app,
			'New project',
			'Project name',
			'Create',
			async (name) => {
				const index = await this.projects.create(name);
				if (!index) return;
				if (index.parent) await this.storming.createTemplate(index.parent.path);
				await this.projects.ensureHub();
				await this.openAndFocus(index);
			},
			(name) => this.projects.validateName(name),
		).open();
	}

	/** Opens the note in a new tab with the cursor at the end */
	private async openAndFocus(file: TFile): Promise<void> {
		const leaf = this.app.workspace.getLeaf('tab');
		await leaf.openFile(file, { active: true, state: { mode: 'source' } });
		this.app.workspace.setActiveLeaf(leaf, { focus: true });
		if (leaf.view instanceof MarkdownView) {
			const { editor } = leaf.view;
			editor.focus();
			editor.setCursor(editor.lastLine(), 0);
		}
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
		this.projects.refresh();
		this.rebuildSoon();
	}

	/** Saves the project filter; it only changes what is shown, so no rebuild */
	async saveFilter() {
		await this.saveData(this.settings);
		this.projects.refresh();
	}
}
