# Change Log

## [3.2.5]

- Instance sign-in accepts more flexible urls

## [3.2.3]

- Fix Codespace login

## [3.2.2]

- Remove command from command palette

## [3.2.0]

- Add Sign-In feature

## [3.1.8]

- Loading Config View

## [3.1.7]

- Dependency Updates

## [3.1.6]

- Dependency Updates

## [3.1.5]

- Get namespace/org from labmanager when available

## [3.1.4]

- Remove action ability doc string for dropped functions

## [3.1.2]

- Fix missing remote origin on startup by forcing lowercase repo

## [3.1.1]

- Reverse returned list of tags from ghcr.io

## [3.1.0]

- Enable update adapter image outside of dev mode

## [3.0.5]

- Try both forms of looking for management actions.

## [3.0.4]

- Fix assistant type matching for single return type

## [3.0.3]

- Use built-in icons to fix issues in Codespaces of custom icons not always loading properly

## [3.0.2]

- Various bug fixes and cleanup

## [3.0.1]

- Fix drag and drop for assistants, casing was sometimes off

## [3.0.0]

- Generate Assistant Return Parameters
- Will have significant changes to assistant stub files, swaps to param ID's instead of names
  --The benefit here is changing assistant input/output names will no longer invalidate stubs
- Should work with pre-assistant outputs
- NS requires workflows-service 0.2.15+
- NS requires Lab Manager 10.12
- Adapter requires artificial-workflows-tools 0.5.0
- Adapter requires artificial-workflows 0.13.0

## [2.8.3]

- Don't publish wf's when generate fails

## [2.8.2]

- Fix proto loading
- Add logging around git config
- Use new adapter list endpoint
- Add grpc retry for all channels

## [2.8.1]

- Alphabetize in assistant view and action modules
- Fix codelens when files go missing from disk

## [2.8.0]

- Add ability to list adapters

## [2.7.4]

- Fix bug dropping lab id's
- Add snippet for secrets.yaml config "token"

## [2.7.3]

- Fix bug in handling git remote urls
- Add file watch to .env file

## [2.7.2]

- Update extension dependencies

## [2.7.1]

- Add ability to list images for adapter updates
- Add deadline to reflection calls

## [2.7.0]

- Individual Lab/Assistant Import & Export
- Directly open workflows by clicking on tree items

## [2.6.2]

- Fix config bug on swapping configuration contexts for import/export

## [2.6.1]

- Add mock up Adapter Action functionality behind dev mode

## [2.6.0]

- Import/Export of Lab/Assistants
  - Requires artificial-cli 0.0.10 in adapter template

## [2.5.1]

- AlphaNumeric sort for tree views

## [2.5.0]

- CodeLens for publishing workflow above workflow decorators

## [2.4.2]

- Fix for adapter common 16 module naming scheme

## [2.4.1]

- Fix for publishing multiple workflows in same file

## [2.4.0]

- Config change. Config pulled from configs folder using common command line tool
- Debounced apollo errors when config is incorrect to stop spamming notifications

## [2.3.0]

- No more custom config. All connection info comes from .env

## [2.2.4]

- Fix for config, only can override token from artificial.env, not host

## [2.2.3]

- Adapter tree view incorrectly cleared tree items when viewing new child of tree, breaking drag & drop

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
