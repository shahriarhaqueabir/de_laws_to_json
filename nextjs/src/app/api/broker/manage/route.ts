import { NextRequest, NextResponse } from "next/server";
import { spawn, execSync } from "child_process";
import path from "path";
import fs from "fs";
import { errorResponse } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/sanitize";
import { REQUIRED_LOCAL_MODELS } from "@/lib/model-constants";

// ── Process tracking ──
// globalThis survives HMR/route re-bundling — use it to share PID across routes.
declare global {
  var __brokerPid: number | null;
  var __brokerProcess: import("child_process").ChildProcess | null;
}

function detectPythonCommand(): string {
  // Try python first, then python3
  try {
    execSync("python --version", { stdio: "ignore" });
    return "python";
  } catch {
    try {
      execSync("python3 --version", {
        stdio: "ignore",
      });
      return "python3";
    } catch {
      return "python"; // Fallback — will fail gracefully
    }
  }
}

function getBrokerDir(): string | null {
  // Resolve nextjs/../broker/ relative to this file
  const candidates = [
    path.resolve(process.cwd(), "..", "broker"),
    path.resolve(process.cwd(), "broker"),
    path.resolve(__dirname, "..", "..", "..", "..", "..", "broker"),
    path.resolve(__dirname, "..", "..", "..", "..", "broker"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      const brokerPy = path.join(dir, "broker.py");
      if (fs.existsSync(brokerPy)) return dir;
    }
  }
  return null;
}

function runOllamaCommand(args: string[], timeoutMs = 60_000): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("ollama", args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, stdout, stderr: `${stderr}\nTimed out after ${timeoutMs}ms` });
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr: err.message });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout, stderr });
    });
  });
}

