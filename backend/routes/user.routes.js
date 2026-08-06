// routes/user.routes.js
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const auth = require("../middleware/auth");
const { sendLoginAlertEmail } = require("../utils/mailer");
const moment = require("moment");
const { kycUpload } = require("../middleware/kycUpload");
const { upsUpload } = require("../middleware/ups-upload");


const router = express.Router();

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || "dev_secret", { expiresIn: "7d" });
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

async function findLoginUser(cleanIdentifier) {
  try {
    const [rows] = await pool.query(
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
      [cleanIdentifier, cleanIdentifier]
    );
    return rows;
  } catch (error) {
    if (!String(error.message || "").includes("Unknown column")) throw error;
  }

  const [rows] = await pool.query(
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
    [cleanIdentifier, cleanIdentifier]
  );
  return rows;
}

async function findUserProfile(userId) {
  try {
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
    return rows;
  } catch (error) {
    if (!String(error.message || "").includes("Unknown column")) throw error;
  }

  const [rows] = await pool.query(
    `
    SELECT
      id,
      name AS full_name,
      username,
      address,
      NULL AS city,
      NULL AS zipcode,
      nationality AS country,
      phone_number AS phone,
      email,
      CASE WHEN isAdmin = 1 THEN 'admin' ELSE 'user' END AS role,
      is_verified,

      trading_balance AS main_balance,
      holding_balance AS profit_balance,
      staking_balance AS investment_balance,

      account_type,
      0 AS trade_progress,
      signal_strength,

      'active' AS account_status,
      'inactive' AS copy_trading_status,
      'active' AS trading_status,

      created_at
    FROM users
    WHERE id = ?
    LIMIT 1
    `,
    [userId]
  );
  return rows;
}

async function findUserBalances(userId) {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        main_balance,
        profit_balance,
        investment_balance,
        account_type,
        trade_progress,
        signal_strength,
        account_status,
        copy_trading_status,
        trading_status
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    );
    return rows;
  } catch (error) {
    if (!String(error.message || "").includes("Unknown column")) throw error;
  }

  const [rows] = await pool.query(
    `
    SELECT
      trading_balance AS main_balance,
      holding_balance AS profit_balance,
      staking_balance AS investment_balance,
      account_type,
      0 AS trade_progress,
      signal_strength,
      'active' AS account_status,
      'inactive' AS copy_trading_status,
      'active' AS trading_status
    FROM users
    WHERE id = ?
    LIMIT 1
    `,
    [userId]
  );
  return rows;
}
const path = require("path");
const fs = require("fs");
const multer = require("multer");

