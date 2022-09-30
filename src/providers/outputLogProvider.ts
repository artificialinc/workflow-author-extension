import * as vscode from 'vscode';
export class OutputLog {
  private static instance: OutputLog;
  private channel: vscode.OutputChannel;
  private constructor() {
    this.channel = vscode.window.createOutputChannel('Artificial-Workflows');
  }
  public static getInstance(): OutputLog {
    if (!OutputLog.instance) {
      OutputLog.instance = new OutputLog();
    }
    return OutputLog.instance;
  }
  public log(value: string) {
    this.channel.appendLine(value);
  }
}
