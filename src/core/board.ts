import type { Task } from '../types';

/** Kanban columns; Today is derived from the ⏳ scheduled date, not the checkbox */
export type BoardColumn = 'todo' | 'today' | 'done';

export const COLUMN_LABELS: Record<BoardColumn, string> = {
	todo: 'Todo',
	today: 'Today',
	done: 'Done',
};

/** Open tasks scheduled for today or earlier are on Today, so missed ones carry over */
export function columnOf(task: Task, today: string): BoardColumn {
	if (task.status === 'done') return 'done';
	return task.scheduled && task.scheduled <= today ? 'today' : 'todo';
}
