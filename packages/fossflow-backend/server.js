import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// =======================================================
// MYSQL / MARIADB
// =======================================================
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

async function safeAlter(sql) {
  try {
    await pool.query(sql);
  } catch (err) {
    const code = err?.code || "";
    const msg = String(err?.message || "");
    if (
      code === "ER_DUP_FIELDNAME" ||
      msg.includes("Duplicate column name") ||
      msg.includes("already exists")
    ) {
      return;
    }
    console.error("safeAlter error:", err);
  }
}

async function initDB() {
  // users
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('admin','user') NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // =========================
  // ASSETS
  // =========================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS assets (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      asset_tag VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,

      type ENUM('LAPTOP','PC','SERVER','NETWORK','PRINTER','OTHER') NOT NULL DEFAULT 'OTHER',
      status ENUM('IN_USE','IN_STOCK','REPAIR','RETIRED') NOT NULL DEFAULT 'IN_STOCK',

      brand VARCHAR(128) NULL,
      model VARCHAR(128) NULL,
      serial_number VARCHAR(128) NULL,

      assigned_to VARCHAR(128) NULL,
      location VARCHAR(128) NULL,

      purchase_date DATE NULL,
      warranty_end DATE NULL,
      notes TEXT NULL,

      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      PRIMARY KEY (id),
      UNIQUE KEY uq_assets_asset_tag (asset_tag),
      UNIQUE KEY uq_assets_serial_number (serial_number),
      KEY idx_assets_status (status),
      KEY idx_assets_type (type),
      KEY idx_assets_location (location)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // =========================
  // INVENTORY ITEMS
  // =========================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      sku VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,

      category ENUM('STORAGE','MEMORY','NETWORK','PERIPHERAL','OTHER') NOT NULL DEFAULT 'OTHER',
      unit VARCHAR(32) NOT NULL DEFAULT 'pcs',
      location VARCHAR(128) NULL,

      stock INT NOT NULL DEFAULT 0,
      min_stock INT NOT NULL DEFAULT 0,

      notes TEXT NULL,

      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      PRIMARY KEY (id),
      UNIQUE KEY uq_inventory_sku (sku),
      KEY idx_inventory_location (location),
      KEY idx_inventory_category (category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // =========================
  // INVENTORY MOVEMENTS
  // =========================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      inventory_item_id BIGINT UNSIGNED NOT NULL,

      type ENUM('IN','OUT','ADJUST') NOT NULL,
      qty INT NOT NULL,
      ref VARCHAR(255) NULL,

      created_by VARCHAR(100) NULL,
      target_asset_id BIGINT UNSIGNED NULL,

      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      PRIMARY KEY (id),
      KEY idx_moves_item_time (inventory_item_id, created_at),
      KEY idx_moves_created_by (created_by),
      KEY idx_moves_target_asset (target_asset_id),
      CONSTRAINT fk_moves_item
        FOREIGN KEY (inventory_item_id)
        REFERENCES inventory_items(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_moves_target_asset
        FOREIGN KEY (target_asset_id)
        REFERENCES assets(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Idempotent upgrades
  await safeAlter(
    `ALTER TABLE inventory_movements ADD COLUMN created_by VARCHAR(100) NULL AFTER ref`
  );
  await safeAlter(
    `ALTER TABLE inventory_movements ADD COLUMN target_asset_id BIGINT UNSIGNED NULL AFTER created_by`
  );

  // =========================
  // ACTIVITY LOGS (global audit)
  // =========================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

      actor_username VARCHAR(100) NULL,
      actor_user_id BIGINT NULL,

      action ENUM(
        'ASSET_CREATE','ASSET_UPDATE','ASSET_DELETE',
        'INV_CREATE','INV_UPDATE','INV_DELETE',
        'INV_MOVE'
      ) NOT NULL,

      entity_type ENUM('ASSET','INVENTORY') NOT NULL,
      entity_id BIGINT UNSIGNED NULL,

      meta JSON NULL,

      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      PRIMARY KEY (id),
      KEY idx_activity_time (created_at),
      KEY idx_activity_actor (actor_username),
      KEY idx_activity_entity (entity_type, entity_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

initDB().catch(console.error);

async function seedAdmin() {
  const username = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASS;
  if (!username || !password) return;

  const [rows] = await pool.query("SELECT id FROM users WHERE username = ?", [
    username,
  ]);

  if (rows.length === 0) {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (username, password, role) VALUES (?, ?, 'admin')",
      [username, hash]
    );
    console.log("Admin user created");
  }
}
seedAdmin().catch(console.error);

// =======================================================
// AUTH
// =======================================================
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id?, username, role }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin Only" });
  }
  next();
}

async function logActivity({ req, action, entityType, entityId, meta }) {
  try {
    await pool.query(
      `INSERT INTO activity_logs (actor_username, actor_user_id, action, entity_type, entity_id, meta)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user?.username || null,
        req.user?.id || null,
        action,
        entityType,
        entityId ? Number(entityId) : null,
        meta ? JSON.stringify(meta) : null,
      ]
    );
  } catch (err) {
    console.error("logActivity error:", err);
  }
}

// ===== LOGIN =====
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    /**
     * ======================================
     * HARD-CODED ROOT LOGIN (NO DATABASE)
     * ======================================
     */
    if (
      process.env.ROOT_USERNAME &&
      process.env.ROOT_PASSWORD &&
      username === process.env.ROOT_USERNAME &&
      password === process.env.ROOT_PASSWORD
    ) {
      const token = jwt.sign(
        { username: "root", role: "admin" },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );

      return res.json({ token, role: "admin" });
    }

    /**
     * =========================
     * DATABASE LOGIN (EXISTING)
     * =========================
     */
    const [rows] = await pool.query("SELECT * FROM users WHERE username = ?", [
      username,
    ]);

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "10h" }
    );

    res.json({ token, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// ===== HEALTH =====
app.get("/api/storage/status", (req, res) => {
  res.json({ enabled: true, gitBackup: false, version: "1.0.0" });
});

// =======================================================
// IT ASSET & INVENTORY (MYSQL/MARIADB)
// =======================================================

// ----- Dashboard summary -----
app.get("/api/dashboard/summary", authenticate, async (req, res) => {
  try {
    const [[kpiAssets]] = await pool.query(
      `SELECT COUNT(*) AS totalAssets FROM assets`
    );
    const [[kpiRepair]] = await pool.query(
      `SELECT COUNT(*) AS assetsInRepair FROM assets WHERE status='REPAIR'`
    );

    const [[kpiInvQty]] = await pool.query(
      `SELECT COALESCE(SUM(stock),0) AS totalInventoryQty FROM inventory_items`
    );
    const [[kpiLow]] = await pool.query(
      `SELECT COUNT(*) AS lowStockItems FROM inventory_items WHERE stock < min_stock`
    );

    const [assetsByStatus] = await pool.query(
      `SELECT status AS name, COUNT(*) AS value
       FROM assets
       GROUP BY status
       ORDER BY value DESC`
    );

    const [inventoryByLocation] = await pool.query(
      `SELECT COALESCE(location,'UNKNOWN') AS name, COALESCE(SUM(stock),0) AS value
       FROM inventory_items
       GROUP BY COALESCE(location,'UNKNOWN')
       ORDER BY value DESC`
    );

    const [recentAssets] = await pool.query(
      `SELECT id,
              asset_tag AS assetTag,
              name,
              type,
              status,
              brand,
              model,
              serial_number AS serialNumber,
              assigned_to AS assignedTo,
              location,
              purchase_date AS purchaseDate,
              warranty_end AS warrantyEnd,
              notes,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM assets
       ORDER BY created_at DESC
       LIMIT 10`
    );

    const [lowStockList] = await pool.query(
      `SELECT id,
              sku,
              name,
              category,
              unit,
              location,
              stock,
              min_stock AS minStock,
              notes,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM inventory_items
       WHERE stock < min_stock
       ORDER BY (min_stock - stock) DESC
       LIMIT 10`
    );

    res.json({
      kpis: {
        totalAssets: Number(kpiAssets.totalAssets) || 0,
        totalInventoryQty: Number(kpiInvQty.totalInventoryQty) || 0,
        lowStockItems: Number(kpiLow.lowStockItems) || 0,
        assetsInRepair: Number(kpiRepair.assetsInRepair) || 0,
      },
      assetsByStatus,
      inventoryByLocation,
      recentAssets,
      lowStockList,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to build dashboard summary" });
  }
});

// ----- Assets CRUD -----
app.get("/api/assets", authenticate, async (req, res) => {
  try {
    const { search = "", status = "", type = "", location = "" } = req.query;
    const q = `%${String(search)}%`;

    const where = [];
    const params = [];

    if (search) {
      where.push(
        `(asset_tag LIKE ? OR name LIKE ? OR serial_number LIKE ? OR assigned_to LIKE ?)`
      );
      params.push(q, q, q, q);
    }
    if (status) {
      where.push(`status = ?`);
      params.push(String(status));
    }
    if (type) {
      where.push(`type = ?`);
      params.push(String(type));
    }
    if (location) {
      where.push(`location = ?`);
      params.push(String(location));
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `SELECT id,
              asset_tag AS assetTag,
              name,
              type,
              status,
              brand,
              model,
              serial_number AS serialNumber,
              assigned_to AS assignedTo,
              location,
              purchase_date AS purchaseDate,
              warranty_end AS warrantyEnd,
              notes,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM assets
       ${whereSql}
       ORDER BY updated_at DESC, id DESC`,
      params
    );

    // send id as string to match FE convention
    res.json(rows.map((r) => ({ ...r, id: String(r.id) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load assets" });
  }
});

app.post("/api/assets", authenticate, adminOnly, async (req, res) => {
  try {
    const {
      assetTag,
      name,
      type = "OTHER",
      status = "IN_STOCK",
      brand,
      model,
      serialNumber,
      assignedTo,
      location,
      purchaseDate,
      warrantyEnd,
      notes,
    } = req.body || {};

    if (!assetTag || !name) {
      return res.status(400).json({ error: "assetTag and name are required" });
    }

    const [result] = await pool.query(
      `INSERT INTO assets (asset_tag, name, type, status, brand, model, serial_number, assigned_to, location, purchase_date, warranty_end, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(assetTag),
        String(name),
        String(type),
        String(status),
        brand ?? null,
        model ?? null,
        serialNumber ?? null,
        assignedTo ?? null,
        location ?? null,
        purchaseDate ? String(purchaseDate) : null,
        warrantyEnd ? String(warrantyEnd) : null,
        notes ?? null,
      ]
    );

    const id = String(result.insertId);
    await logActivity({
      req,
      action: "ASSET_CREATE",
      entityType: "ASSET",
      entityId: id,
      meta: { assetTag, name },
    });

    res.json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create asset" });
  }
});

