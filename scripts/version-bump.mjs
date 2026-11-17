// Copies the version from package.json into manifest.json and records the
// minimum Obsidian version for it in versions.json. Run through `npm version`.
import { readFileSync, writeFileSync } from "node:fs";

const targetVersion = process.env.npm_package_version;
if (!targetVersion) throw new Error("Run this through `npm version <patch|minor|major>`.");

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t") + "\n");

const versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[targetVersion] = manifest.minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t") + "\n");
