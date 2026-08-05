// routes/admin.auth.routes.js
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const pool = require("../db");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/adminOnly");
const { sendMail, sendMailText, sendMailHTML } = require("../utils/mailer");
const { traderUpload } = require("../middleware/traderUpload");

// Simple HTML wrapper for admin emails (since baseTemplate isn't exported)
function adminEmailTemplate({ subject, message }) {
  const safeMessage = String(message || "")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  return `
  <!doctype html>
  <html>
    <head><meta charset="utf-8" /></head>
    <body style="margin:0;padding:20px;background:#0b1020;font-family:Segoe UI,Arial,sans-serif;">
      <div style="max-width:640px;margin:0 auto;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.06);color:#eaf0ff;">
        <div style="padding:18px 20px;background:linear-gradient(135deg, rgba(99,102,241,0.28), rgba(168,85,247,0.22));border-bottom:1px solid rgba(255,255,255,0.10);">
          <div style="font-size:15px;font-weight:900;">${subject}</div>
          <div style="opacity:.8;font-size:12px;margin-top:4px;">Admin Notification</div>
        </div>
        <div style="padding:20px;font-size:14px;line-height:1.7;opacity:.95;">
          ${safeMessage}
        </div>
        <div style="padding:14px 20px;border-top:1px solid rgba(255,255,255,0.10);font-size:12px;opacity:.7;">
          If you did not expect this email, you can ignore it.
        </div>
      </div>
    </body>
  </html>`;
}

const router = express.Router();

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || "dev_secret", {
    expiresIn: "7d",
  });
}

function isBcryptHash(value) {
  return /^\$2[aby]\$\d{2}\$/.test(String(value || ""));
}

async function verifyPassword(inputPassword, storedPassword) {
  if (!storedPassword) return false;
  if (isBcryptHash(storedPassword)) {
    return bcrypt.compare(String(inputPassword), storedPassword);
  }
  return String(inputPassword) === String(storedPassword);
}

async function findAdminByEmail(cleanEmail) {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, password_hash FROM admins WHERE email = ? LIMIT 1",
      [cleanEmail]
    );
    return rows;
  } catch (error) {
    if (!String(error.message || "").includes("doesn't exist")) throw error;
  }

  const [rows] = await pool.query(
    `
    SELECT
      id,
      name,
      email,
      password AS password_hash
    FROM users
    WHERE LOWER(email) = ? AND isAdmin = 1
    LIMIT 1
    `,
    [cleanEmail]
  );
  return rows;
}
// helper: attach crypto balances as { BTC: "0.00", ETH: "0.00", ... }
function attachBalances(users, balancesRows) {
  const map = new Map(); // user_id -> balances object

  for (const r of balancesRows) {
    if (!map.has(r.user_id)) map.set(r.user_id, {});
    map.get(r.user_id)[r.asset] = r.balance; // keep as string from MySQL
  }

  return users.map((u) => ({
    ...u,
    crypto_balances: map.get(u.id) || {},
  }));
}
const ASSETS = new Set(["BTC", "ETH", "USDT", "BNB", "LTC", "DOGE", "XRP", "SHIB", "SOL"]);

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "wallets");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function safeAsset(v) {
  const a = String(v || "").trim().toUpperCase();
  return ASSETS.has(a) ? a : null;
}

function baseUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}

