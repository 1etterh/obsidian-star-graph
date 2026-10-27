export type SortOrder = 'newest' | 'oldest';

export interface Task {
	path: string;
	/** 0-based line number in the file */
	line: number;
	/** Original line, used to detect stale writes */
	raw: string;
	/** Description without checkbox and date markers */
	text: string;
	done: boolean;
	/** Dates are stored as YYYY-MM-DD strings */
	created?: string;
	scheduled?: string;
	due?: string;
	/** Date of the daily note this task lives in, if any */
	dailyDate?: string;
	/** Fallback sort key: file creation time (ms) */
	fileCtime: number;
}
