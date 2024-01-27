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

  editor.selections = editor.selections.map(
    selection => new vscode.Selection(selection.end, selection.end));

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
  const strGenerator = parseInput(input) ?? genFromSeqList(orgStrs, 0, new Option);

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
class Option {
  skip: number = 1;
  duplicate: number = 1;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function parseInput(input: string | undefined): ((idx: number) => string) | null {
  if (input === undefined) { return null; } // on cancel

  const splited = input.split(/[:, ]/);

  const [option, parsedNum] = parseOptions(splited.slice(1));
  const remain = (parsedNum === 0)
    ? splited
    : splited.slice(0, -parsedNum);

  const startStr = splited[0];
  const startNum = startStr ? parseInt(startStr) : 0;
  if (!isNaN(startNum)) {
    return genSequenceNumber(startNum, option, startStr.length);
  }

  const seqList = getList(startStr);
  if (seqList) {
    return genFromSeqList(seqList.list, seqList.index, option);
  }

  return null;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function parseOptions(srcs: string[]): [Option, number] {
  const typeList = Object.values(OPTION_TYPE);

  let parsedWithType = new Array<{ type: OptionType, val: number }>;
  let parsedWithoutType = new Array<number>;

  const isParsedType = (type: OptionType | null) => {
    return (parsedWithType.find(item => item.type === type) !== undefined);
  };

  for (const src of srcs.reverse()) {
    const parsed = parseOption(src);
    if (parsed === null) { break; }

    if (isParsedType(parsed.type)) { break; }

    if (parsed.type === null) {
      parsedWithoutType.push(parsed.val);
    } else {
      parsedWithType.push({ type: parsed.type, val: parsed.val });
    }

    const parsedNum = parsedWithoutType.length + parsedWithType.length;
    if (parsedNum >= typeList.length) { break; }
  }

  const remainTypeList = typeList.filter(type => !isParsedType(type));
  assert(parsedWithoutType.length <= remainTypeList.length);

  const typeValMap = parsedWithType.concat(
    parsedWithoutType.reverse().map((val, idx) => ({ type: remainTypeList[idx], val: val }))
  );
  let result = new Option;
  for (const typeValPair of typeValMap) {
    switch (typeValPair.type) {
      case 'skip': result.skip = typeValPair.val; break;
      case 'duplicate': result.duplicate = typeValPair.val; break;
    }
  }
  return [result, typeValMap.length];
}

export const OPTION_TYPE = {
  skip: "skip",
  duplicate: "duplicate",
} as const;
export type OptionType = typeof OPTION_TYPE[keyof typeof OPTION_TYPE];

function parseOption(src: string): { type: OptionType | null, val: number } | null {
  const valFull = parseInt(src);
  if (!Number.isNaN(valFull)) {
    return { type: null, val: valFull };
  }

  const type
    = (src[0] === 's') ? OPTION_TYPE.skip
      : (src[0] === 'd') ? OPTION_TYPE.duplicate
        : null;
  if (type === null) { return null; }

  const valRest = parseInt(src.slice(1));
  if (Number.isNaN(valRest)) { return null; }

  return { type, val: valRest };
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function genSequenceNumber(startNum: number, option: Option, digit: number): ((idx: number) => string) {
  return (idx: number) => {
    const val = (startNum + Math.floor(idx / option.duplicate) * option.skip);
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

function genFromSeqList(seqList: string[], sttIdx: number, option: Option): ((idx: number) => string) {
  return (idx: number) => {
    const len = seqList.length;
    const adjustedIdx = (sttIdx + Math.floor(idx / option.duplicate) * option.skip) % len;
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

