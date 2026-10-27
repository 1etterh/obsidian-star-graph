import { Component, ItemView, setIcon, ViewStateResult, WorkspaceLeaf } from 'obsidian';
import { SYNCDEV_ICON } from '../icon';
import type SyncDevPlugin from '../main';
import { CalendarPanel } from './calendarPanel';
import { KanbanPanel } from './kanbanPanel';

export const SYNCDEV_VIEW_TYPE = 'syncdev';

export type SyncDevTab = 'kanban' | 'calendar';

const TABS: { id: SyncDevTab; label: string; icon: string }[] = [
	{ id: 'kanban', label: 'Kanban', icon: 'square-kanban' },
	{ id: 'calendar', label: 'Calendar', icon: 'calendar-days' },
];

interface SyncDevViewState extends Record<string, unknown> {
	tab?: SyncDevTab;
}

function isTab(value: unknown): value is SyncDevTab {
	return TABS.some((t) => t.id === value);
}

/** One main-area tab holding the kanban and calendar panels */
export class SyncDevView extends ItemView {
	private tab: SyncDevTab = 'kanban';
	private tabEls = new Map<SyncDevTab, HTMLElement>();
	private panelEl!: HTMLElement;
	private panel: Component | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: SyncDevPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return SYNCDEV_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'SyncDev';
	}

	getIcon(): string {
		return SYNCDEV_ICON;
	}

	getState(): SyncDevViewState {
		return { ...super.getState(), tab: this.tab };
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const tab = (state as SyncDevViewState | null)?.tab;
		if (isTab(tab)) this.showTab(tab);
		await super.setState(state, result);
	}

	async onOpen(): Promise<void> {
		const root = this.contentEl;
		root.empty();
		root.addClass('syncdev-view');

		const bar = root.createDiv({ cls: 'syncdev-tabs' });
		for (const { id, label, icon } of TABS) {
			const el = bar.createDiv({ cls: 'syncdev-tab' });
			setIcon(el.createSpan({ cls: 'syncdev-tab-icon' }), icon);
			el.createSpan({ text: label });
			el.addEventListener('click', () => {
				this.showTab(id);
				// Persist the tab in the workspace layout
				this.app.workspace.requestSaveLayout();
			});
			this.tabEls.set(id, el);
		}
		this.panelEl = root.createDiv({ cls: 'syncdev-panel' });

		this.showTab(this.tab, true);
	}

	/** Swaps the panel; panels are rebuilt on every switch to keep them simple */
	showTab(tab: SyncDevTab, force = false): void {
		if (!this.panelEl || (tab === this.tab && !force)) {
			this.tab = tab;
			return;
		}
		this.tab = tab;
		for (const [id, el] of this.tabEls) el.toggleClass('is-active', id === tab);

		if (this.panel) this.removeChild(this.panel);
		this.panelEl.empty();
		this.panel = this.addChild(this.createPanel(tab));
	}

	private createPanel(tab: SyncDevTab): Component {
		switch (tab) {
			case 'kanban':
				return new KanbanPanel(this.plugin, this.panelEl);
			case 'calendar':
				return new CalendarPanel(this.plugin, this.panelEl);
		}
	}
}
