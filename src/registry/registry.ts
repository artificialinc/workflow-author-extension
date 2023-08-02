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
