import * as net from "net";
import * as path from "path";
import * as vscode from "vscode";
import * as semver from "semver";

import { PythonExtension } from "@vscode/python-extension";
import { LanguageClient, LanguageClientOptions, ServerOptions, State, integer } from "vscode-languageclient/node";

const BASE_CONIG_SECTION = "artificial.workflow.author.lsp";
const SERVER_CONFIG_SECTION = BASE_CONIG_SECTION + ".server";
const CLIENT_CONFIG_SECTION = BASE_CONIG_SECTION + ".client";

let client: LanguageClient | undefined;
let clientStarting = false;
let python: PythonExtension;
let logger: vscode.LogOutputChannel;

/**
 * If the user has explicitly provided a src directory use that.
 * Otherwise, fallback to the examples/servers directory.
 *
 * @returns The working directory from which to launch the server
 */
function getCwd(): string {
    const config = vscode.workspace.getConfiguration(SERVER_CONFIG_SECTION);
    const cwd = config.get<string>('cwd');
    if (cwd) {
        return cwd;
    }

    let serverDir = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : '';
    return serverDir;
}

/**
 *
 * @returns The python script that implements the server.
 */
function getServerPath(): string {
    const config = vscode.workspace.getConfiguration(SERVER_CONFIG_SECTION);
    const server = config.get<string>('launchScript');
    return server || "server.py";
}

/**
 * Return the python command to use when starting the server.
 *
 * If debugging is enabled, this will also included the arguments to required
 * to wrap the server in a debug adapter.
 *
 * @returns The full python command needed in order to start the server.
 */
async function getPythonCommand(resource?: vscode.Uri): Promise<string[] | undefined> {
    const config = vscode.workspace.getConfiguration(SERVER_CONFIG_SECTION, resource);
    const pythonPath = await getPythonInterpreter(resource);
    if (!pythonPath) {
        return;
    }
    const command = [pythonPath];
    // const enableDebugger = config.get<boolean>('debug');

    // if (!enableDebugger) {
    //     return command;
    // }

    const debugHost = config.get<string>('debugHost');
    const debugPort = config.get<integer>('debugPort');
    try {
        const debugArgs = await python.debug.getRemoteLauncherCommand(debugHost || 'localhost', debugPort || 5678, true);
        // Debugpy recommends we disable frozen modules
        command.push("-Xfrozen_modules=off", ...debugArgs);
    } catch (err) {
        logger.error(`Unable to get debugger command: ${err}`);
        logger.error("Debugger will not be available.");
    }

    return command;
}

/**
 * Return the python interpreter to use when starting the server.
 *
 * This uses the official python extension to grab the user's currently
 * configured environment.
 *
 * @returns The python interpreter to use to launch the server
 */
async function getPythonInterpreter(resource?: vscode.Uri): Promise<string | undefined> {
    const config = vscode.workspace.getConfiguration("pygls.server", resource);
    const pythonPath = config.get<string>('pythonPath');
    if (pythonPath) {
        logger.info(`Using user configured python environment: '${pythonPath}'`);
        return pythonPath;
    }

    if (!python) {
        return;
    }

    if (resource) {
        logger.info(`Looking for environment in which to execute: '${resource.toString()}'`);
    }
    // Use whichever python interpreter the user has configured.
    const activeEnvPath = python.environments.getActiveEnvironmentPath(resource);
    logger.info(`Found environment: ${activeEnvPath.id}: ${activeEnvPath.path}`);

    const activeEnv = await python.environments.resolveEnvironment(activeEnvPath);
    if (!activeEnv) {
        logger.error(`Unable to resolve envrionment: ${activeEnvPath}`);
        return;
    }

    // const v = activeEnv.version
    // const pythonVersion = semver.parse(`${v.major}.${v.minor}.${v.micro}`)

    // // Check to see if the environment satisfies the min Python version.
    // if (semver.lt(pythonVersion, MIN_PYTHON)) {
    //     const message = [
    //         `Your currently configured environment provides Python v${pythonVersion} `,
    //         `but pygls requires v${MIN_PYTHON}.\n\nPlease choose another environment.`
    //     ].join('')

    //     const response = await vscode.window.showErrorMessage(message, "Change Environment")
    //     if (!response) {
    //         return
    //     } else {
    //         await vscode.commands.executeCommand('python.setInterpreter')
    //         return
    //     }
    // }

    const pythonUri = activeEnv.executable.uri;
    if (!pythonUri) {
        logger.error(`URI of Python executable is undefined!`);
        return;
    }

    return pythonUri.fsPath;
}

