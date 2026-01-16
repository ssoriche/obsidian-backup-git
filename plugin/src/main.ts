import { Plugin, Notice, PluginSettingTab, Setting, TFile } from 'obsidian';
import type { App } from 'obsidian';
import { GitEngine } from './git-engine';
import type { GitStatus } from './git-engine';
import { buildCommitMessage } from './commit-builder';
import type { FileDiffStat } from './commit-builder';
import { promises as fs } from 'fs';
import * as path from 'path';

interface LocalGitSettings {
    // Auto-commit configuration
    enableIntervalCommit: boolean;
    intervalMinutes: number;
    enableIdleCommit: boolean;
    idleMinutes: number;

    // Commit message configuration
    maxFilesInCommitMessage: number;

    // UI toggles
    showRibbonIcon: boolean;
    showStatusBar: boolean;

    // Advanced
    additionalGitignorePatterns: string;
    debugLogging: boolean;
}

const DEFAULT_SETTINGS: LocalGitSettings = {
    enableIntervalCommit: true,
    intervalMinutes: 5,
    enableIdleCommit: false,
    idleMinutes: 10,
    maxFilesInCommitMessage: 5,
    showRibbonIcon: true,
    showStatusBar: true,
    additionalGitignorePatterns: '',
    debugLogging: false,
};

export default class LocalGitPlugin extends Plugin {
    settings!: LocalGitSettings;
    gitEngine: GitEngine | null = null;
    statusBarItem: HTMLElement | null = null;

    private intervalTimer: NodeJS.Timeout | null = null;
    private idleCheckTimer: NodeJS.Timeout | null = null;
    private lastEditTime: number = Date.now();
    private commitInProgress = false;
    private changeQueue = new Set<string>();
    private changeTimeout: NodeJS.Timeout | null = null;
    private suppressLocalEvents = false;

