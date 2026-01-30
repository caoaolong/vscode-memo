import * as vscode from 'vscode';
import { MemoViewProvider } from './memo_view_provider';
import { registerMemoCompletionProvider } from './memo_completion_provider';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "vscode-memo" is now active!');

	const provider = new MemoViewProvider(context.extensionUri, context);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(MemoViewProvider.viewType, provider),
		registerMemoCompletionProvider(context)
	);
}

export function deactivate() {}
