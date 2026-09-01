"use client";

/**
 * Instant Valuation — plate first, exactly like the old system's flow, with an
 * answer the old system couldn't give: the range with evidence behind it, the
 * comp cloud drawn, the comps themselves, and how fast the model actually sells.
 */

import { useState } from "react";
import { api } from "@/lib/api";
import { CompScatter } from "@/components/CompScatter";

interface ValuationResult {
  priced: boolean;
  needs_manual?: boolean;
  reason?: string;
  low?: number; mid?: number; high?: number;
  trade_in?: number;
  comps?: number; step?: string; expanded?: boolean;
  sold_comps?: number; listed_comps?: number;
  variant_used?: string;
  model_median_days_to_sell?: number;
  model_sales_observed?: number;
  vehicle?: Record<string, unknown>;
  carjam?: { year?: number; make?: string; model?: string; variant?: string } | null;
  comp_points?: { kms: number; price: number; year?: number | null; sold?: boolean }[];
  comp_rows?: { year: number | null; variant: string | null; region: string | null;
                kms: number | null; price: number | null; days: number | null;
                fuel: string | null; transmission: string | null; colour: string | null;
                status: string }[];
}

const money = (v?: number | null) => (v == null ? "—" : "$" + Math.round(v).toLocaleString());

export default function ValuePage() {
  const [plate, setPlate] = useState("");
  const [manual, setManual] = useState(false);
  const [form, setForm] = useState({ make: "", model: "", variant: "", year: "",
                                     kms: "", engine_cc: "", fuel_type: "", region: "" });
  const [kms, setKms] = useState("");
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function run(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const r = await api<ValuationResult>("/api/dealer/valuation", {
        method: "POST", body: JSON.stringify(payload),
      });
      setResult(r);
      if (r.needs_manual) setManual(true);
    } catch {
      setResult({ priced: false, reason: "Something went wrong — try manual entry." });
      setManual(true);
    } finally { setBusy(false); }
  }

  return (
    <main className="apex" style={{ maxWidth: 900, margin: "0 auto", padding: "30px 20px 90px" }}>
      <h1 className="ax-h1">Instant valuation</h1>
      <p className="ax-sub">
        Enter the plate — CarJam identifies the exact car, engine and all — or add
        it manually.
      </p>

      <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap",
                    alignItems: "center" }}>
        <input
          value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          placeholder="ABC123"
          maxLength={7}
          style={{ fontSize: 26, fontWeight: 800, letterSpacing: ".12em",
                   textTransform: "uppercase", width: 190, padding: "12px 16px",
                   borderRadius: 10, border: "2px solid #14233A", textAlign: "center" }}
        />
        <input
          value={kms} onChange={(e) => setKms(e.target.value.replace(/\D/g, ""))}
          placeholder="Kms" style={{ width: 110, padding: "13px 12px", borderRadius: 10,
                   border: "1px solid #D9DFE7", fontSize: 15 }}
        />
        <button
          disabled={busy || plate.length < 5}
          onClick={() => run({ plate, kms: kms ? Number(kms) : undefined })}
          style={{ padding: "13px 26px", borderRadius: 10, border: "1px solid #16A34A",
                   background: "#22C55E", color: "#06210F", fontWeight: 800, fontSize: 15,
                   cursor: "pointer", opacity: busy || plate.length < 5 ? 0.5 : 1 }}>
          {busy ? "…" : "Value it"}
        </button>
        <button onClick={() => setManual((m) => !m)}
          style={{ padding: "13px 18px", borderRadius: 10, border: "1px solid #D9DFE7",
                   background: "#fff", fontSize: 14, cursor: "pointer" }}>
          Enter manually
        </button>
      </div>

      {manual && (
        <div style={{ marginTop: 14, display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
          {(["make","model","variant","year","kms","engine_cc","fuel_type","region"] as const)
            .map((k) => (
              <input key={k} placeholder={k.replace("_", " ")} value={form[k]}
                onChange={set(k)}
                style={{ padding: "10px 12px", borderRadius: 9,
                         border: "1px solid #D9DFE7", fontSize: 14 }} />
          ))}
          <button
            disabled={busy || !form.make || !form.model}
            onClick={() => run({
              make: form.make, model: form.model, variant: form.variant || undefined,
              year: form.year ? Number(form.year) : undefined,
              kms: form.kms ? Number(form.kms) : undefined,
              engine_cc: form.engine_cc ? Number(form.engine_cc) : undefined,
              fuel_type: form.fuel_type || undefined, region: form.region || undefined,
            })}
            style={{ padding: "10px 16px", borderRadius: 9, border: "1px solid #16A34A",
                     background: "#22C55E", color: "#06210F", fontWeight: 700,
                     cursor: "pointer" }}>
            Value it
          </button>
        </div>
      )}

      {result?.carjam && (
        <p style={{ marginTop: 14, fontSize: 15 }}>
          Found: <strong>{result.carjam.year} {result.carjam.make} {result.carjam.model}
          {result.carjam.variant ? ` ${result.carjam.variant}` : ""}</strong>
        </p>
      )}
      {result && !result.priced && (
        <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8,
                      background: "#FFFBEB", color: "#92400E", fontSize: 14 }}>
          {result.reason}
        </div>
      )}

      {result?.priced && (
        <>
          <div className="ax-panel" style={{ marginTop: 22, padding: 24 }}>
            <div style={{ display: "flex", gap: 26, flexWrap: "wrap", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em",
                              textTransform: "uppercase", color: "#94A3B8" }}>Retail value</div>
                <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-.03em" }}>
                  {money(result.mid)}
                </div>
                <div style={{ color: "#5b6472", fontSize: 14 }}>
                  range {money(result.low)}–{money(result.high)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em",
                              textTransform: "uppercase", color: "#94A3B8" }}>Trade-in</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{money(result.trade_in)}</div>
              </div>
              {result.model_median_days_to_sell != null && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em",
                                textTransform: "uppercase", color: "#94A3B8" }}>Sells in</div>
                  <div style={{ fontSize: 28, fontWeight: 800 }}>
                    {result.model_median_days_to_sell} days
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: "#5b6472" }}>
              {result.comps} comparable cars ({result.sold_comps} sold, {result.listed_comps} listed)
              · {result.step}
              {result.variant_used ? ` · read as ${result.variant_used}` : ""}
              {result.expanded && (
                <strong style={{ color: "#92400E" }}> · net was widened — treat as indicative</strong>
              )}
            </div>
            {result.comp_points && result.comp_points.length >= 2 && (
              <CompScatter
                points={result.comp_points}
                targetKms={Number((result.vehicle as Record<string, unknown>)?.kms) || null}
                valueMid={result.mid}
              />
            )}
          </div>

          {result.comp_rows && result.comp_rows.length > 0 && (
            <>
              <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase",
                           letterSpacing: ".07em", color: "#5b6472", margin: "26px 0 10px" }}>
                The comparable cars
              </h2>
              <div className="ax-scroll">
                <table className="ax-table">
                  <thead><tr>
                    {["year","spec","region","kms","price","days","status"].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {result.comp_rows.map((c, i) => (
                      <tr key={i}>
                        <td >{c.year ?? "—"}</td>
                        <td >{c.variant ?? "—"}</td>
                        <td >{c.region ?? "—"}</td>
                        <td >{c.kms ? `${Math.round(c.kms / 1000)}k` : "—"}</td>
                        <td style={{ fontWeight: 700 }}>{money(c.price)}</td>
                        <td >{c.days ?? "—"}</td>
                        <td >
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px",
                            borderRadius: 999,
                            background: c.status === "SOLD" ? "#ECFDF5" : "#F1F5F9",
                            color: c.status === "SOLD" ? "#065F46" : "#475569" }}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}

const td: React.CSSProperties = {};
