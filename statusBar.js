'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

class StatusBarManager {
    /** @param {import('vscode').ExtensionContext} context */
    constructor(context) {
        this._context = context;

        this._statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            Number.MAX_SAFE_INTEGER
        );
        this._statusBarItem.text = '$(link) .ws';
        this._statusBarItem.tooltip = 'Open workspace file as JSONC';
        this._statusBarItem.command = 'ws-edit.openAsJsonc';

        this._closeDisposable = null;
        this._jsoncPath = null;
        this._symlinkTarget = null;

        const commandDisposable = vscode.commands.registerCommand(
            'ws-edit.openAsJsonc',
            () => this.openAsJsonc()
        );

        context.subscriptions.push(this._statusBarItem, commandDisposable);
    }

    initialize() {
        const wsFile = vscode.workspace.workspaceFile;
        if (!wsFile) {
            this._statusBarItem.hide();
            return;
        }

        const wsPath = wsFile.fsPath;
        const jsoncPath = wsPath + '.jsonc';

        const alreadyOpen = vscode.window.tabGroups.all.some(group =>
            group.tabs.some(tab => {
                const input = tab.input;
                return input instanceof vscode.TabInputText &&
                    input.uri.fsPath === jsoncPath;
            })
        );

        if (alreadyOpen) {
            this._statusBarItem.hide();
            this._watchForClose(jsoncPath, path.basename(wsPath));
            return;
        }

        if (this._exists(jsoncPath)) {
            vscode.workspace.openTextDocument(jsoncPath).then(doc => {
                vscode.window.showTextDocument(doc);
                this._statusBarItem.hide();
                this._watchForClose(jsoncPath, path.basename(wsPath));
            });
            return;
        }

        this._statusBarItem.show();
    }

    async openAsJsonc() {
        const wsFile = vscode.workspace.workspaceFile;
        if (!wsFile) {
            return;
        }

        const wsPath = wsFile.fsPath;
        const jsoncPath = wsPath + '.jsonc';
        const symlinkTarget = path.basename(wsPath);

        let createdSymlink = false;

        if (!this._exists(jsoncPath)) {
            try {
                fs.symlinkSync(symlinkTarget, jsoncPath, 'file');
                createdSymlink = true;
            } catch (err) {
                vscode.window.showErrorMessage(
                    `WS Edit: Could not create symlink at "${jsoncPath}": ${err.message}. ` +
                    'Please file an issue at github.com/cyberclast/ws-edit/issues'
                );
                return;
            }
        }

        try {
            const doc = await vscode.workspace.openTextDocument(jsoncPath);
            await vscode.window.showTextDocument(doc);
        } catch (err) {
            if (createdSymlink) {
                this._deleteFile(jsoncPath, symlinkTarget);
            }
            vscode.window.showErrorMessage(
                `WS Edit: Could not open "${jsoncPath}": ${err.message}`
            );
            return;
        }

        this._statusBarItem.hide();
        this._watchForClose(jsoncPath, symlinkTarget);
    }

    /**
     * @param {string} jsoncPath
     * @param {string} symlinkTarget
     */
    _watchForClose(jsoncPath, symlinkTarget) {
        this._jsoncPath = jsoncPath;
        this._symlinkTarget = symlinkTarget;

        if (this._closeDisposable) {
            this._closeDisposable.dispose();
            this._closeDisposable = null;
        }

        // VS Code may resolve the symlink, so match against both the symlink
        // path and the real path (the .code-workspace file).
        let resolvedPath = jsoncPath;
        try { resolvedPath = fs.realpathSync(jsoncPath); } catch { /* ignore */ }
        const pathsToMatch = new Set([jsoncPath, resolvedPath]);

        // onDidCloseTextDocument is unreliable (VS Code keeps documents in
        // memory after tab close). Use the Tab API instead, which fires as
        // soon as the tab is removed from the UI.
        this._closeDisposable = vscode.window.tabGroups.onDidChangeTabs(e => {
            const closed = e.closed.some(tab => {
                const input = tab.input;
                return input instanceof vscode.TabInputText &&
                    pathsToMatch.has(input.uri.fsPath);
            });
            if (closed) {
                this._deleteFile(jsoncPath, symlinkTarget);
                this._statusBarItem.show();
                if (this._closeDisposable) {
                    this._closeDisposable.dispose();
                    this._closeDisposable = null;
                }
            }
        });
    }

    /**
     * @param {string} p
     * @returns {boolean}
     */
    _exists(p) {
        try {
            fs.lstatSync(p);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @param {string} p
     * @param {string} expectedTarget
     */
    _deleteFile(p, expectedTarget) {
        try {
            const target = fs.readlinkSync(p);
            if (target === expectedTarget) {
                fs.unlinkSync(p);
            }
        } catch (err) {
            console.log(`ws-edit: could not delete "${p}":`, err.message);
        }
    }

    dispose() {
        try {
            if (this._jsoncPath && this._symlinkTarget) {
                this._deleteFile(this._jsoncPath, this._symlinkTarget);
            }
        } catch {
            // swallow
        }
        if (this._closeDisposable) {
            this._closeDisposable.dispose();
            this._closeDisposable = null;
        }
    }
}

module.exports = { StatusBarManager };
