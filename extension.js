'use strict';

const { StatusBarManager } = require('./statusBar');

/** @type {StatusBarManager} */
let statusBarManager;

/**
 * @param {import('vscode').ExtensionContext} context
 */
function activate(context) {
    statusBarManager = new StatusBarManager(context);
    statusBarManager.initialize();

    context.subscriptions.push(
        require('vscode').workspace.onDidChangeWorkspaceFolders(() => {
            statusBarManager.initialize();
        })
    );
}

function deactivate() {
    if (statusBarManager) {
        statusBarManager.dispose();
    }
}

module.exports = { activate, deactivate };
