import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

// ── Process tracking ──
// globalThis survives HMR/route re-bundling — use it to share PID across routes.
declare global {
  var __brokerPid: number | null;
  var __brokerProcess: import("child_process").ChildProcess | null;
}

function detectPythonCommand(): string {
  // Try python first, then python3
  try {
    require("child_process").execSync("python --version", { stdio: "ignore" });
    return "python";
  } catch {
    try {
      require("child_process").execSync("python3 --version", {
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { action: string };
    const { action } = body;

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
          message: `Broker started (PID ${proc.pid})`,
          pid: proc.pid,
          log: result.log,
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
            require("child_process").execSync(
              `taskkill /PID ${proc.pid} /F /T`,
              { stdio: "ignore" },
            );
          } else {
            proc.kill("SIGTERM");
            // Give it 3s, then SIGKILL
            setTimeout(() => {
              try {
                proc.kill("SIGKILL");
              } catch {}
            }, 3000);
          }
          killed = true;
        } catch {
          // Process may already be dead
        }
      } else if (pid) {
        try {
          if (process.platform === "win32") {
            require("child_process").execSync(`taskkill /PID ${pid} /F`, {
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
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Broker] Manage error:", err);
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
