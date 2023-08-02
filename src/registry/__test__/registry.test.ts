import { Registry } from '../registry';
import * as registryClient from "@snyk/docker-registry-v2-client";

describe('testregistry', function () {
  test('test list tags', async function () {
    const spy = jest.spyOn(registryClient, "getTags").mockResolvedValue(["aidan-5"]);

    const r = Registry.createFromGithub("https://github.com/artificialinc/artificial-adapter-template.git", "user", "token");
    const tags = await r.listTags();
    expect(tags).toContain("ghcr.io/artificialinc/artificial-adapter-template:aidan-5");
    expect(spy).toBeCalledWith("ghcr.io", "artificialinc/artificial-adapter-template", "user", "token");
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
