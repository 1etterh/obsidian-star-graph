import { moment } from 'obsidian';
import type { SortOrder, Task } from '../types';
import { DATE_FORMAT } from './dailyNotes';

/** Created marker, then daily note date, then file creation date */
export function createdKey(task: Task): string {
	return (
		task.created ??
		task.dailyDate ??
		moment(task.fileCtime).format(DATE_FORMAT)
	);
}

export function sortTasks(tasks: Task[], order: SortOrder): Task[] {
	const dir = order === 'newest' ? -1 : 1;
	return [...tasks].sort((a, b) => {
		const byDate = createdKey(a).localeCompare(createdKey(b));
		if (byDate !== 0) return byDate * dir;
		// Same day: keep note order (later lines are newer)
		return (a.path.localeCompare(b.path) || a.line - b.line) * dir;
	});
}
