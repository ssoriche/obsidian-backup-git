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

function hasNetDeletions(stat: FileDiffStat): boolean {
    return stat.netChange < 0;
}

function formatFileName(stat: FileDiffStat): string {
    return hasNetDeletions(stat) ? `${stat.path} [DELETES]` : stat.path;
}
