import * as vscode from 'vscode';

export class MemoViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'vscode-memo-view';
    private _view?: vscode.WebviewView;
    /** 当前编辑器会话内是否已通过密码验证，关闭窗口后重置 */
    private _sessionUnlocked = false;

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
                        this._sessionUnlocked = true;
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
                        prompt: data.prompt ? String(data.prompt).trim() : undefined,
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
                    const promptPrefix = this._context.globalState.get('memoPromptPrefix') || '';
                    webviewView.webview.postMessage({
                        type: 'initData',
                        memos,
                        hasPassword: !!password,
                        sessionUnlocked: this._sessionUnlocked,
                        layout,
                        promptPrefix
                    });
                    break;
                }
                case 'setPromptPrefix': {
                    const value = (data.value ?? '').trim();
                    await this._context.globalState.update('memoPromptPrefix', value);
                    break;
                }
                case 'clearAll': {
                    const result = await vscode.window.showWarningMessage(
                        '确定要清空所有备忘录吗？此操作不可恢复。',
                        { modal: true },
                        '确定'
                    );
                    if (result === '确定') {
                        await this._context.globalState.update('memos', []);
                        webviewView.webview.postMessage({ type: 'updateMemos', memos: [] });
                    }
                    break;
                }
                case 'openAddMemo': {
                    this._openAddMemoPanel();
                    break;
                }
                case 'openEditMemo': {
                    this._openAddMemoPanel(data.memo);
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

    private _openAddMemoPanel(editMemo?: { id: string; title?: string; content?: string; prompt?: string }) {
        const isEdit = !!editMemo;
        const panel = vscode.window.createWebviewPanel(
            'addMemo',
            isEdit ? '编辑备忘录' : '新建备忘录',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    this._extensionUri,
                    vscode.Uri.joinPath(this._extensionUri, 'node_modules')
                ]
            }
        );

        let pendingEditMemo = editMemo;

        this._getHtmlForAddMemo(panel.webview).then(html => {
            panel.webview.html = html;
        });

        panel.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'addMemoReady': {
                    if (pendingEditMemo) {
                        panel.webview.postMessage({ type: 'initEditMemo', memo: pendingEditMemo });
                        pendingEditMemo = undefined;
                    }
                    break;
                }
                case 'saveMemo': {
                    const memos: any[] = this._context.globalState.get('memos') || [];
                    memos.push({
                        id: Date.now().toString(),
                        title: data.title,
                        content: data.content,
                        prompt: data.prompt ? String(data.prompt).trim() : undefined,
                        color: this._getRandomColor()
                    });
                    await this._context.globalState.update('memos', memos);

                    if (this._view) {
                        this._view.webview.postMessage({ type: 'updateMemos', memos });
                    }

                    panel.dispose();
                    break;
                }
                case 'updateMemo': {
                    const memos: any[] = this._context.globalState.get('memos') || [];
                    const index = memos.findIndex((m: any) => m.id === data.id);
                    if (index >= 0) {
                        memos[index] = {
                            ...memos[index],
                            title: data.title,
                            content: data.content,
                            prompt: data.prompt ? String(data.prompt).trim() : undefined
                        };
                        await this._context.globalState.update('memos', memos);
                        if (this._view) {
                            this._view.webview.postMessage({ type: 'updateMemos', memos });
                        }
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
        const nodeModulesUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules')).toString();

        const bytes = await vscode.workspace.fs.readFile(htmlUri);
        let html = new TextDecoder().decode(bytes);

        html = html
            .replace(/{{STYLE_URI}}/g, styleUri.toString())
            .replace(/{{SCRIPT_URI}}/g, scriptUri.toString())
            .replace(/{{NODE_MODULES_URI}}/g, nodeModulesUri);

        return html;
    }
}