// folder: backend/uploads/deposits
const DEPOSIT_UPLOAD_DIR = path.join(__dirname, "..", "uploads", "deposits");
fs.mkdirSync(DEPOSIT_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DEPOSIT_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
    const name = `deposit_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "application/pdf",
    ].includes(file.mimetype);

    cb(ok ? null : new Error("Only images (png/jpg/webp) or pdf allowed"), ok);
  },
});

// allowed crypto assets
const ALLOWED_ASSETS = ["BTC","ETH","USDT","BNB","LTC","DOGE","XRP","SHIB","SOL"];

// ========================= Registration ========================= //
router.post("/register", async (req, res) => {
  try {
    const {
      full_name,
      username,
      address,
      city,
      zipcode,
      country,
      phone,
      email,
      password,
    } = req.body || {};

    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!full_name || !username || !address || !city || !country || !phone || !cleanEmail || !password) {
      return res.status(400).json({ message: "All required fields must be filled" });
    }

    const [exists] = await pool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [cleanEmail]);
    if (exists.length) return res.status(409).json({ message: "Email already registered" });

    const hash = await bcrypt.hash(String(password), 12);

    const [result] = await pool.query(
      `
      INSERT INTO users
      (full_name, username, address, city, zipcode, country, phone, email, password_hash, role, is_verified, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'user', 0, NOW())
      `,
      [
        String(full_name).trim(),
        String(username).trim(),
        String(address).trim(),
        String(city).trim(),
        zipcode ? String(zipcode).trim() : null,
        String(country).trim(),
        String(phone).trim(),
        cleanEmail,
        hash,
      ]
    );

    try {
      await pool.query("DELETE FROM email_otps WHERE email = ?", [cleanEmail]);
    } catch (error) {
      if (!String(error.message || "").includes("email_otps")) throw error;
    }

    const token = signToken({
      id: result.insertId,
      role: "user",
      email: cleanEmail,
    });

    return res.json({
      message: "Registration successful. Your account is pending admin approval.",
      user_id: result.insertId,
      status: "pending_admin_approval",
      token,
      account_pending: true,
      user: {
        id: result.insertId,
        full_name: String(full_name).trim(),
        username: String(username).trim(),
        email: cleanEmail,
        role: "user",
        is_verified: 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ========================= Verify OTP ========================= //
router.post("/verify-otp", async (req, res) => {
  return res.status(410).json({
    message: "OTP verification has been removed. Accounts must be approved by an admin.",
  });
});
// ========================= Resend OTP (removed) ========================= //
router.post("/resend-otp", async (req, res) => {
  return res.status(410).json({
    message: "OTP resend has been removed. Accounts must be approved by an admin.",
  });
});
// ========================= Login (email OR username) ========================= //
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body || {};

    if (!identifier || !password) {
      return res.status(400).json({
        message: "identifier (email or username) and password are required",
      });
    }

    const cleanIdentifier = String(identifier).trim().toLowerCase();

    const rows = await findLoginUser(cleanIdentifier);

    if (!rows.length) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = rows[0];

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken({
      id: user.id,
      role: user.role || "user",
      email: user.email,
    });

    if (Number(user.is_verified) !== 1) {
      return res.json({
        message: "Account is pending admin approval.",
        token,
        account_pending: true,
        user: {
          id: user.id,
          full_name: user.full_name,
          username: user.username,
          email: user.email,
          role: user.role || "user",
          is_verified: Number(user.is_verified) || 0,
        },
      });
    }

    // 🔔 Send Login Alert Email (DO NOT block login if mail fails)
    try {
      const when = moment().format("dddd, MMMM Do YYYY, h:mm A");
      await sendLoginAlertEmail({
        to: user.email,
        name: user.full_name || user.username || "User",
        when,
      });
    } catch (e) {
      console.log("Login alert email failed:", String(e));
    }

    return res.json({
      message: "Logged in",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        username: user.username,
        email: user.email,
        role: user.role || "user",
        is_verified: Number(user.is_verified) || 0,
      },
    });
  } catch (err) {
    console.error("[users.login] failed:", err);
    return res.status(500).json({
      message: "Server error",
      error: String(err),
    });
  }
});
// ========================= Login (NO email notice) ========================= //
router.post("/login-no-email", async (req, res) => {
  try {
    const { identifier, password } = req.body || {};

    if (!identifier || !password) {
      return res.status(400).json({
        message: "identifier (email or username) and password are required",
      });
    }

    const cleanIdentifier = String(identifier).trim().toLowerCase();

    const rows = await findLoginUser(cleanIdentifier);

    if (!rows.length) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = rows[0];

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken({
      id: user.id,
      role: user.role || "user",
      email: user.email,
    });

    if (Number(user.is_verified) !== 1) {
      return res.json({
        message: "Account is pending admin approval.",
        token,
        account_pending: true,
        user: {
          id: user.id,
          full_name: user.full_name,
          username: user.username,
          email: user.email,
          role: user.role || "user",
          is_verified: Number(user.is_verified) || 0,
        },
      });
    }

    // ❌ NO email notification here

    return res.json({
      message: "Logged in",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        username: user.username,
        email: user.email,
        role: user.role || "user",
        is_verified: Number(user.is_verified) || 0,
      },
    });
  } catch (err) {
    console.error("[users.login-no-email] failed:", err);
    return res.status(500).json({
      message: "Server error",
      error: String(err),
    });
  }
});
// ========================= Change Password (User) ========================= //
router.patch("/change-password", auth, async (req, res) => {
  try {
    const userId = req.user.id; // from JWT
    const { new_password } = req.body || {};

    if (!new_password || String(new_password).trim().length < 8) {
      return res.status(400).json({
        message: "New password is required (minimum 8 characters)",
      });
    }

    // Check user exists
    const [rows] = await pool.query(
      "SELECT id FROM users WHERE id = ? LIMIT 1",
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    // Hash new password
    const hash = await bcrypt.hash(String(new_password), 12);

    // Update password
    await pool.query(
      "UPDATE users SET password_hash = ? WHERE id = ?",
      [hash, userId]
    );

    return res.json({
      message: "Password updated successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: String(err),
    });
  }
});
// ========================= Get Current User Profile + Balances ========================= //
router.get("/me", auth, async (req, res) => {
  try {
    // 1) Get user + main balances + statuses
    const rows = await findUserProfile(req.user.id);

    if (!rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = rows[0];

    // 2) Get crypto balances from separate table
    const [cryptoRows] = await pool.query(
      `
      SELECT asset, balance, updated_at
      FROM user_crypto_balances
      WHERE user_id = ?
      ORDER BY asset ASC
      `,
      [req.user.id]
    );

    // Optional: convert to object map like { BTC: "0.00", ETH: "0.00" }
    const crypto_balances = {};
    for (const r of cryptoRows) crypto_balances[r.asset] = r.balance;

    return res.json({
      user: {
        ...user,
        created_at_formatted: moment(user.created_at).format("MMMM Do YYYY, h:mm A"),
        created_at_from_now: moment(user.created_at).fromNow(),
        crypto_balances,     // map
        crypto_list: cryptoRows, // list (if you want it)
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: String(err),
    });
  }
});
// ========================= Get All Balances ========================= //
router.get("/balances", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1️⃣ Get main & trading balances from users table
    const userRows = await findUserBalances(userId);

    if (!userRows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2️⃣ Get crypto balances
    const [cryptoRows] = await pool.query(
      `
      SELECT asset, balance
      FROM user_crypto_balances
      WHERE user_id = ?
      `,
      [userId]
    );

    const crypto_balances = {};
    for (const row of cryptoRows) {
      crypto_balances[row.asset] = row.balance;
    }

    return res.json({
      balances: {
        main_balance: userRows[0].main_balance,
        profit_balance: userRows[0].profit_balance,
        investment_balance: userRows[0].investment_balance,
        crypto_balances,
        account_type: userRows[0].account_type,
        trade_progress: userRows[0].trade_progress,
        signal_strength: userRows[0].signal_strength,
        account_status: userRows[0].account_status,
        copy_trading_status: userRows[0].copy_trading_status,
        trading_status: userRows[0].trading_status,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: String(err),
    });
  }
});
// ========================= Crypto Allocation (%) Summary ========================= //
router.get("/balances/crypto-allocation", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT asset, balance
      FROM user_crypto_balances
      WHERE user_id = ?
      AND balance > 0
      `,
      [userId]
    );

    if (!rows.length) {
      return res.json({
        total_crypto_balance: 0,
        allocation: [],
      });
    }

    // 1️⃣ Calculate total crypto balance
    const total = rows.reduce(
      (sum, r) => sum + Number(r.balance || 0),
      0
    );

    if (total === 0) {
      return res.json({
        total_crypto_balance: 0,
        allocation: [],
      });
    }

    // 2️⃣ Calculate percentage per asset
    const allocation = rows.map((r) => {
      const bal = Number(r.balance) || 0;
      const percent = (bal / total) * 100;

      return {
        asset: r.asset,
        balance: bal,
        percentage: Number(percent.toFixed(2)), // 2 decimal precision
      };
    });

    return res.json({
      total_crypto_balance: Number(total.toFixed(8)),
      allocation,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: String(err),
    });
  }
});

