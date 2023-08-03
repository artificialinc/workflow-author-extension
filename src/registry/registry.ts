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
import { getTags } from "@snyk/docker-registry-v2-client";

export class Registry {
  username: string;
  password: string;
  registryBase: string;
  repository: string;

  constructor(registryBase: string, repository: string, username: string, password: string) {
    this.username = username;
    this.password = password;
    this.registryBase = registryBase;
    this.repository = repository;
  }

  public static createFromGithub(githubURL: string, username: string, token: string): Registry {
    // Parse github remote url
    const url = new URL(githubURL);
    // Strip trailing .git if exists
    const path = url.pathname.endsWith(".git") ? url.pathname.slice(0, -4) : url.pathname;
    // Strip leading slash
    const pathWithoutLeadingSlash = path.startsWith("/") ? path.slice(1) : path;
    return new Registry("ghcr.io", pathWithoutLeadingSlash, username, token);
  }

  public async listTags(): Promise<string[]> {
    const tags = await getTags(this.registryBase, this.repository, this.username, this.password);
    return tags.map((tag) => {
      return `${this.registryBase}/${this.repository}:${tag}`;
    });
  }
}