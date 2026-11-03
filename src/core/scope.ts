import type { Task } from '../types';

export interface ScopeFilter {
	folders: string[];
	tags: string[];
}

/** `projects, #syncdev` → folder `projects`, tag `syncdev`; any match counts */
export function parseScopeFilter(value: string): ScopeFilter {
	const filter: ScopeFilter = { folders: [], tags: [] };
	for (const part of value.split(',').map((s) => s.trim())) {
		if (part.startsWith('#')) {
			const tag = part.slice(1).replace(/\/+$/, '').toLowerCase();
			if (tag) filter.tags.push(tag);
		} else {
			const folder = part.replace(/^\/+|\/+$/g, '');
			if (folder) filter.folders.push(folder);
		}
	}
	return filter;
}

/** A folder covers its subfolders and a tag its nested tags (#work → #work/syncdev) */
export function matchesScope(task: Task, filter: ScopeFilter): boolean {
	if (filter.folders.length === 0 && filter.tags.length === 0) return true;
	return (
		filter.folders.some((f) => task.path.startsWith(`${f}/`)) ||
		filter.tags.some((f) => task.tags.some((t) => t === f || t.startsWith(`${f}/`)))
	);
}

/** Tasks matching the filter typed above the SyncDev tabs */
export function filterTasks(tasks: Task[], value: string): Task[] {
	const filter = parseScopeFilter(value);
	return tasks.filter((t) => matchesScope(t, filter));
}
