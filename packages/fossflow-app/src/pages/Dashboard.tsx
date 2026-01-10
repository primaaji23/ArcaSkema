import React, { useEffect, useMemo, useState } from "react";
import AppLayout from "../layouts/AppLayout";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchDashboardSummary, type DashboardSummary } from "../services/itService";

// ---------- Small UI Helpers ----------
function Card({
  title,
  right,
  children,
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
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
      {(title || right) && (
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
          <div style={{ fontWeight: 800, color: "#0F172A" }}>{title}</div>
          <div>{right}</div>
        </div>
      )}
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
        border: "1px solid #EEF2F7",
        padding: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        minHeight: 86,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: "#64748B", fontWeight: 800 }}>
          {title}
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A" }}>
          {value}
        </div>
        {hint ? (
          <div style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>
            {hint}
          </div>
        ) : null}
      </div>

      <div
        aria-hidden
        style={{
          width: 86,
          height: 40,
          borderRadius: 10,
          background:
            "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(20,184,166,0.12))",
          border: "1px solid rgba(148,163,184,0.35)",
        }}
      />
    </div>
  );
}

function Pill({
  label,
  tone,
}: {
  label: string;
  tone: "green" | "blue" | "amber" | "red" | "gray";
}) {
  const map: Record<typeof tone, { bg: string; fg: string; bd: string }> = {
    green: { bg: "#ECFDF5", fg: "#047857", bd: "#A7F3D0" },
    blue: { bg: "#EFF6FF", fg: "#1D4ED8", bd: "#BFDBFE" },
    amber: { bg: "#FFFBEB", fg: "#B45309", bd: "#FDE68A" },
    red: { bg: "#FEF2F2", fg: "#B91C1C", bd: "#FECACA" },
    gray: { bg: "#F8FAFC", fg: "#475569", bd: "#E2E8F0" },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${map[tone].bd}`,
        background: map[tone].bg,
        color: map[tone].fg,
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

export default function Dashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchDashboardSummary()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError("");
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.message || "Failed to load dashboard");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const statusColors = useMemo(() => {
    // stable color mapping by key
    return {
      IN_USE: "#22C55E",
      IN_STOCK: "#60A5FA",
      REPAIR: "#F59E0B",
      RETIRED: "#94A3B8",
      UNKNOWN: "#CBD5E1",
    } as Record<string, string>;
  }, []);

  const locationColors = useMemo(
    () => ["#60A5FA", "#22C55E", "#F59E0B", "#A78BFA", "#94A3B8"],
    []
  );

  const kpis = data?.kpis;

  return (
    <AppLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: "#64748B", fontWeight: 900 }}>
            Home &gt; Dashboard
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A" }}>
            IT Asset & Inventory Dashboard
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ color: "#475569", fontWeight: 800 }}>Loading...</div>
      ) : error ? (
        <div style={{ color: "#B91C1C", fontWeight: 800 }}>{error}</div>
      ) : null}

      {/* KPI row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: 14,
          marginBottom: 14,
          opacity: loading ? 0.6 : 1,
        }}
      >
        <div style={{ gridColumn: "span 3" }}>
          <KpiCard
            title="Total Assets"
            value={fmtInt(kpis?.totalAssets ?? 0)}
            hint="Unit aset terdaftar"
          />
        </div>
        <div style={{ gridColumn: "span 3" }}>
          <KpiCard
            title="Total Inventory"
            value={fmtInt(kpis?.totalInventoryQty ?? 0)}
            hint="Total qty seluruh item"
          />
        </div>
        <div style={{ gridColumn: "span 3" }}>
          <KpiCard
            title="Low Stock"
            value={fmtInt(kpis?.lowStockItems ?? 0)}
            hint="Item di bawah minimum"
          />
        </div>
        <div style={{ gridColumn: "span 3" }}>
          <KpiCard
            title="Assets in Repair"
            value={fmtInt(kpis?.assetsInRepair ?? 0)}
            hint="Perlu tindak lanjut"
          />
        </div>
      </div>

      {/* Charts row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: 14,
          marginBottom: 14,
          opacity: loading ? 0.6 : 1,
        }}
      >
        <div style={{ gridColumn: "span 7" }}>
          <Card title="Assets by Status">
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.assetsByStatus ?? []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" name="Total">
                    {(data?.assetsByStatus ?? []).map((entry) => (
                      <Cell key={entry.name} fill={statusColors[entry.name] || statusColors.UNKNOWN} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div style={{ gridColumn: "span 5" }}>
          <Card title="Inventory by Location">
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.inventoryByLocation ?? []}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {(data?.inventoryByLocation ?? []).map((_, idx) => (
                      <Cell key={idx} fill={locationColors[idx % locationColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      {/* Tables row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 14, opacity: loading ? 0.6 : 1 }}>
        <div style={{ gridColumn: "span 6" }}>
          <Card title="Recent Assets">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#64748B", fontSize: 12 }}>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Asset Tag</th>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Nama</th>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Type</th>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.recentAssets ?? []).map((a) => {
                    const tone =
                      a.status === "IN_USE"
                        ? "green"
                        : a.status === "IN_STOCK"
                        ? "blue"
                        : a.status === "REPAIR"
                        ? "amber"
                        : a.status === "RETIRED"
                        ? "gray"
                        : "gray";

                    return (
                      <tr key={a.id}>
                        <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC", fontWeight: 900, color: "#0F172A" }}>
                          {a.assetTag}
                        </td>
                        <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC", color: "#0F172A", fontWeight: 700 }}>
                          {a.name}
                        </td>
                        <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC", color: "#475569", fontWeight: 800 }}>
                          {a.type}
                        </td>
                        <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC" }}>
                          <Pill label={a.status} tone={tone as any} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(data?.recentAssets ?? []).length === 0 ? (
                <div style={{ marginTop: 8, color: "#64748B", fontWeight: 800 }}>
                  Belum ada data aset.
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        <div style={{ gridColumn: "span 6" }}>
          <Card title="Low Stock Inventory">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#64748B", fontSize: 12 }}>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>SKU</th>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Item</th>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Lokasi</th>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Stock</th>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Min</th>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #F1F5F9" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.lowStockList ?? []).map((i) => (
                    <tr key={i.id}>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC", fontWeight: 900, color: "#0F172A" }}>
                        {i.sku}
                      </td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC", color: "#0F172A", fontWeight: 700 }}>
                        {i.name}
                      </td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC", color: "#475569", fontWeight: 800 }}>
                        {i.location || "-"}
                      </td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC", color: "#0F172A", fontWeight: 900 }}>
                        {fmtInt(i.stock)}
                      </td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC", color: "#475569", fontWeight: 900 }}>
                        {fmtInt(i.minStock)}
                      </td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #F8FAFC" }}>
                        <Pill label="LOW" tone="red" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data?.lowStockList ?? []).length === 0 ? (
                <div style={{ marginTop: 8, color: "#64748B", fontWeight: 800 }}>
                  Aman — tidak ada item low stock.
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>

      <div style={{ height: 8 }} />
    </AppLayout>
  );
}
