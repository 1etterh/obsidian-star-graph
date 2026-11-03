import { setIcon } from 'obsidian';

/**
 * Text input that turns each entry into a chip. Enter or a comma adds the typed text,
 * Backspace on an empty input removes the last chip, and × removes one chip.
 * `onChange` gets the full list after every add or remove.
 */
export function createChipInput(
	parent: HTMLElement,
	initial: string[],
	placeholder: string,
	onChange: (values: string[]) => void,
): void {
	const values = [...initial];
	const wrap = parent.createDiv({ cls: 'syncdev-chips' });
	const chipsEl = wrap.createDiv({ cls: 'syncdev-chips-list' });
	const input = wrap.createEl('input', { type: 'text', cls: 'syncdev-chips-input' });

	const render = () => {
		chipsEl.empty();
		values.forEach((value, i) => {
			const chip = chipsEl.createSpan({ cls: 'syncdev-chip', text: value });
			chip.toggleClass('is-tag', value.startsWith('#'));
			const remove = chip.createSpan({
				cls: 'syncdev-chip-remove',
				attr: { 'aria-label': `Remove ${value}` },
			});
			setIcon(remove, 'x');
			remove.addEventListener('click', (evt) => {
				evt.stopPropagation();
				values.splice(i, 1);
				changed();
			});
		});
		input.placeholder = values.length === 0 ? placeholder : '';
	};
	const changed = () => {
		render();
		onChange([...values]);
	};
	const add = (text: string) => {
		const parts = text
			.split(',')
			.map((s) => s.trim())
			.filter((s) => s && !values.includes(s));
		if (parts.length === 0) return;
		values.push(...parts);
		changed();
	};

	input.addEventListener('keydown', (evt) => {
		// Skip keys while an IME (e.g. Korean) is still composing
		if (evt.isComposing) return;
		if (evt.key === 'Enter' || evt.key === ',') {
			evt.preventDefault();
			add(input.value);
			input.value = '';
		} else if (evt.key === 'Backspace' && input.value === '' && values.length > 0) {
			values.pop();
			changed();
		}
	});
	// Pasting `a, b` adds both at once
	input.addEventListener('input', () => {
		if (!input.value.includes(',')) return;
		add(input.value);
		input.value = '';
	});
	wrap.addEventListener('click', () => input.focus());
	render();
}
