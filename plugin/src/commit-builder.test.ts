import { describe, it, expect } from 'vitest';
import { buildCommitMessage } from './commit-builder';
import type { FileDiffStat } from './commit-builder';

describe('buildCommitMessage', () => {
    it('generates message for single file', () => {
        const files: FileDiffStat[] = [
            { path: 'note.md', additions: 5, deletions: 2, netChange: 3 },
        ];
        const result = buildCommitMessage({ files });
        expect(result).toBe('chore: update note.md');
    });

    it('generates message for multiple files', () => {
        const files: FileDiffStat[] = [
            { path: 'note1.md', additions: 5, deletions: 2, netChange: 3 },
            { path: 'note2.md', additions: 10, deletions: 0, netChange: 10 },
        ];
        const result = buildCommitMessage({ files });
        expect(result).toBe('chore: update note1.md, note2.md');
    });

    it('marks files with net deletions', () => {
        const files: FileDiffStat[] = [
            { path: 'deleted.md', additions: 2, deletions: 10, netChange: -8 },
        ];
        const result = buildCommitMessage({ files });
        expect(result).toBe('chore: update deleted.md [DELETES]');
    });

    it('handles mix of additions and deletions', () => {
        const files: FileDiffStat[] = [
            { path: 'added.md', additions: 10, deletions: 2, netChange: 8 },
            { path: 'deleted.md', additions: 1, deletions: 20, netChange: -19 },
        ];
        const result = buildCommitMessage({ files });
        expect(result).toBe('chore: update added.md, deleted.md [DELETES]');
    });

    it('truncates long file lists', () => {
        const files: FileDiffStat[] = Array.from({ length: 10 }, (_, i) => ({
            path: `file${i.toString()}.md`,
            additions: 1,
            deletions: 0,
            netChange: 1,
        }));
        const result = buildCommitMessage({ files, maxFiles: 3 });
        expect(result).toBe('chore: update file0.md, file1.md, file2.md and 7 more');
    });

    it('sorts files alphabetically', () => {
        const files: FileDiffStat[] = [
            { path: 'zebra.md', additions: 1, deletions: 0, netChange: 1 },
            { path: 'apple.md', additions: 1, deletions: 0, netChange: 1 },
            { path: 'banana.md', additions: 1, deletions: 0, netChange: 1 },
        ];
        const result = buildCommitMessage({ files });
        expect(result).toBe('chore: update apple.md, banana.md, zebra.md');
    });

    it('handles empty file list', () => {
        const files: FileDiffStat[] = [];
        const result = buildCommitMessage({ files });
        expect(result).toBe('chore: update files');
    });

    it('handles files with zero net change', () => {
        const files: FileDiffStat[] = [
            { path: 'unchanged.md', additions: 10, deletions: 10, netChange: 0 },
        ];
        const result = buildCommitMessage({ files });
        expect(result).toBe('chore: update unchanged.md');
    });

    it('respects custom maxFiles parameter', () => {
        const files: FileDiffStat[] = Array.from({ length: 8 }, (_, i) => ({
            path: `file${i.toString()}.md`,
            additions: 1,
            deletions: 0,
            netChange: 1,
        }));
        const result = buildCommitMessage({ files, maxFiles: 2 });
        expect(result).toBe('chore: update file0.md, file1.md and 6 more');
    });
});
