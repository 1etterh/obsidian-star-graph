export type SortOrder = 'newest' | 'oldest';

/** Checkbox state; plain markdown has only these two */
export type TaskStatus = 'todo' | 'done';

export interface Task {
	path: string;
	/** 0-based line number in the file */
	line: number;
	/** Original line, used to detect stale writes */
	raw: string;
	/** Description without checkbox and date markers */
	text: string;
	status: TaskStatus;
	/** Dates are stored as YYYY-MM-DD strings */
	created?: string;
	scheduled?: string;
	due?: string;
	completed?: string;
	/** Trailing ^block id, used as a stable identity */
	blockId?: string;
	/** Date of the daily note this task lives in, if any */
	dailyDate?: string;
	/** Fallback sort key: file creation time (ms) */
	fileCtime: number;
}
