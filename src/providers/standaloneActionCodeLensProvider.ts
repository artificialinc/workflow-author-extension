import * as vscode from 'vscode';


export class StandAloneActionCodeLensProvider implements vscode.CodeLensProvider {
  async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    const locations: vscode.Range[] = [];
    let actions: string [] = [];
    for (let line = 0; line < document.lineCount; line++) {
      const text = document.lineAt(line);
      if (text.text.trimStart().startsWith('@action(')) {
        const nextLine = line + 1;
        // TODO: Could loop here to find the next actual function signature, currently assuming it's the next line after the decorator
        const compatible = isActionStandaloneCompat(document.lineAt(nextLine).text);
        if (compatible) {
            locations.push(new vscode.Range(line, 0, line, 0));
            actions.push(compatible);
        }
      }
    }
    const codeLens: vscode.CodeLens[] = [];
    if (!actions.length) {
      return codeLens;
    }
    const commands: vscode.Command[] = [];
    actions.forEach( (action) => {
        commands.push({
            command: 'workflows.standalonePublish',
            title: 'Publish Standalone Action',
            arguments: [action], 
          });
    });


    for (const [index, range] of locations.entries()) {
      codeLens.push(new vscode.CodeLens(range, commands[index]));
    }

    return codeLens;
  }

}


function isActionStandaloneCompat(text: string): string | null{
  // Finds function signatures that have exactly self and actx as arguments, and return None.
  const regex = /^\s*async def (\w+)\(self,\s*actx:\s*ActionExecutionContext\s*\)\s*->\s*None:$/;
  const match = text.match(regex);
  // Returns function name from the signature
  return match ? match[1] : null;
}

