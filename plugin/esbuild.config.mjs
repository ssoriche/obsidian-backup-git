import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import { copyFileSync, mkdirSync, existsSync, writeFileSync } from "fs";

const prod = process.argv[2] === "production";

// Ensure build directory exists
if (!existsSync("build")) {
    mkdirSync("build");
}

// Copy manifest and styles
copyFileSync("manifest.json", "build/manifest.json");

// Create empty styles.css if it doesn't exist
if (!existsSync("build/styles.css")) {
    writeFileSync("build/styles.css", "/* Styles for Local Git plugin */\n");
}

const context = await esbuild.context({
    entryPoints: ["src/main.ts"],
    bundle: true,
    platform: "node",
    external: [
        "obsidian",
        "electron",
        "@codemirror/autocomplete",
        "@codemirror/collab",
        "@codemirror/commands",
        "@codemirror/language",
        "@codemirror/lint",
        "@codemirror/search",
        "@codemirror/state",
        "@codemirror/view",
        "@lezer/common",
        "@lezer/highlight",
        "@lezer/lr",
        ...builtins,
    ],
    format: "cjs",
    target: "es2018",
    logLevel: "info",
    sourcemap: prod ? false : "inline",
    treeShaking: true,
    outfile: "build/main.js",
});

if (prod) {
    await context.rebuild();
    process.exit(0);
} else {
    await context.watch();
}
