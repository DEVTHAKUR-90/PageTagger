/** Validates that generated Annotaura browser packages contain the expected local-first release artifacts. */
import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const targets = ["chromium", "firefox"];
const requiredFiles = [
  "background/service-worker.js",
  "content/annotaura-content.js",
  "workspace/index.html",
  "workspace/workspace.js",
  "workspace/scratch.html",
  "workspace/scratch.js",
  "assets/icon-16.png",
  "assets/icon-32.png",
  "assets/icon-48.png",
  "assets/icon-128.png",
];

async function mustExist(path) {
  await access(path, constants.R_OK);
}

async function verifyTarget(target) {
  const directory = resolve(root, "extension", "dist", target);
  await mustExist(directory);
  for (const file of requiredFiles) await mustExist(resolve(directory, file));

  const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8"));
  if (manifest.manifest_version !== 3) throw new Error(`${target}: expected Manifest V3.`);
  if (manifest.background?.service_worker !== "background/service-worker.js") throw new Error(`${target}: service worker path is missing.`);
  if (!manifest.permissions?.includes("activeTab") || !manifest.permissions?.includes("storage")) throw new Error(`${target}: minimum user-intent and local-storage permissions are missing.`);
  if (manifest.host_permissions?.length || manifest.permissions?.some((permission) => permission === "<all_urls>" || permission === "tabs")) throw new Error(`${target}: unexpected broad page-access permission found.`);
  if (target === "firefox" && !manifest.browser_specific_settings?.gecko?.id) throw new Error("firefox: Gecko add-on ID is missing.");
  if (target === "chromium" && manifest.browser_specific_settings) throw new Error("chromium: Firefox-specific manifest fields leaked into the package.");

  const sourceFiles = await readdir(resolve(directory, "workspace"));
  const concatenated = await Promise.all(sourceFiles.filter((name) => /\.(js|html|css)$/.test(name)).map((name) => readFile(resolve(directory, "workspace", name), "utf8")));
  const remoteCodePattern = /<script[^>]+https?:\/\//i;
  if (concatenated.some((content) => remoteCodePattern.test(content))) throw new Error(`${target}: remotely hosted script detected.`);
  console.log(`✓ ${target} package verified`);
}

await Promise.all(targets.map(verifyTarget));
console.log("Annotaura package checks completed.");
