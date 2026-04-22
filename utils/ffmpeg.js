
const { spawn } = require("child_process");
const fs = require("fs");
const { ensureDir, ensureFile } = require("./fsSafe");
const { log, raw } = require("./consoleLogger");

// ✅ SAFE spawn (no shell, no string parsing bugs)
function runFFmpeg(args, jobId) {
    return new Promise((resolve, reject) => {
        const proc = spawn("ffmpeg", args);

        proc.stdout.on("data", d => raw(`[FFMPEG STDOUT][${jobId}] ${d}`));
        proc.stderr.on("data", d => raw(`[FFMPEG STDERR][${jobId}] ${d}`));

        proc.on("close", code => {
            log(jobId, "ffmpeg:exit", { code });
            if (code !== 0) return reject(new Error(`ffmpeg failed ${code}`));
            resolve();
        });
    });
}

async function compressVideo(input, output, jobId) {
    ensureFile(input, "Input video");
    ensureDir(output);

    log(jobId, "video:input", {
        size: fs.statSync(input).size
    });

    // 🔥 MAIN (correct args array)
    try {
        await runFFmpeg([
            "-y",
            "-i", input,
            "-ss", "0",
            "-t", "30",
            "-c:v", "libx265",
            "-crf", "24",
            "-preset", "fast",
            "-pix_fmt", "yuv420p",
            output
        ], jobId);

        if (fs.existsSync(output)) return;

        throw new Error("no output");

    } catch (e) {
        log(jobId, "ffmpeg:main_failed", { message: e.message });
    }

    // 🔥 FALLBACK 1
    try {
        log(jobId, "ffmpeg:fallback1");

        await runFFmpeg([
            "-y",
            "-i", input,
            "-t", "30",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "28",
            output
        ], jobId);

        if (fs.existsSync(output)) return;

    } catch (e) {
        log(jobId, "ffmpeg:fallback1_failed", { message: e.message });
    }

    // 🔥 FALLBACK 2 (guaranteed)
    try {
        log(jobId, "ffmpeg:fallback2");

        await runFFmpeg([
            "-y",
            "-i", input,
            "-t", "30",
            "-c", "copy",
            output
        ], jobId);

        if (fs.existsSync(output)) return;

    } catch (e) {
        log(jobId, "ffmpeg:fallback2_failed", { message: e.message });
    }

    throw new Error("All ffmpeg attempts failed — no output generated");
}

module.exports = { compressVideo };
