import { Component, setIcon } from 'obsidian';
import type SyncDevPlugin from '../main';

/** "Projects" dropdown with a checkbox per project, shared by every tab */
export class ProjectFilter extends Component {
	private labelEl!: HTMLElement;
	private popoverEl!: HTMLElement;

	constructor(
		private plugin: SyncDevPlugin,
		private parent: HTMLElement,
	) {
		super();
	}

	onload(): void {
		const wrapper = this.parent.createDiv({ cls: 'syncdev-filter' });
		const button = wrapper.createEl('button', { cls: 'syncdev-filter-button' });
		setIcon(button.createSpan({ cls: 'syncdev-tab-icon' }), 'filter');
		this.labelEl = button.createSpan();
		setIcon(button.createSpan({ cls: 'syncdev-tab-icon' }), 'chevron-down');
		this.popoverEl = wrapper.createDiv({ cls: 'syncdev-filter-popover' });
		this.popoverEl.hide();

		button.addEventListener('click', () => {
			this.popoverEl.toggle(!this.popoverEl.isShown());
		});
		this.registerDomEvent(activeDocument, 'click', (evt) => {
			if (!wrapper.contains(evt.target as Node)) this.popoverEl.hide();
		});
		this.registerEvent(this.plugin.projects.on('changed', () => this.render()));
		this.render();
	}

	private render(): void {
		const { settings, projects } = this.plugin;
		const list = projects.list();
		const shown = list.filter((p) => !settings.hiddenProjects.includes(p.name));
		this.labelEl.setText(
			shown.length === list.length && settings.showUnassigned
				? 'All projects'
				: `${shown.length} of ${list.length} projects`,
		);

		const pop = this.popoverEl;
		pop.empty();
		if (list.length === 0) {
			pop.createDiv({
				cls: 'syncdev-empty',
				text: `Create a folder in ${projects.root()} to add a project`,
			});
		}
		for (const project of list) {
			this.renderOption(
				project.name,
				!settings.hiddenProjects.includes(project.name),
				(checked) => {
					settings.hiddenProjects = checked
						? settings.hiddenProjects.filter((n) => n !== project.name)
						: [...settings.hiddenProjects, project.name];
				},
				project.color,
			);
		}
		pop.createDiv({ cls: 'syncdev-filter-separator' });
		this.renderOption('No project', settings.showUnassigned, (checked) => {
			settings.showUnassigned = checked;
		});
	}

	private renderOption(
		label: string,
		checked: boolean,
		onChange: (checked: boolean) => void,
		color?: string,
	): void {
		const row = this.popoverEl.createEl('label', { cls: 'syncdev-filter-option' });
		const checkbox = row.createEl('input', { type: 'checkbox' });
		checkbox.checked = checked;
		if (color) {
			row
				.createSpan({ cls: 'syncdev-project-dot' })
				.setCssProps({ '--syncdev-project-color': `var(${color})` });
		}
		row.appendText(label);
		checkbox.addEventListener('change', () => {
			onChange(checkbox.checked);
			void this.plugin.saveFilter();
		});
	}
}
