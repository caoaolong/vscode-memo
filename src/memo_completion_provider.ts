import * as vscode from 'vscode';

export function registerMemoCompletionProvider(context: vscode.ExtensionContext): vscode.Disposable {
    const selector: vscode.DocumentSelector = [{ language: '*' }, { scheme: 'untitled' }];
    const triggerCharacters = ['.'];

    const provider: vscode.CompletionItemProvider = {
        provideCompletionItems(
            document: vscode.TextDocument,
            position: vscode.Position,
            _token: vscode.CancellationToken
        ): vscode.CompletionItem[] | undefined {
            const prefix = (context.globalState.get('memoPromptPrefix') as string) || '';
            if (!prefix || prefix.length === 0) {
                return undefined;
            }

            const line = document.lineAt(position);
            const lineText = line.text.substring(0, position.character);
            const pattern = new RegExp(`${escapeRegExp(prefix)}\\.([a-zA-Z0-9_]*)$`);
            const match = lineText.match(pattern);
            if (!match) {
                return undefined;
            }

            const wordAfterDot = match[1] || '';
            const memos: Array<{ id: string; title?: string; content: string; prompt?: string }> =
                context.globalState.get('memos') || [];
            const withPrompt = memos.filter((m) => m.prompt && String(m.prompt).trim());
            const filtered = wordAfterDot
                ? withPrompt.filter((m) => String(m.prompt).toLowerCase().startsWith(wordAfterDot.toLowerCase()))
                : withPrompt;

            const startCharacter = position.character - prefix.length - 1 - wordAfterDot.length;
            const range = new vscode.Range(
                new vscode.Position(position.line, startCharacter),
                position
            );

            return filtered.map((memo) => {
                const item = new vscode.CompletionItem(
                    memo.prompt!,
                    vscode.CompletionItemKind.Text
                );
                item.detail = memo.title ? `备忘录: ${memo.title}` : '备忘录';
                item.insertText = memo.content ?? '';
                item.range = range;
                return item;
            });
        },
    };

    return vscode.languages.registerCompletionItemProvider(
        selector,
        provider,
        ...triggerCharacters
    );
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
