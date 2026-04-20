import * as vscode from 'vscode';
import * as crypto from 'crypto';

interface SavedClip {
  id: string;
  url: string;
  videoId: string;
  timestamp: number;
  note: string;
  savedAt: number;
}

class FocusTubeViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'focustube.sidebar';

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')]
    };

    webviewView.webview.html = this._buildHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.command) {
        case 'getClips':
          this._sendClips(webviewView.webview);
          break;

        case 'saveTimestamp': {
          const clips: SavedClip[] = this._context.globalState.get('focustube.clips', []);
          const clip: SavedClip = {
            id: crypto.randomUUID(),
            url: msg.data.url,
            videoId: msg.data.videoId,
            timestamp: Math.floor(msg.data.timestamp),
            note: msg.data.note || '',
            savedAt: Date.now()
          };
          clips.unshift(clip);
          await this._context.globalState.update('focustube.clips', clips);
          this._sendClips(webviewView.webview);
          break;
        }

        case 'deleteClip': {
          let clips: SavedClip[] = this._context.globalState.get('focustube.clips', []);
          clips = clips.filter((c) => c.id !== msg.id);
          await this._context.globalState.update('focustube.clips', clips);
          this._sendClips(webviewView.webview);
          break;
        }

        case 'clearAllClips': {
          await this._context.globalState.update('focustube.clips', []);
          this._sendClips(webviewView.webview);
          break;
        }

        case 'error':
          vscode.window.showErrorMessage(`FocusTube: ${msg.text}`);
          break;
      }
    });
  }

  /** Called by the "FocusTube: Save Timestamp" command. */
  public triggerSaveTimestamp(): void {
    if (!this._view) {
      vscode.window.showErrorMessage('FocusTube: Open the FocusTube panel first.');
      return;
    }
    this._view.webview.postMessage({ command: 'requestTimestamp' });
  }

  /** Called by the "FocusTube: Show Saved Clips" command. */
  public triggerShowClips(): void {
    this._view?.show(true);
    this._view?.webview.postMessage({ command: 'scrollToClips' });
  }

  private _sendClips(webview: vscode.Webview): void {
    const clips: SavedClip[] = this._context.globalState.get('focustube.clips', []);
    webview.postMessage({ command: 'updateClips', clips });
  }

  private _buildHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css')
    );
    // Nonce for inline script CSP
    const nonce = crypto.randomBytes(16).toString('hex');

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    frame-src https://www.youtube-nocookie.com https://www.youtube.com;
    script-src 'nonce-${nonce}' https://www.youtube.com https://s.ytimg.com;
    style-src ${webview.cspSource} 'unsafe-inline';
    img-src ${webview.cspSource} https: data:;
    connect-src https:;
  ">
  <link rel="stylesheet" href="${styleUri}">
  <title>FocusTube</title>
</head>
<body>
  <div id="app">

    <!-- ── URL input ── -->
    <section id="url-section">
      <div class="input-row">
        <input
          id="url-input"
          type="text"
          placeholder="Paste YouTube URL…"
          autocomplete="off"
          spellcheck="false"
          aria-label="YouTube URL"
        />
        <button id="load-btn" class="btn btn-primary" title="Load video (Enter)">▶</button>
      </div>
      <div id="url-error" class="error-msg" role="alert" aria-live="polite"></div>
    </section>

    <!-- ── Player ── -->
    <section id="player-section" class="hidden">
      <div id="player-bar">
        <span id="video-label" class="video-label" title=""></span>
        <div class="bar-actions">
          <button id="mini-btn"  class="btn btn-icon" title="Toggle mini mode">⊡</button>
          <button id="close-btn" class="btn btn-icon btn-close" title="Close video">✕</button>
        </div>
      </div>

      <div id="player-wrap">
        <div id="yt-player"></div>
      </div>

      <div id="ts-row">
        <input
          id="note-input"
          type="text"
          placeholder="Note (optional)…"
          maxlength="200"
          aria-label="Timestamp note"
        />
        <button id="save-ts-btn" class="btn btn-secondary">⚑ Save Timestamp</button>
      </div>
    </section>

    <!-- ── Saved clips ── -->
    <section id="clips-section">
      <div class="section-head">
        <span class="section-title">Saved Clips</span>
        <button id="clear-all-btn" class="btn btn-danger btn-xs hidden" title="Delete all clips">Clear all</button>
      </div>
      <div id="clips-list">
        <p class="empty-hint">No saved clips yet.</p>
      </div>
    </section>

  </div><!-- #app -->

  <!-- YouTube IFrame API — must load before main.js -->
  <script nonce="${nonce}" src="https://www.youtube.com/iframe_api"></script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new FocusTubeViewProvider(context.extensionUri, context);

  // Register the sidebar webview view
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      FocusTubeViewProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // "FocusTube: Open" — focus the sidebar panel
  context.subscriptions.push(
    vscode.commands.registerCommand('focustube.open', () => {
      vscode.commands.executeCommand('focustube.sidebar.focus');
    })
  );

  // "FocusTube: Save Timestamp" — delegate to provider
  context.subscriptions.push(
    vscode.commands.registerCommand('focustube.saveTimestamp', () => {
      provider.triggerSaveTimestamp();
    })
  );

  // "FocusTube: Show Saved Clips" — scroll to clips list
  context.subscriptions.push(
    vscode.commands.registerCommand('focustube.showSavedClips', () => {
      provider.triggerShowClips();
    })
  );
}

export function deactivate(): void {}
