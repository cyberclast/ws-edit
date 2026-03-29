'use strict';

const vscode = require('vscode');

class StatusBarManager {
    /** @param {import('vscode').ExtensionContext} context */
    constructor(context) {
        this._statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            Number.MAX_SAFE_INTEGER,
        );
        this._statusBarItem.text = '$(link) .ws';
        this._statusBarItem.tooltip = 'Edit this workspace as JSON';
        this._statusBarItem.command = 'ws-edit.open';

        const commandDisposable = vscode.commands.registerCommand('ws-edit.open', () => this.openAsJsonc());

        context.subscriptions.push(this._statusBarItem, commandDisposable);
    }

    initialize() {
        if (!vscode.workspace.workspaceFile) {
            this._statusBarItem.hide();
            return;
        }
        this._statusBarItem.show();
    }

    async openAsJsonc() {
        const wsFile = vscode.workspace.workspaceFile;
        if (!wsFile) {
            return;
        }

        try {
            const doc = await vscode.workspace.openTextDocument(wsFile);
            await vscode.window.showTextDocument(doc);
        } catch (err) {
            vscode.window.showErrorMessage(`WS Edit: Could not open workspace file: ${err.message}`);
        }
    }
}

module.exports = { StatusBarManager };
