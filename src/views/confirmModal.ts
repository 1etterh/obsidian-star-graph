import { App, Modal, Setting } from 'obsidian';

export class ConfirmModal extends Modal {
	constructor(
		app: App,
		title: string,
		private message: string,
		private confirmText: string,
		private onConfirm: () => void,
	) {
		super(app);
		this.setTitle(title);
	}

	onOpen() {
		this.contentEl.createEl('p', { text: this.message });
		new Setting(this.contentEl)
			.addButton((btn) => btn.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((btn) =>
				btn
					.setButtonText(this.confirmText)
					.setCta()
					.onClick(() => {
						this.close();
						this.onConfirm();
					}),
			);
	}

	onClose() {
		this.contentEl.empty();
	}
}
