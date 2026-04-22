const { spawn } = require("child_process");
const fs = require("fs");
const { ensureDir } = require("./fsSafe");
const { log } = require("./consoleLogger");

async function extract(filePath, outDir, password, jobId) {
    ensureDir(outDir);

    log(jobId, "extract:start", {
        file: filePath,
        outDir,
        password: password ? "***" : null
    });

    return new Promise((resolve, reject) => {
        const args = [
            "x",           // extract with full paths
            "-y",          // yes to all prompts
            password ? `-p${password}` : "-p-",  // password or none
            filePath,
            `-o${outDir}`  // output dir (no space after -o)
        ];

        log(jobId, "extract:cmd", { bin: "unrar", args: args.map(a =>
            a.startsWith("-p") && password ? "-p***" : a
        )});

        const proc = spawn("unrar", args);

        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", d => { stdout += d.toString(); });
        proc.stderr.on("data", d => { stderr += d.toString(); });

        proc.on("close", code => {
            log(jobId, "extract:exit", { code, stderr: stderr.slice(-300) });

            if (code !== 0) {
                return reject(new Error(
                    `unrar failed (code ${code}): ${stderr.slice(-200) || stdout.slice(-200)}`
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