function fileUrl(req, relPath) {
  // relPath example: /uploads/wallets/xxx.png
  return `${baseUrl(req)}${relPath}`;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
    const name = `qr_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  fileFilter: (req, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Only image files are allowed"), ok);
  },
});


// -------------------------- Admin Registration ------------------------ //
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, admin_secret } = req.body || {};
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!name || !cleanEmail || !password) {
      return res.status(400).json({ message: "name, email, password are required" });
    }

    // Protect admin creation
    if (!process.env.ADMIN_REGISTER_SECRET) {
      return res.status(500).json({ message: "ADMIN_REGISTER_SECRET not set in .env" });
    }
    if (admin_secret !== process.env.ADMIN_REGISTER_SECRET) {
      return res.status(403).json({ message: "Invalid admin secret" });
    }

    const [exists] = await pool.query("SELECT id FROM admins WHERE email = ?", [cleanEmail]);
    if (exists.length) return res.status(409).json({ message: "Admin already exists" });

    const hash = await bcrypt.hash(password, 12);

    const [result] = await pool.query(
      "INSERT INTO admins (name, email, password_hash, created_at) VALUES (?, ?, ?, NOW())",
      [String(name).trim(), cleanEmail, hash]
    );

    const token = signToken({ id: result.insertId, role: "admin", email: cleanEmail });

    // Optional: email admin
    try {
      await sendMail({
        to: cleanEmail,
        subject: "Admin Account Created",
        html: `<p>Hello ${String(name).trim()},</p><p>Your admin account is ready.</p>`,
      });
    } catch (e) {
      // don't fail registration if mail fails
      console.log("Mail failed:", String(e));
    }

    return res.json({ message: "Admin registered", token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// -------------------------- Admin Login ------------------------ //
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const rows = await findAdminByEmail(cleanEmail);

    if (!rows.length) return res.status(401).json({ message: "Invalid credentials" });

    const admin = rows[0];
    const ok = await verifyPassword(password, admin.password_hash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken({ id: admin.id, role: "admin", email: admin.email });
    return res.json({ message: "Logged in", token, admin: { id: admin.id, name: admin.name, email: admin.email } });
  } catch (err) {
    console.error("[admin.login] failed:", err);
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});

// -------------------------- Get All Users (admin only) ------------------------ //
router.get("/users", auth, adminOnly, async (req, res) => {
  try {
    const [users] = await pool.query(
      `
      SELECT
        id,
        full_name,
        username,
        address,
        city,
        zipcode,
        country,
        phone,
        email,
        role,
        is_verified,
        main_balance,
        profit_balance,
        investment_balance,
        account_type,
        trade_progress,
        signal_strength,
        account_status,
        copy_trading_status,
        trading_status,
        created_at
      FROM users
      ORDER BY created_at DESC
      `
    );

    if (!users.length) return res.json({ count: 0, users: [] });

    const ids = users.map((u) => u.id);
    const placeholders = ids.map(() => "?").join(",");

    const [balances] = await pool.query(
      `
      SELECT user_id, asset, balance
      FROM user_crypto_balances
      WHERE user_id IN (${placeholders})
      `,
      ids
    );

    const usersWithBalances = attachBalances(users, balances);

    return res.json({
      count: usersWithBalances.length,
      users: usersWithBalances,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// -------------------------- GET /api/admin/users/:id -------------------------- //
router.get("/users/:id", auth, adminOnly, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ message: "Invalid user id" });

    const [rows] = await pool.query(
      `
      SELECT
        id,
        full_name,
        username,
        address,
        city,
        zipcode,
        country,
        phone,
        email,
        role,
        is_verified,
        main_balance,
        profit_balance,
        investment_balance,
        account_type,
        trade_progress,
        signal_strength,
        account_status,
        copy_trading_status,
        trading_status,
        created_at
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    );

    if (!rows.length) return res.status(404).json({ message: "User not found" });

    const [balances] = await pool.query(
      `
      SELECT asset, balance
      FROM user_crypto_balances
      WHERE user_id = ?
      `,
      [userId]
    );

    const crypto_balances = {};
    for (const r of balances) crypto_balances[r.asset] = r.balance;

    return res.json({
      user: { ...rows[0], crypto_balances },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// -------------------------- PUT /api/admin/users/:id -------------------------- //
router.put("/users/:id", auth, adminOnly, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ message: "Invalid user id" });

    // Allowed user columns to update
    const allowed = [
      "full_name",
      "username",
      "address",
      "city",
      "zipcode",
      "country",
      "phone",
      "email",
      "role",
      "is_verified",
      "main_balance",
      "profit_balance",
      "investment_balance",
      "account_type",
      "trade_progress",
      "signal_strength",
      "account_status",
      "copy_trading_status",
      "trading_status",
      // if you later add a PIN column, include it here, e.g. "pin_hash"
    ];

    const updates = [];
    const values = [];

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    }

    // Optional: crypto_balances object in body, e.g. { BTC: "0.5", ETH: "1.2" }
    const crypto = req.body.crypto_balances;

    if (!updates.length && !crypto) {
      return res.status(400).json({ message: "No valid fields provided to update" });
    }

    // Ensure user exists
    const [exists] = await pool.query("SELECT id FROM users WHERE id = ? LIMIT 1", [userId]);
    if (!exists.length) return res.status(404).json({ message: "User not found" });

    // 1) Update users table (if any user fields)
    if (updates.length) {
      values.push(userId);
      await pool.query(
        `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
        values
      );
    }

    // 2) Upsert crypto balances (if provided)
    if (crypto && typeof crypto === "object") {
      const allowedAssets = new Set(["BTC", "ETH", "USDT", "BNB", "LTC", "DOGE", "XRP", "SHIB", "SOL"]);
      const entries = Object.entries(crypto).filter(([asset]) => allowedAssets.has(String(asset).toUpperCase()));

      // Upsert each provided asset
      for (const [assetRaw, bal] of entries) {
        const asset = String(assetRaw).toUpperCase();
        await pool.query(
          `
          INSERT INTO user_crypto_balances (user_id, asset, balance)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE balance = VALUES(balance), updated_at = CURRENT_TIMESTAMP
          `,
          [userId, asset, bal]
        );
      }
    }

    // Return updated user (including balances)
    const [userRows] = await pool.query(
      `
      SELECT
        id,
        full_name,
        username,
        address,
        city,
        zipcode,
        country,
        phone,
        email,
        role,
        is_verified,
        main_balance,
        profit_balance,
        investment_balance,
        account_type,
        trade_progress,
        signal_strength,
        account_status,
        copy_trading_status,
        trading_status,
        created_at
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    );

    const [balRows] = await pool.query(
      `SELECT asset, balance FROM user_crypto_balances WHERE user_id = ?`,
      [userId]
    );

    const crypto_balances = {};
    for (const r of balRows) crypto_balances[r.asset] = r.balance;

    return res.json({
      message: "User updated",
      user: { ...userRows[0], crypto_balances },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ------------------ POST /api/admin/crypto-balances/bootstrap ------------------
router.post("/crypto-balances/bootstrap", auth, adminOnly, async (req, res) => {
  try {
    const [result] = await pool.query(
      `
      INSERT INTO user_crypto_balances (user_id, asset, balance)
      SELECT
        u.id AS user_id,
        a.asset,
        0.000000000000000000 AS balance
      FROM users u
      CROSS JOIN (
        SELECT 'BTC' AS asset UNION ALL
        SELECT 'ETH' UNION ALL
        SELECT 'USDT' UNION ALL
        SELECT 'BNB' UNION ALL
        SELECT 'LTC' UNION ALL
        SELECT 'DOGE' UNION ALL
        SELECT 'XRP' UNION ALL
        SELECT 'SHIB' UNION ALL
        SELECT 'SOL'
      ) a
      LEFT JOIN user_crypto_balances b
        ON b.user_id = u.id AND b.asset = a.asset
      WHERE b.id IS NULL
      `
    );

    return res.json({
      message: "Crypto balances bootstrap completed",
      inserted_rows: result.affectedRows || 0,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ------------- POST /api/admin/users/:id/crypto-balances/bootstrap -------------
router.post("/users/:id/crypto-balances/bootstrap", auth, adminOnly, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ message: "Invalid user id" });

    const [exists] = await pool.query("SELECT id FROM users WHERE id = ? LIMIT 1", [userId]);
    if (!exists.length) return res.status(404).json({ message: "User not found" });

    const [result] = await pool.query(
      `
      INSERT INTO user_crypto_balances (user_id, asset, balance)
      SELECT
        u.id AS user_id,
        a.asset,
        0.000000000000000000 AS balance
      FROM (SELECT ? AS id) u
      CROSS JOIN (
        SELECT 'BTC' AS asset UNION ALL
        SELECT 'ETH' UNION ALL
        SELECT 'USDT' UNION ALL
        SELECT 'BNB' UNION ALL
        SELECT 'LTC' UNION ALL
        SELECT 'DOGE' UNION ALL
        SELECT 'XRP' UNION ALL
        SELECT 'SHIB' UNION ALL
        SELECT 'SOL'
      ) a
      LEFT JOIN user_crypto_balances b
        ON b.user_id = u.id AND b.asset = a.asset
      WHERE b.id IS NULL
      `,
      [userId]
    );

    return res.json({
      message: "User crypto balances bootstrap completed",
      user_id: userId,
      inserted_rows: result.affectedRows || 0,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ========================= ADMIN: Set / Update User PIN (PLAIN stored in pin_hash) ========================= //
router.post("/users/:id/set-pin", auth, adminOnly, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const pin = String(req.body.pin || "").trim();

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    // allow 4-6 digits (edit if you want)
    if (!/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ message: "PIN must be 4 to 6 digits" });
    }

    const [result] = await pool.query(
      `
      UPDATE users
      SET pin_hash = ?, updated_at = NOW()
      WHERE id = ?
      `,
      [pin, userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      message: "User PIN set successfully (stored as plain in pin_hash)",
      user_id: userId,
      pin
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ========================= ADMIN: View User PIN (PLAIN) ========================= //
router.get("/users/:id/pin", auth, adminOnly, async (req, res) => {
  try {
    const userId = Number(req.params.id);

    const [rows] = await pool.query(
      `
      SELECT id, pin_hash
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      user_id: rows[0].id,
      pin: rows[0].pin_hash || null
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});


// -------------------------- POST /api/admin/wallet-addresses --------------------------
router.post("/wallet-addresses", auth, adminOnly, upload.single("qr"), async (req, res) => {
  try {
    const asset = safeAsset(req.body.asset);
    const address = String(req.body.address || "").trim();

    if (!asset || !address) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: "asset and address are required" });
    }

    const qr_filename = req.file ? req.file.filename : null;

    // if you set UNIQUE(asset), this will prevent duplicates
    const [r] = await pool.query(
      `
      INSERT INTO wallet_addresses (asset, address, qr_filename, created_at, updated_at)
      VALUES (?, ?, ?, NOW(), NOW())
      `,
      [asset, address, qr_filename]
    );

    const qr_path = qr_filename ? `/uploads/wallets/${qr_filename}` : null;

    return res.json({
      message: "Wallet address created",
      wallet: {
        id: r.insertId,
        asset,
        address,
        qr_path,
        qr_url: qr_path ? fileUrl(req, qr_path) : null,
      },
    });
  } catch (err) {
    // cleanup file if DB insert fails
    if (req.file) fs.unlink(req.file.path, () => {});
    // duplicate asset (if UNIQUE asset)
    if (String(err).includes("ER_DUP_ENTRY")) {
      return res.status(409).json({ message: "Wallet for this asset already exists" });
    }
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// -------------------------- PUT /api/admin/wallet-addresses/:id --------------------------
router.put("/wallet-addresses/:id", auth, adminOnly, upload.single("qr"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: "Invalid id" });
    }

    const [oldRows] = await pool.query(
      `SELECT id, asset, address, qr_filename FROM wallet_addresses WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!oldRows.length) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ message: "Wallet record not found" });
    }

    const updates = [];
    const vals = [];

    if (Object.prototype.hasOwnProperty.call(req.body, "asset")) {
      const asset = safeAsset(req.body.asset);
      if (!asset) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(400).json({ message: "Invalid asset" });
      }
      updates.push("asset = ?");
      vals.push(asset);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "address")) {
      const address = String(req.body.address || "").trim();
      if (!address) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(400).json({ message: "address cannot be empty" });
      }
      updates.push("address = ?");
      vals.push(address);
    }

    let newQrFilename = null;
    if (req.file) {
      newQrFilename = req.file.filename;
      updates.push("qr_filename = ?");
      vals.push(newQrFilename);
    }

    if (!updates.length) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: "No fields to update" });
    }

    vals.push(id);

    await pool.query(
      `UPDATE wallet_addresses SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
      vals
    );

    // delete old QR if replaced
    if (newQrFilename && oldRows[0].qr_filename) {
      const oldPath = path.join(UPLOAD_DIR, oldRows[0].qr_filename);
      fs.unlink(oldPath, () => {});
    }

    const [rows] = await pool.query(
      `SELECT id, asset, address, qr_filename, created_at, updated_at FROM wallet_addresses WHERE id = ? LIMIT 1`,
      [id]
    );

    const w = rows[0];
    const qr_path = w.qr_filename ? `/uploads/wallets/${w.qr_filename}` : null;

    return res.json({
      message: "Wallet updated",
      wallet: {
        ...w,
        qr_path,
        qr_url: qr_path ? fileUrl(req, qr_path) : null,
      },
    });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    if (String(err).includes("ER_DUP_ENTRY")) {
      return res.status(409).json({ message: "Wallet for this asset already exists" });
    }
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// -------------------------- GET /api/admin/wallet-addresses --------------------------
router.get("/wallet-addresses", auth, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, asset, address, qr_filename, created_at, updated_at FROM wallet_addresses ORDER BY asset ASC`
    );

    const wallets = rows.map((w) => {
      const qr_path = w.qr_filename ? `/uploads/wallets/${w.qr_filename}` : null;
      return {
        ...w,
        qr_path,
        qr_url: qr_path ? fileUrl(req, qr_path) : null,
      };
    });

    return res.json({ count: wallets.length, wallets });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// -------------------------- GET /api/admin/wallet-addresses/:id --------------------------
router.get("/wallet-addresses/:id", auth, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const [rows] = await pool.query(
      `SELECT id, asset, address, qr_filename, created_at, updated_at FROM wallet_addresses WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: "Wallet record not found" });

    const w = rows[0];
    const qr_path = w.qr_filename ? `/uploads/wallets/${w.qr_filename}` : null;

    return res.json({
      wallet: {
        ...w,
        qr_path,
        qr_url: qr_path ? fileUrl(req, qr_path) : null,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// -------------------------- DELETE /api/admin/wallet-addresses/:id --------------------------
router.delete("/wallet-addresses/:id", auth, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const [rows] = await pool.query(
      `SELECT id, qr_filename FROM wallet_addresses WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: "Wallet record not found" });

    await pool.query(`DELETE FROM wallet_addresses WHERE id = ?`, [id]);

    // delete file if exists
    if (rows[0].qr_filename) {
      const p = path.join(UPLOAD_DIR, rows[0].qr_filename);
      fs.unlink(p, () => {});
    }

    return res.json({ message: "Wallet deleted" });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});


// -------------------------- GET /api/admin/deposits --------------------------
router.get("/deposits", auth, adminOnly, async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status).trim().toLowerCase() : null;
    const allowedStatus = new Set(["pending", "approved", "declined"]);

    const where = [];
    const vals = [];

    if (status) {
      if (!allowedStatus.has(status)) {
        return res.status(400).json({ message: "Invalid status filter" });
      }
      where.push("d.status = ?");
      vals.push(status);
    }

    const sql = `
      SELECT
        d.id,
        d.user_id,
        u.full_name,
        u.username,
        u.email,
        d.asset,
        d.amount,
        d.status,
        d.admin_note,
        d.proof_filename,
        d.approved_by,
        d.approved_at,
        d.declined_by,
        d.declined_at,
        d.created_at,
        d.updated_at
      FROM deposits d
      JOIN users u ON u.id = d.user_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY d.created_at DESC
    `;

    const [rows] = await pool.query(sql, vals);

    const deposits = rows.map((d) => {
      const proof_path = d.proof_filename ? `/uploads/deposits/${d.proof_filename}` : null;
      return {
        ...d,
        proof_path,
        proof_url: proof_path ? `${baseUrl(req)}${proof_path}` : null,
      };
    });

    return res.json({ count: deposits.length, deposits });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// -------------------------- GET /api/admin/deposits/:id --------------------------
router.get("/deposits/:id", auth, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid deposit id" });

    const [rows] = await pool.query(
      `
      SELECT
        d.id,
        d.user_id,
        u.full_name,
        u.username,
        u.email,
        d.asset,
        d.amount,
        d.status,
        d.admin_note,
        d.proof_filename,
        d.approved_by,
        d.approved_at,
        d.declined_by,
        d.declined_at,
        d.created_at,
        d.updated_at
      FROM deposits d
      JOIN users u ON u.id = d.user_id
      WHERE d.id = ?
      LIMIT 1
      `,
      [id]
    );

    if (!rows.length) return res.status(404).json({ message: "Deposit not found" });

    const d = rows[0];
    const proof_path = d.proof_filename ? `/uploads/deposits/${d.proof_filename}` : null;

    return res.json({
      deposit: {
        ...d,
        proof_path,
        proof_url: proof_path ? `${baseUrl(req)}${proof_path}` : null,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// -------------------------- ✅ Approve deposit and TOP-UP users.main_balance --------------------------
router.post("/deposits/:id/approve", auth, adminOnly, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const adminId = req.user.id;
    const depositId = Number(req.params.id);

    if (!Number.isInteger(depositId) || depositId <= 0) {
      return res.status(400).json({ message: "Invalid deposit id" });
    }

    const admin_note = req.body?.admin_note ? String(req.body.admin_note).trim() : null;

    await conn.beginTransaction();

    // 1) Get deposit row (lock it to prevent double-approve)
    const [depRows] = await conn.query(
      `
      SELECT id, user_id, asset, amount, status
      FROM deposits
      WHERE id = ?
      FOR UPDATE
      `,
      [depositId]
    );

    if (!depRows || depRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: "Deposit not found" });
    }

    const dep = depRows[0];

    if (dep.status !== "pending") {
      await conn.rollback();
      return res.status(400).json({ message: "Deposit already processed" });
    }

    // 2) Mark approved
    const [approveResult] = await conn.query(
      `
      UPDATE deposits
      SET status='approved',
          admin_note=?,
          approved_by=?,
          approved_at=NOW(),
          updated_at=NOW()
      WHERE id = ? AND status='pending'
      `,
      [admin_note, adminId, depositId]
    );

    // extra safety: if another request approved it first
    if (!approveResult || approveResult.affectedRows !== 1) {
      await conn.rollback();
      return res.status(409).json({ message: "Deposit was already processed by another action" });
    }

    // 3) Credit user's main_balance
    const [creditResult] = await conn.query(
      `
      UPDATE users
      SET main_balance = main_balance + ?,
          updated_at = NOW()
      WHERE id = ?
      `,
      [dep.amount, dep.user_id]
    );

    if (!creditResult || creditResult.affectedRows !== 1) {
      await conn.rollback();
      return res.status(404).json({ message: "User not found for this deposit" });
    }

    await conn.commit();

    return res.json({
      message: "Deposit approved and main balance updated",
      deposit_id: dep.id,
      user_id: dep.user_id,
      asset: dep.asset,
      amount: dep.amount,
      credited_to: "main_balance",
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return res.status(500).json({ message: "Server error", error: String(err) });
  } finally {
    conn.release();
  }
});
// -------------------------- POST /api/admin/deposits/:id/decline --------------------------
router.post("/deposits/:id/decline", auth, adminOnly, async (req, res) => {
  try {
    const adminId = req.user.id;
    const depositId = Number(req.params.id);
    if (!depositId) return res.status(400).json({ message: "Invalid deposit id" });

    const admin_note = req.body?.admin_note ? String(req.body.admin_note).trim() : "Declined";

    const [rows] = await pool.query(
      `SELECT id, status FROM deposits WHERE id = ? LIMIT 1`,
      [depositId]
    );

    if (!rows.length) return res.status(404).json({ message: "Deposit not found" });
    if (rows[0].status !== "pending") return res.status(400).json({ message: "Deposit already processed" });

    await pool.query(
      `
      UPDATE deposits
      SET status='declined',
          admin_note=?,
          declined_by=?,
          declined_at=NOW(),
          updated_at=NOW()
      WHERE id = ?
      `,
      [admin_note, adminId, depositId]
    );

    return res.json({ message: "Deposit declined", deposit_id: depositId });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});


// -------------------------- ✅ Approve Withdrawal (Admin) --------------------------
router.post("/withdrawals/:id/approve", auth, adminOnly, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const adminId = req.user.id;
    const withdrawalId = Number(req.params.id);
    const admin_note = req.body?.admin_note ? String(req.body.admin_note).trim() : null;

    if (!Number.isInteger(withdrawalId) || withdrawalId <= 0) {
      return res.status(400).json({ message: "Invalid withdrawal id" });
    }

    await conn.beginTransaction();

    // 1) Lock withdrawal row
    const [wRows] = await conn.query(
      `
      SELECT id, user_id, method, asset, amount, status
      FROM withdrawals
      WHERE id = ?
      FOR UPDATE
      `,
      [withdrawalId]
    );

    if (!wRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: "Withdrawal not found" });
    }

    const w = wRows[0];
    if (w.status !== "pending") {
      await conn.rollback();
      return res.status(400).json({ message: "Withdrawal already processed" });
    }

    // 2) Lock user row and finalize balances
    const [uRows] = await conn.query(
      `
      SELECT id, main_balance, withdraw_hold
      FROM users
      WHERE id = ?
      FOR UPDATE
      `,
      [w.user_id]
    );

    if (!uRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: "User not found" });
    }

    // Deduct main balance + release hold
    const [balRes] = await conn.query(
      `
      UPDATE users
      SET main_balance = main_balance - ?,
          withdraw_hold = GREATEST(withdraw_hold - ?, 0),
          updated_at = NOW()
      WHERE id = ?
      `,
      [w.amount, w.amount, w.user_id]
    );

    if (!balRes.affectedRows) {
      await conn.rollback();
      return res.status(500).json({ message: "Balance update failed" });
    }

    // 3) Mark withdrawal approved
    const [ok] = await conn.query(
      `
      UPDATE withdrawals
      SET status='approved',
          admin_note=?,
          approved_by=?,
          approved_at=NOW(),
          updated_at=NOW()
      WHERE id = ? AND status='pending'
      `,
      [admin_note, adminId, withdrawalId]
    );

    if (!ok.affectedRows) {
      await conn.rollback();
      return res.status(409).json({ message: "Withdrawal was already processed" });
    }

    await conn.commit();

    return res.json({
      message: "Withdrawal approved",
      withdrawal_id: w.id,
      user_id: w.user_id,
      method: w.method,
      asset: w.asset,
      amount: w.amount,
      status: "approved",
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return res.status(500).json({ message: "Server error", error: String(err) });
  } finally {
    conn.release();
  }
});
// -------------------------- ❌ Decline Withdrawal (Admin) --------------------------
router.post("/withdrawals/:id/decline", auth, adminOnly, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const adminId = req.user.id;
    const withdrawalId = Number(req.params.id);
    const admin_note = req.body?.admin_note ? String(req.body.admin_note).trim() : null;

    if (!Number.isInteger(withdrawalId) || withdrawalId <= 0) {
      return res.status(400).json({ message: "Invalid withdrawal id" });
    }

    await conn.beginTransaction();

    const [wRows] = await conn.query(
      `
      SELECT id, user_id, amount, status
      FROM withdrawals
      WHERE id = ?
      FOR UPDATE
      `,
      [withdrawalId]
    );

    if (!wRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: "Withdrawal not found" });
    }

    const w = wRows[0];
    if (w.status !== "pending") {
      await conn.rollback();
      return res.status(400).json({ message: "Withdrawal already processed" });
    }

    // Release hold back to available funds (no main_balance change)
    await conn.query(
      `
      UPDATE users
      SET withdraw_hold = GREATEST(withdraw_hold - ?, 0),
          updated_at = NOW()
      WHERE id = ?
      `,
      [w.amount, w.user_id]
    );

    // Mark declined
    await conn.query(
      `
      UPDATE withdrawals
      SET status='declined',
          admin_note=?,
          declined_by=?,
          declined_at=NOW(),
          updated_at=NOW()
      WHERE id = ? AND status='pending'
      `,
      [admin_note, adminId, withdrawalId]
    );

    await conn.commit();

    return res.json({
      message: "Withdrawal declined",
      withdrawal_id: w.id,
      status: "declined",
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return res.status(500).json({ message: "Server error", error: String(err) });
  } finally {
    conn.release();
  }
});
// ========================= ADMIN: Get All Withdrawals ========================= //
router.get("/withdrawals", auth, adminOnly, async (req, res) => {
  try {
    const {
      status,        // pending | approved | declined
      method,        // bank | crypto
      asset,         // BTC, ETH, USDT...
      user_id,       // optional filter
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const where = [];
    const params = [];

    if (status) {
      where.push("w.status = ?");
      params.push(status);
    }

    if (method) {
      where.push("w.method = ?");
      params.push(method);
    }

    if (asset) {
      where.push("w.asset = ?");
      params.push(asset.toUpperCase());
    }

    if (user_id) {
      where.push("w.user_id = ?");
      params.push(Number(user_id));
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // 1️⃣ Fetch withdrawals
    const [rows] = await pool.query(
      `
      SELECT
        w.id,
        w.user_id,
        u.email,
        w.method,
        w.asset,
        w.amount,
        w.status,

        -- crypto
        w.crypto_address,
        w.crypto_network,

        -- bank
        w.bank_name,
        w.bank_account_number,
        w.bank_account_name,
        w.bank_country,

        w.admin_note,
        w.approved_by,
        w.approved_at,
        w.declined_by,
        w.declined_at,
        w.created_at,
        w.updated_at
      FROM withdrawals w
      JOIN users u ON u.id = w.user_id
      ${whereSQL}
      ORDER BY w.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limitNum, offset]
    );

    // 2️⃣ Count for pagination
    const [countRows] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM withdrawals w
      ${whereSQL}
      `,
      params
    );

    return res.json({
      meta: {
        page: pageNum,
        limit: limitNum,
        total: countRows[0].total,
        total_pages: Math.ceil(countRows[0].total / limitNum)
      },
      withdrawals: rows
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: String(err)
    });
  }
});
// ========================= ADMIN: Get Withdrawal By ID ========================= //
router.get("/withdrawals/:id", auth, adminOnly, async (req, res) => {
  try {
    const withdrawalId = Number(req.params.id);

    if (!Number.isInteger(withdrawalId) || withdrawalId <= 0) {
      return res.status(400).json({ message: "Invalid withdrawal id" });
    }

    const [rows] = await pool.query(
      `
      SELECT
        w.id,
        w.user_id,
        u.email,
        w.method,
        w.asset,
        w.amount,
        w.status,

        -- crypto
        w.crypto_address,
        w.crypto_network,

        -- bank
        w.bank_name,
        w.bank_account_number,
        w.bank_account_name,
        w.bank_country,

        w.admin_note,
        w.approved_by,
        w.approved_at,
        w.declined_by,
        w.declined_at,
        w.created_at,
        w.updated_at
      FROM withdrawals w
      JOIN users u ON u.id = w.user_id
      WHERE w.id = ?
      LIMIT 1
      `,
      [withdrawalId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Withdrawal not found" });
    }

    return res.json({
      withdrawal: rows[0]
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: String(err)
    });
  }
});



// helpers
const toNum = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));
const isNonEmpty = (s) => typeof s === "string" && s.trim().length > 0;

// ========================= ADMIN: Create Plan ========================= //
router.post("/plans", auth, adminOnly, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const roi_percent = toNum(req.body.roi_percent);
    const accuracy_percent = toNum(req.body.accuracy_percent);
    const price = toNum(req.body.price);
    const duration_days = parseInt(req.body.duration_days, 10);
    const is_active = req.body.is_active === undefined ? 1 : (req.body.is_active ? 1 : 0);

    if (!isNonEmpty(name)) return res.status(400).json({ message: "Plan name is required" });
    if (!Number.isFinite(roi_percent) || roi_percent < 0) return res.status(400).json({ message: "Invalid roi_percent" });
    if (!Number.isFinite(accuracy_percent) || accuracy_percent < 0 || accuracy_percent > 100) {
      return res.status(400).json({ message: "accuracy_percent must be 0 - 100" });
    }
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ message: "Invalid price" });
    if (!Number.isInteger(duration_days) || duration_days <= 0) {
      return res.status(400).json({ message: "duration_days must be a positive integer" });
    }

    const [result] = await pool.query(
      `
      INSERT INTO investment_plans
        (name, roi_percent, accuracy_percent, price, duration_days, is_active, created_at, updated_at)
      VALUES
        (?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [name, roi_percent, accuracy_percent, price, duration_days, is_active]
    );

    return res.json({
      message: "Plan created",
      plan_id: result.insertId,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ========================= ADMIN: Update Plan ========================= //
router.put("/plans/:id", auth, adminOnly, async (req, res) => {
  try {
    const planId = Number(req.params.id);
    if (!Number.isInteger(planId) || planId <= 0) {
      return res.status(400).json({ message: "Invalid plan id" });
    }

    // allow partial updates
    const fields = [];
    const params = [];

    if (req.body.name !== undefined) {
      const name = String(req.body.name || "").trim();
      if (!isNonEmpty(name)) return res.status(400).json({ message: "name cannot be empty" });
      fields.push("name = ?");
      params.push(name);
    }

    if (req.body.roi_percent !== undefined) {
      const roi_percent = toNum(req.body.roi_percent);
      if (!Number.isFinite(roi_percent) || roi_percent < 0) return res.status(400).json({ message: "Invalid roi_percent" });
      fields.push("roi_percent = ?");
      params.push(roi_percent);
    }

    if (req.body.accuracy_percent !== undefined) {
      const accuracy_percent = toNum(req.body.accuracy_percent);
      if (!Number.isFinite(accuracy_percent) || accuracy_percent < 0 || accuracy_percent > 100) {
        return res.status(400).json({ message: "accuracy_percent must be 0 - 100" });
      }
      fields.push("accuracy_percent = ?");
      params.push(accuracy_percent);
    }

    if (req.body.price !== undefined) {
      const price = toNum(req.body.price);
      if (!Number.isFinite(price) || price < 0) return res.status(400).json({ message: "Invalid price" });
      fields.push("price = ?");
      params.push(price);
    }

    if (req.body.duration_days !== undefined) {
      const duration_days = parseInt(req.body.duration_days, 10);
      if (!Number.isInteger(duration_days) || duration_days <= 0) {
        return res.status(400).json({ message: "duration_days must be a positive integer" });
      }
      fields.push("duration_days = ?");
      params.push(duration_days);
    }

    if (req.body.is_active !== undefined) {
      const is_active = req.body.is_active ? 1 : 0;
      fields.push("is_active = ?");
      params.push(is_active);
    }

    if (!fields.length) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const [result] = await pool.query(
      `
      UPDATE investment_plans
      SET ${fields.join(", ")}, updated_at = NOW()
      WHERE id = ?
      `,
      [...params, planId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Plan not found" });
    }

    return res.json({ message: "Plan updated", plan_id: planId });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ========================= GET: All Plans (users can see) ========================= //
router.get("/plans", auth, async (req, res) => {
  try {
    const activeOnly = String(req.query.active_only || "1") === "1"; // default active only

    const [rows] = await pool.query(
      `
      SELECT
        id, name, roi_percent, accuracy_percent, price, duration_days, is_active,
        created_at, updated_at
      FROM investment_plans
      ${activeOnly ? "WHERE is_active = 1" : ""}
      ORDER BY created_at DESC
      `
    );

    return res.json({ count: rows.length, plans: rows });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ========================= GET: Plan By ID (users can see) ========================= //
router.get("/plans/:id", auth, async (req, res) => {
  try {
    const planId = Number(req.params.id);
    if (!Number.isInteger(planId) || planId <= 0) {
      return res.status(400).json({ message: "Invalid plan id" });
    }

    const [rows] = await pool.query(
      `
      SELECT
        id, name, roi_percent, accuracy_percent, price, duration_days, is_active,
        created_at, updated_at
      FROM investment_plans
      WHERE id = ?
      LIMIT 1
      `,
      [planId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Plan not found" });
    }

    return res.json({ plan: rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ========================= ADMIN: Delete Plan ========================= //
router.delete("/plans/:id", auth, adminOnly, async (req, res) => {
  try {
    const planId = Number(req.params.id);
    if (!Number.isInteger(planId) || planId <= 0) {
      return res.status(400).json({ message: "Invalid plan id" });
    }

    const [result] = await pool.query(
      `DELETE FROM investment_plans WHERE id = ?`,
      [planId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Plan not found" });
    }

    return res.json({ message: "Plan deleted", plan_id: planId });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});

// ========================= ADMIN: List User Investments ========================= //
router.get("/investments", auth, adminOnly, async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status).trim().toLowerCase() : "";
    const userId = req.query.user_id ? Number(req.query.user_id) : null;
    const allowed = new Set(["active", "completed", "cancelled"]);

    const where = [];
    const params = [];

    if (status) {
      if (!allowed.has(status)) return res.status(400).json({ message: "Invalid status filter" });
      where.push("ui.status = ?");
      params.push(status);
    }

    if (userId) {
      where.push("ui.user_id = ?");
      params.push(userId);
    }

    const [rows] = await pool.query(
      `
      SELECT
        ui.id,
        ui.user_id,
        u.full_name,
        u.username,
        u.email,
        ui.plan_id,
        p.name AS plan_name,
        ui.amount,
        ui.roi_percent,
        ui.expected_profit,
        ui.expected_total,
        ui.actual_profit_loss,
        ui.final_total,
        ui.duration_days,
        ui.status,
        ui.admin_note,
        ui.started_at,
        ui.ends_at,
        ui.completed_at,
        ui.created_at,
        ui.updated_at
      FROM user_investments ui
      JOIN users u ON u.id = ui.user_id
      JOIN investment_plans p ON p.id = ui.plan_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY ui.created_at DESC
      `,
      params
    );

    return res.json({ count: rows.length, investments: rows });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});

// ========================= ADMIN: Add Profit/Loss To Investment ========================= //
router.patch("/investments/:id/result", auth, adminOnly, async (req, res) => {
  try {
    const investmentId = Number(req.params.id);
    if (!Number.isInteger(investmentId) || investmentId <= 0) {
      return res.status(400).json({ message: "Invalid investment id" });
    }

    const actual_profit_loss = toNum(req.body.actual_profit_loss);
    const admin_note = req.body.admin_note === undefined ? null : String(req.body.admin_note || "").trim();

    if (!Number.isFinite(actual_profit_loss)) {
      return res.status(400).json({ message: "actual_profit_loss must be a number" });
    }

    const [rows] = await pool.query(
      `SELECT id, amount, status FROM user_investments WHERE id = ? LIMIT 1`,
      [investmentId]
    );

    if (!rows.length) return res.status(404).json({ message: "Investment not found" });
    if (rows[0].status === "completed") {
      return res.status(400).json({ message: "Completed investments cannot be edited" });
    }

    const amount = Number(rows[0].amount) || 0;
    const final_total = Math.max(0, Number((amount + actual_profit_loss).toFixed(2)));

    await pool.query(
      `
      UPDATE user_investments
      SET actual_profit_loss = ?,
          final_total = ?,
          admin_note = ?,
          updated_at = NOW()
      WHERE id = ?
      `,
      [actual_profit_loss, final_total, admin_note || null, investmentId]
    );

    return res.json({
      message: "Investment result updated",
      investment_id: investmentId,
      actual_profit_loss,
      final_total,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});

// ========================= ADMIN: Settle Investment To User Main Wallet ========================= //
router.post("/investments/:id/settle", auth, adminOnly, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const adminId = req.user.id;
    const investmentId = Number(req.params.id);

    if (!Number.isInteger(investmentId) || investmentId <= 0) {
      return res.status(400).json({ message: "Invalid investment id" });
    }

    await conn.beginTransaction();

    const [rows] = await conn.query(
      `
      SELECT id, user_id, amount, actual_profit_loss, final_total, status
      FROM user_investments
      WHERE id = ?
      FOR UPDATE
      `,
      [investmentId]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ message: "Investment not found" });
    }

    const investment = rows[0];
    if (investment.status === "completed") {
      await conn.rollback();
      return res.status(400).json({ message: "Investment already completed" });
    }

    const amount = Number(investment.amount) || 0;
    const actual = Number(investment.actual_profit_loss) || 0;
    const finalTotal = Number(investment.final_total) > 0
      ? Number(investment.final_total)
      : Math.max(0, Number((amount + actual).toFixed(2)));

    await conn.query(
      `
      UPDATE users
      SET investment_balance = GREATEST(investment_balance - ?, 0),
          main_balance = main_balance + ?,
          updated_at = NOW()
      WHERE id = ?
      `,
      [amount, finalTotal, investment.user_id]
    );

    await conn.query(
      `
      UPDATE user_investments
      SET final_total = ?,
          status = 'completed',
          completed_at = NOW(),
          settled_by = ?,
          updated_at = NOW()
      WHERE id = ?
      `,
      [finalTotal, adminId, investmentId]
    );

    await conn.query(
      `
      INSERT INTO notifications (user_id, type, title, message, created_by, created_at)
      VALUES (?, 'investment', 'Investment Completed', ?, ?, NOW())
      `,
      [
        investment.user_id,
        `Your investment has been completed. ${finalTotal.toFixed(2)} has been sent to your main wallet.`,
        adminId,
      ]
    );

    await conn.commit();

    return res.json({
      message: "Investment settled to user main wallet",
      investment_id: investmentId,
      user_id: investment.user_id,
      principal: amount,
      actual_profit_loss: actual,
      credited_to_main_balance: finalTotal,
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return res.status(500).json({ message: "Server error", error: String(err) });
  } finally {
    conn.release();
  }
});


// ========================= ADMIN: Get All KYC (with filters + pagination) ========================= //
router.get("/kyc", auth, adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 20, user_id } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const where = [];
    const params = [];

    if (status) {
      where.push("k.status = ?");
      params.push(status);
    }
    if (user_id) {
      where.push("k.user_id = ?");
      params.push(Number(user_id));
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `
      SELECT
        k.id, k.user_id, u.email,
        k.selfie_filename, k.id_front_filename, k.id_back_filename,
        k.status, k.admin_note,
        k.approved_by, k.approved_at, k.declined_by, k.declined_at,
        k.created_at, k.updated_at
      FROM user_kyc k
      JOIN users u ON u.id = k.user_id
      ${whereSQL}
      ORDER BY k.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limitNum, offset]
    );

    const [countRows] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM user_kyc k
      ${whereSQL}
      `,
      params
    );

    return res.json({
      meta: {
        page: pageNum,
        limit: limitNum,
        total: countRows[0].total,
        total_pages: Math.ceil(countRows[0].total / limitNum),
      },
      kyc_list: rows,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ========================= ADMIN: Get KYC By ID ========================= //
router.get("/kyc/:id", auth, adminOnly, async (req, res) => {
  try {
    const kycId = Number(req.params.id);
    if (!Number.isInteger(kycId) || kycId <= 0) {
      return res.status(400).json({ message: "Invalid kyc id" });
    }

    const [rows] = await pool.query(
      `
      SELECT
        k.id, k.user_id, u.email,
        k.selfie_filename, k.id_front_filename, k.id_back_filename,
        k.status, k.admin_note,
        k.approved_by, k.approved_at, k.declined_by, k.declined_at,
        k.created_at, k.updated_at
      FROM user_kyc k
      JOIN users u ON u.id = k.user_id
      WHERE k.id = ?
      LIMIT 1
      `,
      [kycId]
    );

    if (!rows.length) return res.status(404).json({ message: "KYC not found" });

    const d = rows[0];
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    return res.json({
      kyc: {
        ...d,
        selfie_url: `${baseUrl}/uploads/kyc/${d.selfie_filename}`,
        id_front_url: `${baseUrl}/uploads/kyc/${d.id_front_filename}`,
        id_back_url: `${baseUrl}/uploads/kyc/${d.id_back_filename}`,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ========================= ADMIN: Approve KYC ========================= //
router.post("/kyc/:id/approve", auth, adminOnly, async (req, res) => {
  try {
    const adminId = req.user.id;
    const kycId = Number(req.params.id);
    const admin_note = req.body?.admin_note ? String(req.body.admin_note).trim() : null;

    if (!Number.isInteger(kycId) || kycId <= 0) {
      return res.status(400).json({ message: "Invalid kyc id" });
    }

    const [result] = await pool.query(
      `
      UPDATE user_kyc
      SET status = 'approved',
          admin_note = ?,
          approved_by = ?,
          approved_at = NOW(),
          declined_by = NULL,
          declined_at = NULL,
          updated_at = NOW()
      WHERE id = ? AND status = 'pending'
      `,
      [admin_note, adminId, kycId]
    );

    if (!result.affectedRows) {
      return res.status(400).json({ message: "KYC not found or already processed" });
    }

    return res.json({ message: "KYC approved", kyc_id: kycId, status: "approved" });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ========================= ADMIN: Decline KYC ========================= //
router.post("/kyc/:id/decline", auth, adminOnly, async (req, res) => {
  try {
    const adminId = req.user.id;
    const kycId = Number(req.params.id);
    const admin_note = req.body?.admin_note ? String(req.body.admin_note).trim() : null;

    if (!Number.isInteger(kycId) || kycId <= 0) {
      return res.status(400).json({ message: "Invalid kyc id" });
    }

    const [result] = await pool.query(
      `
      UPDATE user_kyc
      SET status = 'declined',
          admin_note = ?,
          declined_by = ?,
          declined_at = NOW(),
          approved_by = NULL,
          approved_at = NULL,
          updated_at = NOW()
      WHERE id = ? AND status = 'pending'
      `,
      [admin_note, adminId, kycId]
    );

    if (!result.affectedRows) {
      return res.status(400).json({ message: "KYC not found or already processed" });
    }

    return res.json({ message: "KYC declined", kyc_id: kycId, status: "declined" });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});


// ========================= ADMIN: Create Copy Trader ========================= //
router.post("/copy-traders", auth, adminOnly, traderUpload.single("image"), async (req, res) => {
  try {
    const trader_name = String(req.body.trader_name || "").trim();
    const win_rate_percent = toNum(req.body.win_rate_percent);
    const profit_percent = toNum(req.body.profit_percent);
    const is_active = req.body.is_active === undefined ? 1 : (req.body.is_active ? 1 : 0);

    if (!trader_name) return res.status(400).json({ message: "trader_name is required" });
    if (!Number.isFinite(win_rate_percent) || win_rate_percent < 0 || win_rate_percent > 100) {
      return res.status(400).json({ message: "win_rate_percent must be 0 - 100" });
    }
    if (!Number.isFinite(profit_percent)) {
      return res.status(400).json({ message: "Invalid profit_percent" });
    }

    const image_filename = req.file ? req.file.filename : null;

    const [result] = await pool.query(
      `
      INSERT INTO copy_traders
        (trader_name, win_rate_percent, profit_percent, image_filename, is_active, created_at, updated_at)
      VALUES
        (?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [trader_name, win_rate_percent, profit_percent, image_filename, is_active]
    );

    return res.json({
      message: "Copy trader created",
      trader_id: result.insertId
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ========================= ADMIN: Update Copy Trader ========================= //
// Supports updating text fields + replacing image if provided.
router.put("/copy-traders/:id", auth, adminOnly, traderUpload.single("image"), async (req, res) => {
  try {
    const traderId = Number(req.params.id);
    if (!Number.isInteger(traderId) || traderId <= 0) {
      return res.status(400).json({ message: "Invalid trader id" });
    }

    const fields = [];
    const params = [];

    if (req.body.trader_name !== undefined) {
      const trader_name = String(req.body.trader_name || "").trim();
      if (!trader_name) return res.status(400).json({ message: "trader_name cannot be empty" });
      fields.push("trader_name = ?");
      params.push(trader_name);
    }

    if (req.body.win_rate_percent !== undefined) {
      const win_rate_percent = toNum(req.body.win_rate_percent);
      if (!Number.isFinite(win_rate_percent) || win_rate_percent < 0 || win_rate_percent > 100) {
        return res.status(400).json({ message: "win_rate_percent must be 0 - 100" });
      }
      fields.push("win_rate_percent = ?");
      params.push(win_rate_percent);
    }

    if (req.body.profit_percent !== undefined) {
      const profit_percent = toNum(req.body.profit_percent);
      if (!Number.isFinite(profit_percent)) return res.status(400).json({ message: "Invalid profit_percent" });
      fields.push("profit_percent = ?");
      params.push(profit_percent);
    }

    if (req.body.is_active !== undefined) {
      fields.push("is_active = ?");
      params.push(req.body.is_active ? 1 : 0);
    }

    // if new image uploaded
    if (req.file) {
      fields.push("image_filename = ?");
      params.push(req.file.filename);
    }

    if (!fields.length) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const [result] = await pool.query(
      `
      UPDATE copy_traders
      SET ${fields.join(", ")}, updated_at = NOW()
      WHERE id = ?
      `,
      [...params, traderId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Copy trader not found" });
    }

    return res.json({ message: "Copy trader updated", trader_id: traderId });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ========================= ADMIN: Get All Copy Traders ========================= //
router.get("/copy-traders", auth, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        id, trader_name, win_rate_percent, profit_percent, image_filename, is_active,
        created_at, updated_at
      FROM copy_traders
      ORDER BY created_at DESC
      `
    );

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const traders = rows.map((t) => ({
      ...t,
      image_url: t.image_filename ? `${baseUrl}/uploads/traders/${t.image_filename}` : null
    }));

    return res.json({ count: traders.length, traders });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ========================= ADMIN: Get Copy Trader By ID ========================= //
router.get("/copy-traders/:id", auth, adminOnly, async (req, res) => {
  try {
    const traderId = Number(req.params.id);
    if (!Number.isInteger(traderId) || traderId <= 0) {
      return res.status(400).json({ message: "Invalid trader id" });
    }

    const [rows] = await pool.query(
      `
      SELECT
        id, trader_name, win_rate_percent, profit_percent, image_filename, is_active,
        created_at, updated_at
      FROM copy_traders
      WHERE id = ?
      LIMIT 1
      `,
      [traderId]
    );

    if (!rows.length) return res.status(404).json({ message: "Copy trader not found" });

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const t = rows[0];

    return res.json({
      trader: {
        ...t,
        image_url: t.image_filename ? `${baseUrl}/uploads/traders/${t.image_filename}` : null
      }
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ========================= ADMIN: Delete Copy Trader ========================= //
router.delete("/copy-traders/:id", auth, adminOnly, async (req, res) => {
  try {
    const traderId = Number(req.params.id);
    if (!Number.isInteger(traderId) || traderId <= 0) {
      return res.status(400).json({ message: "Invalid trader id" });
    }

    const [result] = await pool.query(`DELETE FROM copy_traders WHERE id = ?`, [traderId]);

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Copy trader not found" });
    }

    return res.json({ message: "Copy trader deleted", trader_id: traderId });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});


// ========================= ADMIN: Send Popup ========================= //
router.post("/notify/popup", auth, adminOnly, async (req, res) => {
  try {
    const adminId = req.user.id;

    const title = String(req.body.title || "").trim();
    const message = String(req.body.message || "").trim();
    const user_id = req.body.user_id ? Number(req.body.user_id) : null;
    const expires_in_minutes = req.body.expires_in_minutes ? Number(req.body.expires_in_minutes) : null;

    if (!isNonEmpty(title)) return res.status(400).json({ message: "title is required" });
    if (!isNonEmpty(message)) return res.status(400).json({ message: "message is required" });

    let expiresAtSQL = "NULL";
    const params = [user_id || null, title, message, adminId];

    if (expires_in_minutes && Number.isFinite(expires_in_minutes) && expires_in_minutes > 0) {
      expiresAtSQL = "DATE_ADD(NOW(), INTERVAL ? MINUTE)";
      params.splice(3, 0, expires_in_minutes); // insert before adminId
    }

    const [result] = await pool.query(
      `
      INSERT INTO notifications (user_id, type, title, message, expires_at, created_by, created_at)
      VALUES (?, 'popup', ?, ?, ${expiresAtSQL}, ?, NOW())
      `,
      params
    );

    return res.json({
      message: "Popup sent",
      notification_id: result.insertId,
      target: user_id ? { user_id } : { broadcast: true },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ========================= ADMIN: Send Notification ========================= //
router.post("/notify/notification", auth, adminOnly, async (req, res) => {
  try {
    const adminId = req.user.id;

    const title = String(req.body.title || "").trim();
    const message = String(req.body.message || "").trim();
    const user_id = req.body.user_id ? Number(req.body.user_id) : null;

    if (!isNonEmpty(title)) return res.status(400).json({ message: "title is required" });
    if (!isNonEmpty(message)) return res.status(400).json({ message: "message is required" });

    const [result] = await pool.query(
      `
      INSERT INTO notifications (user_id, type, title, message, expires_at, created_by, created_at)
      VALUES (?, 'notification', ?, ?, NULL, ?, NOW())
      `,
      [user_id || null, title, message, adminId]
    );

    return res.json({
      message: "Notification sent",
      notification_id: result.insertId,
      target: user_id ? { user_id } : { broadcast: true },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ========================= ADMIN: Get All Notifications ========================= //
router.get("/notify", auth, adminOnly, async (req, res) => {
  try {
    const {
      type,          // notification | popup
      user_id,       // optional
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const where = [];
    const params = [];

    if (type) {
      where.push("n.type = ?");
      params.push(type);
    }

    if (user_id) {
      where.push("n.user_id = ?");
      params.push(Number(user_id));
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // 1️⃣ Fetch notifications
    const [rows] = await pool.query(
      `
      SELECT
        n.id,
        n.type,
        n.user_id,
        u.email,
        n.title,
        n.message,
        n.expires_at,
        n.created_by,
        n.created_at
      FROM notifications n
      LEFT JOIN users u ON u.id = n.user_id
      ${whereSQL}
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limitNum, offset]
    );

    // 2️⃣ Count for pagination
    const [countRows] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM notifications n
      ${whereSQL}
      `,
      params
    );

    return res.json({
      meta: {
        page: pageNum,
        limit: limitNum,
        total: countRows[0].total,
        total_pages: Math.ceil(countRows[0].total / limitNum)
      },
      notifications: rows
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: String(err)
    });
  }
});
// ========================= ADMIN: Delete Notification ========================= //
router.delete("/notify/:id", auth, adminOnly, async (req, res) => {
  try {
    const notificationId = Number(req.params.id);

    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      return res.status(400).json({ message: "Invalid notification id" });
    }

    const [result] = await pool.query(
      `
      DELETE FROM notifications
      WHERE id = ?
      `,
      [notificationId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.json({
      message: "Notification deleted",
      notification_id: notificationId
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: String(err)
    });
  }
});
// ========================= ADMIN: Send Email ========================= //
router.post("/notify/email", auth, adminOnly, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const adminId = req.user.id;

    const subject = String(req.body.subject || "").trim();
    const message = String(req.body.message || "").trim();

    const user_id = req.body.user_id ? Number(req.body.user_id) : null;
    const to_email = req.body.to_email ? String(req.body.to_email).trim() : null;
    const broadcast = req.body.broadcast === true;
    const sendHtml = req.body.html === true;

    if (!isNonEmpty(subject)) return res.status(400).json({ message: "subject is required" });
    if (!isNonEmpty(message)) return res.status(400).json({ message: "message is required" });

    if (!broadcast && !user_id && !to_email) {
      return res.status(400).json({ message: "Provide user_id OR to_email OR broadcast:true" });
    }

    await conn.beginTransaction();

    let recipients = [];

    if (broadcast) {
      const [rows] = await conn.query(
        `SELECT id AS user_id, email FROM users WHERE email IS NOT NULL AND email != ''`
      );
      recipients = rows.map((r) => ({ user_id: r.user_id, email: r.email }));
    } else if (user_id) {
      const [rows] = await conn.query(
        `SELECT id AS user_id, email FROM users WHERE id = ? LIMIT 1`,
        [user_id]
      );
      if (!rows.length) {
        await conn.rollback();
        return res.status(404).json({ message: "User not found" });
      }
      recipients = [{ user_id: rows[0].user_id, email: rows[0].email }];
    } else {
      recipients = [{ user_id: null, email: to_email }];
    }

    const results = [];

    for (const r of recipients) {
      try {
        if (sendHtml) {
          const html = adminEmailTemplate({ subject, message });
          await sendMailHTML(r.email, subject, html);
        } else {
          await sendMailText(r.email, subject, message);
        }

        await conn.query(
          `
          INSERT INTO email_logs (user_id, to_email, subject, message, status, error, created_by, created_at)
          VALUES (?, ?, ?, ?, 'sent', NULL, ?, NOW())
          `,
          [r.user_id, r.email, subject, message, adminId]
        );

        results.push({ to: r.email, status: "sent" });
      } catch (e) {
        await conn.query(
          `
          INSERT INTO email_logs (user_id, to_email, subject, message, status, error, created_by, created_at)
          VALUES (?, ?, ?, ?, 'failed', ?, ?, NOW())
          `,
          [r.user_id, r.email, subject, message, String(e), adminId]
        );

        results.push({ to: r.email, status: "failed", error: String(e) });
      }
    }

    await conn.commit();

    return res.json({
      message: "Email send operation completed",
      broadcast,
      sent_count: results.filter((x) => x.status === "sent").length,
      failed_count: results.filter((x) => x.status === "failed").length,
      results,
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return res.status(500).json({ message: "Server error", error: String(err) });
  } finally {
    conn.release();
  }
});
// ========================= ADMIN: Get Email Logs History ========================= //
router.get("/notify/emails", auth, adminOnly, async (req, res) => {
  try {
    const {
      status,        // sent | failed
      user_id,       // optional
      to_email,      // optional search
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const where = [];
    const params = [];

    if (status) {
      where.push("e.status = ?");
      params.push(status);
    }

    if (user_id) {
      where.push("e.user_id = ?");
      params.push(Number(user_id));
    }

    if (to_email) {
      where.push("e.to_email LIKE ?");
      params.push(`%${String(to_email).trim()}%`);
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // 1️⃣ Fetch logs
    const [rows] = await pool.query(
      `
      SELECT
        e.id,
        e.user_id,
        u.email AS user_email,
        e.to_email,
        e.subject,
        e.message,
        e.status,
        e.error,
        e.created_by,
        e.created_at
      FROM email_logs e
      LEFT JOIN users u ON u.id = e.user_id
      ${whereSQL}
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limitNum, offset]
    );

    // 2️⃣ Count total
    const [countRows] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM email_logs e
      ${whereSQL}
      `,
      params
    );

    return res.json({
      meta: {
        page: pageNum,
        limit: limitNum,
        total: countRows[0].total,
        total_pages: Math.ceil(countRows[0].total / limitNum)
      },
      emails: rows
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: String(err)
    });
  }
});


// ========================= ADMIN: Approve Account Upgrade ========================= //
router.post("/account-upgrades/:id/approve", auth, adminOnly, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const adminId = req.user.id;
    const upgradeId = Number(req.params.id);
    const admin_note = req.body?.admin_note ? String(req.body.admin_note).trim() : null;

    if (!Number.isInteger(upgradeId) || upgradeId <= 0) {
      return res.status(400).json({ message: "Invalid upgrade id" });
    }

    await conn.beginTransaction();

    // 1) lock upgrade row
    const [uRows] = await conn.query(
      `
      SELECT id, user_id, requested_account_type, status
      FROM account_upgrades
      WHERE id = ?
      FOR UPDATE
      `,
      [upgradeId]
    );

    if (!uRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: "Upgrade request not found" });
    }

    const upg = uRows[0];
    if (upg.status !== "pending") {
      await conn.rollback();
      return res.status(400).json({ message: "Upgrade already processed" });
    }

    // 2) update user account type
    const [userRes] = await conn.query(
      `
      UPDATE users
      SET account_type = ?,
          updated_at = NOW()
      WHERE id = ?
      `,
      [upg.requested_account_type, upg.user_id]
    );

    if (!userRes.affectedRows) {
      await conn.rollback();
      return res.status(404).json({ message: "User not found" });
    }

    // 3) mark upgrade approved
    const [ok] = await conn.query(
      `
      UPDATE account_upgrades
      SET status='approved',
          admin_note=?,
          approved_by=?,
          approved_at=NOW(),
          updated_at=NOW()
      WHERE id = ? AND status='pending'
      `,
      [admin_note, adminId, upgradeId]
    );

    if (!ok.affectedRows) {
      await conn.rollback();
      return res.status(409).json({ message: "Upgrade was already processed" });
    }

    await conn.commit();

    return res.json({
      message: "Upgrade approved and user account_type updated",
      upgrade_id: upgradeId,
      user_id: upg.user_id,
      new_account_type: upg.requested_account_type,
      status: "approved"
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return res.status(500).json({ message: "Server error", error: String(err) });
  } finally {
    conn.release();
  }
});
// ========================= ADMIN: Decline Account Upgrade ========================= //
router.post("/account-upgrades/:id/decline", auth, adminOnly, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const adminId = req.user.id;
    const upgradeId = Number(req.params.id);
    const admin_note = req.body?.admin_note ? String(req.body.admin_note).trim() : null;

    if (!Number.isInteger(upgradeId) || upgradeId <= 0) {
      return res.status(400).json({ message: "Invalid upgrade id" });
    }

    await conn.beginTransaction();

    const [uRows] = await conn.query(
      `
      SELECT id, user_id, requested_account_type, status
      FROM account_upgrades
      WHERE id = ?
      FOR UPDATE
      `,
      [upgradeId]
    );

    if (!uRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: "Upgrade request not found" });
    }

    const upg = uRows[0];
    if (upg.status !== "pending") {
      await conn.rollback();
      return res.status(400).json({ message: "Upgrade already processed" });
    }

    await conn.query(
      `
      UPDATE account_upgrades
      SET status='declined',
          admin_note=?,
          declined_by=?,
          declined_at=NOW(),
          updated_at=NOW()
      WHERE id = ? AND status='pending'
      `,
      [admin_note, adminId, upgradeId]
    );

    await conn.commit();

    return res.json({
      message: "Upgrade declined",
      upgrade_id: upgradeId,
      status: "declined"
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return res.status(500).json({ message: "Server error", error: String(err) });
  } finally {
    conn.release();
  }
});
// ========================= ADMIN: Get All Account Upgrade Requests ========================= //
router.get("/account-upgrades", auth, adminOnly, async (req, res) => {
  try {
    const {
      status, // pending|approved|declined
      user_id,
      requested_account_type,
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const where = [];
    const params = [];

    if (status) { where.push("a.status = ?"); params.push(status); }
    if (user_id) { where.push("a.user_id = ?"); params.push(Number(user_id)); }
    if (requested_account_type) { where.push("a.requested_account_type = ?"); params.push(String(requested_account_type).trim()); }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `
      SELECT
        a.id,
        a.user_id,
        u.email,
        a.current_account_type,
        a.requested_account_type,
        a.note,
        a.proof_filename,
        a.status,
        a.admin_note,
        a.approved_by,
        a.approved_at,
        a.declined_by,
        a.declined_at,
        a.created_at,
        a.updated_at
      FROM account_upgrades a
      JOIN users u ON u.id = a.user_id
      ${whereSQL}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limitNum, offset]
    );

    const [countRows] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM account_upgrades a
      ${whereSQL}
      `,
      params
    );

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const upgrades = rows.map((u) => {
      const proof_path = u.proof_filename ? `/uploads/upgrades/${u.proof_filename}` : null;
      return { ...u, proof_path, proof_url: proof_path ? `${baseUrl}${proof_path}` : null };
    });

    return res.json({
      meta: {
        page: pageNum,
        limit: limitNum,
        total: countRows[0].total,
        total_pages: Math.ceil(countRows[0].total / limitNum)
      },
      upgrades
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});


// -------------------------- Create User (admin only) ------------------------ //
router.post("/create-user", auth, adminOnly, async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!name || !cleanEmail || !password) {
      return res.status(400).json({ message: "name, email, password are required" });
    }

    const [exists] = await pool.query("SELECT id FROM users WHERE email = ?", [cleanEmail]);
    if (exists.length) return res.status(409).json({ message: "User already exists" });

    const hash = await bcrypt.hash(password, 12);

    const [result] = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_verified, created_at)
       VALUES (?, ?, ?, 'user', 0, NOW())`,
      [String(name).trim(), cleanEmail, hash]
    );

    // Optional email
    try {
      await sendMail({
        to: cleanEmail,
        subject: "Welcome to Oncoinmeta",
        html: `<p>Hello ${String(name).trim()},</p><p>Your account has been created.</p>`,
      });
    } catch (e) {
      console.log("Mail failed:", String(e));
    }

    return res.json({ message: "User created", user_id: result.insertId });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});

module.exports = router;
