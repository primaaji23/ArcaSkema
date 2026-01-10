import { useEffect, useState } from "react";
import { fetchAssetActivity, ActivityLog } from "../services/itService";

export default function AssetHistoryModal({
  assetId,
  assetName,
  onClose,
}: {
  assetId: string;
  assetName: string;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchAssetActivity(assetId);
        setLogs(res.logs);
      } finally {
        setLoading(false);
      }
    })();
  }, [assetId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <strong>Asset History – {assetName}</strong>
          <button onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Action</th>
                <th>User</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.createdAt).toLocaleString()}</td>
                  <td>{l.action}</td>
                  <td>{l.actorUsername || "-"}</td>
                  <td>
                    <pre style={{ whiteSpace: "pre-wrap" }}>
                      {l.meta ? JSON.stringify(l.meta, null, 2) : "-"}
                    </pre>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={4}>No history</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