// -------------------------- GET /api/users/wallet-addresses --------------------------
router.get("/wallet-addresses", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT id, asset, address, qr_filename, created_at, updated_at
      FROM wallet_addresses
      ORDER BY asset ASC
      `
    );

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const wallets = rows.map((w) => {
      const qr_path = w.qr_filename ? `/uploads/wallets/${w.qr_filename}` : null;
      return {
        id: w.id,
        asset: w.asset,
        address: w.address,
        qr_path,
        qr_url: qr_path ? `${baseUrl}${qr_path}` : null,
        created_at: w.created_at,
        updated_at: w.updated_at,
      };
    });

    return res.json({ count: wallets.length, wallets });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// -------------------------- GET /api/users/wallet-addresses/:id --------------------------
router.get("/wallet-addresses/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const [rows] = await pool.query(
      `
      SELECT id, asset, address, qr_filename, created_at, updated_at
      FROM wallet_addresses
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    const w = rows[0];
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const qr_path = w.qr_filename ? `/uploads/wallets/${w.qr_filename}` : null;

    return res.json({
      wallet: {
        id: w.id,
        asset: w.asset,
        address: w.address,
        qr_path,
        qr_url: qr_path ? `${baseUrl}${qr_path}` : null,
        created_at: w.created_at,
        updated_at: w.updated_at,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ========================= Create Deposit (User) + proof upload ========================= //
router.post("/deposits", auth, upload.single("proof"), async (req, res) => {
  try {
    const userId = req.user.id;

    const { asset, amount } = req.body || {};
    const cleanAsset = String(asset || "").trim().toUpperCase();
    const cleanAmount = Number(amount);

    const allowed = new Set(["BTC", "ETH", "USDT", "BNB", "LTC", "DOGE", "XRP", "SHIB", "SOL"]);

    if (!allowed.has(cleanAsset)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: "Invalid deposit method (asset)" });
    }

    if (!amount || Number.isNaN(cleanAmount) || cleanAmount <= 0) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: "Valid deposit amount is required" });
    }

    // ✅ proof required
    if (!req.file) {
      return res.status(400).json({ message: "Proof of payment is required (upload file 'proof')" });
    }

    const proof_filename = req.file.filename;
    const proof_path = `/uploads/deposits/${proof_filename}`;
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const [r] = await pool.query(
      `
      INSERT INTO deposits (user_id, asset, amount, proof_filename, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', NOW(), NOW())
      `,
      [userId, cleanAsset, String(amount), proof_filename]
    );

    return res.json({
      message: "Deposit submitted and pending approval",
      deposit: {
        id: r.insertId,
        asset: cleanAsset,
        amount: String(amount),
        status: "pending",
        proof_path,
        proof_url: `${baseUrl}${proof_path}`,
      },
    });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// -------------------------- GET user's deposit history --------------------------
router.get("/deposits", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT
        id,
        asset,
        amount,
        status,
        admin_note,
        proof_filename,
        approved_at,
        declined_at,
        created_at,
        updated_at
      FROM deposits
      WHERE user_id = ?
      ORDER BY created_at DESC
      `,
      [userId]
    );

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const deposits = rows.map((d) => {
      const proof_path = d.proof_filename
        ? `/uploads/deposits/${d.proof_filename}`
        : null;

      return {
        id: d.id,
        asset: d.asset,
        amount: d.amount,
        status: d.status,
        admin_note: d.admin_note,
        proof_path,
        proof_url: proof_path ? `${baseUrl}${proof_path}` : null,
        approved_at: d.approved_at,
        declined_at: d.declined_at,
        created_at: d.created_at,
        updated_at: d.updated_at,
      };
    });

    return res.json({
      count: deposits.length,
      deposits,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: String(err),
    });
  }
});
// -------------------------- GET single deposit by ID --------------------------
router.get("/deposits/:id", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const depositId = Number(req.params.id);

    if (!Number.isInteger(depositId) || depositId <= 0) {
      return res.status(400).json({ message: "Invalid deposit id" });
    }

    // 🔐 normal users can only view their own deposits
    // admins can view any deposit
    const isAdmin = req.user.role === "admin";

    const [rows] = await pool.query(
      `
      SELECT
        id,
        user_id,
        asset,
        amount,
        status,
        admin_note,
        proof_filename,
        approved_at,
        declined_at,
        created_at,
        updated_at
      FROM deposits
      WHERE id = ?
      ${isAdmin ? "" : "AND user_id = ?"}
      LIMIT 1
      `,
      isAdmin ? [depositId] : [depositId, userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Deposit not found" });
    }

    const d = rows[0];

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const proof_path = d.proof_filename
      ? `/uploads/deposits/${d.proof_filename}`
      : null;

    return res.json({
      id: d.id,
      user_id: d.user_id,
      asset: d.asset,
      amount: d.amount,
      status: d.status,
      admin_note: d.admin_note,
      proof_path,
      proof_url: proof_path ? `${baseUrl}${proof_path}` : null,
      approved_at: d.approved_at,
      declined_at: d.declined_at,
      created_at: d.created_at,
      updated_at: d.updated_at,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: String(err),
    });
  }
});




// -------------------------- ✅ Create Withdrawal Request (PENDING) --------------------------
router.post("/withdrawals", auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.user.id;

    const amount = Number(req.body.amount);
    const pin = String(req.body.pin || "").trim();
    const method = String(req.body.method || "").trim().toLowerCase(); // bank | crypto

    if (!/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ message: "PIN must be 4 to 6 digits" });
    }

    if (!amount || Number.isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    if (!["bank", "crypto"].includes(method)) {
      return res.status(400).json({ message: "Invalid method (bank|crypto)" });
    }

    const asset = req.body.asset ? String(req.body.asset).trim().toUpperCase() : null;

    const crypto_address = req.body.crypto_address ? String(req.body.crypto_address).trim() : null;
    const crypto_network = req.body.crypto_network ? String(req.body.crypto_network).trim().toUpperCase() : null;

    const bank_name = req.body.bank_name ? String(req.body.bank_name).trim() : null;
    const bank_account_number = req.body.bank_account_number ? String(req.body.bank_account_number).trim() : null;
    const bank_account_name = req.body.bank_account_name ? String(req.body.bank_account_name).trim() : null;
    const bank_country = req.body.bank_country ? String(req.body.bank_country).trim() : null;

    if (method === "crypto") {
      if (!asset || !ALLOWED_ASSETS.includes(asset)) {
        return res.status(400).json({ message: `Invalid crypto asset. Allowed: ${ALLOWED_ASSETS.join(", ")}` });
      }
      if (!crypto_address || crypto_address.length < 10) {
        return res.status(400).json({ message: "Crypto address is required" });
      }
    }

    if (method === "bank") {
      if (!bank_name || !bank_account_number || !bank_account_name) {
        return res.status(400).json({ message: "Bank name, account number, and account name are required" });
      }
    }

    await conn.beginTransaction();

    // 1) Lock user row and verify PIN + funds
    const [uRows] = await conn.query(
      `
      SELECT id, main_balance, withdraw_hold, pin_hash
      FROM users
      WHERE id = ?
      FOR UPDATE
      `,
      [userId]
    );

    if (!uRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: "User not found" });
    }

    const user = uRows[0];

    // ✅ PLAIN PIN CHECK (pin_hash holds plain PIN)
    if (!user.pin_hash || String(user.pin_hash).trim() !== pin) {
      await conn.rollback();
      return res.status(401).json({ message: "Invalid PIN" });
    }

    const mainBal = Number(user.main_balance) || 0;
    const holdBal = Number(user.withdraw_hold) || 0;
    const available = mainBal - holdBal;

    if (available < amount) {
      await conn.rollback();
      return res.status(400).json({
        message: "Insufficient balance",
        available_balance: available,
        requested_amount: amount,
      });
    }

    // 2) Create withdrawal (pending)
    const [ins] = await conn.query(
      `
      INSERT INTO withdrawals (
        user_id, method, asset, amount, status,
        crypto_address, crypto_network,
        bank_name, bank_account_number, bank_account_name, bank_country,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, 'pending',
        ?, ?,
        ?, ?, ?, ?,
        NOW(), NOW()
      )
      `,
      [
        userId, method, method === "crypto" ? asset : null, amount,
        method === "crypto" ? crypto_address : null,
        method === "crypto" ? crypto_network : null,
        method === "bank" ? bank_name : null,
        method === "bank" ? bank_account_number : null,
        method === "bank" ? bank_account_name : null,
        method === "bank" ? bank_country : null,
      ]
    );

    const withdrawalId = ins.insertId;

    // 3) Reserve funds (increase hold)
    await conn.query(
      `
      UPDATE users
      SET withdraw_hold = withdraw_hold + ?,
          updated_at = NOW()
      WHERE id = ?
      `,
      [amount, userId]
    );

    await conn.commit();

    return res.json({
      message: "Withdrawal request submitted (pending admin approval)",
      withdrawal_id: withdrawalId,
      method,
      amount,
      reserved_from: "main_balance",
      status: "pending",
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return res.status(500).json({ message: "Server error", error: String(err) });
  } finally {
    conn.release();
  }
});
// -------------------------- GET user's withdrawal history --------------------------
router.get("/withdrawals", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT
        id, method, asset, amount, status,
        crypto_address, crypto_network,
        bank_name, bank_account_number, bank_account_name, bank_country,
        admin_note, approved_at, declined_at,
        created_at, updated_at
      FROM withdrawals
      WHERE user_id = ?
      ORDER BY created_at DESC
      `,
      [userId]
    );

    return res.json({ count: rows.length, withdrawals: rows });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});


