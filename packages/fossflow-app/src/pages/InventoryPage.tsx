import React, { useEffect, useMemo, useState } from "react";
import AppLayout from "../layouts/AppLayout";
import { isAdmin } from "../auth/auth";
import {
  createInventoryItem,
  deleteInventoryItem,
  listInventory,
  moveInventory,
  updateInventoryItem,
  listAssets,
  type InventoryCategory,
  type InventoryItem,
  type InventoryMoveType,
} from "../services/itService";

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
        border: "1px solid #EEF2F7",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid #F1F5F9",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ fontWeight: 900, color: "#0F172A" }}>{title}</div>
        <div>{right}</div>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #E2E8F0",
    outline: "none",
    fontWeight: 700,
  };
}

function buttonStyle(variant: "primary" | "ghost" | "danger" = "ghost"): React.CSSProperties {
  if (variant === "primary") {
    return {
      border: "1px solid #0EA5E9",
      background: "#0EA5E9",
      color: "#fff",
      padding: "9px 12px",
      borderRadius: 10,
      cursor: "pointer",
      fontWeight: 900,
    };
  }
  if (variant === "danger") {
    return {
      border: "1px solid #FCA5A5",
      background: "#FEF2F2",
      color: "#B91C1C",
      padding: "9px 12px",
      borderRadius: 10,
      cursor: "pointer",
      fontWeight: 900,
    };
  }
  return {
    border: "1px solid #E2E8F0",
    background: "#fff",
    padding: "9px 12px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 900,
    color: "#0F172A",
  };
}

