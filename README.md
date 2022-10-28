# Artificial-Workflows README

## Features

Generate workflow binary and json, and one button press publish to namespace.<br/>
![](https://github.com/artificial-smahon/extension/blob/main/resources/readme/wfgen.gif)<br/>
Drag and drop config, lab id's, assistant function calls into your workflow.<br/>
![](https://github.com/artificial-smahon/extension/blob/main/resources/readme/drag_drop.gif)<br/>
ID, Type, Param checking for assistants with errors.<br/>
![](https://github.com/artificial-smahon/extension/blob/main/resources/readme/assistant_errors.png)<br/>
Ability to generate assistant stub file<br/>

## Requirements

Must have a config.yaml in your root project<br/>
Config.yaml must specify host and token.<br/>

Must have workflow and adapter folder<br/>
Must be inside a dev container with access to wfgen and wfupload.<br/>

Assistant Stubs are put in the root of the workflows directory in a file named stubs_assistants.py<br/>
The tool does not find or use hand-made stubs, it assumes it is the sole owner of assistant stubs.<br/>
Hand edits to the stubs file will be over-written the next time you generate.<br/>

## Known Issues

## Release Notes

### 1.0.0

Initial version of extension

#### Blocking Features

Can't import assistant stubs from outside local folder<br/>
wfgen/upload/update terminal commands, cant fetch results. Would be nice if these were an API/service<br/>
Could clean up assistant pane if we had an api to fetch assistants by lab<br/>
Load config needs actual BE or apollo queries, slow to fetch all assets in every lab and build it myself<br/>
Need a-c 16 to clean up return values & types<br/>

##### TODO

Handle Type imports for python actions<br/>
Handle discovering actions in different files/modules<br/>
Multiple modules support<br/>
Support for installed pip package actions? cellario..etc..?<br/>
Workflow Config<br/>
Adapter Config<br/>
Loading Config<br/>
