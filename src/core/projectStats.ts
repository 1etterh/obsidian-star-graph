import type { Task } from '../types';
import type { ProjectRegistry } from './projects';

export interface ProjectStats {
	open: number;
	done: number;
	/** Share of done tasks, 0–100 */
	percent: number;
}

export function statsOf(tasks: Task[]): ProjectStats {
	const done = tasks.filter((t) => t.status === 'done').length;
	const percent = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100);
	return { open: tasks.length - done, done, percent };
}

/** Tasks keyed by project name; tasks without a project are left out */
export function groupByProject(tasks: Task[], projects: ProjectRegistry): Map<string, Task[]> {
	const groups = new Map<string, Task[]>();
	for (const task of tasks) {
		const project = projects.projectOf(task);
		if (!project) continue;
		const list = groups.get(project.name) ?? [];
		list.push(task);
		groups.set(project.name, list);
	}
	return groups;
}
