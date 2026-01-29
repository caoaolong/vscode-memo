import * as vscode from 'vscode';

export class MemoViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'vscode-memo-view';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {}

    public async resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri,
                vscode.Uri.joinPath(this._extensionUri, 'node_modules')
            ]
        };

        webviewView.webview.html = await this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'setPassword': {
                    await this._context.globalState.update('memoPassword', data.password);
                    webviewView.webview.postMessage({ type: 'passwordSet' });
                    break;
                }
                case 'verifyPassword': {
                    const savedPassword = this._context.globalState.get('memoPassword');
                    if (savedPassword === data.password) {
                        webviewView.webview.postMessage({ type: 'authSuccess' });
                    } else {
                        webviewView.webview.postMessage({ type: 'authFail' });
                    }
                    break;
                }
                case 'saveMemo': {
                    const memos: any[] = this._context.globalState.get('memos') || [];
                    memos.push({
                        id: Date.now().toString(),
                        title: data.title,
                        content: data.content,
                        color: this._getRandomColor()
                    });
                    await this._context.globalState.update('memos', memos);
                    webviewView.webview.postMessage({ type: 'updateMemos', memos });
                    break;
                }
                case 'deleteMemo': {
                    const result = await vscode.window.showWarningMessage(
                        '确定要删除这条备忘录吗？',
                        { modal: true },
                        '确定'
                    );
                    if (result === '确定') {
                        let memos: any[] = this._context.globalState.get('memos') || [];
                        memos = memos.filter(m => m.id !== data.id);
                        await this._context.globalState.update('memos', memos);
                        webviewView.webview.postMessage({ type: 'updateMemos', memos });
                    }
                    break;
                }
                case 'setLayout': {
                    await this._context.globalState.update('memoLayout', data.layout);
                    break;
                }
                case 'getData': {
                    const memos = this._context.globalState.get('memos') || [];
                    const password = this._context.globalState.get('memoPassword');
                    const layout = this._context.globalState.get('memoLayout') || 'list';
                    webviewView.webview.postMessage({ 
                        type: 'initData', 
                        memos, 
                        hasPassword: !!password,
                        layout
                    });
                    break;
                }
                case 'openAddMemo': {
                    this._openAddMemoPanel();
                    break;
                }
            }
        });
    }

    private _getRandomColor() {
        // Use colors that are more compatible with both dark and light themes
        // These are semi-transparent versions of standard colors or muted tones
        const colors = [
            'rgba(242, 139, 130, 0.4)', // red
            'rgba(251, 188, 4, 0.4)',   // orange
            'rgba(255, 244, 117, 0.4)', // yellow
            'rgba(204, 255, 144, 0.4)', // green
            'rgba(167, 255, 235, 0.4)', // teal
            'rgba(203, 240, 248, 0.4)', // blue
            'rgba(174, 203, 250, 0.4)', // dark blue
            'rgba(215, 174, 251, 0.4)', // purple
            'rgba(253, 207, 232, 0.4)', // pink
            'rgba(230, 201, 168, 0.4)', // brown
            'rgba(232, 234, 237, 0.4)'  // gray
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    private _openAddMemoPanel() {
        const panel = vscode.window.createWebviewPanel(
            'addMemo',
            '新建备忘录',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    this._extensionUri,
                    vscode.Uri.joinPath(this._extensionUri, 'node_modules')
                ]
            }
        );

        this._getHtmlForAddMemo(panel.webview).then(html => {
            panel.webview.html = html;
        });

        panel.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'saveMemo': {
                    const memos: any[] = this._context.globalState.get('memos') || [];
                    memos.push({
                        id: Date.now().toString(),
                        title: data.title,
                        content: data.content,
                        color: this._getRandomColor()
                    });
                    await this._context.globalState.update('memos', memos);
                    
                    if (this._view) {
                        this._view.webview.postMessage({ type: 'updateMemos', memos });
                    }
                    
                    panel.dispose();
                    break;
                }
                case 'cancel': {
                    panel.dispose();
                    break;
                }
            }
        });
    }

    private async _getHtmlForAddMemo(webview: vscode.Webview): Promise<string> {
        const htmlUri = vscode.Uri.joinPath(this._extensionUri, 'media', 'add-memo.html');
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css'));
        const nodeModulesUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules')).toString();

        const bytes = await vscode.workspace.fs.readFile(htmlUri);
        let html = new TextDecoder().decode(bytes);

        html = html
            .replace(/{{STYLE_URI}}/g, styleUri.toString())
            .replace(/{{NODE_MODULES_URI}}/g, nodeModulesUri);

        return html;
    }

    private async _getHtmlForWebview(webview: vscode.Webview): Promise<string> {
        const htmlUri = vscode.Uri.joinPath(this._extensionUri, 'media', 'view.html');
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css'));
        const gridIcon = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'grid_light.png'));
        const listIcon = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'list_light.png'));
        const settingsIcon = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'settings_light.png'));
        const plusIcon = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'plus_light.png'));
        const nodeModulesUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules')).toString();

        const bytes = await vscode.workspace.fs.readFile(htmlUri);
        let html = new TextDecoder().decode(bytes);

        html = html
            .replace(/{{STYLE_URI}}/g, styleUri.toString())
            .replace(/{{SCRIPT_URI}}/g, scriptUri.toString())
            .replace(/{{GRID_ICON}}/g, gridIcon.toString())
            .replace(/{{LIST_ICON}}/g, listIcon.toString())
            .replace(/{{SETTINGS_ICON}}/g, settingsIcon.toString())
            .replace(/{{PLUS_ICON}}/g, plusIcon.toString())
            .replace(/{{NODE_MODULES_URI}}/g, nodeModulesUri);

        return html;
    }
}
