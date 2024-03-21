/*
Copyright 2023 Artificial, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
 limitations under the License.
*/
import { Registry } from '../registry';
import * as registryClient from "@snyk/docker-registry-v2-client";

describe('testregistry', function () {
  test('test list tags - normal', async function () {
    const spy = jest.spyOn(registryClient, "getTags").mockResolvedValue(["aidan-5", "aidan-6"]);

    const r = Registry.createFromGithub("https://github.com/artificialinc/artificial-ADAPTER-template.git", "user", "token");
    const tags = await r.listTags();
    expect(tags).toContain("ghcr.io/artificialinc/artificial-adapter-template:aidan-5");
    expect(spy).toBeCalledWith("ghcr.io", "artificialinc/artificial-adapter-template", "user", "token");
    expect(tags).toStrictEqual(["ghcr.io/artificialinc/artificial-adapter-template:aidan-6", "ghcr.io/artificialinc/artificial-adapter-template:aidan-5"]);
   });

     test('test list tags - capitals in name', async function () {
    const spy = jest.spyOn(registryClient, "getTags").mockResolvedValue(["aidan-5", "aidan-6"]);

    const r = Registry.createFromGithub("https://github.com/artificialinc/artificial-adapter-template.git", "user", "token");
    const tags = await r.listTags();
    expect(tags).toContain("ghcr.io/artificialinc/artificial-adapter-template:aidan-5");
    expect(spy).toBeCalledWith("ghcr.io", "artificialinc/artificial-adapter-template", "user", "token");
    expect(tags).toStrictEqual(["ghcr.io/artificialinc/artificial-adapter-template:aidan-6", "ghcr.io/artificialinc/artificial-adapter-template:aidan-5"]);
   });

  test('test list tags ssh', async function () {
    const spy = jest.spyOn(registryClient, "getTags").mockResolvedValue(["aidan-5"]);

    const r = Registry.createFromGithub("git@github.com:artificialinc/artificial-adapter-template.git", "user", "token");
    const tags = await r.listTags();
    expect(tags).toContain("ghcr.io/artificialinc/artificial-adapter-template:aidan-5");
    expect(spy).toBeCalledWith("ghcr.io", "artificialinc/artificial-adapter-template", "user", "token");
   });

  test('test list tags non-github', async function () {
    const spy = jest.spyOn(registryClient, "getTags").mockResolvedValue(["aidan-5"]);

    expect(() => {Registry.createFromGithub("https://gitlab.com/artificialinc/artificial-adapter-template.git", "user", "token");}).toThrow("Invalid github url: https://gitlab.com/artificialinc/artificial-adapter-template.git");
   });
  test('test list tags real world', async function () {
    // Skip in CI
    if (process.env.CI) {
      console.log("Skipping test");
      return;
    }
    const r = Registry.createFromGithub("https://github.com/artificialinc/artificial-adapter-template.git", process.env.GH_USER || "", process.env.GH_TOKEN || "");
    const tags = await r.listTags();
    console.log(tags);
  }, 10000);
});
