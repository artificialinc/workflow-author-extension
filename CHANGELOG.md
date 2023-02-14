# Change Log

## [2.2.2]

- Fix bug, properly clean quotes from adapter module name and function names.
- Fix drag and drop, URI stopped being passed in plain text by default by vscode.

## [2.2.1]

- Fix bug, only allow adding adapter function calls, not modules through + button.

## [2.2.0]

- Display Adapter Actions from manually created stub files

## [2.1.0]

- Display what namespace the extension is configured and connected to in the status bar

## [2.0.0]

- Requires artificial-workflows 0.7.2 in adapter
- Namespace generated assistants by lab
- This will require assistant stubs to be regenerated for any existing adapters
- This will require imports and call sites to be updated for assistants post generation

## [1.4.2]

- Fix if workflow decorator is not the first decorator, publish tree will now find it properly
- Adding sleep to ensure generation completes before moving on to publish
- Assistant stub generation should now use assistant parameter ordering if it exists in the namespace

## [1.4.1]

- Fix bug, still need to export token from .env for publish

## [1.4.0]

- Use artificial-workflows-tools CLI to publish wf's
- This requires adapter to have artificial-workflows-tools = "\*" in their dev packages

## [1.3.2]

- Fix to always generate workflows from within workflow folder
- Fix to always wfupload from dir with config.yaml

## [1.3.1]

- Bug fix for regex on finding workflow ID's and various other elements which caused workflow publishing to fail
- Fix for icons in tree views

## [1.3.0]

- Stub generation will maintain assistant parameter ordering
  - It currently uses the param decorators as the order, not the params themselves as a stop-gap

## [1.2.0]

- Add configuration to point to:
  1. Assistant stub path: Where to read and generate the assistant stubs
  2. config.yaml path: Where to read config values from

## [1.1.4]

- Better handling of terminal creation and display while generating or publishing workflows

## [1.1.3]

- Generate binary workflow for publishing by default

## [1.1.2]

- Suppress timeout notifications, allow apollo to retry more times.

## [1.1.1]

- Allow extension to override env variables with artificial.env on activation
- Turn off flake8 in generated assistant stub file
- Throw user visible errors when failing to connect to artificial
- Show welcome content for assistants pane if no assistant stubs found

## [1.1.0]

- Pull environment variables from artificial.env, for token/secrets

## [1.0.0]

- Initial release
