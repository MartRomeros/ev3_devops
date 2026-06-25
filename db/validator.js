const fs = require("fs");
const path = require("path");

function readSql() {
  return fs.readFileSync(path.join(__dirname, "init.sql"), "utf8");
}

function hasDatabase(sql, dbName) {
  return new RegExp(`CREATE DATABASE IF NOT EXISTS ${dbName}`, "i").test(sql);
}

function hasTable(sql, tableName) {
  return new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName}`, "i").test(sql);
}

function extractTableColumns(sql, tableName) {
  const match = sql.match(
    new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName}\\s*\\(([\\s\\S]*?)\\);`, "i")
  );
  return match ? match[1] : null;
}

function countSeedRows(sql, tableName) {
  const match = sql.match(
    new RegExp(`INSERT INTO ${tableName}[\\s\\S]*?;`, "i")
  );
  if (!match) return 0;
  // Cada fila de valores comienza con '(' al inicio de línea
  return (match[0].match(/^\s*\(/gm) || []).length;
}

module.exports = { readSql, hasDatabase, hasTable, extractTableColumns, countSeedRows };
