// controllers/systemController.js

const os = require("os");
const { spawnSync } = require("child_process");

function safeSpawn(cmd, args, opts = {}) {
    const res = spawnSync(cmd, args, {
        encoding: "utf-8",
        timeout: 3000,
        ...opts
    });

    if (res.error || res.status === null || res.status !== 0) return null;
    return res.stdout || "";
}

function getCpuDetails() {
    const platform = os.platform();

    try {
        if (platform === "win32") {
            const out = safeSpawn(
                "wmic",
                ["cpu", "get", "NumberOfCores,NumberOfLogicalProcessors", "/format:list"],
                { shell: false }
            );
            if (!out) return fallback();

            const coresMatch = out.match(/NumberOfCores=(\d+)/);
            const threadsMatch = out.match(/NumberOfLogicalProcessors=(\d+)/);

            return {
                physicalCores: coresMatch ? parseInt(coresMatch[1]) : null,
                logicalThreads: threadsMatch ? parseInt(threadsMatch[1]) : null
            };
        }

        if (platform === "linux") {
            const out = safeSpawn("lscpu", [], { shell: false });
            if (!out) return fallback();

            const coresMatch = out.match(/Core\(s\) per socket:\s+(\d+)/);
            const socketsMatch = out.match(/Socket\(s\):\s+(\d+)/);
            const threadsMatch = out.match(/CPU\(s\):\s+(\d+)/);

            const cores = coresMatch && socketsMatch
                ? parseInt(coresMatch[1]) * parseInt(socketsMatch[1])
                : null;

            return {
                physicalCores: cores,
                logicalThreads: threadsMatch ? parseInt(threadsMatch[1]) : null
            };
        }

        if (platform === "darwin") {
            const cores = safeSpawn("sysctl", ["-n", "hw.physicalcpu"], { shell: false });
            const threads = safeSpawn("sysctl", ["-n", "hw.logicalcpu"], { shell: false });

            return {
                physicalCores: cores ? parseInt(cores.trim()) : null,
                logicalThreads: threads ? parseInt(threads.trim()) : null
            };
        }

    } catch (e) { }

    return fallback();
}

function fallback() {
    return {
        physicalCores: null,
        logicalThreads: os.cpus().length
    };
}

function system(req, res) {
    const cpus = os.cpus();
    const cpuDetails = getCpuDetails();

    res.json({
        cpu: {
            model: cpus[0]?.model || "unknown",
            speedMHz: cpus[0]?.speed || "unknown",
            logicalThreads: cpuDetails.logicalThreads ?? cpus.length,
            physicalCores: cpuDetails.physicalCores,
            perCore: cpus.map((c, i) => ({
                core: i,
                speedMHz: c.speed
            }))
        },
        memory: {
            totalGB: (os.totalmem() / 1e9).toFixed(2),
            freeGB: (os.freemem() / 1e9).toFixed(2)
        },
        system: {
            platform: os.platform(),
            arch: os.arch(),
            uptimeSec: os.uptime()
        }
    });
}

module.exports = { system };