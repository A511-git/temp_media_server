
const fs = require("fs");
const path = require("path");

function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function ensureFile(filePath, label = "File") {
    if (!fs.existsSync(filePath)) {
        throw new Error(`${label} missing: ${filePath}`);
    }
}

function safeSize(file) {
    return fs.existsSync(file) ? fs.statSync(file).size : null;
}

module.exports = { ensureDir, ensureFile, safeSize };
