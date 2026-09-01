/** Builds the audited local Annotaura source into separately installable Chromium and Firefox folders. */
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "extension", "src");
const dist = resolve(root, "extension", "dist");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function mergeManifest(base, override) {
  return { ...base, ...override, background: { ...base.background, ...override.background } };
}

async function build(target) {
  const targetPath = resolve(dist, target);
  await mkdir(targetPath, { recursive: true });
  await cp(source, targetPath, {
    recursive: true,
    filter: (filePath) => !filePath.endsWith("manifest.common.json") && !filePath.endsWith("manifest.chromium.json") && !filePath.endsWith("manifest.firefox.json"),
  });

  const base = await readJson(resolve(source, "manifest.common.json"));
  const override = await readJson(resolve(source, `manifest.${target}.json`));
  await writeFile(resolve(targetPath, "manifest.json"), `${JSON.stringify(mergeManifest(base, override), null, 2)}\n`);
}

await rm(dist, { recursive: true, force: true });
await Promise.all([build("chromium"), build("firefox")]);
console.log("Built Annotaura packages in extension/dist/chromium and extension/dist/firefox.");
