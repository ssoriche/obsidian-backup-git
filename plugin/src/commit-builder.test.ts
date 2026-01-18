import { describe, it, expect } from 'vitest';
import {
    buildCommitMessage,
    categorizeFiles,
    buildSingleFileCommitMessage,
    buildHiddenFilesCommitMessage,
} from './commit-builder';
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

describe('categorizeFiles', () => {
    it('separates hidden and regular files', () => {
        const files: FileDiffStat[] = [
            { path: '.hidden', additions: 1, deletions: 0, netChange: 1 },
            { path: 'regular.md', additions: 1, deletions: 0, netChange: 1 },
            { path: 'folder/.config', additions: 1, deletions: 0, netChange: 1 },
            { path: 'another.md', additions: 2, deletions: 1, netChange: 1 },
        ];
        const result = categorizeFiles(files);
        expect(result.hidden).toHaveLength(2);
        expect(result.regular).toHaveLength(2);
        expect(result.hidden[0].path).toBe('.hidden');
        expect(result.hidden[1].path).toBe('folder/.config');
        expect(result.regular[0].path).toBe('regular.md');
        expect(result.regular[1].path).toBe('another.md');
    });

    it('handles all hidden files', () => {
        const files: FileDiffStat[] = [
            { path: '.env', additions: 1, deletions: 0, netChange: 1 },
            { path: '.gitignore', additions: 1, deletions: 0, netChange: 1 },
        ];
        const result = categorizeFiles(files);
        expect(result.hidden).toHaveLength(2);
        expect(result.regular).toHaveLength(0);
    });

    it('handles all regular files', () => {
        const files: FileDiffStat[] = [
            { path: 'note1.md', additions: 1, deletions: 0, netChange: 1 },
            { path: 'note2.md', additions: 1, deletions: 0, netChange: 1 },
        ];
        const result = categorizeFiles(files);
        expect(result.hidden).toHaveLength(0);
        expect(result.regular).toHaveLength(2);
    });

    it('handles empty file list', () => {
        const files: FileDiffStat[] = [];
        const result = categorizeFiles(files);
        expect(result.hidden).toHaveLength(0);
        expect(result.regular).toHaveLength(0);
    });

    it('handles nested hidden files', () => {
        const files: FileDiffStat[] = [
            { path: 'folder/subfolder/.hidden', additions: 1, deletions: 0, netChange: 1 },
            { path: '.obsidian/workspace.json', additions: 1, deletions: 0, netChange: 1 },
        ];
        const result = categorizeFiles(files);
        expect(result.hidden).toHaveLength(2);
        expect(result.regular).toHaveLength(0);
    });
});

describe('buildSingleFileCommitMessage', () => {
    it('creates message for single file', () => {
        const stat: FileDiffStat = {
            path: 'note.md',
            additions: 5,
            deletions: 2,
            netChange: 3,
        };
        expect(buildSingleFileCommitMessage(stat)).toBe('chore: update note.md');
    });

    it('includes DELETES marker for net deletions', () => {
        const stat: FileDiffStat = {
            path: 'old.md',
            additions: 1,
            deletions: 10,
            netChange: -9,
        };
        expect(buildSingleFileCommitMessage(stat)).toBe('chore: update old.md [DELETES]');
    });

    it('handles zero net change', () => {
        const stat: FileDiffStat = {
            path: 'unchanged.md',
            additions: 5,
            deletions: 5,
            netChange: 0,
        };
        expect(buildSingleFileCommitMessage(stat)).toBe('chore: update unchanged.md');
    });

    it('handles hidden files', () => {
        const stat: FileDiffStat = {
            path: '.gitignore',
            additions: 2,
            deletions: 0,
            netChange: 2,
        };
        expect(buildSingleFileCommitMessage(stat)).toBe('chore: update .gitignore');
    });
});

describe('buildHiddenFilesCommitMessage', () => {
    it('creates message for hidden files', () => {
        const files: FileDiffStat[] = [
            { path: '.env', additions: 1, deletions: 0, netChange: 1 },
            { path: '.gitignore', additions: 2, deletions: 0, netChange: 2 },
        ];
        const result = buildHiddenFilesCommitMessage(files);
        expect(result).toBe('chore: update hidden files (.env, .gitignore)');
    });

    it('sorts hidden files alphabetically', () => {
        const files: FileDiffStat[] = [
            { path: '.zshrc', additions: 1, deletions: 0, netChange: 1 },
            { path: '.bashrc', additions: 1, deletions: 0, netChange: 1 },
            { path: '.env', additions: 1, deletions: 0, netChange: 1 },
        ];
        const result = buildHiddenFilesCommitMessage(files);
        expect(result).toBe('chore: update hidden files (.bashrc, .env, .zshrc)');
    });

    it('handles single hidden file', () => {
        const files: FileDiffStat[] = [
            { path: '.gitignore', additions: 1, deletions: 0, netChange: 1 },
        ];
        const result = buildHiddenFilesCommitMessage(files);
        expect(result).toBe('chore: update hidden files (.gitignore)');
    });

    it('handles empty list', () => {
        const files: FileDiffStat[] = [];
        const result = buildHiddenFilesCommitMessage(files);
        expect(result).toBe('chore: update hidden files');
    });

    it('includes DELETES marker for files with net deletions', () => {
        const files: FileDiffStat[] = [
            { path: '.env', additions: 1, deletions: 0, netChange: 1 },
            { path: '.old', additions: 0, deletions: 10, netChange: -10 },
        ];
        const result = buildHiddenFilesCommitMessage(files);
        expect(result).toBe('chore: update hidden files (.env, .old [DELETES])');
    });

    it('handles nested hidden files', () => {
        const files: FileDiffStat[] = [
            { path: 'folder/.hidden', additions: 1, deletions: 0, netChange: 1 },
            { path: '.obsidian/workspace.json', additions: 2, deletions: 0, netChange: 2 },
        ];
        const result = buildHiddenFilesCommitMessage(files);
        expect(result).toBe(
            'chore: update hidden files (.obsidian/workspace.json, folder/.hidden)'
        );
    });
});
