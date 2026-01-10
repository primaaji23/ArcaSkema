import React, { useEffect, useMemo, useState } from "react";
import AppLayout from "../layouts/AppLayout";
import { isAdmin } from "../auth/auth";
import {
  createAsset,
  deleteAsset,
  listAssets,
  updateAsset,
  type Asset,
  type AssetStatus,
  type AssetType,
} from "../services/itService";
import AssetHistoryModal from "../components/AssetHistoryModal";

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

function Pill({ label, tone }: { label: string; tone: "green" | "blue" | "amber" | "gray" }) {
  const map = {
    green: { bg: "#ECFDF5", fg: "#047857", bd: "#A7F3D0" },
    blue: { bg: "#EFF6FF", fg: "#1D4ED8", bd: "#BFDBFE" },
    amber: { bg: "#FFFBEB", fg: "#B45309", bd: "#FDE68A" },
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

type FormState = {
  id?: string;
  assetTag: string;
  name: string;
  type: AssetType;
  brand: string;
  model: string;
  serialNumber: string;
  status: AssetStatus;
  assignedTo: string;
  location: string;
  purchaseDate: string;
  warrantyEnd: string;
  notes: string;
};

const defaultForm: FormState = {
  assetTag: "",
  name: "",
  type: "OTHER",
  brand: "",
  model: "",
  serialNumber: "",
  status: "IN_STOCK",
  assignedTo: "",
  location: "",
  purchaseDate: "",
  warrantyEnd: "",
  notes: "",
};

export default function AssetsPage() {
  const canWrite = isAdmin();

  const [items, setItems] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AssetStatus | "">("");
  const [type, setType] = useState<AssetType | "">("");
  const [location, setLocation] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);

  const [historyAsset, setHistoryAsset] = useState<{
    id: string;
    name: string;
  } | null>(null);


  async function reload() {
    setLoading(true);
    setError("");
    try {
      const data = await listAssets({ search, status, type, location });
      setItems(data);
    } catch (e: any) {
      setError(e?.message || "Gagal load assets");
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

  function openEdit(a: Asset) {
    setForm({
      id: a.id,
      assetTag: a.assetTag,
      name: a.name,
      type: a.type,
      brand: a.brand || "",
      model: a.model || "",
      serialNumber: a.serialNumber || "",
      status: a.status,
      assignedTo: a.assignedTo || "",
      location: a.location || "",
      purchaseDate: a.purchaseDate || "",
      warrantyEnd: a.warrantyEnd || "",
      notes: a.notes || "",
    });
    setFormOpen(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const payload: Partial<Asset> = {
      assetTag: form.assetTag.trim(),
      name: form.name.trim(),
      type: form.type,
      brand: form.brand.trim(),
      model: form.model.trim(),
      serialNumber: form.serialNumber.trim(),
      status: form.status,
      assignedTo: form.assignedTo.trim(),
      location: form.location.trim(),
      purchaseDate: form.purchaseDate.trim(),
      warrantyEnd: form.warrantyEnd.trim(),
      notes: form.notes.trim(),
    };

    try {
      if (!payload.assetTag || !payload.name) {
        setError("Asset Tag dan Nama wajib diisi");
        return;
      }

      if (form.id) {
        await updateAsset(form.id, payload);
      } else {
        await createAsset(payload);
      }

      setFormOpen(false);
      await reload();
    } catch (e: any) {
      setError(e?.message || "Gagal simpan");
    }
  }

  async function onDelete(a: Asset) {
    if (!canWrite) return;
    const ok = window.confirm(`Hapus asset ${a.assetTag} - ${a.name}?`);
    if (!ok) return;

    try {
      await deleteAsset(a.id);
      await reload();
    } catch (e: any) {
      setError(e?.message || "Gagal hapus");
    }
  }

  return (
    <AppLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: "#64748B", fontWeight: 900 }}>Home &gt; Assets</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A" }}>Assets IT (Laptop, PC, Server, dll)</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button style={buttonStyle()} onClick={reload}>↻ Refresh</button>
          {canWrite ? (
            <button style={buttonStyle("primary")} onClick={openAdd}>+ Add Asset</button>
          ) : null}
        </div>
      </div>

      {error ? <div style={{ color: "#B91C1C", fontWeight: 900, marginBottom: 10 }}>{error}</div> : null}

      <Card
        title="Assets List"
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              style={{ ...inputStyle(), width: 220 }}
              placeholder="Search assetTag / name / serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") reload();
              }}
            />

            <select style={{ ...inputStyle(), width: 170 }} value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="">All Status</option>
              <option value="IN_USE">IN_USE</option>
              <option value="IN_STOCK">IN_STOCK</option>
              <option value="REPAIR">REPAIR</option>
              <option value="RETIRED">RETIRED</option>
            </select>

            <select style={{ ...inputStyle(), width: 170 }} value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="">All Type</option>
              <option value="LAPTOP">LAPTOP</option>
              <option value="PC">PC</option>
              <option value="SERVER">SERVER</option>
              <option value="NETWORK">NETWORK</option>
              <option value="PRINTER">PRINTER</option>
              <option value="OTHER">OTHER</option>
            </select>

            <select style={{ ...inputStyle(), width: 190 }} value={location} onChange={(e) => setLocation(e.target.value)}>
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
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Asset Tag</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Name</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Type</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Serial</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Owner</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Location</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Status</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => {
                const tone =
                  a.status === "IN_USE"
                    ? "green"
                    : a.status === "IN_STOCK"
                    ? "blue"
                    : a.status === "REPAIR"
                    ? "amber"
                    : "gray";

                return (
                  <tr key={a.id}>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC", fontWeight: 900, color: "#0F172A" }}>{a.assetTag}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC", fontWeight: 800, color: "#0F172A" }}>{a.name}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC", fontWeight: 800, color: "#475569" }}>{a.type}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC", fontWeight: 800, color: "#475569" }}>{a.serialNumber || "-"}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC", fontWeight: 800, color: "#475569" }}>{a.assignedTo || "-"}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC", fontWeight: 800, color: "#475569" }}>{a.location || "-"}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC" }}>
                      <Pill label={a.status} tone={tone as any} />
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC" }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          onClick={() => setHistoryAsset({ id: a.id, name: a.name })}
                        >
                          History
                        </button>
                        
                        {canWrite ? (
                          <>
                            <button style={buttonStyle()} onClick={() => openEdit(a)}>Edit</button>
                            <button style={buttonStyle("danger")} onClick={() => onDelete(a)}>Delete</button>
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
            style={{ background: "#fff", borderRadius: 14, width: "min(900px, 100%)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 16, borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900, color: "#0F172A" }}>{form.id ? "Edit Asset" : "Add Asset"}</div>
              <button style={buttonStyle()} onClick={() => setFormOpen(false)}>✕</button>
            </div>

            <form onSubmit={submitForm} style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
              <div style={{ gridColumn: "span 4" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>Asset Tag</div>
                <input style={inputStyle()} value={form.assetTag} onChange={(e) => setForm((p) => ({ ...p, assetTag: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "span 8" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>Name</div>
                <input style={inputStyle()} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>

              <div style={{ gridColumn: "span 4" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>Type</div>
                <select style={inputStyle()} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as any }))}>
                  <option value="LAPTOP">LAPTOP</option>
                  <option value="PC">PC</option>
                  <option value="SERVER">SERVER</option>
                  <option value="NETWORK">NETWORK</option>
                  <option value="PRINTER">PRINTER</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
              <div style={{ gridColumn: "span 4" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>Status</div>
                <select style={inputStyle()} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as any }))}>
                  <option value="IN_USE">IN_USE</option>
                  <option value="IN_STOCK">IN_STOCK</option>
                  <option value="REPAIR">REPAIR</option>
                  <option value="RETIRED">RETIRED</option>
                </select>
              </div>
              <div style={{ gridColumn: "span 4" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>Location</div>
                <input style={inputStyle()} value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
              </div>

              <div style={{ gridColumn: "span 4" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>Brand</div>
                <input style={inputStyle()} value={form.brand} onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "span 4" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>Model</div>
                <input style={inputStyle()} value={form.model} onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "span 4" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>Serial Number</div>
                <input style={inputStyle()} value={form.serialNumber} onChange={(e) => setForm((p) => ({ ...p, serialNumber: e.target.value }))} />
              </div>

              <div style={{ gridColumn: "span 4" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>Assigned To</div>
                <input style={inputStyle()} value={form.assignedTo} onChange={(e) => setForm((p) => ({ ...p, assignedTo: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "span 4" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>Purchase Date (ISO)</div>
                <input style={inputStyle()} placeholder="2026-01-10" value={form.purchaseDate} onChange={(e) => setForm((p) => ({ ...p, purchaseDate: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "span 4" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>Warranty End (ISO)</div>
                <input style={inputStyle()} placeholder="2027-01-10" value={form.warrantyEnd} onChange={(e) => setForm((p) => ({ ...p, warrantyEnd: e.target.value }))} />
              </div>

              <div style={{ gridColumn: "span 12" }}>
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

      <div style={{ height: 8 }} />

      {historyAsset && (
        <AssetHistoryModal
          assetId={historyAsset.id}
          assetName={historyAsset.name}
          onClose={() => setHistoryAsset(null)}
        />
      )}

    </AppLayout>
  );
}