async function ensureRequiredModels(): Promise<{ ok: boolean; message: string }> {
  try {
    // Check installed models via HTTP API instead of subprocess
    const status = await checkOllamaStatus();
    if (!status.running) {
      return {
        ok: false,
        message: "Ollama is not running on " + OLLAMA_API_URL,
      };
    }

    const missingModels = REQUIRED_LOCAL_MODELS.filter(
      (model) => !status.installedModels.some((m) => m.startsWith(model) || m.includes(model)),
    );

    if (missingModels.length === 0) {
      return { ok: true, message: "Required local models are already available" };
    }

    for (const model of missingModels) {
      // Pull model via HTTP API
      const pullRes = await fetch(`${OLLAMA_API_URL}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: model, stream: false }),
        signal: AbortSignal.timeout(1_800_000),
      });
      if (!pullRes.ok) {
        const errBody = await pullRes.text().catch(() => "");
        return {
          ok: false,
          message: `Failed to download ${model}: ${errBody || pullRes.statusText}`,
        };
      }
    }

    return { ok: true, message: `Downloaded required models: ${REQUIRED_LOCAL_MODELS.join(", ")}` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unexpected error while preparing Ollama models",
    };
  }
}

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434";

async function checkOllamaStatus(): Promise<{ running: boolean; installedModels: string[] }> {
  try {
    // Use HTTP API instead of spawning a subprocess — works reliably across
    // all platforms (Windows, macOS, Linux) without requiring ollama in PATH.
    const res = await fetch(`${OLLAMA_API_URL}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      return { running: false, installedModels: [] };
    }
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const availableModels = (data.models || []).map((m: { name: string }) => m.name);
    const installedModels = REQUIRED_LOCAL_MODELS.filter((m) =>
      availableModels.some((am: string) => am.startsWith(m) || am.includes(m)),
    );
    return { running: true, installedModels: [...installedModels] };
  } catch {
    return { running: false, installedModels: [] };
  }
}

async function checkBrokerRunning(): Promise<{ running: boolean; pid: number | null }> {
  if (globalThis.__brokerPid) {
    try {
      process.kill(globalThis.__brokerPid, 0);
      return { running: true, pid: globalThis.__brokerPid };
    } catch {
      globalThis.__brokerPid = null;
      globalThis.__brokerProcess = null;
    }
  }
  return { running: false, pid: null };
}

export async function POST(req: NextRequest) {
  // Dev-only guard: prevent process spawn/kill in production.
  // In non-development environments we report a warning instead of failing
  // hard so the UI can degrade gracefully when a local broker is unavailable.
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      {
        status: "warn",
        message:
          "Broker management is only available in local development. The local broker may be unavailable, which is expected in production or deployed environments.",
      },
      { status: 200 },
    );
  }

  try {
    const body = (await req.json()) as { action: string };
    const { action } = body;

    if (action === "status") {
      const [ollamaStatus, brokerStatus] = await Promise.all([
        checkOllamaStatus(),
        checkBrokerRunning(),
      ]);

      return NextResponse.json({
        status: "ok",
        ollama_running: ollamaStatus.running,
        installed_models: ollamaStatus.installedModels,
        broker_running: brokerStatus.running,
        broker_pid: brokerStatus.pid,
      });
    }

    if (action === "start") {
      // Check if already running
      if (globalThis.__brokerPid) {
        try {
          // Send signal 0 to check if process exists
          process.kill(globalThis.__brokerPid, 0);
          return NextResponse.json({
            status: "ok",
            message: "Broker is already running",
            pid: globalThis.__brokerPid,
          });
        } catch {
          // Stale PID — clean it up
          globalThis.__brokerPid = null;
          globalThis.__brokerProcess = null;
        }
      }

      const brokerDir = getBrokerDir();
      if (!brokerDir) {
        return NextResponse.json(
          { status: "error", message: "Could not find broker/ directory" },
          { status: 500 },
        );
      }

      const pythonCmd = detectPythonCommand();
      const modelStatus = await ensureRequiredModels();
      if (!modelStatus.ok) {
        console.warn(`[Broker] Model preparation warning: ${modelStatus.message}`);
      }

      const proc = spawn(pythonCmd, ["broker.py"], {
        cwd: brokerDir,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: false,
      });

      globalThis.__brokerProcess = proc;
      globalThis.__brokerPid = proc.pid ?? null;

      // Wait for startup message or fallback timeout
      const startupTimeout = 8_000;
      let started = false;

      const result = await new Promise<{ ok: boolean; log: string }>(
        (resolve) => {
          let stdoutBuf = "";
          let stderrBuf = "";

          const onData = (chunk: string) => {
            stdoutBuf += chunk;
            stderrBuf += chunk;
            const combined = stdoutBuf + stderrBuf;
            if (
              combined.includes("Uvicorn running") ||
              combined.includes("Starting broker") ||
              combined.includes("Application startup") ||
              combined.includes("uvicorn")
            ) {
              started = true;
              resolve({ ok: true, log: combined.slice(0, 500) });
            }
          };

          proc.stdout?.on("data", (data: Buffer) => onData(data.toString()));
          proc.stderr?.on("data", (data: Buffer) => onData(data.toString()));

          proc.on("error", (err) => {
            resolve({ ok: false, log: err.message });
          });

          proc.on("exit", (code) => {
            if (!started) {
              resolve({
                ok: false,
                log: `Process exited with code ${code}\n${stderrBuf.slice(0, 300)}`,
              });
            }
          });

          // Fallback timeout — assume started if no error after 8s
          setTimeout(() => {
            if (!started) {
              started = true;
              resolve({
                ok: true,
                log: `Started with PID ${proc.pid} (startup message not confirmed within ${startupTimeout}ms)`,
              });
            }
          }, startupTimeout);
        },
      );

      if (result.ok) {
        console.log(`[Broker] Started broker (PID ${proc.pid})`);
        return NextResponse.json({
          status: "ok",
          message: `Broker started (PID ${proc.pid})${modelStatus.ok ? "" : `; model prep warning: ${modelStatus.message}`}`,
          pid: proc.pid,
          log: result.log,
          modelStatus,
        });
      } else {
        console.error(`[Broker] Failed to start broker: ${result.log}`);
        globalThis.__brokerPid = null;
        globalThis.__brokerProcess = null;
        return NextResponse.json(
          { status: "error", message: `Failed to start broker: ${result.log}` },
          { status: 500 },
        );
      }
    }

    if (action === "stop") {
      const pid = globalThis.__brokerPid;
      const proc = globalThis.__brokerProcess;
      let killed = false;

      if (proc && proc.pid) {
        // Kill the process tree
        try {
          if (process.platform === "win32") {
            execSync(`taskkill /PID ${proc.pid} /F /T`, { stdio: "ignore" });
          } else {
            proc.kill("SIGTERM");
            // Give it 3s, then SIGKILL
            setTimeout(() => {
              try {
                proc.kill("SIGKILL");
              } catch { }
            }, 3000);
          }
          killed = true;
        } catch {
          // Process may already be dead
        }
      } else if (pid) {
        try {
          if (process.platform === "win32") {
            execSync(`taskkill /PID ${pid} /F`, {
              stdio: "ignore",
            });
          } else {
            process.kill(pid, "SIGTERM");
          }
          killed = true;
        } catch {
          // Already dead
        }
      }

      globalThis.__brokerPid = null;
      globalThis.__brokerProcess = null;

      return NextResponse.json({
        status: "ok",
        message: killed
          ? `Broker process terminated`
          : "No broker process found (already stopped)",
      });
    }

    return NextResponse.json(
      { status: "error", message: `Unknown action: ${action}` },
      { status: 400 },
    );
  } catch (err: unknown) {
    console.error("[Broker] Manage error:", err);
    return errorResponse("SERVER_ERROR", sanitizeErrorMessage(err), 500);
  }
}
