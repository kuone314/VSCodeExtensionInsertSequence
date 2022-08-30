import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

  context.subscriptions.push(vscode.commands.registerCommand('insert-sequence.execute', () => {
  }));
}

export function deactivate() { }
