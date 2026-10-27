/** Prefix of block ids SyncDev adds, so its own links can be recognised */
export const BLOCK_PREFIX = 'sd-';

export function newBlockId(): string {
	return BLOCK_PREFIX + Math.random().toString(36).slice(2, 8);
}
