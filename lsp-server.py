############################################################################
# Copyright(c) Open Law Library. All rights reserved.                      #
# See ThirdPartyNotices.txt in the project root for additional notices.    #
#                                                                          #
# Licensed under the Apache License, Version 2.0 (the "License")           #
# you may not use this file except in compliance with the License.         #
# You may obtain a copy of the License at                                  #
#                                                                          #
#     http: // www.apache.org/licenses/LICENSE-2.0                         #
#                                                                          #
# Unless required by applicable law or agreed to in writing, software      #
# distributed under the License is distributed on an "AS IS" BASIS,        #
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. #
# See the License for the specific language governing permissions and      #
# limitations under the License.                                           #
############################################################################
import argparse
import logging
import os
from dataclasses import asdict

from artificial.adapter_common.command_line import AdapterProgramConfig, AdConfigProps
from artificial.workflows.tools.commands.stubs import _adapterstubs_entry_point
from artificial.workflows.tools.core.command_context import CommandContext
from artificial.workflows.tools.core.config import Config
from lsprotocol import types
from pygls.server import LanguageServer

server = LanguageServer('artificial-workflows-lsp', 'v1')


@server.command('artificial-workflows-lsp.getConfig')
async def get_config(ls: LanguageServer, args) -> dict:
    os.environ['ARTIFICIAL_CONFIG_ROOT'] = '/Users/aidan/Development/Artificial/artificial-benchling-resource-library/configs'
    cfg = AdConfigProps('')
    d = cfg.config.to_dataclass(AdapterProgramConfig)
    return asdict(d)


@server.command('artificial-workflows-lsp.generateActionStubs')
async def geerate_action_stubs(ls: LanguageServer, args) -> dict:
    logging.info(f'Command: {args}')

    await _adapterstubs_entry_point(
        CommandContext(
            arguments=argparse.Namespace(stubs=args[1], plugin_module=args[0]),
            config=Config(),
            alabpy=None,  # type: ignore
            auth=None,  # type: ignore
            redis_connection_pool=None,
        )
    )
    return {'config': 'config'}


async def generate_action_stubs():
    await _adapterstubs_entry_point(
        CommandContext(
            arguments=argparse.Namespace(
                stubs='/Users/aidan/Development/Artificial/artificial-benchling-resource-library/workflow/stubs/stubs_actions.py',
                plugin_module='adapter.main.plugin',
            ),
            config=Config(),
            alabpy=None,  # type: ignore
            auth=None,  # type: ignore
            redis_connection_pool=None,
        )
    )


@server.feature(types.NOTEBOOK_DOCUMENT_DID_SAVE)
async def did_save_notebook(params: types.DidSaveNotebookDocumentParams) -> None:
    """LSP handler for notebookDocument/didSave request."""
    await generate_action_stubs()


@server.feature(types.TEXT_DOCUMENT_DID_SAVE)
async def did_save(params: types.DidSaveTextDocumentParams) -> None:
    """LSP handler for textDocument/didSave request."""
    await generate_action_stubs()


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(message)s')

    server.start_io()

