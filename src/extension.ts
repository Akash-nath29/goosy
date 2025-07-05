import * as vscode from "vscode";
import { checkVulnerabilities, getComplexity, refactorCode } from "./api";

interface Vulnerability {
  line: number;
  severity: string;
  type: string;
  description: string;
}

const vulnerabilityDecorationType =
  vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(255, 0, 0, 0.2)",
    textDecoration: "underline double orange",
    border: "1px solid orange",
    borderRadius: "4px",
    before: {
      contentText: "⚠ ",
      color: "orange",
      margin: "0 6px 0 0",
    },
  });

class GoosyLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    const top = new vscode.Range(0, 0, 0, 0);

    lenses.push(
      new vscode.CodeLens(top, {
        title: "🔍 Analyze File",
        command: "goosy.analyzeDocument",
      })
    );
    lenses.push(
      new vscode.CodeLens(top, {
        title: "⚙️ Check Complexity",
        command: "goosy.checkComplexitySelection",
      })
    );
    lenses.push(
      new vscode.CodeLens(top, {
        title: "♻️ Refactor Selection",
        command: "goosy.refactorSelection",
      })
    );

    const regex = /^\s*def\s+/;
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      if (regex.test(line.text)) {
        lenses.push(
          new vscode.CodeLens(line.range, {
            title: "♻️ Refactor Function",
            command: "goosy.refactorSelection",
          })
        );
        lenses.push(
          new vscode.CodeLens(line.range, {
            title: "⚙️ Check Function Complexity",
            command: "goosy.checkComplexitySelection",
          })
        );
      }
    }

    return lenses;
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log("🚀 Goosy extension activated!");

  const lensProvider = vscode.languages.registerCodeLensProvider(
    "*",
    new GoosyLensProvider()
  );
  context.subscriptions.push(lensProvider);

  async function analyzeAndDecorate(fullDocument: boolean) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage("No active editor.");
      return;
    }

    const document = editor.document;
    const text = fullDocument
      ? document.getText()
      : document.getText(editor.selection);

    if (!text.trim()) {
      vscode.window.showInformationMessage("Nothing to analyze.");
      return;
    }

    vscode.window.showInformationMessage("Running vulnerability check...");

    const result = await checkVulnerabilities(text);

    if (!result || !Array.isArray(result.vulnerabilities)) {
      vscode.window.showErrorMessage(
        "Analysis failed or gave invalid response."
      );
      return;
    }

    if (result.vulnerabilities.length === 0) {
      vscode.window.showInformationMessage(
        "✅ No severe vulnerabilities found."
      );
      editor.setDecorations(vulnerabilityDecorationType, []);
      return;
    }

    const decorations: vscode.DecorationOptions[] = result.vulnerabilities.map(
      (v: Vulnerability) => {
        const line = Math.max(0, v.line - 1);
        const lineText = document.lineAt(line).text;
        return {
          range: new vscode.Range(line, 0, line, lineText.length),
          hoverMessage: `${v.severity.toUpperCase()}: ${v.description}`,
          renderOptions: {
            after: {
              contentText: `💡 ${v.description}`,
              color: "orange",
              fontStyle: "italic",
              margin: "0 0 0 8px",
            },
          },
        };
      }
    );

    editor.setDecorations(vulnerabilityDecorationType, decorations);
    vscode.window.showInformationMessage(
      `⚠️ Found ${result.vulnerabilities.length} vulnerability(s).`
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("goosy.analyzeDocument", () =>
      analyzeAndDecorate(true)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("goosy.analyzeSelection", () =>
      analyzeAndDecorate(false)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("goosy.refactorSelection", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {return;}

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showInformationMessage("Select code to refactor.");
        return;
      }

      const selectedText = editor.document.getText(selection);
      const optimizedCode = await refactorCode(selectedText);

      if (!optimizedCode) {
        vscode.window.showErrorMessage("Refactoring failed.");
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
          editBuilder.insert(
            new vscode.Position(0, 0),
            `${newImports.join("\n")}\n`
          );
        }

        const commentedOriginal = selectedText
          .split("\n")
          .map((line) => `# ${line}`)
          .join("\n");
        editBuilder.replace(
          selection,
          `${cleanedCode}\n\n${commentedOriginal}`
        );
      });

      vscode.window.showInformationMessage("✅ Refactored successfully.");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "goosy.checkComplexitySelection",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {return;}

        const selection = editor.selection;
        if (selection.isEmpty) {
          vscode.window.showInformationMessage(
            "Select code to check complexity."
          );
          return;
        }

        const selectedText = editor.document.getText(selection);
        const complexity = await getComplexity(selectedText);

        if (!complexity || !complexity.summary) {
          vscode.window.showErrorMessage("Complexity check failed.");
          return;
        }

        vscode.window.showInformationMessage(
          `📊 Complexity:\n LOC=${complexity.summary.lines_of_code} | Maintainability=${complexity.summary.maintainability}\n Cyclomatic=${complexity.summary.cyclomatic_complexity} | Cognitive=${complexity.summary.cognitive_complexity} | NPath=${complexity.summary.npath_complexity}`
        );
      }
    )
  );
}

export function deactivate() {}
