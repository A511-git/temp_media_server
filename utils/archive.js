const { spawn } = require("child_process");
const fs = require("fs");
const { ensureDir } = require("./fsSafe");
const { log } = require("./consoleLogger");
const path = require("path");

async function extract(filePath, outDir, password, jobId) {
    if (!jobId) jobId = "unknown";

    log(jobId, "extract:debug:start", { filePath, outDir });

    // 🔍 Check file existence
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

    // 🔍 Working directory
    const cwd = path.dirname(filePath);
    log(jobId, "extract:debug:cwd", { cwd });

    // 🔍 Files in cwd
    try {
        const dirFiles = fs.readdirSync(cwd);
        log(jobId, "extract:debug:cwd_files", { files: dirFiles });
    } catch (e) {
        log(jobId, "extract:debug:cwd_list_error", { message: e.message });
    }

    ensureDir(outDir);

    log(jobId, "extract:start", {
        file: filePath,
        outDir,
        password: password ? "***" : null
    });

    return new Promise((resolve, reject) => {

        const args = [
            "x",
            "-y",
            password ? `-p${password}` : "-p-",
            "-o+",
            path.basename(filePath),
            path.basename(outDir)
        ];

        log(jobId, "extract:cmd", {
            bin: "unrar",
            args
        });

        // 🔍 LIST CONTENTS FIRST (CRITICAL DEBUG)
        const listProc = spawn("unrar", ["l", path.basename(filePath)], {
            shell: false,
            cwd
        });

        let listOut = "";
        let listErr = "";

        listProc.stdout.on("data", d => listOut += d.toString());
        listProc.stderr.on("data", d => listErr += d.toString());

        listProc.on("close", code => {
            log(jobId, "extract:debug:list_output", {
                code,
                stdout: listOut.slice(-500),
                stderr: listErr.slice(-300)
            });
        });

        // 🔥 MAIN EXTRACTION
        const proc = spawn("unrar", args, {
            shell: false,
            cwd
        });

        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", d => {
            const str = d.toString();
            stdout += str;
            log(jobId, "extract:debug:stdout_chunk", {
                chunk: str.slice(0, 200)
            });
        });

        proc.stderr.on("data", d => {
            const str = d.toString();
            stderr += str;
            log(jobId, "extract:debug:stderr_chunk", {
                chunk: str.slice(0, 200)
            });
        });

        proc.on("close", code => {
            log(jobId, "extract:exit", {
                code,
                stderr: stderr.slice(-300),
                stdout: stdout.slice(-300)
            });

            // 🔍 Output directory check
            const outExists = fs.existsSync(outDir);
            log(jobId, "extract:debug:out_exists", { outExists });

            if (outExists) {
                try {
                    const files = fs.readdirSync(outDir);
                    log(jobId, "extract:debug:out_files", { files });
                } catch (e) {
                    log(jobId, "extract:debug:out_read_error", { message: e.message });
                }
            }

            if (code !== 0) {
                const msg = (stderr + stdout).slice(-300);
                return reject(new Error(`unrar failed (code ${code}): ${msg}`));
            }

            let files = [];
            try {
                files = fs.readdirSync(outDir).filter(f => !f.startsWith("."));
            } catch {}

            log(jobId, "extract:done", { extractedFiles: files.length });
            resolve(files);
        });

        proc.on("error", err => {
            log(jobId, "extract:spawn_error", { message: err.message });
            reject(new Error(`unrar not found: ${err.message}`));
        });
    });
}

module.exports = { extract };