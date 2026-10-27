import { Component, moment, setIcon } from 'obsidian';
import { DATE_FORMAT, getDailyNoteConfig, getOrCreateDailyNote } from '../core/dailyNotes';
import { sortTasks } from '../core/sort';
import type SyncDevPlugin from '../main';
import type { Task } from '../types';
import { openTask, renderTaskRow, TaskRowHandlers } from './taskRow';

// Six weeks always fit any month and keep the grid height stable
const GRID_DAYS = 42;

/**
 * The day a task shows up on: done tasks on their completion date,
 * open ones on scheduled, then due, then their daily note date.
 */
function calendarDate(task: Task): string | undefined {
	if (task.status === 'done' && task.completed) return task.completed;
	return task.scheduled ?? task.due ?? task.dailyDate;
}

/** Month grid with the selected day's tasks, shown in the Calendar tab */
export class CalendarPanel extends Component {
	private month = moment().startOf('month');
	private selected = moment().format(DATE_FORMAT);
	private titleEl!: HTMLElement;
	private gridEl!: HTMLElement;
	private dayTitleEl!: HTMLElement;
	private addInput!: HTMLInputElement;
	private dayListEl!: HTMLElement;
	private renderToken = 0;
	/** Owns the markdown children of the current day list, replaced on each render */
	private dayComponent: Component | null = null;

	constructor(
		private plugin: SyncDevPlugin,
		private containerEl: HTMLElement,
	) {
		super();
	}

	onload(): void {
		const root = this.containerEl.createDiv({ cls: 'syncdev-calendar' });

		this.renderHeader(root);
		this.gridEl = root.createDiv({ cls: 'syncdev-calendar-grid' });
		this.renderDayPanel(root.createDiv({ cls: 'syncdev-day' }));

		this.registerEvent(
			this.plugin.index.on('updated', () => void this.render()),
		);
		void this.render();
	}

	private renderHeader(root: HTMLElement): void {
		const header = root.createDiv({ cls: 'syncdev-calendar-header' });
		this.titleEl = header.createEl('h2', { cls: 'syncdev-title' });

		const nav = header.createDiv({ cls: 'syncdev-calendar-nav' });
		const button = (icon: string, label: string, onClick: () => void) => {
			const el = nav.createEl('button', {
				cls: 'clickable-icon',
				attr: { 'aria-label': label },
			});
			setIcon(el, icon);
			el.addEventListener('click', onClick);
		};
		button('chevron-left', 'Previous month', () => this.shiftMonth(-1));
		nav.createEl('button', { text: 'Today' }).addEventListener('click', () => {
			this.month = moment().startOf('month');
			this.selected = moment().format(DATE_FORMAT);
			void this.render();
		});
		button('chevron-right', 'Next month', () => this.shiftMonth(1));
	}

	private shiftMonth(delta: number): void {
		this.month = this.month.clone().add(delta, 'month');
		void this.render();
	}

	private groupByDate(): Map<string, Task[]> {
		const groups = new Map<string, Task[]>();
		for (const task of this.plugin.index.all()) {
			const date = calendarDate(task);
			if (!date) continue;
			const list = groups.get(date) ?? [];
			list.push(task);
			groups.set(date, list);
		}
		return groups;
	}

	private async render(): Promise<void> {
		const groups = this.groupByDate();
		this.titleEl.setText(this.month.format('MMMM YYYY'));
		this.renderGrid(groups);
		const date = moment(this.selected, DATE_FORMAT);
		this.dayTitleEl.setText(date.format('dddd, MMMM D'));
		this.addInput.placeholder = `Add a task to ${this.selected}…`;
		await this.renderDayList(groups.get(this.selected) ?? []);
	}