// ========================= Open Trade (Stocks) ========================= //
router.post("/trades", auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.user.id;

    const symbol = String(req.body.symbol || "").trim().toUpperCase();     // e.g AAPL
    const side = String(req.body.side || "").trim().toLowerCase();        // buy | sell
    const amount = Number(req.body.amount);                               // USD amount
    const duration = String(req.body.duration || "").trim().toLowerCase();// "30s" | "1m" | "5m"

    // optional: if you have live price from frontend or your price service
    const entry_price = req.body.entry_price !== undefined ? Number(req.body.entry_price) : null;

    if (!symbol || symbol.length < 1) {
      return res.status(400).json({ message: "Stock symbol is required" });
    }

    if (!["buy", "sell"].includes(side)) {
      return res.status(400).json({ message: "Trade side must be buy or sell" });
    }

    if (!amount || Number.isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: "Invalid trade amount" });
    }

    const DURATION_MAP = { "30s": 30, "1m": 60, "5m": 300 };
    const duration_seconds = DURATION_MAP[duration];

    if (!duration_seconds) {
      return res.status(400).json({ message: "Duration must be 30s, 1m, or 5m" });
    }

    if (entry_price !== null && (Number.isNaN(entry_price) || entry_price <= 0)) {
      return res.status(400).json({ message: "Invalid entry_price" });
    }

    await conn.beginTransaction();

    // 1) Lock user row
    const [uRows] = await conn.query(
      `
      SELECT id, main_balance
      FROM users
      WHERE id = ?
      FOR UPDATE
      `,
      [userId]
    );

    if (!uRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: "User not found" });
    }

    const user = uRows[0];
    const mainBal = Number(user.main_balance) || 0;

    if (mainBal < amount) {
      await conn.rollback();
      return res.status(400).json({
        message: "Insufficient main balance",
        main_balance: mainBal,
        required: amount,
      });
    }

    // 2) Deduct from main_balance immediately (trade stake)
    await conn.query(
      `
      UPDATE users
      SET main_balance = main_balance - ?,
          updated_at = NOW()
      WHERE id = ?
      `,
      [amount, userId]
    );

    // 3) Create trade (open)
    const [ins] = await conn.query(
      `
      INSERT INTO trades (
        user_id, symbol, side, amount, duration_seconds,
        entry_price, status, opened_at, expires_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, 'open', NOW(), DATE_ADD(NOW(), INTERVAL ? SECOND)
      )
      `,
      [userId, symbol, side, amount, duration_seconds, entry_price, duration_seconds]
    );

    const tradeId = ins.insertId;

    await conn.commit();

    return res.json({
      message: "Trade opened",
      trade: {
        id: tradeId,
        user_id: userId,
        symbol,
        side,
        amount,
        duration_seconds,
        entry_price,
        status: "open",
      },
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return res.status(500).json({ message: "Server error", error: String(err) });
  } finally {
    conn.release();
  }
});
// ========================= Get User Trades ========================= //
router.get("/trades", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT
        id, symbol, side, amount, duration_seconds,
        entry_price, exit_price, pnl,
        status, opened_at, expires_at, closed_at
      FROM trades
      WHERE user_id = ?
      ORDER BY opened_at DESC
      `,
      [userId]
    );

    return res.json({ count: rows.length, trades: rows });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ========================= Settle Expired Trades (User) ========================= //
router.post("/trades/settle-expired", auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.user.id;

    // optional: your backend can provide real price later
    // for now, we can close with exit_price = entry_price and pnl = 0
    await conn.beginTransaction();

    const [openTrades] = await conn.query(
      `
      SELECT id, amount, entry_price, side
      FROM trades
      WHERE user_id = ?
        AND status = 'open'
        AND expires_at <= NOW()
      FOR UPDATE
      `,
      [userId]
    );

    if (!openTrades.length) {
      await conn.rollback();
      return res.json({ message: "No expired trades to settle", settled: 0 });
    }

    // Here: pnl is 0 by default (plug in price feed later)
    for (const t of openTrades) {
      const pnl = 0;
      const payoutBackToMain = Number(t.amount) + pnl;

      // mark closed
      await conn.query(
        `
        UPDATE trades
        SET status='closed',
            exit_price = entry_price,
            pnl = ?,
            closed_at = NOW()
        WHERE id = ? AND status='open'
        `,
        [pnl, t.id]
      );

      // return stake (+ pnl) back to main_balance
      await conn.query(
        `
        UPDATE users
        SET main_balance = main_balance + ?,
            updated_at = NOW()
        WHERE id = ?
        `,
        [payoutBackToMain, userId]
      );
    }

    await conn.commit();

    return res.json({
      message: "Expired trades settled",
      settled: openTrades.length,
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return res.status(500).json({ message: "Server error", error: String(err) });
  } finally {
    conn.release();
  }
});


// ========================= USER: Invest In A Plan ========================= //
router.post("/investments", auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.user.id;

    const planId = Number(req.body.plan_id);
    let amount = req.body.amount !== undefined ? Number(req.body.amount) : null;

    if (!Number.isInteger(planId) || planId <= 0) {
      return res.status(400).json({ message: "Invalid plan_id" });
    }

    await conn.beginTransaction();

    // 1) Get plan (lock not required but okay)
    const [planRows] = await conn.query(
      `
      SELECT id, name, roi_percent, price, duration_days, is_active
      FROM investment_plans
      WHERE id = ?
      LIMIT 1
      `,
      [planId]
    );

    if (!planRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: "Plan not found" });
    }

    const plan = planRows[0];

    if (Number(plan.is_active) !== 1) {
      await conn.rollback();
      return res.status(400).json({ message: "This plan is not active" });
    }

    const minPrice = Number(plan.price) || 0;

    // default: invest exactly plan price
    if (amount === null) amount = minPrice;

    if (!amount || Number.isNaN(amount) || amount <= 0) {
      await conn.rollback();
      return res.status(400).json({ message: "Invalid investment amount" });
    }

    if (amount < minPrice) {
      await conn.rollback();
      return res.status(400).json({
        message: "Amount is below plan price",
        plan_price: minPrice,
        your_amount: amount
      });
    }

    // 2) Lock user balance
    const [uRows] = await conn.query(
      `
      SELECT id, main_balance, investment_balance
      FROM users
      WHERE id = ?
      FOR UPDATE
      `,
      [userId]
    );

    if (!uRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: "User not found" });
    }

    const user = uRows[0];
    const mainBal = Number(user.main_balance) || 0;

    if (mainBal < amount) {
      await conn.rollback();
      return res.status(400).json({
        message: "Insufficient main balance",
        main_balance: mainBal,
        required: amount
      });
    }

    // 3) Deduct from main balance (+ optionally add to investment_balance)
    await conn.query(
      `
      UPDATE users
      SET main_balance = main_balance - ?,
          investment_balance = investment_balance + ?,
          updated_at = NOW()
      WHERE id = ?
      `,
      [amount, amount, userId]
    );

    // 4) Create investment record (snapshot ROI + duration)
    const roi = Number(plan.roi_percent) || 0;
    const expected_profit = Number(((amount * roi) / 100).toFixed(2));
    const expected_total = Number((amount + expected_profit).toFixed(2));
    const duration_days = Number(plan.duration_days) || 1;

    const [ins] = await conn.query(
      `
      INSERT INTO user_investments (
        user_id, plan_id,
        amount, roi_percent,
        expected_profit, expected_total,
        duration_days, status,
        started_at, ends_at,
        created_at, updated_at
      ) VALUES (
        ?, ?,
        ?, ?,
        ?, ?,
        ?, 'active',
        NOW(), DATE_ADD(NOW(), INTERVAL ? DAY),
        NOW(), NOW()
      )
      `,
      [userId, planId, amount, roi, expected_profit, expected_total, duration_days, duration_days]
    );

    const investmentId = ins.insertId;

    await conn.commit();

    return res.json({
      message: "Investment started",
      investment: {
        id: investmentId,
        user_id: userId,
        plan_id: planId,
        plan_name: plan.name,
        amount,
        roi_percent: roi,
        expected_profit,
        expected_total,
        duration_days,
        status: "active"
      }
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return res.status(500).json({ message: "Server error", error: String(err) });
  } finally {
    conn.release();
  }
});
// ========================= USER: Get My Investments ========================= //
router.get("/investments", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT
        ui.id, ui.plan_id,
        p.name AS plan_name,
        ui.amount, ui.roi_percent,
        ui.expected_profit, ui.expected_total,
        ui.actual_profit_loss, ui.final_total,
        ui.admin_note,
        ui.duration_days, ui.status,
        ui.started_at, ui.ends_at, ui.completed_at,
        ui.created_at, ui.updated_at
      FROM user_investments ui
      JOIN investment_plans p ON p.id = ui.plan_id
      WHERE ui.user_id = ?
      ORDER BY ui.created_at DESC
      `,
      [userId]
    );

    return res.json({ count: rows.length, investments: rows });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ========================= USER: Get Investment By ID ========================= //
