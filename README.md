# Artificial-Workflows README

## Features

![](https://github.com/artificial-smahon/extension/blob/main/resources/readme/assistant_errors.png)
![](https://github.com/artificial-smahon/extension/blob/main/resources/readme/wfgen.gif)
![](https://github.com/artificial-smahon/extension/blob/main/resources/readme/drag_drop.gif)
Generate adapter action stubs for workflows
Generate assistant action stubs for workflows
Generate function calls for adapter and assistant actions inside the workflow

## Requirements

Must have a config.yaml in your root project
Config.yaml must specify host and token.

Must have workflow and adapter folder
Currently for adapter actions, just looks for an actions.py file
Must be inside a dev container with access to wfgen, etc..

## Known Issues

## Release Notes

### 0.0.1

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
