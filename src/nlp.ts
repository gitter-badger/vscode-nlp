import * as vscode from 'vscode';
import { TextFile, nlpFileType, separatorType } from './textFile';
import { visualText } from './visualText';

export let nlpFile: NLPFile;
export class NLPFile extends TextFile {

	constructor() {
        super();
	}

	analyze(filepath: vscode.Uri) {
		const filestr = filepath.path;
		var pos = filestr.search('/input/');
		var anapath = filestr.substr(0,pos);
		var workpath = '/home/dehilster/nlp-engine/';
		var cmd = `${workpath}nlp.exe -ANA ${anapath} -WORK ${workpath} ${filestr} -DEV`;

		const cp = require('child_process');
		cp.exec(cmd, (err, stdout, stderr) => {
			console.log('stdout: ' + stdout);
			console.log('stderr: ' + stderr);
			if (err) {
				console.log('error: ' + err);
			} else {
				visualText.analyzer.saveCurrentFile(filepath);				
			}
		});
	}

    reformatRule(editor: vscode.TextEditor) {
		this.setDocument(editor);
		if (this.getFileType() == nlpFileType.NLP) {
			var rulevars = this.findRuleText(editor);

			if (rulevars[0].length) {
				var formattedRule = this.formatRule(rulevars[0]);
				var rang = new vscode.Selection(rulevars[1].start,rulevars[1].end);
				if (rulevars[1].start.line == rulevars[1].end.line) {
					formattedRule = this.getSeparator() + formattedRule + this.getSeparator() + '\t';
				}
				var snippet = new vscode.SnippetString(formattedRule);
				editor.insertSnippet(snippet,rang);
			}			
		}
	}

	findRuleText(editor: vscode.TextEditor): [string, vscode.Range] {
		var rulestr = '';
		var position = editor.selection.active;
		var lineStart = position.line;
		var charStart = position.character;
		var lineEnd = position.line;
		var charEnd = position.character;

		var lines = this.getLines(true);
		var line = lines[lineStart];
		var lastline = line;
		var multilined = false;
		var pos = 0;

		while ((pos = line.search('<-')) < 0) {
			rulestr = line + rulestr;
			lastline = line;
			line = lines[--lineStart];
			multilined = true;
		}
		if (lineStart < position.line)
			charStart = 0;
		else
			charStart = pos+3;
		if (multilined)
			lineStart++;

		multilined = false;
		line = lines[lineEnd];
		var firsttime = true;
		while ((pos = line.search('@@')) < 0) {
			if (!firsttime)
				rulestr = rulestr + line;
			lastline = line;
			line = lines[++lineEnd];
			firsttime = false;
		}
		if (!firsttime)	{
			lineEnd--;
			charEnd = lastline.length-1;
		} else {
			charEnd = pos;			
		}

		var posStart = new vscode.Position(lineStart,charStart);
		var posEnd = new vscode.Position(lineEnd,charEnd);
		var range = new vscode.Range(posStart, posEnd);

		if (rulestr.length == 0) {
			rulestr = lastline.substr(charStart,charEnd-charStart);
		}

		return [rulestr,range];
	}

	formatRule(ruleStr: string): string {

		enum state { UNKNOWN, NODE, ATTR_START, ATTR, ATTR_END, COMMENT };

		var formattedRule = ruleStr.replace(this.getSeparatorNormalized(),' ');

		var tokens = ruleStr.split(/\s+/);
		var currentState = state.UNKNOWN;
		var lastState = state.UNKNOWN;
		var lastToken = '';
		var rulelines = new Array();
		var rulelinesFinal = new Array();
		var ruleline = '';
		var maxline = 0;
		const nodeNumRegex = /\([\d]+\)/g;

		for (let token of tokens) {
			if (!token.length)
				continue;

			if (token.localeCompare('###') == 0 || token.match(nodeNumRegex)) {
				currentState = state.COMMENT;

			} else if (currentState as state == state.NODE && token.startsWith('[')) {
				currentState = state.ATTR_START;
				if (token.endsWith(']'))
					currentState = state.ATTR_END;

			} else if (currentState == state.ATTR_START || currentState == state.ATTR ) {
				if (token.endsWith(']'))
					currentState = state.ATTR_END;
				else
					currentState = state.ATTR;

			} else {
				currentState = state.NODE;
			}

			if (currentState != state.COMMENT) {
				if (currentState == state.NODE && (lastState == state.NODE || lastState as state == state.ATTR_END || lastState == state.COMMENT)) {
					if (ruleline.length > maxline)
						maxline = ruleline.length;
					rulelines.push(ruleline);
					ruleline = '';
				}
				if (ruleline.length > 1) {
					ruleline = ruleline + ' ';
				}
				ruleline = ruleline + token;
			}

			lastToken = token;
			lastState = currentState;
		}
		if (ruleline.length > maxline)
			maxline = ruleline.length;
		rulelines.push(ruleline);

		var passnum = 1;
		var tabsize = 4;
		var tabsmax = Math.floor(maxline / tabsize);

		for (var line of rulelines) {
			var tabsline = Math.floor(line.length) / tabsize;
			var tabs = tabsmax - tabsline + 1;
			var tabstr = '\t';
			for (let i=1; i<tabs; i++) {
				tabstr = tabstr + '\t';
			}
			rulelinesFinal.push('\t' + line + tabstr + '### (' + passnum.toString() + ')');
			passnum++;
		}

		formattedRule = rulelinesFinal.join(this.getSeparator());

		return formattedRule;
	}
}