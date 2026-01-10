import { apiFetch } from "./api";

export type AssetType =
  | "LAPTOP"
  | "PC"
  | "SERVER"
  | "NETWORK"
  | "PRINTER"
  | "OTHER";

export type AssetStatus = "IN_USE" | "IN_STOCK" | "REPAIR" | "RETIRED";

export type Asset = {
  id: string;
  assetTag: string;
  name: string;
  type: AssetType;
  brand?: string;
  model?: string;
  serialNumber?: string;
  status: AssetStatus;
  assignedTo?: string;
  location?: string;
  purchaseDate?: string; // ISO string (optional)
  warrantyEnd?: string; // ISO string (optional)
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type InventoryCategory =
  | "STORAGE"
  | "MEMORY"
  | "NETWORK"
  | "PERIPHERAL"
  | "OTHER";

export type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  category: InventoryCategory;
  unit?: string;
  location?: string;
  stock: number;
  minStock: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type InventoryMoveType = "IN" | "OUT" | "ADJUST";

export type DashboardSummary = {
  kpis: {
    totalAssets: number;
    totalInventoryQty: number;
    lowStockItems: number;
    assetsInRepair: number;
  };
  assetsByStatus: { name: string; value: number }[];
  inventoryByLocation: { name: string; value: number }[];
  recentAssets: Asset[];
  lowStockList: InventoryItem[];
};

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

function qs(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ---------- Dashboard ----------
export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await apiFetch("/api/dashboard/summary");
  return json<DashboardSummary>(res);
}

// ---------- Assets CRUD ----------
export async function listAssets(params?: {
  search?: string;
  status?: AssetStatus | "";
  type?: AssetType | "";
  location?: string;
}): Promise<Asset[]> {
  const res = await apiFetch(
    `/api/assets${qs({
      search: params?.search,
      status: params?.status as string,
      type: params?.type as string,
      location: params?.location,
    })}`
  );
  return json<Asset[]>(res);
}

export async function createAsset(payload: Partial<Asset>): Promise<Asset> {
  const res = await apiFetch("/api/assets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return json<Asset>(res);
}

export async function updateAsset(id: string, payload: Partial<Asset>): Promise<Asset> {
  const res = await apiFetch(`/api/assets/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return json<Asset>(res);
}

export async function deleteAsset(id: string): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/assets/${id}`, { method: "DELETE" });
  return json<{ success: boolean }>(res);
}

// ---------- Inventory CRUD ----------
export async function listInventory(params?: {
  search?: string;
  category?: InventoryCategory | "";
  location?: string;
}): Promise<InventoryItem[]> {
  const res = await apiFetch(
    `/api/inventory${qs({
      search: params?.search,
      category: params?.category as string,
      location: params?.location,
    })}`
  );
  return json<InventoryItem[]>(res);
}

export async function createInventoryItem(payload: Partial<InventoryItem>): Promise<InventoryItem> {
  const res = await apiFetch("/api/inventory", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return json<InventoryItem>(res);
}

export async function updateInventoryItem(
  id: string,
  payload: Partial<InventoryItem>
): Promise<InventoryItem> {
  const res = await apiFetch(`/api/inventory/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return json<InventoryItem>(res);
}

export async function deleteInventoryItem(id: string): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/inventory/${id}`, { method: "DELETE" });
  return json<{ success: boolean }>(res);
}

export async function moveInventory(
  id: string,
  move: { type: InventoryMoveType; qty: number; ref?: string }
): Promise<InventoryItem> {
  const res = await apiFetch(`/api/inventory/${id}/move`, {
    method: "POST",
    body: JSON.stringify(move),
  });
  return json<InventoryItem>(res);
}

export type InventoryMovement = {
  id: string;
  inventoryItemId: string;
  type: "IN" | "OUT" | "ADJUST";
  qty: number;
  ref?: string;
  createdBy?: string;
  targetAssetId?: string;
  targetAssetTag?: string;
  targetAssetName?: string;
  createdAt: string;
};

export type ActivityLog = {
  id: string;
  actorUsername?: string;
  action: string;
  entityType: "INVENTORY" | "ASSET";
  entityId?: number;
  meta?: any;
  createdAt: string;
};

export async function fetchInventoryMovements(
  itemId: string
): Promise<{ movements: InventoryMovement[] }> {
  const res = await apiFetch(`/api/inventory/${itemId}/movements`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchInventoryActivity(
  itemId: string
): Promise<{ logs: ActivityLog[] }> {
  const res = await apiFetch(
    `/api/activity?entityType=INVENTORY&entityId=${itemId}`
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchAssetActivity(
  assetId: string
): Promise<{ logs: ActivityLog[] }> {
  const res = await apiFetch(
    `/api/activity?entityType=ASSET&entityId=${assetId}`
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

