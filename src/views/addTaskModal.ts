import { App, Modal, Setting } from 'obsidian';

export class AddTaskModal extends Modal {
	private text = '';

	constructor(
		app: App,
		private onSubmit: (text: string) => Promise<void>,
	) {
		super(app);
		this.setTitle('Add task to today');
	}

	onOpen() {
		const submit = () => {
			if (!this.text.trim()) return;
			this.close();
			void this.onSubmit(this.text);
		};

		new Setting(this.contentEl).addText((text) => {
			text.setPlaceholder('What needs doing?').onChange((value) => {
				this.text = value;
			});
			text.inputEl.addClass('syncdev-modal-input');
			text.inputEl.addEventListener('keydown', (evt) => {
				if (evt.key === 'Enter' && !evt.isComposing) submit();
			});
			window.setTimeout(() => text.inputEl.focus(), 0);
		});

		new Setting(this.contentEl).addButton((btn) =>
			btn.setButtonText('Add').setCta().onClick(submit),
		);
	}

	onClose() {
		this.contentEl.empty();
	}
}
