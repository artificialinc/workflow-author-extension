# Artificial-Workflows README

## Features

Generate workflow binary and json, and one button press publish to namespace.
![](https://github.com/artificial-smahon/extension/blob/main/resources/readme/wfgen.gif)
Drag and drop config, lab id's, assistant function calls into your workflow.
![](https://github.com/artificial-smahon/extension/blob/main/resources/readme/drag_drop.gif)
ID, Type, Param checking for assistants with errors.
![](https://github.com/artificial-smahon/extension/blob/main/resources/readme/assistant_errors.png)
Ability to generate assistant stub file

## Requirements

Must have a config.yaml in your root project
Config.yaml must specify host and token.

Must have workflow and adapter folder
Must be inside a dev container with access to wfgen and wfupload.

Assistant Stubs are put in the root of the workflows directory in a file named stubs_assistants.py
The tool does not find or use hand-made stubs, it assumes it is the sole owner of assistant stubs.
Hand edits to the stubs file will be over-written the next time you generate.

## Known Issues

## Release Notes

### 1.0.0

Initial version of extension

#### Blocking Features

Can't import assistant stubs from outside local folder
wfgen/upload/update terminal commands, cant fetch results. Would be nice if these were an API/service
Could clean up assistant pane if we had an api to fetch assistants by lab
Load config needs actual BE or apollo queries, slow to fetch all assets in every lab and build it myself
Need a-c 16 to clean up return values & types

##### TODO

Handle Type imports for python actions
Handle discovering actions in different files/modules
Multiple modules support
Support for installed pip package actions? cellario..etc..?
Workflow Config
Adapter Config
Loading Config
