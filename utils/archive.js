const fs = require("fs");
const path = require("path");
const { ensureDir } = require("./fsSafe");
const { log } = require("./consoleLogger");

const Seven = require("node-7z");
const path7za = require("7zip-bin").path7za;

async function extract(filePath, outDir, password, jobId) {
    if (!jobId) jobId = "unknown";

    log(jobId, "extract:debug:start", { filePath, outDir });

    // 🔍 File existence check
    const fileExists = fs.existsSync(filePath);
    log(jobId, "extract:debug:file_exists", { fileExists });

    if (!fileExists) {
        throw new Error(`File missing before extraction: ${filePath}`);
    }

    // 🔍 File size
    try {
        const size = fs.statSync(filePath).size;
        log(jobId, "extract:debug:file_size", { size });
    } catch (e) {
        log(jobId, "extract:debug:file_size_error", { message: e.message });
    }

    ensureDir(outDir);

    log(jobId, "extract:start", {
        file: filePath,
        outDir,
        password: password ? "***" : null
    });

    return new Promise((resolve, reject) => {
        const stream = Seven.extractFull(filePath, outDir, {
            $bin: path7za,
            password: password || undefined
        });

        // 🔍 Progress logging
        stream.on("progress", progress => {
            log(jobId, "extract:progress", progress);
        });

        // 🔍 Each extracted file
        stream.on("data", data => {
            log(jobId, "extract:file", {
                file: data.file
            });
        });

        // 🔍 Done
        stream.on("end", () => {
            log(jobId, "extract:done");

            let files = [];
            try {
                files = fs.readdirSync(outDir).filter(f => !f.startsWith("."));
                log(jobId, "extract:debug:out_files", { files });
            } catch (e) {
                log(jobId, "extract:debug:out_read_error", { message: e.message });
            }

            resolve(files);
        });

        // 🔍 Error handling
        stream.on("error", err => {
            log(jobId, "extract:error", {
                message: err.message,
                stack: err.stack
            });

            reject(new Error(`7z extraction failed: ${err.message}`));
        });
    });
}

module.exports = { extract };