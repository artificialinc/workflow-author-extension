# Artificial, Inc. Workflow Authoring VSCode Extension

This extension is not standalone. The Artificial, Inc. devcontainer should be installed to take full advantage of this extension.

The Artificial, Inc. devcontainer, SDK and documentation are available to licensed SDK customers from Artificial, Inc. Please contact an Artificial, Inc. representative to learn more!

## Features

Generate workflow binary and json, and one button press publish to namespace.<br/>
![](https://github.com/artificialinc/workflow-author-extension/blob/main/resources/readme/wfgen.gif)<br/>
Drag and drop config, lab id's, assistant function calls into your workflow.<br/>
![](https://github.com/artificialinc/workflow-author-extension/blob/main/resources/readme/drag_drop.gif)<br/>
ID, Type, Param checking for assistants with errors.<br/>
![](https://github.com/artificialinc/workflow-author-extension/blob/main/resources/readme/assistant_errors.png)<br/>
Ability to generate assistant stub file<br/>

## Requirements

Must have a config.yaml in your root project or specify a path to your config.yaml in VS Code extension settings<br/>
Config.yaml must specify host, org, and prefix<br/>

Must have a artificial.env in your root project<br/>
artificial.env must specify ARTIFICIAL_TOKEN=.<br/>
artificial.env may optionally override host with ARTIFICIAL_HOST=.<br/>

Must have workflow and adapter folder<br/>
Must be inside a dev container with access to `wfgen` and `wfupload`.<br/>

Assistant Stubs are put in the root of the workflows directory in a file named stubs_assistants.py<br/>
Optionally assistant stubs can have a custom path and file name configured in VS Code extension settings<br/>
The tool does not find or use hand-made stubs, it assumes it is the sole owner of assistant stubs.<br/>
Hand edits to the stubs file will be over-written the next time you generate.<br/>

## Known Issues

Generation and publishing of workflows throws errors to the terminal. User has to be aware and open the terminal to ensure the operation completed successfully.
