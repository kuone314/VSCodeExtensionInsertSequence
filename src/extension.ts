import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

  context.subscriptions.push(vscode.commands.registerCommand('sequence-number.helloWorld', () => {
  }));
}

export function deactivate() { }
