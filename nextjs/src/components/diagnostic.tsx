"use client";

import { useEffect, useState, useId } from "react";

const LOG_PREFIX = "[DIAG]";

export function Diagnostics() {
  const id = useId();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [bodyInfo, setBodyInfo] = useState("waiting...");

  // Capture uncaught errors
  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      const msg = `[UNCAUGHT] ${event.message} at ${event.filename}:${event.lineno}`;
      console.error(`${LOG_PREFIX} ${msg}`);
      setErrors((prev) => [...prev, msg]);
    };
    window.addEventListener("error", handler);
    return () => window.removeEventListener("error", handler);
  }, []);

  useEffect(() => {
    console.log(`${LOG_PREFIX} [${id}] Diagnostics mounted`);
    setStep(1);
  }, [id]);

  useEffect(() => {
    if (step === 1) {
      setStep(2);
    }
  }, [step]);

  // Check body state after hydration
  useEffect(() => {
    try {
      const cls = document.body?.className?.slice(0, 40) || "?";
      const cs = window.getComputedStyle(document.body);
      setBodyInfo(`cls=${cls} bg=${cs.background?.slice(0, 30) || "?"}`);
    } catch {
      setBodyInfo("error reading body");
    }
  }, [step]);

  useEffect(() => {
    console.log(
      `[DIAG] [${id}] step=${step} | errors=${errors.length} | ${bodyInfo}`,
    );
  }, [step, errors, bodyInfo, id]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        right: 0,
        zIndex: 99999,
        pointerEvents: "none",
        padding: "4px 10px",
        font: "11px/1.3 monospace",
        background: errors.length ? "#cc3333" : "#1a1a1a",
        color: errors.length ? "#fff" : "#999",
        border: "1px solid #333",
        maxWidth: "60vw",
        overflow: "hidden",
      }}
      id="diag-panel"
    >
      <div>React: {step >= 1 ? "mounted ✓" : "pending..."}</div>
      <div>Hydrated: {step >= 2 ? "✓" : "..."}</div>
      <div>{bodyInfo}</div>
      {errors.length > 0 && (
        <div style={{ color: "#ff6666" }}>
          Errors ({errors.length}): {errors.join(" | ")}
        </div>
      )}
    </div>
  );
}
