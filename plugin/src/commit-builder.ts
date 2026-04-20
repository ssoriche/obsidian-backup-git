export interface FileDiffStat {
    path: string;
    additions: number;
    deletions: number;
    netChange: number;
}

export interface CommitMessageOptions {
    files: FileDiffStat[];
    maxFiles?: number;
}

export function buildCommitMessage(options: CommitMessageOptions): string {
    const { files, maxFiles = 5 } = options;

    if (files.length === 0) {
        return 'chore: update files';
    }

    // Sort files alphabetically for consistent ordering
    const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

    // Format file names with [DELETES] marker if net negative
    const formattedFiles = sortedFiles.map((stat) => formatFileName(stat));

    // Build the file list portion
    let fileList: string;
    if (formattedFiles.length <= maxFiles) {
        fileList = formattedFiles.join(', ');
    } else {
        const shown = formattedFiles.slice(0, maxFiles);
        const remaining = formattedFiles.length - maxFiles;
        fileList = `${shown.join(', ')} and ${remaining.toString()} more`;
    }

    return `chore: update ${fileList}`;
}

export function hasNetDeletions(stat: FileDiffStat): boolean {
    return stat.netChange < 0;
}

export function formatFileName(stat: FileDiffStat): string {
    return hasNetDeletions(stat) ? `${stat.path} [DELETES]` : stat.path;
}

export interface FileGroup {
    hidden: FileDiffStat[];
    regular: FileDiffStat[];
}

export function categorizeFiles(files: FileDiffStat[]): FileGroup {
    const hidden: FileDiffStat[] = [];
    const regular: FileDiffStat[] = [];

    for (const file of files) {
        // Check if any part of the path is hidden (starts with .)
        const pathParts = file.path.split('/');
        const isHidden = pathParts.some((part) => part.startsWith('.'));

        if (isHidden) {
            hidden.push(file);
        } else {
            regular.push(file);
        }
    }

    return { hidden, regular };
}

export function buildSingleFileCommitMessage(stat: FileDiffStat): string {
    const fileName = formatFileName(stat);
    return `chore: update ${fileName}`;
}

export function buildHiddenFilesCommitMessage(files: FileDiffStat[]): string {
    if (files.length === 0) {
        return 'chore: update hidden files';
    }

    const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
    const formattedFiles = sortedFiles.map((stat) => formatFileName(stat));

    const fileList = formattedFiles.join(', ');
    return `chore: update hidden files (${fileList})`;
}
