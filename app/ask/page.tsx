"use client";

/**
 * Ask Ollie — the product.
 *
 * A dealer types a question about their yard or the market and gets an answer
 * built from their own data. Dark, centred, one input. No dashboard to read
 * first, no filters to set.
 *
 * The orb is a canvas particle field. It idles slowly and spins up while a
 * question is being answered, so a fifteen-second answer feels like work being
 * done rather than a hang — which matters here, because the assistant is
 * deliberately allowed to take its time and check itself.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AssistantAnswer, Briefing, ChartSpec, api } from "@/lib/api";

const SUGGESTIONS = [
  "What are the biggest margins on the market right now?",
  "What am I holding that's over 90 days?",
  "What's selling fastest that I don't stock?",
  "What's a 2022 Ranger Wildtrak 2.0 worth with 60,000km?",
  "How many did I sell last week — up or down?",
  "Which of my cars are priced furthest from the market?",
];

interface Turn {
  role: "user" | "assistant";
  content: string;
  tools?: string[];
  chart?: ChartSpec | null;
}

export default function AskPage() {
  const [history, setHistory] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [used, setUsed] = useState<{ used: number; limit: number } | null>(null);
  const [brief, setBrief] = useState<Briefing | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // The Jarvis opening: greet and lead with the plays before any question is
  // asked. Computed server-side from the data — works with no LLM key at all.
  useEffect(() => {
    api<Briefing>("/api/dealer/briefing").then(setBrief).catch(() => null);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history, busy]);

  const ask = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setHistory((h) => [...h, { role: "user", content: q }]);
    setQuestion("");
    setBusy(true);
    setError(null);
    try {
      const res = await api<AssistantAnswer>("/api/assistant/ask", {
        method: "POST",
        body: JSON.stringify({
          question: q,
          history: history.slice(-8).map((t) => ({ role: t.role, content: t.content })),
        }),
      });
      setHistory((h) => [...h, {
        role: "assistant", content: res.answer,
        tools: res.tool_calls?.map((t) => t.name) ?? [],
        chart: res.chart ?? null,
      }]);
      setUsed({ used: res.questions_used, limit: res.questions_limit });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally { setBusy(false); }
  }, [busy, history]);

  const started = history.length > 0;

  return (
    <div className="ask-root">
      <nav className="ask-nav">
        <a href="/yard">Your yard</a>
        <a href="/value">Instant valuation</a>
        <a href="/admin/upload">Admin</a>
      </nav>
      <div className={`ask-stage${started ? " started" : ""}`}>
        <div className="ask-left">
          <Orb active={busy} />
          {!started && <h1 className="ask-title">Ask&nbsp;Ollie</h1>}

          <form className="ask-form" onSubmit={(e) => { e.preventDefault(); void ask(question); }}>
            <input
              className="ask-input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask anything about your yard or the market…"
              disabled={busy}
              autoFocus
            />
            <button className="ask-send" type="submit" disabled={busy || !question.trim()}
                    aria-label="Ask">↑</button>
          </form>

          {!started && brief && (
            <div className="ask-a ask-brief">{brief.text}</div>
          )}

          {used && (
            <div className="ask-meta">
              {used.limit - used.used} of {used.limit} questions left this month
            </div>
          )}
          {error && <div className="ask-error">{error}</div>}
        </div>

        {!started && (
          <div className="ask-suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="ask-chip" onClick={() => void ask(s)}>{s}</button>
            ))}
          </div>
        )}
      </div>

      {started && (
        <div className="ask-thread">
          {history.map((t, i) => (
            <div key={i} className={t.role === "user" ? "ask-q" : "ask-a"}>
              {t.content}
              {t.chart && <AskChart spec={t.chart} />}
              {t.tools && t.tools.length > 0 && (
                <div className="ask-src">
                  built from {Array.from(new Set(t.tools)).join(", ")}
                </div>
              )}
            </div>
          ))}
          {busy && <div className="ask-working">working it out…</div>}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}

/** Charts inside answers. SVG, dark theme, no library — the data is already in
 *  the answer, this just draws it. Diverging bars put over-market to the right
 *  in red and under-market to the left in green, which is the read a dealer
 *  wants at a glance. */