function Pill({ label, tone }: { label: string; tone: "green" | "red" | "gray" }) {
  const map = {
    green: { bg: "#ECFDF5", fg: "#047857", bd: "#A7F3D0" },
    red: { bg: "#FEF2F2", fg: "#B91C1C", bd: "#FECACA" },
    gray: { bg: "#F8FAFC", fg: "#475569", bd: "#E2E8F0" },
  } as const;
  const t = map[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${t.bd}`,
        background: t.bg,
        color: t.fg,
        fontWeight: 900,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function fmtInt(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

type FormState = {
  id?: string;
  sku: string;
  name: string;
  category: InventoryCategory;
  unit: string;
  location: string;
  stock: string;
  minStock: string;
  notes: string;
};

const defaultForm: FormState = {
  sku: "",
  name: "",
  category: "OTHER",
  unit: "pcs",
  location: "",
  stock: "0",
  minStock: "0",
  notes: "",
};

export default function InventoryPage() {
  const canWrite = isAdmin();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<InventoryCategory | "">("");
  const [location, setLocation] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<InventoryItem | null>(null);
  const [moveType, setMoveType] = useState<InventoryMoveType>("IN");
  const [moveQty, setMoveQty] = useState("1");
  const [moveRef, setMoveRef] = useState("");
  const [moveAssetId, setMoveAssetId] = useState<string>("");
  const [assetsForMove, setAssetsForMove] = useState<{ id: string; assetTag: string; name: string }[]>([]);

  const [historyTarget, setHistoryTarget] = useState<{ id: string; name: string } | null>(null);

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const data = await listInventory({ search, category, location });
      setItems(data);
    } catch (e: any) {
      setError(e?.message || "Gagal load inventory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locations = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) if (it.location) set.add(it.location);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  function openAdd() {
    setForm(defaultForm);
    setFormOpen(true);
  }

  function openEdit(i: InventoryItem) {
    setForm({
      id: i.id,
      sku: i.sku,
      name: i.name,
      category: i.category,
      unit: i.unit || "pcs",
      location: i.location || "",
      stock: String(i.stock ?? 0),
      minStock: String(i.minStock ?? 0),
      notes: i.notes || "",
    });
    setFormOpen(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const payload = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      category: form.category,
      unit: form.unit.trim() || "pcs",
      location: form.location.trim(),
      stock: Number(form.stock || 0),
      minStock: Number(form.minStock || 0),
      notes: form.notes.trim(),
    };

    try {
      if (!payload.sku || !payload.name) {
        setError("SKU dan Nama wajib diisi");
        return;
      }
      if (!Number.isFinite(payload.stock) || payload.stock < 0) {
        setError("Stock tidak valid");
        return;
      }
      if (!Number.isFinite(payload.minStock) || payload.minStock < 0) {
        setError("Min stock tidak valid");
        return;
      }

      if (form.id) {
        await updateInventoryItem(form.id, payload);
      } else {
        await createInventoryItem(payload);
      }
      setFormOpen(false);
      await reload();
    } catch (e: any) {
      setError(e?.message || "Gagal simpan");
    }
  }

  async function onDelete(i: InventoryItem) {
    if (!canWrite) return;
    const ok = window.confirm(`Hapus inventory item ${i.sku} - ${i.name}?`);
    if (!ok) return;

    try {
      await deleteInventoryItem(i.id);
      await reload();
    } catch (e: any) {
      setError(e?.message || "Gagal hapus");
    }
  }

  function openMove(i: InventoryItem) {
    setMoveTarget(i);
    setMoveType("IN");
    setMoveQty("1");
    setMoveRef("");
    setMoveAssetId("");
    setMoveOpen(true);

    // load asset list for linking OUT -> ASSET
    (async () => {
      try {
        const a = await listAssets({});
        setAssetsForMove(a.map((x) => ({ id: x.id, assetTag: x.assetTag, name: x.name })));
      } catch {
        // ignore
      }
    })();
  }

  async function submitMove(e: React.FormEvent) {
    e.preventDefault();
    if (!moveTarget) return;
    setError("");

    const qty = Number(moveQty || 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Qty harus > 0");
      return;
    }

    try {
      await moveInventory(moveTarget.id, {
        type: moveType,
        qty,
        ref: moveRef.trim() || undefined,
      });
      setMoveOpen(false);
      await reload();
    } catch (e: any) {
      setError(e?.message || "Gagal update stock");
    }
  }

  return (
    <AppLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: "#64748B", fontWeight: 900 }}>Home &gt; Inventory</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A" }}>Inventory IT (SSD, HDD, RAM, dll)</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button style={buttonStyle()} onClick={reload}>↻ Refresh</button>
          {canWrite ? (
            <button style={buttonStyle("primary")} onClick={openAdd}>+ Add Item</button>
          ) : null}
        </div>
      </div>

      {error ? <div style={{ color: "#B91C1C", fontWeight: 900, marginBottom: 10 }}>{error}</div> : null}

      <Card
        title="Inventory List"
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              style={{ ...inputStyle(), width: 220 }}
              placeholder="Search SKU / item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") reload();
              }}
            />

            <select
              style={{ ...inputStyle(), width: 170 }}
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
            >
              <option value="">All Category</option>
              <option value="STORAGE">STORAGE</option>
              <option value="MEMORY">MEMORY</option>
              <option value="NETWORK">NETWORK</option>
              <option value="PERIPHERAL">PERIPHERAL</option>
              <option value="OTHER">OTHER</option>
            </select>

            <select
              style={{ ...inputStyle(), width: 190 }}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            >
              <option value="">All Location</option>
              {locations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>

            <button style={buttonStyle("primary")} onClick={reload}>Filter</button>
          </div>
        }
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#64748B", fontSize: 12 }}>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>SKU</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Item</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Category</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Location</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Stock</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Min</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Status</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const isLow = (i.stock ?? 0) < (i.minStock ?? 0);
                return (
                  <tr key={i.id}>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC", fontWeight: 900, color: "#0F172A" }}>{i.sku}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC", fontWeight: 800, color: "#0F172A" }}>{i.name}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC", fontWeight: 800, color: "#475569" }}>{i.category}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC", fontWeight: 800, color: "#475569" }}>{i.location || "-"}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC", fontWeight: 900, color: "#0F172A" }}>{fmtInt(i.stock ?? 0)}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC", fontWeight: 900, color: "#475569" }}>{fmtInt(i.minStock ?? 0)}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC" }}>
                      {isLow ? <Pill label="LOW" tone="red" /> : <Pill label="OK" tone="green" />}
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC" }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {canWrite ? (
                          <>
                            <button style={buttonStyle()} onClick={() => openEdit(i)}>Edit</button>
                            <button style={buttonStyle()} onClick={() => openMove(i)}>Stock</button>
                            <button style={buttonStyle()} onClick={() => setHistoryTarget({ id: i.id, name: i.name })}>History</button>
                            <button style={buttonStyle("danger")} onClick={() => onDelete(i)}>Delete</button>
                          </>
                        ) : (
                          <span style={{ color: "#64748B", fontWeight: 800 }}>Read only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {loading ? (
            <div style={{ marginTop: 10, color: "#475569", fontWeight: 800 }}>Loading...</div>
          ) : items.length === 0 ? (
            <div style={{ marginTop: 10, color: "#64748B", fontWeight: 800 }}>Tidak ada data.</div>
          ) : null}
        </div>
      </Card>

      {/* Add/Edit Modal */}
      {formOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 999,
          }}
          onMouseDown={() => setFormOpen(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 14, width: "min(720px, 100%)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 16, borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900, color: "#0F172A" }}>{form.id ? "Edit Inventory" : "Add Inventory"}</div>
              <button style={buttonStyle()} onClick={() => setFormOpen(false)}>✕</button>
            </div>

            <form onSubmit={submitForm} style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
              <div style={{ gridColumn: "span 6" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>SKU</div>
                <input style={inputStyle()} value={form.sku} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "span 6" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>Name</div>
                <input style={inputStyle()} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>

              <div style={{ gridColumn: "span 4" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>Category</div>
                <select style={inputStyle()} value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as any }))}>
                  <option value="STORAGE">STORAGE</option>
                  <option value="MEMORY">MEMORY</option>
                  <option value="NETWORK">NETWORK</option>
                  <option value="PERIPHERAL">PERIPHERAL</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
              <div style={{ gridColumn: "span 4" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>Unit</div>
                <input style={inputStyle()} value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "span 4" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>Location</div>
                <input style={inputStyle()} value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
              </div>

              <div style={{ gridColumn: "span 4" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>Stock</div>
                <input style={inputStyle()} inputMode="numeric" value={form.stock} onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "span 4" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>Min Stock</div>
                <input style={inputStyle()} inputMode="numeric" value={form.minStock} onChange={(e) => setForm((p) => ({ ...p, minStock: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "span 4" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>Notes</div>
                <input style={inputStyle()} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>

              <div style={{ gridColumn: "span 12", display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
                <button type="button" style={buttonStyle()} onClick={() => setFormOpen(false)}>Cancel</button>
                <button type="submit" style={buttonStyle("primary")}>Save</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Stock Move Modal */}
      {moveOpen && moveTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 999,
          }}
          onMouseDown={() => setMoveOpen(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 14, width: "min(640px, 100%)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 16, borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900, color: "#0F172A" }}>Stock Movement</div>
              <button style={buttonStyle()} onClick={() => setMoveOpen(false)}>✕</button>
            </div>

            <form onSubmit={submitMove} style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
              <div style={{ gridColumn: "span 12", color: "#0F172A", fontWeight: 900 }}>
                {moveTarget.sku} — {moveTarget.name}
              </div>

              <div style={{ gridColumn: "span 4" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>Type</div>
                <select style={inputStyle()} value={moveType} onChange={(e) => setMoveType(e.target.value as any)}>
                  <option value="IN">IN (Tambah)</option>
                  <option value="OUT">OUT (Kurang)</option>
                  <option value="ADJUST">ADJUST (Set)</option>
                </select>
              </div>
              <div style={{ gridColumn: "span 4" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>Qty</div>
                <input style={inputStyle()} inputMode="numeric" value={moveQty} onChange={(e) => setMoveQty(e.target.value)} />
              </div>
              <div style={{ gridColumn: "span 4" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>Ref / Notes</div>
                <input style={inputStyle()} value={moveRef} onChange={(e) => setMoveRef(e.target.value)} />
              </div>

              <div style={{ gridColumn: "span 12", display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
                <button type="button" style={buttonStyle()} onClick={() => setMoveOpen(false)}>Cancel</button>
                <button type="submit" style={buttonStyle("primary")}>Apply</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div style={{ height: 8 }} />
    </AppLayout>
  );
}
