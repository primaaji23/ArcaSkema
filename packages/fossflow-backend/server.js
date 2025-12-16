import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { username, role }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

// ===== LOGIN =====
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  let role = null;

  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    role = "admin";
  } else if (
    username === process.env.USER_USER &&
    password === process.env.USER_PASS
  ) {
    role = "user";
  } else {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { username, role },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({ token, role });
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