function AskChart({ spec }: { spec: ChartSpec }) {
  const W = 640, RH = 26, GAP = 8, LABEL = 190;
  const H = spec.points.length * (RH + GAP) + 30;
  const max = Math.max(...spec.points.map((p) => Math.abs(p.value)), 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, marginTop: 14 }}
         role="img" aria-label={spec.title}>
      <text x={0} y={14} fill="#6B7A8C" fontSize={12}>{spec.title}</text>
      {spec.points.map((p, i) => {
        const y = 26 + i * (RH + GAP);
        const plot = W - LABEL - 60;
        if (spec.type === "diverging") {
          const mid = LABEL + plot / 2;
          const w = (Math.abs(p.value) / max) * (plot / 2);
          const over = p.value > 0;
          return (
            <g key={i}>
              <text x={LABEL - 8} y={y + RH / 2 + 4} textAnchor="end" fill="#B9C6D4" fontSize={12}>
                {p.label.length > 26 ? p.label.slice(0, 25) + "…" : p.label}
              </text>
              <line x1={mid} y1={y - 2} x2={mid} y2={y + RH + 2} stroke="#2A3644" />
              <rect x={over ? mid : mid - w} y={y} width={Math.max(w, 1)} height={RH} rx={4}
                    fill={over ? "#F87171" : "#34D399"} opacity={0.85} />
              <text x={over ? mid + w + 6 : mid - w - 6} y={y + RH / 2 + 4}
                    textAnchor={over ? "start" : "end"} fill="#8FA1B3" fontSize={12}>
                {p.value > 0 ? "+" : ""}{p.value.toFixed(1)}%
              </text>
            </g>
          );
        }
        const w = (p.value / max) * plot;
        return (
          <g key={i}>
            <text x={LABEL - 8} y={y + RH / 2 + 4} textAnchor="end" fill="#B9C6D4" fontSize={12}>
              {p.label}
            </text>
            <rect x={LABEL} y={y} width={Math.max(w, 1)} height={RH} rx={4}
                  fill={p.warn ? "#F59E0B" : "#22C55E"} opacity={0.85} />
            <text x={LABEL + w + 6} y={y + RH / 2 + 4} fill="#8FA1B3" fontSize={12}>
              {p.value.toLocaleString()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** The orb — a dense swarm with a bright core, alive even at idle, and it
 *  spins up while Ollie works so a long answer reads as effort, not a hang. */
function Orb({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const SIZE = 300;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    // Dense toward the core: sum of two randoms biases small radii, which is
    // what makes it read as a glowing ball rather than scattered pixels.
    const N = 1400;
    const parts = Array.from({ length: N }, () => {
      const r = 14 + ((Math.random() + Math.random()) / 2) * 96;
      return {
        a: Math.random() * Math.PI * 2,
        r,
        s: (0.0025 + Math.random() * 0.006) * (r < 50 ? 1.6 : 1),
        w: Math.random() * Math.PI * 2,
        sz: 0.7 + Math.random() * 1.3,
      };
    });

    let raf = 0;
    let boost = 0;
    let t = 0;

    const draw = () => {
      t += 0.016;
      boost += ((activeRef.current ? 1 : 0) - boost) * 0.05;
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.globalCompositeOperation = "lighter";

      for (const p of parts) {
        p.a += p.s * (1 + boost * 3);
        const breathe = 1 + Math.sin(t * 0.9 + p.w) * 0.05;
        const rr = p.r * breathe;
        const x = SIZE / 2 + Math.cos(p.a) * rr;
        const y = SIZE / 2 + Math.sin(p.a) * rr * 0.86;

        const near = 1 - Math.min(p.r / 110, 1);
        const alpha = 0.05 + near * near * 0.75 + boost * 0.15;
        const hue = 162 + near * 30;
        ctx.beginPath();
        ctx.arc(x, y, p.sz * (0.8 + near), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 85%, ${48 + near * 30}%, ${alpha})`;
        ctx.fill();
      }

      const glow = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, 78);
      glow.addColorStop(0, `rgba(120,255,214,${0.35 + boost * 0.25})`);
      glow.addColorStop(0.5, `rgba(60,190,160,${0.10 + boost * 0.08})`);
      glow.addColorStop(1, "rgba(60,190,160,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.globalCompositeOperation = "source-over";

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className="ask-orb" style={{ width: 300, height: 300 }} />;
}