function getClientOptions(): LanguageClientOptions {
    // const config = vscode.workspace.getConfiguration(CLIENT_CONFIG_SECTION)
    const options = {
    documentSelector: [
          { scheme: "file", language: "python" },
          { scheme: "untitled", language: "python" },
          { scheme: "vscode-notebook", language: "python" },
          { scheme: "vscode-notebook-cell", language: "python" },
        ],        outputChannel: logger,
        connectionOptions: {
            maxRestartCount: 0 // don't restart on server failure.
        },
    };
    logger.info(`client options: ${JSON.stringify(options, undefined, 2)}`);
    return options;
}

async function getPythonExtension() {
    try {
        python = await PythonExtension.api();
    } catch (err) {
        logger.error(`Unable to load python extension: ${err}`);
    }
}

function startDebugging() {
    if (!vscode.workspace.workspaceFolders) {
        logger.error("Unable to start debugging, there is no workspace.")
        return Promise.reject("Unable to start debugging, there is no workspace.")
    }
    // TODO: Is there a more reliable way to ensure the debug adapter is ready?
    setTimeout(async () => {
        if (!vscode.workspace.workspaceFolders) {
            return;
        }
        await vscode.debug.startDebugging(vscode.workspace.workspaceFolders[0],{
            "name": "pygls: Debug Server",
            "type": "python",
            "request": "attach",
            "connect": {
                "host": "localhost",
                "port": "5678"
            },
            "justMyCode": false,
				})
    }, 2000);
    return Promise.resolve();
}

export async function startLangServer(): Promise<void>  {
    logger = vscode.window.createOutputChannel('artificial-workflows-lsp', { log: true });

    await getPythonExtension();

    // Don't interfere if we are already in the process of launching the server.
    if (clientStarting) {
        return;
    }

    clientStarting = true;
    if (client) {
        await stopLangServer();
    }
    const config = vscode.workspace.getConfiguration(SERVER_CONFIG_SECTION);
    const cwd = getCwd();
    const serverPath = getServerPath();

    logger.info(`cwd: '${cwd}'`);
    logger.info(`server: '${serverPath}'`);

    const resource = vscode.Uri.joinPath(vscode.Uri.file(cwd), serverPath);
    let pythonCommand = await getPythonCommand(resource);
    if (!pythonCommand) {
        clientStarting = false;
        return;
    }

    logger.debug(`python: ${pythonCommand.join(" ")}`);
    const serverOptions: ServerOptions = {
        command: pythonCommand[0],
        args: [...pythonCommand.slice(1), serverPath],
        options: { cwd },
    };

    client = new LanguageClient('artificial-workflows-tools', serverOptions, getClientOptions());
    const promises = [client.start()];

    // if (config.get<boolean>("debug")) {
        promises.push(startDebugging())
    // }

    const results = await Promise.allSettled(promises);
    clientStarting = false;

    for (const result of results) {
        if (result.status === "rejected") {
            logger.error(`There was a error starting the server: ${result.reason}`);
        }
    }
}

export async function stopLangServer(): Promise<void> {
    if (!client) {
        return;
    }

    if (client.state === State.Running) {
        await client.stop();
    }

    client.dispose();
    client = undefined;
}

export async function executeServerCommand() {
    if (!client || client.state !== State.Running) {
        await vscode.window.showErrorMessage("There is no language server running.")
        return
    }

    const knownCommands = client.initializeResult?.capabilities.executeCommandProvider?.commands
    if (!knownCommands || knownCommands.length === 0) {
        const info = client.initializeResult?.serverInfo
        const name = info?.name || "Server"
        const version = info?.version || ""

        await vscode.window.showInformationMessage(`${name} ${version} does not implement any commands.`)
        return
    }

    const commandName = await vscode.window.showQuickPick(knownCommands, { canPickMany: false })
    if (!commandName) {
        return
    }
    logger.info(`executing command: '${commandName}'`)

    const result = await vscode.commands.executeCommand(commandName, 'adapter.main.plugin', '/Users/aidan/Development/Artificial/artificial-benchling-resource-library/workflow/stubs/stubs_actions.py')
    logger.info(`${commandName} result: ${JSON.stringify(result, undefined, 2)}`)
}
