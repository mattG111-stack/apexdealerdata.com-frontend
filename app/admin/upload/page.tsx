"use client";

/**
 * Admin: load the weekly snapshot.
 *
 * A file lands staged, not live. The ingest runs in the background because a
 * 50,000-row week takes about nine seconds — long enough that holding the
 * request open would time out behind a proxy.
 *
 * The week-ending date comes from the filename. Guessing it wrong would file a
 * week under the wrong date and corrupt every sold-derivation after it, so an
 * unreadable name is rejected rather than defaulted to today.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { DataStatus, IngestJob, Snapshot, api } from "@/lib/api";

export default function AdminUploadPage() {
  const [jobs, setJobs] = useState<IngestJob[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [status, setStatus] = useState<DataStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [j, s, d] = await Promise.all([
        api<IngestJob[]>("/api/admin/jobs?limit=10"),
        api<Snapshot[]>("/api/admin/snapshots?limit=15"),
        api<DataStatus>("/api/admin/data-status").catch(() => null),
      ]);
      setJobs(j); setSnapshots(s); setStatus(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Poll only while something is actually running.
  useEffect(() => {
    if (!jobs.some((j) => j.status === "running" || j.status === "pending")) return;
    const t = setInterval(() => { void load(); }, 2000);
    return () => clearInterval(t);
  }, [jobs, load]);

  async function upload(file: File) {
    setUploading(true); setError(null);
    const body = new FormData();
    body.append("file", file);
    try {
      await api("/api/admin/upload", { method: "POST", body });
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally { setUploading(false); }
  }

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "32px 20px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em" }}>
        Weekly data
      </h1>
      <p style={{ color: "#5b6472", marginTop: 6, fontSize: 14, maxWidth: 640 }}>
        Name the file with its week, like <code>week ending 03-08-26.csv</code>.
        It loads staged for review — dealers don&apos;t see it until you publish.
      </p>

      {error && (
        <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8,
                      background: "#FEF2F2", color: "#991B1B", fontSize: 14 }}>
          {error}
        </div>
      )}

      {status && <FeedStatus s={status} />}

      <div style={{ marginTop: 20, padding: 18, border: "1px dashed #CBD5E1",
                    borderRadius: 12, background: "#fff" }}>
        <input ref={fileRef} type="file" accept=".csv"
          disabled={uploading}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
        />
        <button
          onClick={async () => {
            setError(null);
            try {
              await api("/api/admin/reprice", { method: "POST" });
              setError("Pricing started — refresh in a few minutes to see valuations.");
            } catch (e) { setError(e instanceof Error ? e.message : "Couldn't start."); }
          }}
          style={{ marginLeft: 12, fontSize: 13, fontWeight: 600, padding: "8px 14px",
                   borderRadius: 8, border: "1px solid #D9DFE7", background: "#fff",
                   cursor: "pointer" }}>
          Price latest week now
        </button>
        <button
          onClick={async () => {
            setError(null);
            try {
              await api("/api/admin/rebuild-sales", { method: "POST" });
              setError("Rebuilding sold weeks — refresh in a few minutes.");
            } catch (e) { setError(e instanceof Error ? e.message : "Couldn't start."); }
          }}
          style={{ marginLeft: 8, fontSize: 13, fontWeight: 600, padding: "8px 14px",
                   borderRadius: 8, border: "1px solid #D9DFE7", background: "#fff",
                   cursor: "pointer" }}>
          Rebuild missing sales
        </button>
        {uploading && (
          <span style={{ marginLeft: 10, fontSize: 13, color: "#5b6472" }}>
            uploading…
          </span>
        )}
      </div>

      {jobs.length > 0 && (
        <>
          <h2 style={h2}>Recent loads</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {jobs.map((j) => (
              <div key={j.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between",
                              gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 600 }}>
                    {j.filename}
                    {j.week_ending && (
                      <span style={{ color: "#94A3B8", marginLeft: 8, fontWeight: 400 }}>
                        week ending {j.week_ending}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700,
                                 color: j.status === "failed" ? "#B91C1C"
                                      : j.status === "completed" ? "#065F46" : "#92400E" }}>
                    {j.status}{j.stage ? ` · ${j.stage}` : ""}
                  </span>
                </div>
                {j.status === "completed" && (
                  <div style={{ marginTop: 6, fontSize: 13, color: "#5b6472" }}>
                    {(j.rows_inserted ?? 0).toLocaleString()} listings
                    {j.rows_rejected ? ` · ${j.rows_rejected} rejected` : ""}
                    {j.sales_derived != null &&
                      ` · ${j.sales_derived.toLocaleString()} sales derived`}
                    {j.relists_flagged != null && j.relists_flagged > 0 &&
                      ` · ${j.relists_flagged} relists flagged`}
                  </div>
                )}
                {j.error_message && (
                  <div style={{ marginTop: 6, fontSize: 13, color: "#B91C1C" }}>
                    {j.error_message}
                  </div>
                )}
                {j.audit_warnings && (
                  <div style={{ marginTop: 6, fontSize: 13, color: "#92400E" }}>
                    {j.audit_warnings}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <h2 style={h2}>Weeks loaded</h2>
      <div style={{ display: "grid", gap: 6 }}>
        {snapshots.map((s) => (
          <div key={s.id} style={{ ...card, display: "flex",
                                   justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontWeight: 600 }}>{s.week_ending}</span>
            <span style={{ fontSize: 13, color: "#5b6472" }}>
              {s.rows_inserted.toLocaleString()} listings · {s.status}
              {!s.sales_confirmed && (
                <span title="Sales for this week aren't confirmed until the next snapshot lands — about 4% turn out to be relists."
                      style={{ marginLeft: 8, color: "#92400E" }}>
                  sales provisional
                </span>
              )}
            </span>
          </div>
        ))}
        {snapshots.length === 0 && (
          <div style={{ color: "#94A3B8" }}>Nothing loaded yet.</div>
        )}
      </div>
    </main>
  );
}

function FeedStatus({ s }: { s: DataStatus }) {
  return (
    <section style={{ marginTop: 22, border: "1px solid #E3E7EE", borderRadius: 14,
                      background: "#fff", padding: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em",
                    textTransform: "uppercase", color: "#5b6472" }}>
        What Ollie can answer from
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <Tile label="current for sale" value={s.for_sale_count.toLocaleString()}
              sub={s.for_sale_week ?? "nothing loaded"} />
        <Tile label="priced" value={s.priced.toLocaleString()}
              sub={s.for_sale_count ? `${Math.round(100 * s.priced / s.for_sale_count)}% of stock` : "—"} />
        <Tile label="sold weeks held" value={String(s.sold_weeks_held)} sub="rolling window" />
        <Tile label="sales in window" value={s.sold_total.toLocaleString()}
              sub="relists excluded" />
        <Tile label="dealers" value={s.dealers.toLocaleString()} />
      </div>

      {s.sold_window.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 6 }}>
            Sold data by week — newest first
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {s.sold_window.map((w) => (
              <span key={w.week} title={w.provisional
                ? "Provisional — about 4% of these turn out to be relists once the next week lands"
                : "Confirmed"}
                style={{ fontSize: 12.5, padding: "6px 10px", borderRadius: 8,
                         background: w.provisional ? "#FFFBEB" : "#F1F5F9",
                         color: w.provisional ? "#92400E" : "#334155" }}>
                {w.week} · {w.sales.toLocaleString()}{w.provisional ? " ·  prov" : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      <p style={{ marginTop: 12, fontSize: 12.5, color: "#94A3B8" }}>
        Pricing compares against the current for-sale week plus recent sales.
        Older weeks stay stored for back-testing but aren&apos;t what the tool reads.
      </p>
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ flex: "1 1 120px", border: "1px solid #EEF1F5", borderRadius: 10,
                  padding: "10px 13px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em",
                    textTransform: "uppercase", color: "#94A3B8" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 3,
                    letterSpacing: "-.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const h2: React.CSSProperties = {
  fontSize: 15, fontWeight: 700, marginTop: 28, marginBottom: 10,
  textTransform: "uppercase", letterSpacing: ".06em", color: "#5b6472",
};

const card: React.CSSProperties = {
  border: "1px solid #E3E7EE", borderRadius: 10, padding: "12px 14px", background: "#fff",
};
