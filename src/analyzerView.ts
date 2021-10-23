import * as vscode from 'vscode';
import * as path from 'path';
import { visualText } from './visualText';
import { dirfuncs } from './dirfuncs';
import { textView } from './textView';
import { fileOperation } from './fileOps';

interface AnalyzerItem {
	uri: vscode.Uri;
	hasLogs: boolean;
}

export class AnalyzerTreeDataProvider implements vscode.TreeDataProvider<AnalyzerItem> {

	private _onDidChangeTreeData: vscode.EventEmitter<AnalyzerItem> = new vscode.EventEmitter<AnalyzerItem>();
	readonly onDidChangeTreeData: vscode.Event<AnalyzerItem> = this._onDidChangeTreeData.event;

	refresh(analyzerItem: AnalyzerItem): void {
		this._onDidChangeTreeData.fire(analyzerItem);
	}

	constructor() { }

	public getTreeItem(element: AnalyzerItem): vscode.TreeItem {
		var conVal = element.hasLogs ? 'hasLogs' : '';
		return {
			resourceUri: element.uri,
			collapsibleState: void 0,
			contextValue: conVal,
			iconPath: {
				light: path.join(__filename, '..', '..', 'resources', 'light', 'gear.svg'),
				dark: path.join(__filename, '..', '..', 'resources', 'dark', 'gear.svg')
			},
			command: {
				command: 'analyzerView.openAnalyzer',
				arguments: [element],
				title: 'Open Analyzer'
			}
		};
	}

	public getChildren(element?: AnalyzerItem): AnalyzerItem[] {
        if (visualText.hasWorkspaceFolder()) {
            const analyzers = visualText.getAnalyzers();
            const children: AnalyzerItem[] = new Array();
			var hasAllLogs = false;
            for (let analyzer of analyzers) {
				var hasLogs = dirfuncs.hasLogDirs(analyzer,true);
				if (hasLogs) hasAllLogs = true;
                children.push({uri: analyzer, hasLogs: hasLogs});
            }
			vscode.commands.executeCommand('setContext', 'analyzers.hasLogs', hasAllLogs);
            return children;
        }
		return [];
	}
}

export let analyzerView: AnalyzerView;
export class AnalyzerView {

	public analyzerView: vscode.TreeView<AnalyzerItem>;

	constructor(context: vscode.ExtensionContext) {
		const analyzerViewProvider = new AnalyzerTreeDataProvider();
		this.analyzerView = vscode.window.createTreeView('analyzerView', { treeDataProvider: analyzerViewProvider });
		vscode.commands.registerCommand('analyzerView.refreshAll', resource => analyzerViewProvider.refresh(resource));
		vscode.commands.registerCommand('analyzerView.newAnalyzer', () => this.newAnalyzer());
		vscode.commands.registerCommand('analyzerView.deleteAnalyzer', resource => this.deleteAnalyzer(resource));
		vscode.commands.registerCommand('analyzerView.colorizeAnalyzer', resource => this.colorizeAnalyzer());
		vscode.commands.registerCommand('analyzerView.loadDefaultAnalyzers', resource => this.loadDefaultAnalyzers());
		vscode.commands.registerCommand('analyzerView.openAnalyzer', resource => this.openAnalyzer(resource));
		vscode.commands.registerCommand('analyzerView.deleteAnalyzerLogs', resource => this.deleteAnalyzerLogs(resource));
		vscode.commands.registerCommand('analyzerView.deleteAllAnalyzerLogs', () => this.deleteAllAnalyzerLogs());
		vscode.commands.registerCommand('analyzerView.updateTitle', resource => this.updateTitle(resource));
		vscode.commands.registerCommand('analyzerView.copyAnalyzer', resource => this.copyAnalyzer(resource));
		vscode.commands.registerCommand('analyzerView.copyAll', () => this.copyAll());
    }
    
    static attach(ctx: vscode.ExtensionContext) {
        if (!analyzerView) {
            analyzerView = new AnalyzerView(ctx);
        }
        return analyzerView;
	}

	copyAll() {
		if (visualText.hasWorkspaceFolder()) {
			const options: vscode.OpenDialogOptions = {
				canSelectMany: false,
				openLabel: 'Folder to copy all Analyzers to',
				defaultUri: visualText.getWorkspaceFolder(),
				canSelectFiles: false,
				canSelectFolders: true
			};
			vscode.window.showOpenDialog(options).then(selection => {
				if (!selection) {
					return;
				}
				const analyzers = visualText.getAnalyzers();
				var toFolder = vscode.Uri.file(selection[0].fsPath);
				for (let analyzer of analyzers) {
					var folder = path.basename(analyzer.fsPath);
					visualText.fileOps.addFileOperation(analyzer,vscode.Uri.file(path.join(toFolder.fsPath,folder)),fileOperation.COPY);
				}
				visualText.fileOps.startFileOps();	
			});	
		}		
	}

