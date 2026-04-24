const { spawn } = require("child_process");
const fs = require("fs");
const { ensureDir } = require("./fsSafe");
const { log } = require("./consoleLogger");

async function extract(filePath, outDir, password, jobId) {
    if (!jobId) jobId = "unknown";
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
            "-o+",              // ✅ correct overwrite flag
            filePath,
            outDir              // ✅ output dir as separate argument
        ];

        log(jobId, "extract:cmd", {
            bin: "unrar",
            args
        });

        const proc = spawn("unrar", args, { shell: false });

        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", d => { stdout += d.toString(); });
        proc.stderr.on("data", d => { stderr += d.toString(); });

        proc.on("close", code => {
            log(jobId, "extract:exit", {
                code,
                stderr: stderr.slice(-300),
                stdout: stdout.slice(-300)
            });

            if (code !== 0) {
                const msg = (stderr + stdout).slice(-300);

                return reject(new Error(
                    `unrar failed (code ${code}): ${msg}`
                ));
            }

            let files = [];
            try {
                files = fs.readdirSync(outDir).filter(f => !f.startsWith("."));
            } catch { }

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