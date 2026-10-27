export type SortOrder = 'newest' | 'oldest';

export type TaskStatus = 'todo' | 'doing' | 'done';

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
	/** Tags on the line, without '#' */
	tags: string[];
	/** Date of the daily note this task lives in, if any */
	dailyDate?: string;
	/** Fallback sort key: file creation time (ms) */
	fileCtime: number;
}

export interface Project {
	/** Folder name, shown in the UI */
	name: string;
	folder: string;
	/** Tag that assigns a task to this project, without '#' */
	tag: string;
	/** CSS color variable used to tell projects apart */
	color: string;
}
