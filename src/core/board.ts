import type { Task, TaskStatus } from '../types';

/** Kanban columns follow the checkbox */
export type BoardColumn = TaskStatus;

export const COLUMN_LABELS: Record<BoardColumn, string> = {
	todo: 'Todo',
	done: 'Done',
};

export function columnOf(task: Task): BoardColumn {
	return task.status;
}
