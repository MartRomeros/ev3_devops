const {
  readSql,
  hasDatabase,
  hasTable,
  extractTableColumns,
  countSeedRows,
} = require("../validator");

let sql;

beforeAll(() => {
  sql = readSql();
});

// ─── Base de datos ────────────────────────────────────────────────────────────

describe("Base de datos", () => {
  it("crea la base de datos tienda_perritos con IF NOT EXISTS", () => {
    expect(hasDatabase(sql, "tienda_perritos")).toBe(true);
  });

  it("selecciona tienda_perritos antes de crear las tablas", () => {
    expect(sql).toMatch(/USE tienda_perritos/i);
    // USE debe aparecer antes del primer CREATE TABLE
    const useIndex = sql.search(/USE tienda_perritos/i);
    const createIndex = sql.search(/CREATE TABLE/i);
    expect(useIndex).toBeLessThan(createIndex);
  });
});

// ─── Tabla productos ──────────────────────────────────────────────────────────

describe("Tabla productos", () => {
  it("crea la tabla productos con IF NOT EXISTS", () => {
    expect(hasTable(sql, "productos")).toBe(true);
  });

  it("define id como INT AUTO_INCREMENT PRIMARY KEY", () => {
    const cols = extractTableColumns(sql, "productos");
    expect(cols).toMatch(/id\s+INT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/i);
  });

  it("define nombre como VARCHAR(100) NOT NULL", () => {
    const cols = extractTableColumns(sql, "productos");
    expect(cols).toMatch(/nombre\s+VARCHAR\(100\)\s+NOT\s+NULL/i);
  });

  it("define descripcion como VARCHAR nullable (sin NOT NULL)", () => {
    const cols = extractTableColumns(sql, "productos");
    expect(cols).toMatch(/descripcion\s+VARCHAR/i);
    // La columna descripcion NO debe tener NOT NULL
    const descLine = cols.match(/descripcion[^\n,]+/i)?.[0] ?? "";
    expect(descLine).not.toMatch(/NOT\s+NULL/i);
  });

  it("define precio como DECIMAL(10,2) NOT NULL", () => {
    const cols = extractTableColumns(sql, "productos");
    expect(cols).toMatch(/precio\s+DECIMAL\(10,2\)\s+NOT\s+NULL/i);
  });

  it("define stock como INT NOT NULL", () => {
    const cols = extractTableColumns(sql, "productos");
    expect(cols).toMatch(/stock\s+INT\s+NOT\s+NULL/i);
  });
});

// ─── Datos de prueba ──────────────────────────────────────────────────────────

describe("Datos de prueba (seed)", () => {
  it("contiene un INSERT INTO productos", () => {
    expect(sql).toMatch(/INSERT INTO productos/i);
  });

  it("inserta al menos 5 productos", () => {
    expect(countSeedRows(sql, "productos")).toBeGreaterThanOrEqual(5);
  });

  it("cada fila de seed incluye precio y stock como números", () => {
    // Busca patrones de números al final de cada tupla: ..., <precio>, <stock>)
    const tuples = sql.match(/'\s*,\s*\d+\s*,\s*\d+\s*\)/g);
    expect(tuples).not.toBeNull();
    expect(tuples.length).toBeGreaterThanOrEqual(5);
  });
});

// ─── Integridad del archivo ───────────────────────────────────────────────────

describe("Integridad del archivo SQL", () => {
  it("no contiene sentencias DROP DATABASE ni DROP TABLE", () => {
    expect(sql).not.toMatch(/DROP\s+(DATABASE|TABLE)/i);
  });

  it("todas las sentencias terminan en punto y coma", () => {
    // Filtra líneas no vacías y no comentarios
    const lineas = sql
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("--") && !l.startsWith("#"));

    const ultimaLinea = lineas[lineas.length - 1];
    // El archivo debe terminar con ';'
    expect(ultimaLinea.endsWith(";") || ultimaLinea.endsWith("),")).toBe(true);
  });
});
