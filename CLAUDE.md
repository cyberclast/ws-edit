# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Extension overview

**ws-edit** — a VS Code extension that adds a `$(link) WS` status bar button whenever a `.code-workspace` file is open as a workspace (i.e. `vscode.workspace.workspaceFile` is set). Clicking the button creates a `.jsonc` symlink beside the workspace file and opens it, giving full JSONC language support (comments, schema, intellisense). The symlink is always treated as owned by the extension — it is deleted when the editor tab closes and opened in the editor on activation if left stale from a previous session.

## Commands

```bash
# Lint all JS files
npm run lint

# Package and install locally
npm run install-local
```

No automated tests — use F5 (Run Extension) in the Extension Development Host for manual testing.

## Planned file structure

```
ws-edit/
├── extension.js      # Entry point: activate / deactivate
├── statusBar.js      # StatusBarManager class
├── package.json
├── .eslintrc.json
├── .gitignore
├── CLAUDE.md
├── CHANGELOG.md
├── README.md
└── LICENSE
```

## Architecture

### `extension.js`

Entry point only. Creates `StatusBarManager`, calls `initialize()` once on activation, and wires `onDidChangeWorkspaceFolders` → `statusBarManager.initialize()`. `deactivate()` calls `statusBarManager.dispose()`.

### `statusBar.js` — `StatusBarManager` class

Owns the status bar item and all symlink lifecycle logic.

**Constructor** — creates a `StatusBarItem` (Left, priority 100), sets `text = '$(link) WS'` and `tooltip`, registers the `ws-edit.openAsJsonc` command. Pushes both to `context.subscriptions`.

**`initialize()`** — called on activation and on workspace folder changes. If no `workspaceFile`, hides button and returns. Computes `jsoncPath`. Then:

- If `jsoncPath` is already open in an editor → hide button, call `_watchForClose(jsoncPath, path.basename(wsPath))`
- If `jsoncPath` exists on disk but is NOT open → open it in an editor, hide button, call `_watchForClose(jsoncPath, path.basename(wsPath))`
- Otherwise → show button

**`openAsJsonc()`** (command handler, async) — the core flow:

1. Read `vscode.workspace.workspaceFile.fsPath` → `wsPath`
2. Compute `jsoncPath = wsPath + '.jsonc'`
3. If `jsoncPath` doesn't exist: `fs.symlinkSync(path.basename(wsPath), jsoncPath, 'file')` inside a try/catch — on failure, show error and return. If it already exists, skip creation.
4. Open with `vscode.workspace.openTextDocument(jsoncPath)` + `vscode.window.showTextDocument(doc)` inside a try/catch — on failure, delete the symlink if we just created it and return
5. Hide the button, call `_watchForClose(jsoncPath, path.basename(wsPath))`

**`_watchForClose(jsoncPath, symlinkTarget)`** — stores `jsoncPath` as `this.jsoncPath` and `symlinkTarget` as `this.symlinkTarget`, disposes any previous `closeDisposable`, registers a new `vscode.workspace.onDidCloseTextDocument` listener that calls `_deleteFile(jsoncPath, symlinkTarget)`, shows the button, and self-disposes when the matching document closes. Listener is managed manually (not pushed to `context.subscriptions`) to avoid double-dispose.

**`_exists(p)`** — `lstatSync` in a try/catch; returns bool without following symlinks.

**`_deleteFile(p, expectedTarget)`** — deletes `p` only if it is a symlink whose target matches `expectedTarget` (verified via `fs.readlinkSync`). Best-effort; errors are silently logged, never surfaced to the user.

**`dispose()`** — best-effort: calls `_deleteFile(this.jsoncPath, this.symlinkTarget)` if set, then disposes `closeDisposable`. Errors are swallowed.

## Key design decisions

- **Symlink identity check before deletion**: `_deleteFile` verifies via `fs.readlinkSync` that the `.jsonc` is a symlink pointing to `path.basename(wsPath)` before deleting. A real file or a symlink to somewhere else is left untouched.
- **Relative symlink target**: `path.basename(wsPath)` — more portable if the directory is moved.
- **`lstatSync` not `existsSync`**: checks existence without following the symlink, which matters if the target has since been deleted.
- **Symlink type `'file'`**: required on Windows; ignored on Linux/macOS.
- **Fail closed on symlink error**: if symlink creation fails, show an error and stop — no fallback copying or syncing.
- **Dispose is best-effort**: cleanup during shutdown swallows errors silently; noisy shutdown errors would be worse than a stale file.
- **Button hidden while editor is open**: the button toggles between "open editor" (visible) and "editor is open" (hidden), so there's no ambiguity about what clicking it does.
- **Single `closeDisposable`**: re-clicking the button while the tab is already open (edge case) replaces the listener rather than stacking it.

## Requirements

Claude to check / user to check

- [ ] [ ] Shows a WS button only when a `.code-workspace` is open as the current workspace
- [ ] [ ] Hides the WS button while the `.jsonc` editor is open
- [ ] [ ] Creates a `.jsonc` symlink beside the workspace file when button is clicked
- [ ] [ ] Opens the `.jsonc` file in an editor when the button is clicked
- [ ] [ ] Removes the `.jsonc` link when its editor tab is closed, only if it is a symlink pointing to the adjacent `.code-workspace` file
- [ ] [ ] Reopens a stale `.jsonc` file on activation (left from a crashed/dirty previous session) and deletes it when that editor closes
- [ ] [ ] Does not stack duplicate close listeners when the button is clicked multiple times
- [ ] [ ] Shows a clear error if the `.jsonc` symlink cannot be created (suggest filing an issue at github.com/cyberclast/ws-edit/issues)
