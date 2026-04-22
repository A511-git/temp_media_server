
const fs = require("fs");
const path = require("path");


const ROOT_DIR = process.cwd(); // main repo
const OUTPUT_FILE = path.join(ROOT_DIR, "CODE.md");

const EXCLUDED_DIRS = new Set([
    "node_modules",
    ".git",
    ".vscode",
    "v1",
    "temp",
    "output",
]);

const EXCLUDED_FILES = [
    ".env",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    ".DS_Store",
    "CODE.md",
    "collect-code.js"
];


// reset / create output file
fs.writeFileSync(OUTPUT_FILE, "# Consolidated Codebase\n\n", "utf8");

function shouldExcludeFile(fileName) {
    if (EXCLUDED_FILES.includes(fileName)) return true;
    if (fileName.startsWith(".env")) return true;
    return false;
}

function walkDirectory(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // skip excluded directories
        if (entry.isDirectory()) {
            if (EXCLUDED_DIRS.has(entry.name)) continue;
            walkDirectory(fullPath);
            continue;
        }

        // skip excluded files
        if (shouldExcludeFile(entry.name)) continue;

        // read file content safely
        try {
            const content = fs.readFileSync(fullPath, "utf8");
            const relativePath = path.relative(ROOT_DIR, fullPath);

            fs.appendFileSync(
                OUTPUT_FILE,
                `\n\n## File: ${relativePath} \n\n` +
                "```js\n" +
                content +
                "\n```\n",
                "utf8"
            );
        } catch {
            // skip binary / unreadable files silently
        }
    }
}

walkDirectory(ROOT_DIR);

console.log("✅ All code collected into CODE.md");
