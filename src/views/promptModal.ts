import { App, Modal, Setting } from 'obsidian';

/** Asks for a single line of text */
export class PromptModal extends Modal {
	private text = '';

	constructor(
		app: App,
		title: string,
		private placeholder: string,
		private submitText: string,
		private onSubmit: (text: string) => Promise<void>,
		/** Returns an error message, or null when the text is valid */
		private validate: (text: string) => string | null = (text) =>
			text.trim() ? null : 'Enter some text',
	) {
		super(app);
		this.setTitle(title);
	}

	onOpen() {
		let errorEl: HTMLElement | null = null;
		const showError = (message: string | null) => {
			errorEl?.setText(message ?? '');
			errorEl?.toggle(message !== null);
		};
		const submit = () => {
			const error = this.validate(this.text);
			if (error) {
				showError(error);
				return;
			}
			this.close();
			void this.onSubmit(this.text.trim());
		};

		new Setting(this.contentEl).addText((text) => {
			text.setPlaceholder(this.placeholder).onChange((value) => {
				this.text = value;
				// Only flag problems once something is typed
				showError(value.trim() ? this.validate(value) : null);
			});
			text.inputEl.addClass('syncdev-modal-input');
			text.inputEl.addEventListener('keydown', (evt) => {
				if (evt.key !== 'Enter' || evt.isComposing) return;
				// Without this, focus returns to the button that opened the modal
				// and the same Enter clicks it again, reopening the modal
				evt.preventDefault();
				submit();
			});
			window.setTimeout(() => text.inputEl.focus(), 0);
		});

		errorEl = this.contentEl.createDiv({ cls: 'syncdev-modal-error' });
		errorEl.hide();

		new Setting(this.contentEl).addButton((btn) =>
			btn.setButtonText(this.submitText).setCta().onClick(submit),
		);
	}

	onClose() {
		this.contentEl.empty();
	}
}
