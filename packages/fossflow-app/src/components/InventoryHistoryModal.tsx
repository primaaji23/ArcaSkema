import { useEffect, useState } from "react";
import {
  fetchInventoryMovements,
  fetchInventoryActivity,
  InventoryMovement,
  ActivityLog,
} from "../services/itService";

export default function InventoryHistoryModal({
  itemId,
  itemName,
  onClose,
}: {
  itemId: string;
  itemName: string;
  onClose: () => void;
}) {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [m, a] = await Promise.all([
          fetchInventoryMovements(itemId),
          fetchInventoryActivity(itemId),
        ]);
        setMovements(m.movements);
        setLogs(a.logs);
      } finally {
        setLoading(false);
      }
    })();
  }, [itemId]);

  return (
    <div
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
      onMouseDown={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          width: "min(960px, 100%)",
          maxHeight: "80vh",
          overflow: "auto",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ padding: 16, borderBottom: "1px solid #E2E8F0" }}>
          <strong>History – {itemName}</strong>
          <button
            style={{ float: "right" }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 16 }}>Loading...</div>
        ) : (
          <div style={{ padding: 16 }}>
            <h4>📦 Stock Movements</h4>
            <table width="100%">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Ref</th>
                  <th>User</th>
                  <th>Asset</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>{new Date(m.createdAt).toLocaleString()}</td>
                    <td>{m.type}</td>
                    <td>{m.qty}</td>
                    <td>{m.ref || "-"}</td>
                    <td>{m.createdBy || "-"}</td>
                    <td>{m.targetAssetTag ? `${m.targetAssetTag} – ${m.targetAssetName || ""}` : (m.targetAssetId ? m.targetAssetId : "-")}</td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr><td colSpan={6}>No movements</td></tr>
                )}
              </tbody>
            </table>

            <h4 style={{ marginTop: 24 }}>📝 Activity Log</h4>
            <table width="100%">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>User</th>
                  <th>Asset</th>
                  <th>Meta</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>{new Date(l.createdAt).toLocaleString()}</td>
                    <td>{l.action}</td>
                    <td>{l.actorUsername || "-"}</td>
                    <td>
                      <pre style={{ maxWidth: 360, whiteSpace: "pre-wrap" }}>
                        {l.meta ? JSON.stringify(l.meta, null, 2) : "-"}
                      </pre>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={4}>No logs</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