	copyAnalyzer(analyzerItem: AnalyzerItem) {
		if (visualText.hasWorkspaceFolder()) {
			const options: vscode.OpenDialogOptions = {
				canSelectMany: false,
				openLabel: 'Folder to copy to',
				defaultUri: visualText.getWorkspaceFolder(),
				canSelectFiles: false,
				canSelectFolders: true
			};
			vscode.window.showOpenDialog(options).then(selection => {
				if (!selection) {
					return;
				}
				var folder = path.basename(analyzerItem.uri.fsPath);
				visualText.fileOps.addFileOperation(analyzerItem.uri,vscode.Uri.file(path.join(selection[0].fsPath,folder)),fileOperation.COPY);
				visualText.fileOps.startFileOps();	
			});	
		}
	}
	
	private updateTitle(analyzerItem: AnalyzerItem): void {
		/* Currently not compiling
		var analyzerName = path.basename(analyzerItem.uri.fsPath);
		if (analyzerName.length)
			this.analyzerView.title = `ANALYZERS (${analyzerName})`;
		else
			this.analyzerView.title = 'ANALYZERS';
		*/
	}

	private openAnalyzer(analyzerItem: AnalyzerItem): void {
		this.updateTitle(analyzerItem);
		visualText.loadAnalyzer(analyzerItem.uri);
	}

	private deleteAnalyzer(analyzerItem: AnalyzerItem): void {
		if (visualText.hasWorkspaceFolder()) {
			let items: vscode.QuickPickItem[] = [];
			var deleteDescr = '';
			deleteDescr = deleteDescr.concat('Delete \'',path.basename(analyzerItem.uri.fsPath),'\' analyzer');
			items.push({label: 'Yes', description: deleteDescr});
			items.push({label: 'No', description: 'Do not delete log'});

			vscode.window.showQuickPick(items).then(selection => {
				if (!selection || selection.label == 'No')
					return;
				visualText.fileOps.addFileOperation(analyzerItem.uri,analyzerItem.uri,fileOperation.DELETE);
				visualText.fileOps.startFileOps();
			});
		}
	}

	private colorizeAnalyzer() {
		if (vscode.workspace.workspaceFolders) {
			var fromFile = path.join(visualText.extensionDirectory().fsPath,'.vscode','settings.json');
			var toFile = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath,'.vscode','settings.json');
			dirfuncs.copyFile(fromFile,toFile);
		}
	}

	private loadDefaultAnalyzers() {
		var ext = visualText.getExtension();
        if (ext) {
			var defaults = vscode.Uri.file(path.join(ext.uri.fsPath,visualText.NLPENGINE_FOLDER,'analyzers'));
			vscode.commands.executeCommand("vscode.openFolder",defaults);
			vscode.commands.executeCommand('workbench.action.openPanel');
		}
	}
	
	private newAnalyzer() {
		visualText.analyzer.newAnalyzer();
	}

	public deleteAllAnalyzerLogs() {
		if (visualText.hasWorkspaceFolder()) {

			let items: vscode.QuickPickItem[] = [];
			var deleteDescr = '';
			deleteDescr = deleteDescr.concat('Delete log directories for all analyzers');
			items.push({label: 'Yes', description: deleteDescr});
			items.push({label: 'No', description: 'Do not delete directory logs'});

			vscode.window.showQuickPick(items).then(selection => {
				if (!selection || selection.label == 'No')
					return;
				textView.deleteAllLogDirs();
			});
		}
	}

	public deleteAnalyzerLogs(analyzerItem: AnalyzerItem) {
		if (visualText.hasWorkspaceFolder()) {
			let items: vscode.QuickPickItem[] = [];
			var deleteDescr = '';
			var analyzerName = path.basename(analyzerItem.uri.fsPath);
			deleteDescr = deleteDescr.concat('Delete log directories for \'',analyzerName,'\'');
			items.push({label: 'Yes', description: deleteDescr});
			items.push({label: 'No', description: 'Do not delete directory logs'});

			vscode.window.showQuickPick(items).then(selection => {
				if (!selection || selection.label == 'No')
					return;

				textView.deleteAnalyzerLogDir(analyzerItem.uri.fsPath);
			});
		}
	}
}