app.put("/api/assets/:id", authenticate, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });

    const payload = req.body || {};
    await pool.query(
      `UPDATE assets SET
        asset_tag = COALESCE(?, asset_tag),
        name = COALESCE(?, name),
        type = COALESCE(?, type),
        status = COALESCE(?, status),
        brand = ?,
        model = ?,
        serial_number = ?,
        assigned_to = ?,
        location = ?,
        purchase_date = ?,
        warranty_end = ?,
        notes = ?
       WHERE id = ?`,
      [
        payload.assetTag ?? null,
        payload.name ?? null,
        payload.type ?? null,
        payload.status ?? null,
        payload.brand ?? null,
        payload.model ?? null,
        payload.serialNumber ?? null,
        payload.assignedTo ?? null,
        payload.location ?? null,
        payload.purchaseDate ? String(payload.purchaseDate) : null,
        payload.warrantyEnd ? String(payload.warrantyEnd) : null,
        payload.notes ?? null,
        id,
      ]
    );

    await logActivity({
      req,
      action: "ASSET_UPDATE",
      entityType: "ASSET",
      entityId: id,
      meta: payload,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update asset" });
  }
});

app.delete("/api/assets/:id", authenticate, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });

    await pool.query(`DELETE FROM assets WHERE id=?`, [id]);

    await logActivity({
      req,
      action: "ASSET_DELETE",
      entityType: "ASSET",
      entityId: id,
      meta: {},
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete asset" });
  }
});

