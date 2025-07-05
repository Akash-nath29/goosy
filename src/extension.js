"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const api_1 = require("./api");
const vulnerabilityDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(255, 0, 0, 0.2)",
    textDecoration: "underline double orange",
    border: "1px solid red",
    borderRadius: "4px",
    before: {
        contentText: "⚠ ",
        color: "red",
        margin: "0 6px 0 0",
    },
});
class GoosyLensProvider {
    provideCodeLenses(document) {
        const lenses = [];
        const top = new vscode.Range(0, 0, 0, 0);
        lenses.push(new vscode.CodeLens(top, {
            title: "🔍 Analyze File",
            command: "goosy.analyzeDocument",
        }));
        lenses.push(new vscode.CodeLens(top, {
            title: "⚙️ Check Complexity",
            command: "goosy.checkComplexitySelection",
        }));
        lenses.push(new vscode.CodeLens(top, {
            title: "♻️ Refactor Selection",
            command: "goosy.refactorSelection",
        }));
        const regex = /^\s*def\s+/;
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            if (regex.test(line.text)) {
                lenses.push(new vscode.CodeLens(line.range, {
                    title: "♻️ Refactor Function",
                    command: "goosy.refactorSelection",
                }));
                lenses.push(new vscode.CodeLens(line.range, {
                    title: "⚙️ Check Function Complexity",
                    command: "goosy.checkComplexitySelection",
                }));
            }
        }
        return lenses;
    }
}
function activate(context) {
    console.log("🚀 Goosy extension activated!");
    const lensProvider = vscode.languages.registerCodeLensProvider("*", new GoosyLensProvider());
    context.subscriptions.push(lensProvider);
    async function analyzeAndDecorate(fullDocument) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage("Goosy: No active editor.");
            return;
        }
        const document = editor.document;
        const text = fullDocument
            ? document.getText()
            : document.getText(editor.selection);
        if (!text.trim()) {
            vscode.window.showInformationMessage("Goosy: Nothing to analyze.");
            return;
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Goosy: Running vulnerability check...",
            cancellable: false,
        }, async () => {
            const result = await (0, api_1.checkVulnerabilities)(text);
            if (!result || !Array.isArray(result.vulnerabilities)) {
                vscode.window.showErrorMessage("Goosy: Analysis failed or gave invalid response.");
                return;
            }
            if (result.vulnerabilities.length === 0) {
                vscode.window.showInformationMessage("Goosy: ✅ No severe vulnerabilities found.");
                editor.setDecorations(vulnerabilityDecorationType, []);
                return;
            }
            const decorations = result.vulnerabilities.map((v) => {
                const line = Math.max(0, v.line - 1);
                const lineText = document.lineAt(line).text;
                return {
                    range: new vscode.Range(line, 0, line, lineText.length),
                    hoverMessage: `${v.severity.toUpperCase()}: ${v.description}`,
                    renderOptions: {
                        after: {
                            contentText: `💡 ${v.description}`,
                            color: "red",
                            fontStyle: "italic",
                            margin: "0 0 0 8px",
                        },
                    },
                };
            });
            editor.setDecorations(vulnerabilityDecorationType, decorations);
            vscode.window.showInformationMessage(`Goosy: ⚠️ Found ${result.vulnerabilities.length} vulnerability(s).`);
        });
    }
    context.subscriptions.push(vscode.commands.registerCommand("goosy.analyzeDocument", () => analyzeAndDecorate(true)));
    context.subscriptions.push(vscode.commands.registerCommand("goosy.analyzeSelection", () => analyzeAndDecorate(false)));
    context.subscriptions.push(vscode.commands.registerCommand("goosy.refactorSelection", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showInformationMessage("Goosy: Select code to refactor.");
            return;
        }
        vscode.window.showInformationMessage("Goosy: Refactoring...");
        const selectedText = editor.document.getText(selection);
        const optimizedCode = await (0, api_1.refactorCode)(selectedText);
        if (!optimizedCode) {
            vscode.window.showErrorMessage("Goosy: Refactoring failed.");
            return;
        }
        const importRegex = /^(import .+|from .+ import .+)$/gm;
        const imports = optimizedCode.match(importRegex) || [];
        const cleanedCode = optimizedCode.replace(importRegex, "").trim();
        editor.edit((editBuilder) => {
            const fullText = editor.document.getText();
            const existingImports = new Set(fullText.match(importRegex) || []);
            const newImports = imports.filter((i) => !existingImports.has(i));
            if (newImports.length > 0) {
                editBuilder.insert(new vscode.Position(0, 0), `${newImports.join("\n")}\n`);
            }
            const commentedOriginal = selectedText
                .split("\n")
                .map((line) => `# ${line}`)
                .join("\n");
            editBuilder.replace(selection, `${cleanedCode}\n\n${commentedOriginal}`);
        });
        vscode.window.showInformationMessage("✅ Refactored successfully.");
    }));
    context.subscriptions.push(vscode.commands.registerCommand("goosy.checkComplexitySelection", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showInformationMessage("Goosy: Select code to check complexity.");
            return;
        }
        vscode.window.showInformationMessage("Goosy: Checking complexity...");
        const selectedText = editor.document.getText(selection);
        const complexity = await (0, api_1.getComplexity)(selectedText);
        if (!complexity || !complexity.summary) {
            vscode.window.showErrorMessage("Goosy: Complexity check failed.");
            return;
        }
        vscode.window.showInformationMessage(`Goosy:  📊 Complexity:\n LOC=${complexity.summary.lines_of_code} | Maintainability=${complexity.summary.maintainability}\n Cyclomatic=${complexity.summary.cyclomatic_complexity} | Cognitive=${complexity.summary.cognitive_complexity} | NPath=${complexity.summary.npath_complexity}`);
    }));
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map