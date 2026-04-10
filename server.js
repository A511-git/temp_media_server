import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";

const app = express();
const PORT = 3000;

// directories
const DOWNLOAD_DIR = "./downloads";
const CHUNK_DIR = "./chunks";
const IMAGE_DIR = "./images";
const LOG_FILE = "./logs.txt";

// ensure dirs exist
[DOWNLOAD_DIR, CHUNK_DIR, IMAGE_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// logging
function log(message) {
    const time = new Date().toISOString();
    const full = `[${time}] ${message}`;
    console.log(full);
    fs.appendFileSync(LOG_FILE, full + "\n");
}

// download file
async function downloadFile(url, outputPath) {
    log(`Downloading: ${url}`);

    const response = await axios({
        url,
        method: "GET",
        responseType: "stream"
    });

    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        writer.on("finish", () => {
            log(`Download complete: ${outputPath}`);
            resolve();
        });

        writer.on("error", reject);
    });
}

// metadata
function getMetadata(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, data) => {
            if (err) return reject(err);

            log("Video Metadata:");
            log(JSON.stringify(data.format, null, 2));

            resolve(data);
        });
    });
}

// split video
function splitVideo(inputPath) {
    return new Promise((resolve, reject) => {
        log("Starting video split...");

        ffmpeg(inputPath)
            .outputOptions([
                "-c copy",
                "-map 0",
                "-f segment",
                "-segment_time 30",
                "-reset_timestamps 1"
            ])
            .output(`${CHUNK_DIR}/chunk_%03d.mp4`)
            .on("start", cmd => log(`FFmpeg: ${cmd}`))
            .on("progress", p => log(`Progress: ${p.percent || "N/A"}%`))
            .on("end", () => {
                log("Video splitting completed");
                resolve();
            })
            .on("error", err => {
                log(`Split error: ${err.message}`);
                reject(err);
            })
            .run();
    });
}

// analyze chunks
function analyzeChunks() {
    const files = fs.readdirSync(CHUNK_DIR);

    files.forEach(file => {
        const filePath = path.join(CHUNK_DIR, file);

        ffmpeg.ffprobe(filePath, (err, data) => {
            if (err) {
                log(`Error reading ${file}`);
                return;
            }

            const duration = data.format.duration;
            log(`Chunk ${file} → ${duration}s`);
            log(`URL: http://localhost:${PORT}/chunks/${file}`);
        });
    });
}

// video compression (first chunk)
function compressVideo(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        const start = Date.now();

        log("Starting video compression (chunk_000)...");

        ffmpeg(inputPath)
            .outputOptions([
                "-c:v libx264",
                "-crf 28",
                "-preset veryfast",
                "-pix_fmt yuv420p",
                "-c:a copy"
            ])
            .output(outputPath)
            .on("start", cmd => log(`FFmpeg Video: ${cmd}`))
            .on("end", () => {
                const time = (Date.now() - start) / 1000;
                log(`Video compression done in ${time}s`);
                resolve(time);
            })
            .on("error", err => {
                log(`Video compression error: ${err.message}`);
                reject(err);
            })
            .run();
    });
}

// compress first chunk
async function compressFirstChunk() {
    const input = `${CHUNK_DIR}/chunk_000.mp4`;
    const output = `${CHUNK_DIR}/chunk_000_compressed.mp4`;

    if (!fs.existsSync(input)) {
        log("chunk_000 not found");
        return;
    }

    const originalSize = fs.statSync(input).size / 1024;
    log(`Original chunk size: ${originalSize.toFixed(2)} KB`);

    const timeTaken = await compressVideo(input, output);

    const compressedSize = fs.statSync(output).size / 1024;

    log(`Compressed chunk size: ${compressedSize.toFixed(2)} KB`);
    log(`Compression ratio: ${(originalSize / compressedSize).toFixed(2)}x`);
    log(`URL: http://localhost:${PORT}/chunks/chunk_000_compressed.mp4`);
    log(`Total compression time: ${timeTaken}s`);
}

// image compression
function compressImageToWebM(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        const start = Date.now();

        log("Starting image compression...");

        ffmpeg(inputPath)
            .outputOptions([
                "-c:v libvpx-vp9",
                "-crf 30",
                "-b:v 0",
                "-pix_fmt yuv420p"
            ])
            .output(outputPath)
            .on("start", cmd => log(`FFmpeg Image: ${cmd}`))
            .on("end", () => {
                const time = (Date.now() - start) / 1000;
                log(`Image compression done in ${time}s`);
                resolve(time);
            })
            .on("error", err => {
                log(`Image error: ${err.message}`);
                reject(err);
            })
            .run();
    });
}

// ---------------- ROUTES ----------------

// video
app.get("/process", async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) return res.status(400).send("Provide ?url=");

        const filePath = `${DOWNLOAD_DIR}/input.mp4`;

        await downloadFile(url, filePath);
        await getMetadata(filePath);
        await splitVideo(filePath);

        setTimeout(async () => {
            analyzeChunks();
            await compressFirstChunk();
        }, 2000);

        res.send("Processing started. Check /logs");
    } catch (err) {
        log(`Video route error: ${err.message}`);
        res.status(500).send("Error");
    }
});

// image
app.get("/compress-image", async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) return res.status(400).send("Provide ?url=");

        const input = `${IMAGE_DIR}/input_image`;
        const output = `${IMAGE_DIR}/output.webm`;

        await downloadFile(url, input);

        const originalSize = fs.statSync(input).size / 1024;
        log(`Original size: ${originalSize.toFixed(2)} KB`);

        const timeTaken = await compressImageToWebM(input, output);

        const compressedSize = fs.statSync(output).size / 1024;

        log(`Compressed size: ${compressedSize.toFixed(2)} KB`);
        log(`Ratio: ${(originalSize / compressedSize).toFixed(2)}x`);
        log(`URL: http://localhost:${PORT}/images/output.webm`);

        res.json({
            originalKB: originalSize.toFixed(2),
            compressedKB: compressedSize.toFixed(2),
            time: timeTaken,
            url: `http://localhost:${PORT}/images/output.webm`
        });

    } catch (err) {
        log(`Image route error: ${err.message}`);
        res.status(500).send("Error");
    }
});

// static
app.use("/chunks", express.static(CHUNK_DIR));
app.use("/images", express.static(IMAGE_DIR));

// logs
app.get("/logs", (req, res) => {
    if (!fs.existsSync(LOG_FILE)) return res.send("No logs");

    const data = fs.readFileSync(LOG_FILE, "utf-8");
    res.setHeader("Content-Type", "text/plain");
    res.send(data);
});

app.listen(PORT, () => {
    log(`Server running at http://localhost:${PORT}`);
});