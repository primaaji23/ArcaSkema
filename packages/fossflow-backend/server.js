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

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('admin','user') NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

initDB().catch(console.error);

async function seedAdmin() {
  const username = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASS;

  if (!username || !password) return;

  const [rows] = await pool.query(
    "SELECT id FROM users WHERE username = ?",
    [username]
  );

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


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET;

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// ===== CONFIG =====
const STORAGE_ENABLED = process.env.ENABLE_SERVER_STORAGE === "true";
const STORAGE_PATH = process.env.STORAGE_PATH || "/data/diagrams";
const ENABLE_GIT_BACKUP = process.env.ENABLE_GIT_BACKUP === "true";

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ===== AUTH =====
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.sendStatus(401);

  const token = authHeader.split(" ")[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.sendStatus(401);
  }
}

// function authenticate(req, res, next) {
//   const authHeader = req.headers.authorization;
//   if (!authHeader) {
//     return res.status(401).json({ error: "No token provided" });
//   }

//   const token = authHeader.split(" ")[1];
//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = decoded; // { username, role }
//     next();
//   } catch {
//     return res.status(401).json({ error: "Invalid token" });
//   }
// }

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin Only" });
  }
  next();
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
        {
          username: "root",
          role: "admin"
        },
        process.env.JWT_SECRET,
        { expiresIn: "25s" }
      );

      return res.json({
        token,
        role: "admin"
      });
    }

    /**
     * =========================
     * DATABASE LOGIN (EXISTING)
     * =========================
     */
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "10h" }
    );

    res.json({
      token,
      role: user.role
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});


// ===== HEALTH =====
app.get("/api/storage/status", (req, res) => {
  res.json({
    enabled: STORAGE_ENABLED,
    gitBackup: ENABLE_GIT_BACKUP,
    version: "1.0.0",
  });
});

// ===== STORAGE =====
if (STORAGE_ENABLED) {
  async function ensureStorageDir() {
    try {
      await fs.access(STORAGE_PATH);
    } catch {
      await fs.mkdir(STORAGE_PATH, { recursive: true });
    }
  }

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
  app.post(
    "/api/diagrams",
    authenticate,
    adminOnly,
    async (req, res) => {
      try {
        const id = req.body.id || `diagram_${Date.now()}`;
        const filePath = path.join(STORAGE_PATH, `${id}.json`);

        const data = {
          ...req.body,
          id,
          created: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        };

        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        res.status(201).json({ success: true, id });
      } catch {
        res.status(500).json({ error: "Failed to create diagram" });
      }
    }
  );

  app.put(
    "/api/diagrams/:id",
    authenticate,
    adminOnly,
    async (req, res) => {
      try {
        const filePath = path.join(STORAGE_PATH, `${req.params.id}.json`);
        const data = {
          ...req.body,
          id: req.params.id,
          lastModified: new Date().toISOString(),
        };

        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        res.json({ success: true });
      } catch {
        res.status(500).json({ error: "Failed to save diagram" });
      }
    }
  );

  app.delete(
    "/api/diagrams/:id",
    authenticate,
    adminOnly,
    async (req, res) => {
      try {
        const filePath = path.join(STORAGE_PATH, `${req.params.id}.json`);
        await fs.unlink(filePath);
        res.json({ success: true });
      } catch {
        res.status(404).json({ error: "Diagram not found" });
      }
    }
  );
}

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
