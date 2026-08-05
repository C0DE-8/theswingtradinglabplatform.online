require("dotenv").config();

const db = require("../db");

const TABLE_RE = /^[A-Za-z0-9_]+$/;

function ident(name) {
  if (!TABLE_RE.test(name)) throw new Error(`Unsafe identifier: ${name}`);
  return `\`${name}\``;
}

function literal(value) {
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

async function query(sql, params = []) {
  const [rows] = await db.query(sql, params);
  return rows;
}

async function run(sql, params = []) {
  await db.query(sql, params);
}

async function tableExists(table) {
  const rows = await query(`SHOW TABLES LIKE ${literal(table)}`);
  return rows.length > 0;
}

async function columnExists(table, column) {
  const rows = await query(`SHOW COLUMNS FROM ${ident(table)} LIKE ${literal(column)}`);
  return rows.length > 0;
}

async function addColumn(table, column, definition) {
  if (await columnExists(table, column)) {
    console.log(`ok column ${table}.${column}`);
    return;
  }
  await run(`ALTER TABLE ${ident(table)} ADD COLUMN ${ident(column)} ${definition}`);
  console.log(`added column ${table}.${column}`);
}

async function createTable(name, sql) {
  await run(sql);
  console.log(`ok table ${name}`);
}

async function maybe(sql, label) {
  try {
    await run(sql);
    console.log(`ok ${label}`);
  } catch (error) {
    console.log(`skip ${label}: ${error.message}`);
  }
}

async function migrateUsers() {
  if (!(await tableExists("users"))) {
    await createTable("users", `
      CREATE TABLE IF NOT EXISTS users (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        full_name VARCHAR(150) NOT NULL,
        username VARCHAR(80) NOT NULL,
        address VARCHAR(255) NULL,
        city VARCHAR(120) NULL,
        zipcode VARCHAR(40) NULL,
        country VARCHAR(80) NULL,
        phone VARCHAR(60) NULL,
        email VARCHAR(191) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(30) NOT NULL DEFAULT 'user',
        is_verified TINYINT(1) NOT NULL DEFAULT 0,
        main_balance DECIMAL(24,2) NOT NULL DEFAULT 0.00,
        profit_balance DECIMAL(24,2) NOT NULL DEFAULT 0.00,
        investment_balance DECIMAL(24,2) NOT NULL DEFAULT 0.00,
        withdraw_hold DECIMAL(24,2) NOT NULL DEFAULT 0.00,
        pin_hash VARCHAR(255) NULL,
        account_type VARCHAR(50) NOT NULL DEFAULT 'individual',
        trade_progress DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        signal_strength DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        account_status VARCHAR(30) NOT NULL DEFAULT 'active',
        copy_trading_status VARCHAR(30) NOT NULL DEFAULT 'inactive',
        trading_status VARCHAR(30) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY users_email_unique (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    return;
  }

  await addColumn("users", "full_name", "VARCHAR(150) NULL");
  await addColumn("users", "password_hash", "VARCHAR(255) NULL");
  await addColumn("users", "role", "VARCHAR(30) NOT NULL DEFAULT 'user'");
  await addColumn("users", "city", "VARCHAR(120) NULL");
  await addColumn("users", "zipcode", "VARCHAR(40) NULL");
  await addColumn("users", "country", "VARCHAR(80) NULL");
  await addColumn("users", "phone", "VARCHAR(60) NULL");
  await addColumn("users", "main_balance", "DECIMAL(24,2) NOT NULL DEFAULT 0.00");
  await addColumn("users", "profit_balance", "DECIMAL(24,2) NOT NULL DEFAULT 0.00");
  await addColumn("users", "investment_balance", "DECIMAL(24,2) NOT NULL DEFAULT 0.00");
  await addColumn("users", "withdraw_hold", "DECIMAL(24,2) NOT NULL DEFAULT 0.00");
  await addColumn("users", "pin_hash", "VARCHAR(255) NULL");
  await addColumn("users", "trade_progress", "DECIMAL(5,2) NOT NULL DEFAULT 0.00");
  await addColumn("users", "account_status", "VARCHAR(30) NOT NULL DEFAULT 'active'");
  await addColumn("users", "copy_trading_status", "VARCHAR(30) NOT NULL DEFAULT 'inactive'");
  await addColumn("users", "trading_status", "VARCHAR(30) NOT NULL DEFAULT 'active'");

  if (await columnExists("users", "name")) {
    await run("UPDATE users SET full_name = COALESCE(NULLIF(full_name, ''), name)");
  }
  if (await columnExists("users", "password")) {
    await run("UPDATE users SET password_hash = COALESCE(NULLIF(password_hash, ''), password)");
  }
  if (await columnExists("users", "isAdmin")) {
    await run("UPDATE users SET role = CASE WHEN isAdmin = 1 THEN 'admin' ELSE COALESCE(NULLIF(role, ''), 'user') END");
  }
  if (await columnExists("users", "phone_number")) {
    await run("UPDATE users SET phone = COALESCE(NULLIF(phone, ''), phone_number)");
  }
  if (await columnExists("users", "nationality")) {
    await run("UPDATE users SET country = COALESCE(NULLIF(country, ''), nationality)");
  }
  if (await columnExists("users", "trading_balance")) {
    await run("UPDATE users SET main_balance = IF(main_balance = 0, trading_balance, main_balance)");
  }
  if (await columnExists("users", "holding_balance")) {
    await run("UPDATE users SET profit_balance = IF(profit_balance = 0, holding_balance, profit_balance)");
  }
  if (await columnExists("users", "staking_balance")) {
    await run("UPDATE users SET investment_balance = IF(investment_balance = 0, staking_balance, investment_balance)");
  }

  await maybe("ALTER TABLE users ADD UNIQUE KEY users_email_unique (email)", "users email unique index");
}

async function migrate() {
  await migrateUsers();

  await createTable("admins", `
    CREATE TABLE IF NOT EXISTS admins (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(191) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY admins_email_unique (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await run(`
    INSERT INTO admins (name, email, password_hash, created_at, updated_at)
    SELECT full_name, email, password_hash, COALESCE(created_at, NOW()), NOW()
    FROM users
    WHERE role = 'admin' AND email IS NOT NULL AND email != ''
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      password_hash = VALUES(password_hash),
      updated_at = NOW()
  `);
  console.log("ok admins backfill");

  await createTable("email_otps", `
    CREATE TABLE IF NOT EXISTS email_otps (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NULL,
      email VARCHAR(191) NOT NULL,
      otp VARCHAR(10) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY email_otps_email_idx (email),
      KEY email_otps_user_idx (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await createTable("user_crypto_balances", `
    CREATE TABLE IF NOT EXISTS user_crypto_balances (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      asset VARCHAR(16) NOT NULL,
      balance DECIMAL(28,8) NOT NULL DEFAULT 0.00000000,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY user_asset_unique (user_id, asset)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await createTable("wallet_addresses", `
    CREATE TABLE IF NOT EXISTS wallet_addresses (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      asset VARCHAR(16) NOT NULL,
      address VARCHAR(255) NOT NULL,
      qr_filename VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY wallet_asset_unique (asset)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await createTable("deposits", `
    CREATE TABLE IF NOT EXISTS deposits (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      asset VARCHAR(16) NOT NULL,
      amount DECIMAL(24,2) NOT NULL DEFAULT 0.00,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      admin_note TEXT NULL,
      proof_filename VARCHAR(255) NULL,
      approved_by INT UNSIGNED NULL,
      approved_at DATETIME NULL,
      declined_by INT UNSIGNED NULL,
      declined_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY deposits_user_idx (user_id),
      KEY deposits_status_idx (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await createTable("withdrawals", `
    CREATE TABLE IF NOT EXISTS withdrawals (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      amount DECIMAL(24,2) NOT NULL DEFAULT 0.00,
      method VARCHAR(20) NOT NULL,
      asset VARCHAR(16) NULL,
      crypto_address VARCHAR(255) NULL,
      crypto_network VARCHAR(80) NULL,
      bank_name VARCHAR(150) NULL,
      bank_account_number VARCHAR(80) NULL,
      bank_account_name VARCHAR(150) NULL,
      bank_country VARCHAR(80) NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      admin_note TEXT NULL,
      approved_by INT UNSIGNED NULL,
      approved_at DATETIME NULL,
      declined_by INT UNSIGNED NULL,
      declined_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY withdrawals_user_idx (user_id),
      KEY withdrawals_status_idx (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await createTable("trades", `
    CREATE TABLE IF NOT EXISTS trades (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      symbol VARCHAR(40) NOT NULL,
      side VARCHAR(10) NOT NULL,
      amount DECIMAL(24,2) NOT NULL DEFAULT 0.00,
      duration_seconds INT NOT NULL DEFAULT 60,
      entry_price DECIMAL(28,8) NOT NULL DEFAULT 0.00000000,
      exit_price DECIMAL(28,8) NULL,
      pnl DECIMAL(24,2) NOT NULL DEFAULT 0.00,
      duration VARCHAR(20) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'open',
      pnl_amount DECIMAL(24,2) NOT NULL DEFAULT 0.00,
      opened_at DATETIME NULL,
      expires_at DATETIME NULL,
      closes_at DATETIME NULL,
      closed_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY trades_user_idx (user_id),
      KEY trades_status_idx (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await addColumn("trades", "symbol", "VARCHAR(40) NOT NULL DEFAULT ''");
  await addColumn("trades", "side", "VARCHAR(10) NOT NULL DEFAULT 'buy'");
  await addColumn("trades", "amount", "DECIMAL(24,2) NOT NULL DEFAULT 0.00");
  await addColumn("trades", "duration_seconds", "INT NOT NULL DEFAULT 60");
  await addColumn("trades", "entry_price", "DECIMAL(28,8) NULL");
  await addColumn("trades", "exit_price", "DECIMAL(28,8) NULL");
  await addColumn("trades", "pnl", "DECIMAL(24,2) NOT NULL DEFAULT 0.00");
  await addColumn("trades", "status", "VARCHAR(30) NOT NULL DEFAULT 'open'");
  await addColumn("trades", "opened_at", "DATETIME NULL");
  await addColumn("trades", "expires_at", "DATETIME NULL");
  await addColumn("trades", "closed_at", "DATETIME NULL");

  await createTable("investment_plans", `
    CREATE TABLE IF NOT EXISTS investment_plans (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(150) NOT NULL,
      description TEXT NULL,
      roi_percent DECIMAL(8,2) NOT NULL DEFAULT 0.00,
      accuracy_percent DECIMAL(8,2) NOT NULL DEFAULT 0.00,
      price DECIMAL(24,2) NOT NULL DEFAULT 0.00,
      min_amount DECIMAL(24,2) NOT NULL DEFAULT 0.00,
      max_amount DECIMAL(24,2) NULL,
      duration_days INT NOT NULL DEFAULT 1,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await addColumn("investment_plans", "description", "TEXT NULL");
  await addColumn("investment_plans", "roi_percent", "DECIMAL(8,2) NOT NULL DEFAULT 0.00");
  await addColumn("investment_plans", "accuracy_percent", "DECIMAL(8,2) NOT NULL DEFAULT 0.00");
  await addColumn("investment_plans", "price", "DECIMAL(24,2) NOT NULL DEFAULT 0.00");
  await addColumn("investment_plans", "duration_days", "INT NOT NULL DEFAULT 1");
  await addColumn("investment_plans", "is_active", "TINYINT(1) NOT NULL DEFAULT 1");

  await createTable("user_investments", `
    CREATE TABLE IF NOT EXISTS user_investments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      plan_id INT UNSIGNED NOT NULL,
      amount DECIMAL(24,2) NOT NULL DEFAULT 0.00,
      roi_percent DECIMAL(8,2) NOT NULL DEFAULT 0.00,
      expected_profit DECIMAL(24,2) NOT NULL DEFAULT 0.00,
      expected_total DECIMAL(24,2) NOT NULL DEFAULT 0.00,
      duration_days INT NOT NULL DEFAULT 1,
      actual_profit_loss DECIMAL(24,2) NOT NULL DEFAULT 0.00,
      final_total DECIMAL(24,2) NOT NULL DEFAULT 0.00,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      started_at DATETIME NULL,
      ends_at DATETIME NULL,
      completed_at DATETIME NULL,
      admin_note TEXT NULL,
      settled_by INT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY user_investments_user_idx (user_id),
      KEY user_investments_plan_idx (plan_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await addColumn("user_investments", "roi_percent", "DECIMAL(8,2) NOT NULL DEFAULT 0.00");
  await addColumn("user_investments", "expected_profit", "DECIMAL(24,2) NOT NULL DEFAULT 0.00");
  await addColumn("user_investments", "expected_total", "DECIMAL(24,2) NOT NULL DEFAULT 0.00");
  await addColumn("user_investments", "duration_days", "INT NOT NULL DEFAULT 1");
  await addColumn("user_investments", "actual_profit_loss", "DECIMAL(24,2) NOT NULL DEFAULT 0.00");
  await addColumn("user_investments", "final_total", "DECIMAL(24,2) NOT NULL DEFAULT 0.00");
  await addColumn("user_investments", "admin_note", "TEXT NULL");
  await addColumn("user_investments", "settled_by", "INT UNSIGNED NULL");

  await createTable("user_kyc", `
    CREATE TABLE IF NOT EXISTS user_kyc (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      id_type VARCHAR(80) NULL,
      id_number VARCHAR(120) NULL,
      id_front_filename VARCHAR(255) NULL,
      id_back_filename VARCHAR(255) NULL,
      selfie_filename VARCHAR(255) NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      admin_note TEXT NULL,
      reviewed_by INT UNSIGNED NULL,
      reviewed_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY user_kyc_user_unique (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await createTable("copy_traders", `
    CREATE TABLE IF NOT EXISTS copy_traders (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      trader_name VARCHAR(150) NOT NULL,
      image_filename VARCHAR(255) NULL,
      specialty VARCHAR(150) NULL,
      win_rate_percent DECIMAL(8,2) NOT NULL DEFAULT 0.00,
      profit_percent DECIMAL(8,2) NOT NULL DEFAULT 0.00,
      followers INT NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await createTable("notifications", `
    CREATE TABLE IF NOT EXISTS notifications (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NULL,
      type VARCHAR(40) NOT NULL DEFAULT 'notice',
      title VARCHAR(180) NOT NULL,
      message TEXT NOT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      expires_at DATETIME NULL,
      created_by INT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY notifications_user_idx (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await createTable("email_logs", `
    CREATE TABLE IF NOT EXISTS email_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NULL,
      to_email VARCHAR(191) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      message TEXT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      error TEXT NULL,
      created_by INT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY email_logs_user_idx (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await createTable("account_upgrades", `
    CREATE TABLE IF NOT EXISTS account_upgrades (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      requested_account_type VARCHAR(80) NOT NULL,
      current_account_type VARCHAR(80) NULL,
      note TEXT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      proof_filename VARCHAR(255) NULL,
      admin_note TEXT NULL,
      approved_by INT UNSIGNED NULL,
      approved_at DATETIME NULL,
      declined_by INT UNSIGNED NULL,
      declined_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY account_upgrades_user_idx (user_id),
      KEY account_upgrades_status_idx (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await addColumn("account_upgrades", "requested_account_type", "VARCHAR(80) NOT NULL DEFAULT ''");
  await addColumn("account_upgrades", "current_account_type", "VARCHAR(80) NULL");
  await addColumn("account_upgrades", "note", "TEXT NULL");
  await addColumn("account_upgrades", "proof_filename", "VARCHAR(255) NULL");
  await addColumn("account_upgrades", "admin_note", "TEXT NULL");
  await addColumn("account_upgrades", "approved_by", "INT UNSIGNED NULL");
  await addColumn("account_upgrades", "approved_at", "DATETIME NULL");
  await addColumn("account_upgrades", "declined_by", "INT UNSIGNED NULL");
  await addColumn("account_upgrades", "declined_at", "DATETIME NULL");
  await addColumn("account_upgrades", "updated_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

  const plans = [
    ["Foundation Yield", 8.50, 82.00, 250.00, 7],
    ["Market Access", 14.00, 86.00, 500.00, 14],
    ["Growth Strategy", 22.50, 89.00, 1000.00, 21],
    ["Prime Momentum", 35.00, 92.00, 2500.00, 30],
    ["Executive Reserve", 55.00, 95.00, 5000.00, 45],
  ];

  for (const plan of plans) {
    await run(
      `
      INSERT INTO investment_plans
        (name, roi_percent, accuracy_percent, price, duration_days, is_active, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, 1, NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM investment_plans WHERE name = ?)
      `,
      [...plan, plan[0]]
    );
  }
  console.log("ok seeded investment plans");
}

migrate()
  .then(() => {
    console.log("migration complete");
  })
  .catch((error) => {
    console.error("migration failed:", error);
    process.exitCode = 1;
  });
