"use client";

import { useEffect, useRef, useState } from "react";

export interface TickLine {
  id?: string;
  level?: "info" | "warn" | "error" | "success";
  message: string;
}

/**
 * The black bar at the top of every employee page. On the dashboard it shows
 * the real activity feed; on the landing page it shows a scripted loop of the
 * work an employee does, so a visitor understands the product before reading a
 * word of copy.
 */
export function Terminal({
  lines,
  rows = 5,
  typing = false,
}: {
  lines: TickLine[];
  rows?: number;
  typing?: boolean;
}) {
  const visible = lines.slice(-rows);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <div
      className="employee-terminal w-full overflow-hidden px-4 py-3 sm:px-6"
      role="log"
      aria-live="polite"
      aria-label="Employee activity"
    >
      <div
        ref={scrollRef}
        className="mx-auto max-w-7xl overflow-y-auto"
        style={{ maxHeight: `${rows * 1.85}em`, minHeight: `${rows * 1.85}em` }}
      >
        {visible.length === 0 ? (
          <div className="opacity-50">&gt;</div>
        ) : (
          visible.map((line, i) => (
            <div key={line.id || i} className="truncate">
              <span className="tick-accent">&gt;</span>{" "}
              <span className={levelClass(line.level)}>{line.message}</span>
              {typing && i === visible.length - 1 && (
                <span className="employee-caret ml-0.5">▊</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function levelClass(level?: TickLine["level"]): string {
  if (level === "success") return "tick-ok";
  if (level === "warn") return "tick-warn";
  if (level === "error") return "tick-err";
  return "";
}

/** A scripted terminal for the marketing pages — types itself out on a loop. */
export function ScriptedTerminal({
  script,
  rows = 5,
}: {
  script: string[];
  rows?: number;
}) {
  const [lines, setLines] = useState<TickLine[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setTimeout(
      () => {
        setLines((prev) => {
          const next = [...prev, { message: script[index % script.length], id: `${index}` }];
          return next.slice(-rows);
        });
        setIndex((i) => i + 1);
      },
      index === 0 ? 400 : 1900,
    );
    return () => clearTimeout(timer);
  }, [index, script, rows]);

  return <Terminal lines={lines} rows={rows} typing />;
}
