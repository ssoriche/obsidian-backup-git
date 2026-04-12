import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.env.npm_package_version;
if (!targetVersion) {
    console.error("npm_package_version is not set — run this via `bun pm version`.");
    process.exit(1);
}

// Read and validate all inputs before writing anything
const manifest = JSON.parse(readFileSync("plugin/manifest.json", "utf8"));
if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) {
    console.error("plugin/manifest.json does not contain a valid JSON object.");
    process.exit(1);
}
const { minAppVersion } = manifest;
if (!minAppVersion) {
    console.error("plugin/manifest.json is missing a valid minAppVersion field.");
    process.exit(1);
}

const versions = JSON.parse(readFileSync("plugin/versions.json", "utf8"));
if (versions === null || typeof versions !== "object" || Array.isArray(versions)) {
    console.error("plugin/versions.json does not contain a valid JSON object.");
    process.exit(1);
}

// All inputs valid — write both files
manifest.version = targetVersion;
writeFileSync("plugin/manifest.json", JSON.stringify(manifest, null, "\t") + "\n");

if (versions[targetVersion] !== minAppVersion) {
    versions[targetVersion] = minAppVersion;
    writeFileSync("plugin/versions.json", JSON.stringify(versions, null, "\t") + "\n");
}