router.get("/investments/:id", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const investmentId = Number(req.params.id);

    if (!Number.isInteger(investmentId) || investmentId <= 0) {
      return res.status(400).json({ message: "Invalid investment id" });
    }

    const [rows] = await pool.query(
      `
      SELECT
        ui.id, ui.user_id, ui.plan_id,
        p.name AS plan_name,
        ui.amount, ui.roi_percent,
        ui.expected_profit, ui.expected_total,
        ui.actual_profit_loss, ui.final_total,
        ui.admin_note,
        ui.duration_days, ui.status,
        ui.started_at, ui.ends_at, ui.completed_at,
        ui.created_at, ui.updated_at
      FROM user_investments ui
      JOIN investment_plans p ON p.id = ui.plan_id
      WHERE ui.id = ? AND ui.user_id = ?
      LIMIT 1
      `,
      [investmentId, userId]
    );

    if (!rows.length) return res.status(404).json({ message: "Investment not found" });

    return res.json({ investment: rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});

// ========================= USER: Get All Investment Plans ========================= //
router.get("/plans", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        id,
        name,
        roi_percent,
        accuracy_percent,
        price,
        duration_days
      FROM investment_plans
      WHERE is_active = 1
      ORDER BY created_at DESC
      `
    );

    return res.json({
      count: rows.length,
      plans: rows
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: String(err)
    });
  }
});
// ========================= USER: Get Investment Plan By ID ========================= //
router.get("/plans/:id", auth, async (req, res) => {
  try {
    const planId = Number(req.params.id);

    if (!Number.isInteger(planId) || planId <= 0) {
      return res.status(400).json({ message: "Invalid plan id" });
    }

    const [rows] = await pool.query(
      `
      SELECT
        id,
        name,
        roi_percent,
        accuracy_percent,
        price,
        duration_days
      FROM investment_plans
      WHERE id = ? AND is_active = 1
      LIMIT 1
      `,
      [planId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Plan not found or inactive" });
    }

    return res.json({
      plan: rows[0]
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: String(err)
    });
  }
});


// ========================= USER: Submit / Re-submit KYC ========================= //
router.post("/kyc/submit",auth,
  kycUpload.fields([
    { name: "selfie", maxCount: 1 },
    { name: "id_front", maxCount: 1 },
    { name: "id_back", maxCount: 1 },
  ]),
  async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const userId = req.user.id;

      const selfie = req.files?.selfie?.[0];
      const idFront = req.files?.id_front?.[0];
      const idBack = req.files?.id_back?.[0];

      if (!selfie || !idFront || !idBack) {
        return res.status(400).json({
          message: "selfie, id_front, and id_back files are required",
        });
      }

      await conn.beginTransaction();

      // if user already has KYC, update it + set pending again
      const [existing] = await conn.query(
        `SELECT id FROM user_kyc WHERE user_id = ? LIMIT 1`,
        [userId]
      );

      if (existing.length) {
        await conn.query(
          `
          UPDATE user_kyc
          SET selfie_filename = ?,
              id_front_filename = ?,
              id_back_filename = ?,
              status = 'pending',
              admin_note = NULL,
              approved_by = NULL,
              approved_at = NULL,
              declined_by = NULL,
              declined_at = NULL,
              updated_at = NOW()
          WHERE user_id = ?
          `,
          [selfie.filename, idFront.filename, idBack.filename, userId]
        );
      } else {
        await conn.query(
          `
          INSERT INTO user_kyc (
            user_id, selfie_filename, id_front_filename, id_back_filename,
            status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'pending', NOW(), NOW())
          `,
          [userId, selfie.filename, idFront.filename, idBack.filename]
        );
      }

      await conn.commit();

      return res.json({
        message: "KYC submitted successfully (pending review)",
        status: "pending",
      });
    } catch (err) {
      try { await conn.rollback(); } catch (_) {}
      return res.status(500).json({ message: "Server error", error: String(err) });
    } finally {
      conn.release();
    }
  }
);
// ========================= USER: Get My KYC ========================= //
router.get("/kyc", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT
        id, user_id,
        selfie_filename, id_front_filename, id_back_filename,
        status, admin_note,
        approved_by, approved_at, declined_by, declined_at,
        created_at, updated_at
      FROM user_kyc
      WHERE user_id = ?
      LIMIT 1
      `,
      [userId]
    );

    if (!rows.length) {
      return res.json({ kyc: null });
    }

    const d = rows[0];
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const selfie_path = `/uploads/kyc/${d.selfie_filename}`;
    const id_front_path = `/uploads/kyc/${d.id_front_filename}`;
    const id_back_path = `/uploads/kyc/${d.id_back_filename}`;

    return res.json({
      kyc: {
        ...d,
        selfie_url: `${baseUrl}${selfie_path}`,
        id_front_url: `${baseUrl}${id_front_path}`,
        id_back_url: `${baseUrl}${id_back_path}`,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});


// ========================= USER: Copy a Trader (ENUM flow) ========================= //
router.post("/copy-traders/:id/copy", auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.user.id;
    const traderId = Number(req.params.id);

    if (!Number.isInteger(traderId) || traderId <= 0) {
      return res.status(400).json({ message: "Invalid trader id" });
    }

    await conn.beginTransaction();

    // 1️⃣ Check trader
    const [tRows] = await conn.query(
      `
      SELECT id, trader_name, is_active
      FROM copy_traders
      WHERE id = ?
      LIMIT 1
      `,
      [traderId]
    );

    if (!tRows.length || Number(tRows[0].is_active) !== 1) {
      await conn.rollback();
      return res.status(404).json({ message: "Trader not found or inactive" });
    }

    // 2️⃣ Lock user
    const [uRows] = await conn.query(
      `
      SELECT id, copied_trader_id, copy_trading_status
      FROM users
      WHERE id = ?
      FOR UPDATE
      `,
      [userId]
    );

    if (!uRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: "User not found" });
    }

    const user = uRows[0];

    // already copying this trader
    if (user.copy_trading_status === "active" && user.copied_trader_id === traderId) {
      await conn.rollback();
      return res.status(400).json({ message: "Already copying this trader" });
    }

    // copying another trader → block
    if (user.copy_trading_status === "active" && user.copied_trader_id) {
      await conn.rollback();
      return res.status(400).json({
        message: "You can only copy one trader at a time. Stop current copy first.",
        current_trader_id: user.copied_trader_id
      });
    }

    // 3️⃣ Activate copy trading
    await conn.query(
      `
      UPDATE users
      SET copied_trader_id = ?,
          copy_trading_status = 'active',
          updated_at = NOW()
      WHERE id = ?
      `,
      [traderId, userId]
    );

    await conn.commit();

    return res.json({
      message: "Copy trading activated",
      copy_trading_status: "active",
      copied_trader_id: traderId,
      trader_name: tRows[0].trader_name
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return res.status(500).json({ message: "Server error", error: String(err) });
  } finally {
    conn.release();
  }
});
// ========================= USER: Stop Copy Trading ========================= //
router.post("/copy-traders/stop", auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.user.id;

    await conn.beginTransaction();

    const [uRows] = await conn.query(
      `
      SELECT id, copy_trading_status
      FROM users
      WHERE id = ?
      FOR UPDATE
      `,
      [userId]
    );

    if (!uRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: "User not found" });
    }

    if (uRows[0].copy_trading_status === "lock") {
      await conn.rollback();
      return res.status(400).json({ message: "Copy trading already locked" });
    }

    await conn.query(
      `
      UPDATE users
      SET copied_trader_id = NULL,
          copy_trading_status = 'lock',
          updated_at = NOW()
      WHERE id = ?
      `,
      [userId]
    );

    await conn.commit();

    return res.json({
      message: "Copy trading stopped",
      copy_trading_status: "lock"
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return res.status(500).json({ message: "Server error", error: String(err) });
  } finally {
    conn.release();
  }
});
// ========================= USER: Get Copy Trading Status ========================= //
router.get("/copy-traders/status", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT
        u.copy_trading_status,
        u.copied_trader_id,
        t.trader_name,
        t.win_rate_percent,
        t.profit_percent,
        t.image_filename
      FROM users u
      LEFT JOIN copy_traders t ON t.id = u.copied_trader_id
      WHERE u.id = ?
      LIMIT 1
      `,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const r = rows[0];
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    return res.json({
      copy_trading_status: r.copy_trading_status, // active | lock
      copied_trader_id: r.copied_trader_id,
      trader: r.copy_trading_status === "active" && r.copied_trader_id
        ? {
            id: r.copied_trader_id,
            trader_name: r.trader_name,
            win_rate_percent: r.win_rate_percent,
            profit_percent: r.profit_percent,
            image_url: r.image_filename
              ? `${baseUrl}/uploads/traders/${r.image_filename}`
              : null
          }
        : null
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ========================= USER: Get Copy Traders ========================= //
router.get("/copy-traders", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        id,
        trader_name,
        win_rate_percent,
        profit_percent,
        image_filename
      FROM copy_traders
      WHERE is_active = 1
      ORDER BY created_at DESC
      `
    );

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const traders = rows.map((t) => ({
      id: t.id,
      trader_name: t.trader_name,
      win_rate_percent: t.win_rate_percent,
      profit_percent: t.profit_percent,
      image_url: t.image_filename
        ? `${baseUrl}/uploads/traders/${t.image_filename}`
        : null
    }));

    return res.json({
      count: traders.length,
      traders
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: String(err)
    });
  }
});
// ========================= USER: Get Copy Trader By ID ========================= //
router.get("/copy-traders/:id", auth, async (req, res) => {
  try {
    const traderId = Number(req.params.id);

    if (!Number.isInteger(traderId) || traderId <= 0) {
      return res.status(400).json({ message: "Invalid trader id" });
    }

    const [rows] = await pool.query(
      `
      SELECT
        id,
        trader_name,
        win_rate_percent,
        profit_percent,
        image_filename
      FROM copy_traders
      WHERE id = ? AND is_active = 1
      LIMIT 1
      `,
      [traderId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Trader not found or inactive" });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const t = rows[0];

    return res.json({
      trader: {
        id: t.id,
        trader_name: t.trader_name,
        win_rate_percent: t.win_rate_percent,
        profit_percent: t.profit_percent,
        image_url: t.image_filename
          ? `${baseUrl}/uploads/traders/${t.image_filename}`
          : null
      }
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: String(err)
    });
  }
});

// ========================= USER: Get Notifications ========================= //
router.get("/notify/notification", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 200);
    const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

    const [rows] = await pool.query(
      `
      SELECT
        id,
        type,
        title,
        message,
        created_at
      FROM notifications
      WHERE type = 'notification'
        AND (user_id IS NULL OR user_id = ?)
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
      `,
      [userId, limit, offset]
    );

    return res.json({
      count: rows.length,
      notifications: rows
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: String(err)
    });
  }
});
// ========================= USER: Get Active Popups ========================= //
router.get("/notify/popup", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT
        id,
        type,
        title,
        message,
        expires_at,
        created_at
      FROM notifications
      WHERE type = 'popup'
        AND (user_id IS NULL OR user_id = ?)
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC
      `,
      [userId]
    );

    return res.json({
      count: rows.length,
      popups: rows
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: String(err)
    });
  }
});



// ========================= USER: Request Account Upgrade ========================= //
router.post("/account-upgrades", auth, upsUpload.single("proof"), async (req, res) => {
  try {
    const userId = req.user.id;

    const requested_account_type = String(req.body.requested_account_type || "").trim();
    const note = req.body?.note ? String(req.body.note).trim() : null;

    if (!requested_account_type) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: "requested_account_type is required" });
    }

    // ✅ get user current account_type
    const [uRows] = await pool.query(
      `SELECT id, account_type FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (!uRows.length) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ message: "User not found" });
    }

    const current_account_type = String(uRows[0].account_type || "").trim();

    if (current_account_type === requested_account_type) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: "You already have this account type" });
    }

    // OPTIONAL: block if already has pending request
    const [pRows] = await pool.query(
      `
      SELECT id
      FROM account_upgrades
      WHERE user_id = ? AND status = 'pending'
      LIMIT 1
      `,
      [userId]
    );

    if (pRows.length) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: "You already have a pending upgrade request" });
    }

    const proof_filename = req.file ? req.file.filename : null;

    const [r] = await pool.query(
      `
      INSERT INTO account_upgrades
        (user_id, requested_account_type, current_account_type, note, proof_filename, status, created_at, updated_at)
      VALUES
        (?, ?, ?, ?, ?, 'pending', NOW(), NOW())
      `,
      [userId, requested_account_type, current_account_type, note, proof_filename]
    );

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const proof_path = proof_filename ? `/uploads/upgrades/${proof_filename}` : null;

    return res.json({
      message: "Upgrade request submitted and pending approval",
      upgrade: {
        id: r.insertId,
        requested_account_type,
        current_account_type,
        note,
        status: "pending",
        proof_path,
        proof_url: proof_path ? `${baseUrl}${proof_path}` : null
      }
    });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});
// ========================= USER: Get My Upgrade Requests ========================= //
router.get("/account-upgrades", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT
        id,
        requested_account_type,
        current_account_type,
        note,
        proof_filename,
        status,
        admin_note,
        approved_at,
        declined_at,
        created_at,
        updated_at
      FROM account_upgrades
      WHERE user_id = ?
      ORDER BY created_at DESC
      `,
      [userId]
    );

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const upgrades = rows.map((u) => {
      const proof_path = u.proof_filename ? `/uploads/upgrades/${u.proof_filename}` : null;
      return {
        ...u,
        proof_path,
        proof_url: proof_path ? `${baseUrl}${proof_path}` : null
      };
    });

    return res.json({ count: upgrades.length, upgrades });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
});


module.exports = router;