	private renderGrid(groups: Map<string, Task[]>): void {
		const grid = this.gridEl;
		grid.empty();

		// weekdaysMin(true) follows the locale's first day of the week, as does startOf('week')
		for (const name of moment.weekdaysMin(true)) {
			grid.createDiv({ cls: 'syncdev-weekday', text: name });
		}

		const today = moment().format(DATE_FORMAT);
		const day = this.month.clone().startOf('week');
		for (let i = 0; i < GRID_DAYS; i++, day.add(1, 'day')) {
			const date = day.format(DATE_FORMAT);
			const tasks = groups.get(date) ?? [];
			const open = tasks.filter((t) => t.status !== 'done').length;
			const done = tasks.length - open;

			const cell = grid.createDiv({ cls: 'syncdev-cell' });
			cell.toggleClass('is-outside', !day.isSame(this.month, 'month'));
			cell.toggleClass('is-today', date === today);
			cell.toggleClass('is-selected', date === this.selected);
			cell.createDiv({ cls: 'syncdev-cell-day', text: day.format('D') });

			const counts = cell.createDiv({ cls: 'syncdev-cell-counts' });
			if (open > 0) {
				counts.createSpan({ cls: 'syncdev-badge', text: String(open) });
			}
			if (done > 0) {
				counts.createSpan({ cls: 'syncdev-badge is-done', text: `✓${done}` });
			}

			cell.addEventListener('click', () => {
				this.selected = date;
				// Picking a day from a neighbouring month moves the calendar there
				const picked = moment(date, DATE_FORMAT);
				if (!picked.isSame(this.month, 'month')) {
					this.month = picked.startOf('month');
				}
				void this.render();
			});
		}
	}

	private renderDayPanel(panel: HTMLElement): void {
		const header = panel.createDiv({ cls: 'syncdev-day-header' });
		this.dayTitleEl = header.createEl('h3');
		const openNote = header.createEl('a', {
			cls: 'syncdev-source',
			text: 'Open daily note',
		});
		openNote.addEventListener(
			'click',
			() => void this.openDailyNote(moment(this.selected, DATE_FORMAT)),
		);

		// Kept across renders so focus survives the re-render after adding
		this.addInput = panel.createEl('input', { type: 'text', cls: 'syncdev-add' });
		this.addInput.addEventListener('keydown', (evt) => {
			// Skip Enter while an IME (e.g. Korean) is still composing
			if (evt.key !== 'Enter' || evt.isComposing) return;
			const text = this.addInput.value.trim();
			if (!text) return;
			this.addInput.value = '';
			void this.plugin.writer.addToDaily(text, moment(this.selected, DATE_FORMAT));
		});

		this.dayListEl = panel.createDiv({ cls: 'syncdev-list' });
	}

	private async renderDayList(tasks: Task[]): Promise<void> {
		// Markdown rendering is async; drop renders superseded by a newer one
		const token = ++this.renderToken;
		const component = this.addChild(new Component());

		// Open tasks first, then done
		const sorted = sortTasks(tasks, 'oldest').sort(
			(a, b) => Number(a.status === 'done') - Number(b.status === 'done'),
		);
		const list = createDiv({ cls: 'syncdev-list' });
		if (sorted.length === 0) {
			list.createDiv({ cls: 'syncdev-empty', text: 'No tasks' });
		}
		for (const task of sorted) {
			await renderTaskRow(this.plugin.app, list, task, component, this.rowHandlers);
			if (token !== this.renderToken) {
				this.removeChild(component);
				return;
			}
		}

		this.dayListEl.replaceWith(list);
		this.dayListEl = list;
		if (this.dayComponent) this.removeChild(this.dayComponent);
		this.dayComponent = component;
	}

	private async openDailyNote(date: moment.Moment): Promise<void> {
		const file = await getOrCreateDailyNote(
			this.plugin.app,
			getDailyNoteConfig(this.plugin.app, this.plugin.settings),
			date,
		);
		await this.plugin.app.workspace.getLeaf(false).openFile(file);
	}

	private rowHandlers: TaskRowHandlers = {
		toggle: (task) => void this.plugin.writer.toggle(task),
		move: (task, status) => void this.plugin.writer.setStatus(task, status),
		open: (task) => void openTask(this.plugin.app, task),
	};
}
