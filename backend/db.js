require("dotenv").config();

const { connectProject } = require("./diamond-sql");

const gateway = connectProject(process.env.SITE_ID, {
  apiKey: process.env.API_KEY,
  dbmsUrl: process.env.DBMS_URL,
  timeoutMs: process.env.DBMS_TIMEOUT_MS || 15000,
});

function mysql2Tuple(result) {
  return [result, []];
}

const db = {
  async query(sql, params = []) {
    return mysql2Tuple(await gateway.query(sql, params));
  },

  async execute(sql, params = []) {
    return mysql2Tuple(await gateway.execute(sql, params));
  },

  status() {
    return gateway.status();
  },

  async getConnection() {
    const connection = await gateway.getConnection();

    return {
      async query(sql, params = []) {
        return mysql2Tuple(await connection.query(sql, params));
      },
      async execute(sql, params = []) {
        return mysql2Tuple(await connection.execute(sql, params));
      },
      beginTransaction: connection.beginTransaction,
      commit: connection.commit,
      rollback: connection.rollback,
      release: connection.release,
    };
  },
};

module.exports = db;
