import { addIcon } from 'obsidian';

export const SYNCDEV_ICON = 'syncdev';

// Drawn on a 24 grid like Lucide and scaled to the 100 viewBox addIcon expects.
// No stroke-width, so it inherits --icon-stroke and matches the built-in icons.
const SVG = `<g transform="scale(4.1667)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
<circle cx="12" cy="12" r="10"/>
<path d="M12 1v22"/>
<path d="M12 6.5A5.5 5.5 0 0 0 12 17.5"/>
<path d="M17.5 9.5A3.5 3.5 0 1 0 17.5 14.5"/>
</g>`;

export function registerIcons(): void {
	addIcon(SYNCDEV_ICON, SVG);
}
