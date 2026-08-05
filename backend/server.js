// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const adminAuthRoutes = require("./routes/admin.auth.routes");
const userRoutes = require("./routes/user.routes");
const db = require("./db");

const app = express();

const SERVICE_NAME = "Investment Platform API";

function envStatus(name) {
  const value = process.env[name];
  return {
    name,
    ok: Boolean(value),
    configured: Boolean(value),
  };
}

function errorPayload(error) {
  return {
    name: error?.name || "Error",
    message: error?.message || String(error),
    code: error?.code || undefined,
  };
}

async function runCheck(name, fn) {
  const started = Date.now();
  try {
    const details = await fn();
    return {
      name,
      ok: true,
      ms: Date.now() - started,
      ...(details ? { details } : {}),
    };
  } catch (error) {
    return {
      name,
      ok: false,
      ms: Date.now() - started,
      error: errorPayload(error),
    };
  }
}

async function buildHealthReport() {
  const checks = [];

  checks.push(await runCheck("gateway.status", async () => db.status()));

  checks.push(await runCheck("database.query", async () => {
    const [rows] = await db.query("SELECT 1 AS ok");
    return { rows: rows.length, ok: rows[0]?.ok === 1 };
  }));

  checks.push(await runCheck("auth.users_login_query", async () => {
    try {
      const [rows] = await db.query(
        `
        SELECT
          id,
          full_name,
          username,
          email,
          password_hash,
          role,
          is_verified
        FROM users
        WHERE LOWER(email) = ? OR LOWER(username) = ?
        LIMIT 1
        `,
        ["__health_check__", "__health_check__"]
      );
      return { schema: "modern", rows: rows.length };
    } catch (error) {
      if (!String(error.message || "").includes("Unknown column")) throw error;
    }

    const [rows] = await db.query(
      `
      SELECT
        id,
        name AS full_name,
        username,
        email,
        password AS password_hash,
        CASE WHEN isAdmin = 1 THEN 'admin' ELSE 'user' END AS role,
        is_verified
      FROM users
      WHERE LOWER(email) = ? OR LOWER(username) = ?
      LIMIT 1
      `,
      ["__health_check__", "__health_check__"]
    );
    return { schema: "legacy", rows: rows.length };
  }));

  checks.push(await runCheck("auth.admins_login_query", async () => {
    try {
      const [rows] = await db.query(
        "SELECT id, name, email, password_hash FROM admins WHERE email = ? LIMIT 1",
        ["__health_check__"]
      );
      return { schema: "admins", rows: rows.length };
    } catch (error) {
      if (!String(error.message || "").includes("doesn't exist")) throw error;
    }

    const [rows] = await db.query(
      `
      SELECT id, name, email, password AS password_hash
      FROM users
      WHERE LOWER(email) = ? AND isAdmin = 1
      LIMIT 1
      `,
      ["__health_check__"]
    );
    return { schema: "users.isAdmin", rows: rows.length };
  }));

  checks.push(await runCheck("auth.jwt_sign", async () => {
    const jwt = require("jsonwebtoken");
    jwt.sign({ health: true }, process.env.JWT_SECRET || "dev_secret", { expiresIn: "1m" });
    return { jwtSecretConfigured: Boolean(process.env.JWT_SECRET) };
  }));

  const env = [
    "SITE_ID",
    "API_KEY",
    "DBMS_URL",
    "JWT_SECRET",
    "ADMIN_REGISTER_SECRET",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASS",
  ].map(envStatus);

  const ok = checks.every((check) => check.ok);

  return {
    ok,
    service: SERVICE_NAME,
    time: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV || "development",
      env,
    },
    checks,
  };
}

/* =========================================================
   ✅ SECURITY (FIXED FOR IMAGE LOADING)
   ========================================================= */
app.use(
  helmet({
    crossOriginEmbedderPolicy: false, // ❗ REQUIRED
    crossOriginResourcePolicy: { policy: "cross-origin" } // ❗ REQUIRED
  })
);

/* =========================================================
   ✅ CORS
   ========================================================= */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

/* =========================================================
   ✅ BODY PARSERS
   ========================================================= */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   ✅ STATIC FILES (UPLOADS FIX)
   ========================================================= */
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    }
  })
);

/* =========================================================
   ✅ HEALTH CHECK
   ========================================================= */
app.get("/", (req, res) => {
  res.json({ ok: true, service: SERVICE_NAME });
});

app.get(["/health", "/api/health", "/api/debug/health"], async (req, res) => {
  try {
    const report = await buildHealthReport();
    res.status(report.ok ? 200 : 503).json({ ...report, route: req.path });
  } catch (error) {
    res.status(503).json({
      ok: false,
      service: SERVICE_NAME,
      route: req.path,
      error: errorPayload(error),
    });
  }
});

/* =========================================================
   ✅ ROUTES
   ========================================================= */
app.use("/api/admin", adminAuthRoutes);
app.use("/api/users", userRoutes);

/* =========================================================
   ❌ 404 HANDLER
   ========================================================= */
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

/* =========================================================
   🚀 START SERVER
   ========================================================= */
const PORT = process.env.PORT || 2080;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
