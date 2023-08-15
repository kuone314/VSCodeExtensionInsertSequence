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


  const inputOptions: vscode.InputBoxOptions = {
    placeHolder: "e.g. 0/a/Monday/June/foo/003,-6",
    validateInput: function (input) {
      editImpl(editor, input, orgStrs);
      return "";
    }
  };

  vscode.window.showInputBox(inputOptions)
    .then(function (input) {
      if (input === undefined) { // canceled
        vscode.commands.executeCommand("undo");
        return;
      }
      editImpl(editor, input, orgStrs);
    });
}

function editImpl(editor: vscode.TextEditor, input: string, orgStrs: string[]) {
  const strGenerator = parseInput(input) ?? genFromSwqList(orgStrs, 0, 1);

  editor.edit(
    function (builder) {
      editor.selections.forEach(function (selection, index) {
        builder.replace(selection, strGenerator(index));
      });
    },
    { undoStopBefore: false, undoStopAfter: false }
  );

  let selections = editor.selections.slice();
  for (let index = 0; index < selections.length; index++) {
    const strNum = strGenerator(index).length;
    selections[index] = new vscode.Selection(
      selections[index].start,
      selections[index].start.translate(0, strGenerator(index).length)
    );
  }
  editor.selections = selections;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function parseInput(input: string): ((idx: number) => string) | null {
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
    return genFromSwqList(seqList.list, seqList.index, step);
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

function genFromSwqList(seqList: string[], sttIdx: number, step: number): ((idx: number) => string) {
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

const lowerAlphabets = [
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
];
const upperAlphabets = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
];

const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const daysShort = [
  "Sun.",
  "Mon.",
  "Tue.",
  "Wed.",
  "Thu.",
  "Fri.",
  "Sat.",
];
const daysLower = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const daysShortLower = [
  "sun.",
  "mon.",
  "tue.",
  "wed.",
  "thu.",
  "fri.",
  "sat.",
];

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const monthsShort = [
  "Jan.",
  "Feb.",
  "Mar.",
  "Apr.",
  "May",
  "Jun.",
  "Jul.",
  "Aug.",
  "Sep.",
  "Oct.",
  "Nov.",
  "Dec.",
];
const monthsLower = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const monthsShortLower = [
  "jan.",
  "feb.",
  "mar.",
  "apr.",
  "may",
  "jun.",
  "jul.",
  "aug.",
  "sep.",
  "oct.",
  "nov.",
  "dec.",
];

const metaVar = [
  "foo",
  "bar",
  "baz",
  "qux",
  "quux",
  "corge",
  "grault",
  "garply",
  "waldo",
  "fred",
  "plugh",
  "xyzzy",
  "thud",
];
const metaVarJp = [
  "hoge",
  "fuga",
  "piyo",
  "hogera",
  "hogehoge",
];
const dummyNames = [
  "Alice",
  "Bob",
  "Carol",
  "Dave",
  "Ellen",
  "Frank",
];
const dummyNamesLower = [
  "alice",
  "bob",
  "carol",
  "dave",
  "Ellen",
  "frank",
];

function getSequenceListAry(): string[][] {
  const sequenceListAry = [
    lowerAlphabets, upperAlphabets,
    daysShort, daysShortLower, days, daysLower,
    monthsShort, monthsShortLower, months, monthsLower,
    metaVar, metaVarJp, dummyNames, dummyNamesLower,
  ];
  return sequenceListAry;
}

