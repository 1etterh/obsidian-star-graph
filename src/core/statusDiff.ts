import type { Task } from '../types';

export interface StatusChange {
	before: Task;
	after: Task;
}

/**
 * Pairs tasks of one file across a re-index: by block id, otherwise by text
 * when exactly one task on each side has it. Returns pairs whose status differs.
 */
export function statusChanges(before: Task[], after: Task[]): StatusChange[] {
	const changes: StatusChange[] = [];
	const unmatched = new Set(after);
	const pair = (old: Task, next: Task) => {
		unmatched.delete(next);
		if (old.status !== next.status) changes.push({ before: old, after: next });
	};

	const byId = new Map(after.filter((t) => t.blockId).map((t) => [t.blockId, t]));
	const rest: Task[] = [];
	for (const old of before) {
		const next = old.blockId ? byId.get(old.blockId) : undefined;
		if (next) pair(old, next);
		else rest.push(old);
	}
	for (const old of rest) {
		const same = (t: Task) => t.text === old.text;
		const candidates = [...unmatched].filter(same);
		if (candidates.length === 1 && rest.filter(same).length === 1) {
			pair(old, candidates[0]!);
		}
	}
	return changes;
}
