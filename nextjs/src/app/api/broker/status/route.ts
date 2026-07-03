import { NextResponse } from "next/server";

declare global {
  var __brokerPid: number | null;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const pid = globalThis.__brokerPid;

  if (!pid) {
    return NextResponse.json({ running: false, pid: null });
  }

  const alive = isProcessAlive(pid);

  if (!alive) {
    // Clean up stale PID
    globalThis.__brokerPid = null;
  }

  return NextResponse.json({
    running: alive,
    pid: alive ? pid : null,
  });
}
