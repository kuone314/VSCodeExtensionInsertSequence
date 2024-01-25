import assert = require('assert');
import * as vscode from 'vscode';

///////////////////////////////////////////////////////////////////////////////////////////////////
export function activate(context: vscode.ExtensionContext) {

  context.subscriptions.push(vscode.commands.registerCommand('insert-sequence.execute', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    commandImpl(editor);
  }));
}

export function deactivate() { }

///////////////////////////////////////////////////////////////////////////////////////////////////
function sorter(a: vscode.Selection, b: vscode.Selection) {
  return a.anchor.line - b.anchor.line || a.anchor.character - b.anchor.character;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
async function commandImpl(editor: vscode.TextEditor) {
  editor.selections = editor.selections.slice().sort(sorter);
  const orgStrs = editor.selections.map(selection => editor.document.getText(selection));

  editor.edit(
    function (builder) {
      editor.selections.forEach(function (selection, index) {
        builder.replace(selection, "");
      });
    },
    { undoStopBefore: false, undoStopAfter: false }
  );

  let inputedStrs = orgStrs;

  const inputOptions: vscode.InputBoxOptions = {
    placeHolder: "e.g. 0/a/Monday/June/foo/003,-6",
    validateInput: function (input) {
      inputedStrs = editImpl(editor, input, inputedStrs, orgStrs);
      return "";
    }
  };

  vscode.window.showInputBox(inputOptions)
    .then(function (input) {
      editImpl(editor, input, inputedStrs, orgStrs);
    });
}

function editImpl(
  editor: vscode.TextEditor,
  input: string | undefined,
  prebInputed: string[],
  orgStrs: string[]
): string[] {
  const strGenerator = parseInput(input) ?? genFromSeqList(orgStrs, 0, 1);

  let selections = editor.selections.slice();

  assert(selections.length === prebInputed.length);
  assert(selections.length === orgStrs.length);

  for (let index = 0; index < selections.length; index++) {
    const strNum = prebInputed[index].length;
    selections[index] = new vscode.Selection(
      selections[index].start.translate(0, -strNum),
      selections[index].start
    );
  }


  const strList = selections.map((_, idx) => strGenerator(idx));
  editor.edit(
    function (builder) {
      selections.forEach(function (selection, index) {
        builder.replace(selection, strList[index]);
      });
    },
    { undoStopBefore: false, undoStopAfter: false }
  );
  return strList;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function parseInput(input: string | undefined): ((idx: number) => string) | null {
  if (input === undefined) { return null; } // on cancel

  const splited = input.split(/[:, ]/);

  const stepStr = splited[1] ?? "";
  const step = stepStr ? parseInt(stepStr) : 1;
  if (isNaN(step)) { return null; }

  const startStr = splited[0];
  const startNum = startStr ? parseInt(startStr) : 0;
  if (!isNaN(startNum)) {
    return genSequenceNumber(startNum, step, startStr.length);
  }

  const seqList = getList(startStr);
  if (seqList) {
    return genFromSeqList(seqList.list, seqList.index, step);
  }

  return null;
}

function genSequenceNumber(startNum: number, step: number, digit: number): ((idx: number) => string) {
  return (idx: number) => {
    const val = (startNum + idx * step);
    const valStr = val.toString();

    const digitDiff = (digit - valStr.length);
    if (digitDiff <= 0) { return valStr; }

    if (val >= 0) {
      return "0".repeat(digitDiff) + valStr;
    } else {

      return "-" + "0".repeat(digitDiff) + (-val).toString();
    }

  };
}

function genFromSeqList(seqList: string[], sttIdx: number, step: number): ((idx: number) => string) {
  return (idx: number) => {
    const len = seqList.length;
    const adjustedIdx = (sttIdx + idx * step) % len;
    return seqList[adjustedIdx];
  };
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function getList(str: string): { list: string[]; index: number } | null {
  for (const sequenceList of getSequenceListAry()) {
    const idx = sequenceList.findIndex(sequenceItem => { return sequenceItem.startsWith(str); });
    if (idx === -1) { continue; }

    return { list: sequenceList, index: idx };
  }

  return null;
}

function getSequenceListAry(): string[][] {
  const config = vscode.workspace.getConfiguration('SequenceNumberSetting');
  const userDefinedSequenceListAry = config.get<string[][]>('SequenceList');
  if (!userDefinedSequenceListAry) { return []; }
  return userDefinedSequenceListAry;
}