    async onload(): Promise<void> {
        await this.loadSettings();

        // Get vault path
        const vaultPath = (this.app.vault.adapter as unknown as { basePath: string }).basePath;

        // Initialize git engine
        this.gitEngine = new GitEngine({
            vaultPath,
            onStatusChange: (status: GitStatus) => {
                this.handleStatusChange(status);
            },
            onError: (error: Error) => {
                this.handleGitError(error);
            },
        });

        // Check if git is installed
        const gitInstalled = await this.gitEngine.checkGitInstalled();
        if (!gitInstalled) {
            new Notice('Git is not installed. Please install git to use Local Git Backup.', 10000);
            console.error('[Local Git] Git not found');
            return;
        }

        // Initialize git repository
        await this.initializeGit();

        // Register vault events
        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (!this.suppressLocalEvents && file instanceof TFile) {
                    this.queueFileChange(file.path);
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('create', (file) => {
                if (!this.suppressLocalEvents && file instanceof TFile) {
                    this.queueFileChange(file.path);
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('delete', (file) => {
                if (!this.suppressLocalEvents && file instanceof TFile) {
                    this.queueFileChange(file.path);
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('rename', (file, oldPath) => {
                if (!this.suppressLocalEvents && file instanceof TFile) {
                    this.queueFileChange(file.path);
                    this.queueFileChange(oldPath);
                }
            })
        );

        // Start timers
        this.startTimers();

        // Add ribbon icon
        if (this.settings.showRibbonIcon) {
            this.addRibbonIcon('git-commit', 'Commit changes', () => {
                void this.performCommit('manual');
            });
        }

        // Add status bar
        if (this.settings.showStatusBar) {
            this.statusBarItem = this.addStatusBarItem();
            this.updateStatusBar('idle', null);
        }

        // Add commands
        this.addCommand({
            id: 'commit-changes',
            name: 'Commit changes',
            callback: () => {
                void this.performCommit('manual');
            },
        });

        // Add settings tab
        this.addSettingTab(new LocalGitSettingTab(this.app, this));
    }

    onunload(): void {
        this.stopTimers();
    }

    async loadSettings(): Promise<void> {
        const data = (await this.loadData()) as Partial<LocalGitSettings> | null;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);

        // Restart timers with new settings
        this.startTimers();

        // Update UI visibility
        this.updateUIVisibility();
    }

    async saveSettingsAsync(): Promise<void> {
        await this.saveSettings();
    }

    private updateUIVisibility(): void {
        // Status bar visibility is handled by showing/hiding the element
        if (this.statusBarItem) {
            this.statusBarItem.style.display = this.settings.showStatusBar ? '' : 'none';
        }

        // Ribbon icon requires reload, notify user
        // (Obsidian doesn't support dynamic ribbon icon add/remove)
    }

    private async initializeGit(): Promise<void> {
        if (!this.gitEngine) return;

        const isRepo = await this.gitEngine.isGitRepo();

        if (!isRepo) {
            try {
                // Create .gitignore
                const vaultPath = (this.app.vault.adapter as unknown as { basePath: string })
                    .basePath;
                const gitignorePath = path.join(vaultPath, '.gitignore');
                const defaultIgnore = [
                    '.obsidian/workspace*',
                    '.obsidian/cache',
                    '.trash/',
                    '.DS_Store',
                ].join('\n');

                await fs.writeFile(gitignorePath, defaultIgnore + '\n');

                // Initialize repo
                await this.gitEngine.initializeRepo();

                // Make initial commit
                await this.gitEngine.stageAndCommit('chore: initial commit');

                new Notice('Git repository initialized');

                if (this.settings.debugLogging) {
                    console.log('[Local Git] Repository initialized');
                }
            } catch (error) {
                console.error('[Local Git] Failed to initialize repository:', error);
                new Notice(`Failed to initialize git: ${(error as Error).message}`);
            }
        }
    }

    private queueFileChange(path: string): void {
        this.changeQueue.add(path);

        if (this.changeTimeout) {
            clearTimeout(this.changeTimeout);
        }

        // Debounce: wait 2 seconds after last change
        this.changeTimeout = setTimeout(() => {
            this.lastEditTime = Date.now();
            this.changeQueue.clear();
        }, 2000);
    }

    private async performCommit(triggeredBy: string): Promise<void> {
        if (this.commitInProgress) {
            if (triggeredBy === 'manual') {
                new Notice('Commit already in progress');
            }
            return;
        }

        if (!this.gitEngine) {
            new Notice('Git engine not initialized');
            return;
        }

        this.commitInProgress = true;

        try {
            // Get changed files with diff stats
            const stats: FileDiffStat[] = await this.gitEngine.getDiffStats();

            if (stats.length === 0) {
                if (triggeredBy === 'manual') {
                    new Notice('No changes to commit');
                }
                return;
            }

            // Build commit message
            const message = buildCommitMessage({
                files: stats,
                maxFiles: this.settings.maxFilesInCommitMessage,
            });

            // Stage and commit
            await this.gitEngine.stageAndCommit(message);

            if (triggeredBy === 'manual') {
                new Notice(`Committed ${stats.length.toString()} file(s)`);
            }

            if (this.settings.debugLogging) {
                console.log(`[Local Git] Commit (${triggeredBy}): ${message}`);
            }
        } catch (error) {
            console.error('[Local Git] Commit failed:', error);

            const errorMsg = (error as Error).message;
            if (errorMsg.includes('not a git repository')) {
                new Notice('Git repository not initialized. Check plugin settings.');
            } else if (errorMsg.includes('permission denied')) {
                new Notice('Permission denied. Check file permissions.');
            } else {
                new Notice(`Commit failed: ${errorMsg}`);
            }
        } finally {
            this.commitInProgress = false;
        }
    }

    private startTimers(): void {
        this.stopTimers();

        // Interval-based commits
        if (this.settings.enableIntervalCommit) {
            const intervalMs = this.settings.intervalMinutes * 60 * 1000;
            this.intervalTimer = setInterval(() => {
                void this.performCommit('interval');
            }, intervalMs);

            if (this.settings.debugLogging) {
                console.log(
                    `[Local Git] Interval timer started: ${this.settings.intervalMinutes.toString()}m`
                );
            }
        }

        // Idle detection check (every 30 seconds)
        if (this.settings.enableIdleCommit) {
            this.idleCheckTimer = setInterval(() => {
                this.checkIdleStatus();
            }, 30 * 1000);

            if (this.settings.debugLogging) {
                console.log(
                    `[Local Git] Idle timer started: ${this.settings.idleMinutes.toString()}m`
                );
            }
        }
    }

    private checkIdleStatus(): void {
        const idleMs = this.settings.idleMinutes * 60 * 1000;
        const elapsed = Date.now() - this.lastEditTime;

        if (elapsed >= idleMs && !this.commitInProgress) {
            if (this.settings.debugLogging) {
                console.log('[Local Git] Idle timeout reached, triggering commit');
            }
            void this.performCommit('idle');
        }
    }

    private stopTimers(): void {
        if (this.intervalTimer) {
            clearInterval(this.intervalTimer);
            this.intervalTimer = null;
        }
        if (this.idleCheckTimer) {
            clearInterval(this.idleCheckTimer);
            this.idleCheckTimer = null;
        }
    }

    private handleStatusChange(status: GitStatus): void {
        this.updateStatusBar(status.state, status.lastCommitTime);
    }

    private handleGitError(error: Error): void {
        if (this.settings.debugLogging) {
            console.error('[Local Git] Git error:', error);
        }
    }

    private updateStatusBar(
        state: 'idle' | 'committing' | 'error',
        lastCommitTime?: number | null
    ): void {
        if (!this.statusBarItem) return;

        switch (state) {
            case 'idle':
                if (lastCommitTime) {
                    const ago = this.formatTimeAgo(lastCommitTime);
                    this.statusBarItem.setText(`Git: Last commit ${ago}`);
                } else {
                    this.statusBarItem.setText('Git: Ready');
                }
                this.statusBarItem.style.color = '';
                break;
            case 'committing':
                this.statusBarItem.setText('Git: Committing...');
                this.statusBarItem.style.color = '';
                break;
            case 'error':
                this.statusBarItem.setText('Git: Error');
                this.statusBarItem.style.color = 'var(--text-error)';
                break;
        }
    }

    private formatTimeAgo(timestamp: number): string {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);

        if (seconds < 60) return `${seconds.toString()}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60).toString()}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600).toString()}h ago`;
        return `${Math.floor(seconds / 86400).toString()}d ago`;
    }
}

class LocalGitSettingTab extends PluginSettingTab {
    plugin: LocalGitPlugin;

    constructor(app: App, plugin: LocalGitPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        // Auto-commit Settings
        containerEl.createEl('h2', { text: 'Auto-commit Settings' });

        new Setting(containerEl)
            .setName('Enable interval-based commits')
            .setDesc('Automatically commit changes at regular intervals')
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.enableIntervalCommit)
                    .onChange(async (value) => {
                        this.plugin.settings.enableIntervalCommit = value;
                        await this.plugin.saveSettingsAsync();
                    })
            );

        new Setting(containerEl)
            .setName('Interval (minutes)')
            .setDesc('How often to commit changes automatically')
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.intervalMinutes.toString())
                    .onChange(async (value) => {
                        const num = parseInt(value, 10);
                        if (!isNaN(num) && num > 0) {
                            this.plugin.settings.intervalMinutes = num;
                            await this.plugin.saveSettingsAsync();
                        }
                    })
            );

        new Setting(containerEl)
            .setName('Enable idle-based commits')
            .setDesc('Commit changes after a period of inactivity')
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.enableIdleCommit).onChange(async (value) => {
                    this.plugin.settings.enableIdleCommit = value;
                    await this.plugin.saveSettingsAsync();
                })
            );

        new Setting(containerEl)
            .setName('Idle time (minutes)')
            .setDesc('How long to wait after last edit before committing')
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.idleMinutes.toString())
                    .onChange(async (value) => {
                        const num = parseInt(value, 10);
                        if (!isNaN(num) && num > 0) {
                            this.plugin.settings.idleMinutes = num;
                            await this.plugin.saveSettingsAsync();
                        }
                    })
            );

        // Commit Messages
        containerEl.createEl('h2', { text: 'Commit Messages' });

        new Setting(containerEl)
            .setName('Max files in commit message')
            .setDesc(
                'Maximum number of file names to include in commit message (rest will show as "and N more")'
            )
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.maxFilesInCommitMessage.toString())
                    .onChange(async (value) => {
                        const num = parseInt(value, 10);
                        if (!isNaN(num) && num > 0) {
                            this.plugin.settings.maxFilesInCommitMessage = num;
                            await this.plugin.saveSettingsAsync();
                        }
                    })
            );

        // User Interface
        containerEl.createEl('h2', { text: 'User Interface' });

        new Setting(containerEl)
            .setName('Show ribbon icon')
            .setDesc('Show git commit icon in the left ribbon (requires reload)')
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.showRibbonIcon).onChange(async (value) => {
                    this.plugin.settings.showRibbonIcon = value;
                    await this.plugin.saveSettingsAsync();
                })
            );

        new Setting(containerEl)
            .setName('Show status bar')
            .setDesc('Show git status in the status bar')
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.showStatusBar).onChange(async (value) => {
                    this.plugin.settings.showStatusBar = value;
                    await this.plugin.saveSettingsAsync();
                })
            );

        // Advanced
        containerEl.createEl('h2', { text: 'Advanced' });

        new Setting(containerEl)
            .setName('Additional gitignore patterns')
            .setDesc('Additional patterns to ignore (one per line, will be added to .gitignore)')
            .addTextArea((text) =>
                text
                    .setValue(this.plugin.settings.additionalGitignorePatterns)
                    .onChange(async (value) => {
                        this.plugin.settings.additionalGitignorePatterns = value;
                        await this.plugin.saveSettingsAsync();
                    })
            );

        new Setting(containerEl)
            .setName('Debug logging')
            .setDesc('Enable debug logging to console')
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.debugLogging).onChange(async (value) => {
                    this.plugin.settings.debugLogging = value;
                    await this.plugin.saveSettingsAsync();
                })
            );
    }
}
