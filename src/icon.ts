import { addIcon } from 'obsidian';

export const SYNCDEV_ICON = 'syncdev';

// A window with </> (icons/E-window-code.svg). Drawn on a 24 grid like Lucide and scaled to the 100 viewBox addIcon expects.
// No stroke-width, so it inherits --icon-stroke and matches the built-in icons.
const SVG = `<g transform="scale(4.1667)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
<rect x="3" y="3.5" width="18" height="17" rx="3.5"/>
<path d="M3 8h18"/>
<path d="M9.5 11.5 7 14.25 9.5 17M14.5 11.5 17 14.25 14.5 17M13 11l-2 6.5"/>
</g>`;

export function registerIcons(): void {
	addIcon(SYNCDEV_ICON, SVG);
}
