import { setIcon } from 'obsidian';

/**
 * A `+` button plus a hidden input line. The button opens and focuses the input;
 * Enter submits and keeps it open for the next task; Escape, or leaving it empty,
 * closes it. The caller places the input, so it can sit above a list that re-renders.
 */
export function createTaskComposer(
	buttonParent: HTMLElement,
	inputParent: HTMLElement,
	label: string,
	onSubmit: (text: string) => void,
): HTMLInputElement {
	const button = buttonParent.createEl('button', {
		cls: 'clickable-icon syncdev-column-add',
		attr: { 'aria-label': label },
	});
	setIcon(button, 'plus');

	const input = inputParent.createEl('input', {
		type: 'text',
		cls: 'syncdev-add syncdev-composer',
		placeholder: `${label}…`,
	});
	input.hide();
	const close = () => {
		input.value = '';
		input.hide();
	};

	button.addEventListener('click', () => {
		input.show();
		input.focus();
	});
	input.addEventListener('keydown', (evt) => {
		if (evt.key === 'Escape') {
			evt.preventDefault();
			close();
			return;
		}
		// Skip Enter while an IME (e.g. Korean) is still composing
		if (evt.key !== 'Enter' || evt.isComposing) return;
		evt.preventDefault();
		const text = input.value.trim();
		if (!text) return;
		input.value = '';
		onSubmit(text);
	});
	input.addEventListener('blur', () => {
		if (!input.value.trim()) close();
	});
	return input;
}