// ----- Inventory CRUD -----
app.get("/api/inventory", authenticate, async (req, res) => {
  try {
    const { search = "", category = "", location = "" } = req.query;
    const q = `%${String(search)}%`;

    const where = [];
    const params = [];

    if (search) {
      where.push(`(sku LIKE ? OR name LIKE ?)`);
      params.push(q, q);
    }
    if (category) {
      where.push(`category = ?`);
      params.push(String(category));
    }
    if (location) {
      where.push(`location = ?`);
      params.push(String(location));
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `SELECT id,
              sku,
              name,
              category,
              unit,
              location,
              stock,
              min_stock AS minStock,
              notes,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM inventory_items
       ${whereSql}
       ORDER BY updated_at DESC, id DESC`,
      params
    );

    res.json(rows.map((r) => ({ ...r, id: String(r.id) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load inventory" });
  }
});

app.post("/api/inventory", authenticate, adminOnly, async (req, res) => {
  try {
    const { sku, name, category = "OTHER", unit = "pcs", location, stock = 0, minStock = 0, notes } =
      req.body || {};

    if (!sku || !name) {
      return res.status(400).json({ error: "sku and name are required" });
    }

    const [result] = await pool.query(
      `INSERT INTO inventory_items (sku, name, category, unit, location, stock, min_stock, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(sku),
        String(name),
        String(category),
        String(unit || "pcs"),
        location ?? null,
        Number(stock) || 0,
        Number(minStock) || 0,
        notes ?? null,
      ]
    );

    const id = String(result.insertId);
    await logActivity({
      req,
      action: "INV_CREATE",
      entityType: "INVENTORY",
      entityId: id,
      meta: { sku, name },
    });

    res.json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create inventory item" });
  }
});

app.put("/api/inventory/:id", authenticate, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });

    const payload = req.body || {};
    await pool.query(
      `UPDATE inventory_items SET
        sku = COALESCE(?, sku),
        name = COALESCE(?, name),
        category = COALESCE(?, category),
        unit = COALESCE(?, unit),
        location = ?,
        stock = COALESCE(?, stock),
        min_stock = COALESCE(?, min_stock),
        notes = ?
       WHERE id = ?`,
      [
        payload.sku ?? null,
        payload.name ?? null,
        payload.category ?? null,
        payload.unit ?? null,
        payload.location ?? null,
        payload.stock ?? null,
        payload.minStock ?? null,
        payload.notes ?? null,
        id,
      ]
    );

    await logActivity({
      req,
      action: "INV_UPDATE",
      entityType: "INVENTORY",
      entityId: id,
      meta: payload,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update inventory item" });
  }
});

app.delete("/api/inventory/:id", authenticate, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });

    await pool.query(`DELETE FROM inventory_items WHERE id=?`, [id]);

    await logActivity({
      req,
      action: "INV_DELETE",
      entityType: "INVENTORY",
      entityId: id,
      meta: {},
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete inventory item" });
  }
});

// ----- Inventory stock move + link to asset -----
app.post("/api/inventory/:id/move", authenticate, adminOnly, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });

    const { type, qty, ref = "", targetAssetId } = req.body || {};
    const q = Number(qty || 0);

    if (!Number.isFinite(q) || q <= 0) {
      return res.status(400).json({ error: "qty must be > 0" });
    }
    if (!["IN", "OUT", "ADJUST"].includes(type)) {
      return res.status(400).json({ error: "invalid type" });
    }

    // If OUT and targetAssetId provided, ensure asset exists
    let taId = null;
    if (type === "OUT" && targetAssetId) {
      taId = Number(targetAssetId);
      if (!Number.isFinite(taId)) return res.status(400).json({ error: "invalid targetAssetId" });
      const [[a]] = await conn.query(`SELECT id FROM assets WHERE id=?`, [taId]);
      if (!a) return res.status(400).json({ error: "target asset not found" });
    }

    await conn.beginTransaction();

    const [[item]] = await conn.query(
      `SELECT id, stock FROM inventory_items WHERE id=? FOR UPDATE`,
      [id]
    );
    if (!item) {
      await conn.rollback();
      return res.status(404).json({ error: "Inventory item not found" });
    }

    let nextStock = Number(item.stock) || 0;
    if (type === "IN") nextStock = nextStock + q;
    if (type === "OUT") nextStock = nextStock - q;
    if (type === "ADJUST") nextStock = q;

    if (nextStock < 0) {
      await conn.rollback();
      return res.status(400).json({ error: "stock would be negative" });
    }

    await conn.query(`UPDATE inventory_items SET stock=? WHERE id=?`, [
      nextStock,
      id,
    ]);

    await conn.query(
      `INSERT INTO inventory_movements (inventory_item_id, type, qty, ref, created_by, target_asset_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, type, q, ref || null, req.user?.username || null, taId]
    );

    await conn.commit();

    // Activity logs (inventory)
    await logActivity({
      req,
      action: "INV_MOVE",
      entityType: "INVENTORY",
      entityId: id,
      meta: { type, qty: q, ref, createdBy: req.user?.username, stockAfter: nextStock, targetAssetId: taId ? String(taId) : null },
    });

    // If linked to asset, log also on ASSET entity (so AssetHistoryModal can display)
    if (taId) {
      await logActivity({
        req,
        action: "INV_MOVE",
        entityType: "ASSET",
        entityId: taId,
        meta: { inventoryItemId: String(id), type, qty: q, ref, createdBy: req.user?.username },
      });
    }

    const [[row]] = await pool.query(
      `SELECT id,
              sku,
              name,
              category,
              unit,
              location,
              stock,
              min_stock AS minStock,
              notes,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM inventory_items WHERE id=?`,
      [id]
    );

    res.json({ ...row, id: String(row.id) });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    console.error(err);
    res.status(500).json({ error: "Failed to move inventory stock" });
  } finally {
    conn.release();
  }
});

// ----- Inventory movements list -----
// GET /api/inventory/:id/movements?limit=100&offset=0
app.get("/api/inventory/:id/movements", authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });

    const limit = Math.min(Number(req.query.limit ?? 100) || 100, 500);
    const offset = Math.max(Number(req.query.offset ?? 0) || 0, 0);

    const [[exists]] = await pool.query(`SELECT id FROM inventory_items WHERE id=?`, [id]);
    if (!exists) return res.status(404).json({ error: "Inventory item not found" });

    const [rows] = await pool.query(
      `SELECT m.id,
              m.inventory_item_id AS inventoryItemId,
              m.type,
              m.qty,
              m.ref,
              m.created_by AS createdBy,
              m.target_asset_id AS targetAssetId,
              a.asset_tag AS targetAssetTag,
              a.name AS targetAssetName,
              m.created_at AS createdAt
       FROM inventory_movements m
       LEFT JOIN assets a ON a.id = m.target_asset_id
       WHERE m.inventory_item_id=?
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT ? OFFSET ?`,
      [id, limit, offset]
    );

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM inventory_movements WHERE inventory_item_id=?`,
      [id]
    );

    const mapped = rows.map((r) => ({
      ...r,
      id: String(r.id),
      inventoryItemId: String(r.inventoryItemId),
      targetAssetId: r.targetAssetId !== null && r.targetAssetId !== undefined ? String(r.targetAssetId) : undefined,
    }));

    res.json({
      itemId: String(id),
      total: Number(countRow.total) || 0,
      limit,
      offset,
      movements: mapped,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load inventory movements" });
  }
});

// ----- Activity logs (admin only) -----
// GET /api/activity?limit=100&offset=0&actor=&entityType=&entityId=
app.get("/api/activity", authenticate, adminOnly, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 100) || 100, 500);
    const offset = Math.max(Number(req.query.offset ?? 0) || 0, 0);

    const actor = String(req.query.actor ?? "");
    const entityType = String(req.query.entityType ?? "");
    const entityId =
      req.query.entityId !== undefined ? Number(req.query.entityId) : null;

    const where = [];
    const params = [];

    if (actor) { where.push(`actor_username = ?`); params.push(actor); }
    if (entityType) { where.push(`entity_type = ?`); params.push(entityType); }
    if (entityId && Number.isFinite(entityId)) { where.push(`entity_id = ?`); params.push(entityId); }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `SELECT id,
              actor_username AS actorUsername,
              actor_user_id AS actorUserId,
              action,
              entity_type AS entityType,
              entity_id AS entityId,
              meta,
              created_at AS createdAt
       FROM activity_logs
       ${whereSql}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM activity_logs ${whereSql}`,
      params
    );

    res.json({
      total: Number(countRow.total) || 0,
      limit,
      offset,
      logs: rows.map((r) => ({ ...r, id: String(r.id), entityId: r.entityId ? String(r.entityId) : null })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load activity logs" });
  }
});

// =======================================================
// STORAGE (DIAGRAMS ONLY, FILESYSTEM)
// =======================================================
const STORAGE_ENABLED = process.env.STORAGE_ENABLED !== "false";
const STORAGE_PATH = process.env.STORAGE_PATH || "./storage";
const ENABLE_GIT_BACKUP = process.env.ENABLE_GIT_BACKUP === "true";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ensureStorageDir() {
  try {
    await fs.access(STORAGE_PATH);
  } catch {
    await fs.mkdir(STORAGE_PATH, { recursive: true });
  }
}

if (STORAGE_ENABLED) {
  ensureStorageDir().catch(console.error);

  // ===== READ (USER + ADMIN) =====
  app.get("/api/diagrams", authenticate, async (req, res) => {
    try {
      const files = await fs.readdir(STORAGE_PATH);
      const diagrams = [];

      for (const file of files) {
        if (file.endsWith(".json")) {
          const filePath = path.join(STORAGE_PATH, file);
          const stats = await fs.stat(filePath);
          const content = await fs.readFile(filePath, "utf-8");
          const data = JSON.parse(content);

          diagrams.push({
            id: file.replace(".json", ""),
            name: data.name || "Untitled Diagram",
            lastModified: stats.mtime,
            size: stats.size,
          });
        }
      }

      res.json(diagrams);
    } catch (err) {
      res.status(500).json({ error: "Failed to list diagrams" });
    }
  });

  app.get("/api/diagrams/:id", authenticate, async (req, res) => {
    try {
      const filePath = path.join(STORAGE_PATH, `${req.params.id}.json`);
      const content = await fs.readFile(filePath, "utf-8");
      res.json(JSON.parse(content));
    } catch (err) {
      res.status(404).json({ error: "Diagram not found" });
    }
  });

  // ===== WRITE (ADMIN ONLY) =====
  app.post("/api/diagrams", authenticate, adminOnly, async (req, res) => {
    try {
      const { id, data } = req.body;
      if (!id || !data) return res.status(400).json({ error: "Missing id/data" });

      const filePath = path.join(STORAGE_PATH, `${id}.json`);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));

      if (ENABLE_GIT_BACKUP) {
        // optional: implement git backup if you had it before
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save diagram" });
    }
  });

  app.delete("/api/diagrams/:id", authenticate, adminOnly, async (req, res) => {
    try {
      const filePath = path.join(STORAGE_PATH, `${req.params.id}.json`);
      await fs.unlink(filePath);
      res.json({ success: true });
    } catch (err) {
      res.status(404).json({ error: "Diagram not found" });
    }
  });
}

// =======================================================
// SERVER
// =======================================================
const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`Backend listening on :${PORT}`);
});
