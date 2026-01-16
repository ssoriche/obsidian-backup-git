import { simpleGit } from 'simple-git';
import type { SimpleGit, StatusResult, LogResult } from 'simple-git';
import type { FileDiffStat } from './commit-builder';

export interface GitEngineConfig {
    vaultPath: string;
    onStatusChange: (status: GitStatus) => void;
    onError: (error: Error) => void;
}

export interface GitStatus {
    state: 'idle' | 'committing' | 'error';
    lastCommitTime: number | null;
    lastCommitMessage: string | null;
}

export interface CommitInfo {
    hash: string;
    message: string;
    date: string;
    author: string;
}

export class GitEngine {
    private git: SimpleGit;
    private vaultPath: string;
    private config: GitEngineConfig;
    private currentStatus: GitStatus = {
        state: 'idle',
        lastCommitTime: null,
        lastCommitMessage: null,
    };

    constructor(config: GitEngineConfig) {
        this.config = config;
        this.vaultPath = config.vaultPath;
        this.git = simpleGit({
            baseDir: this.vaultPath,
            binary: 'git',
            maxConcurrentProcesses: 1,
        });
    }

    async isGitRepo(): Promise<boolean> {
        try {
            await this.git.status();
            return true;
        } catch {
            return false;
        }
    }

    async initializeRepo(): Promise<void> {
        try {
            await this.git.init();
            this.updateStatus({ state: 'idle' });
        } catch (_error) {
            this.handleError(_error as Error);
            throw _error;
        }
    }

    async getChangedFiles(): Promise<string[]> {
        try {
            const status: StatusResult = await this.git.status();

            const changedFiles = [
                ...status.not_added,
                ...status.created,
                ...status.deleted,
                ...status.modified,
                ...status.renamed.map((r) => r.to),
            ];

            return [...new Set(changedFiles)];
        } catch (_error) {
            this.handleError(_error as Error);
            throw _error;
        }
    }

    async getDiffStats(): Promise<FileDiffStat[]> {
        try {
            const stats: FileDiffStat[] = [];

            // Get status first to check if we have any commits
            const status: StatusResult = await this.git.status();

            // If no commits yet, treat all files as new
            if (!status.tracking) {
                for (const file of status.not_added) {
                    stats.push({
                        path: file,
                        additions: 0,
                        deletions: 0,
                        netChange: 0,
                    });
                }
                return stats;
            }

            // Get diff stats using git diff --numstat HEAD
            const diffOutput = await this.git.raw(['diff', '--numstat', 'HEAD']);

            // Parse output: "additions\tdeletions\tpath"
            const lines = diffOutput
                .trim()
                .split('\n')
                .filter((line) => line);

            for (const line of lines) {
                const [addStr, delStr, path] = line.split('\t');

                // Handle binary files (show as "-\t-")
                if (addStr === '-' || delStr === '-') {
                    stats.push({
                        path,
                        additions: 0,
                        deletions: 0,
                        netChange: 0,
                    });
                    continue;
                }

                const additions = parseInt(addStr, 10);
                const deletions = parseInt(delStr, 10);

                stats.push({
                    path,
                    additions,
                    deletions,
                    netChange: additions - deletions,
                });
            }

            // Include untracked files
            for (const file of status.not_added) {
                stats.push({
                    path: file,
                    additions: 0,
                    deletions: 0,
                    netChange: 0,
                });
            }

            return stats;
        } catch (_error) {
            this.handleError(_error as Error);
            throw _error;
        }
    }

    async stageAndCommit(message: string): Promise<void> {
        try {
            this.updateStatus({ state: 'committing' });

            // Stage all changes
            await this.git.add('-A');

            // Commit
            await this.git.commit(message);

            // Update status with commit info
            this.updateStatus({
                state: 'idle',
                lastCommitTime: Date.now(),
                lastCommitMessage: message,
            });
        } catch (error) {
            this.updateStatus({ state: 'error' });
            this.handleError(error as Error);
            throw error;
        }
    }

    async getLastCommitInfo(): Promise<CommitInfo | null> {
        try {
            const log: LogResult = await this.git.log({ maxCount: 1 });

            if (log.latest) {
                return {
                    hash: log.latest.hash,
                    message: log.latest.message,
                    date: log.latest.date,
                    author: log.latest.author_name,
                };
            }

            return null;
        } catch (_error) {
            this.handleError(_error as Error);
            return null;
        }
    }

    async checkGitInstalled(): Promise<boolean> {
        try {
            await this.git.raw(['--version']);
            return true;
        } catch {
            return false;
        }
    }

    private updateStatus(updates: Partial<GitStatus>): void {
        this.currentStatus = { ...this.currentStatus, ...updates };
        this.config.onStatusChange(this.currentStatus);
    }

    private handleError(error: Error): void {
        this.config.onError(error);
    }
}
