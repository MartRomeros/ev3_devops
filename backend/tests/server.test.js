const request = require("supertest");

const mockPool = { query: jest.fn() };

jest.mock("mysql2/promise", () => ({
  createPool: jest.fn(() => mockPool),
}));

const { app, initDb } = require("../server");

beforeAll(async () => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  await initDb();
});

afterAll(() => {
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.clearAllMocks();
});

const sample = {
  id: 1,
  nombre: "Alimento Test",
  descripcion: "Desc test",
  precio: 10000,
  stock: 5,
};

// ─── Health ───────────────────────────────────────────────────────────────────

describe("GET /api/health", () => {
  it("responde 200 con status ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

// ─── GET /api/productos ───────────────────────────────────────────────────────

describe("GET /api/productos", () => {
  it("retorna lista de productos", async () => {
    mockPool.query.mockResolvedValueOnce([[sample]]);
    const res = await request(app).get("/api/productos");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([sample]);
  });

  it("retorna array vacío si no hay productos", async () => {
    mockPool.query.mockResolvedValueOnce([[]]);
    const res = await request(app).get("/api/productos");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("retorna 500 si falla la base de datos", async () => {
    mockPool.query.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).get("/api/productos");
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("message");
  });
});

// ─── GET /api/productos/:id ───────────────────────────────────────────────────

describe("GET /api/productos/:id", () => {
  it("retorna el producto si existe", async () => {
    mockPool.query.mockResolvedValueOnce([[sample]]);
    const res = await request(app).get("/api/productos/1");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(sample);
  });

  it("retorna 404 si el producto no existe", async () => {
    mockPool.query.mockResolvedValueOnce([[]]);
    const res = await request(app).get("/api/productos/999");
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/no encontrado/i);
  });

  it("retorna 500 si falla la base de datos", async () => {
    mockPool.query.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).get("/api/productos/1");
    expect(res.status).toBe(500);
  });
});

// ─── POST /api/productos ──────────────────────────────────────────────────────

describe("POST /api/productos", () => {
  it("crea un producto y retorna 201", async () => {
    mockPool.query
      .mockResolvedValueOnce([{ insertId: 2 }])
      .mockResolvedValueOnce([[{ ...sample, id: 2 }]]);
    const res = await request(app)
      .post("/api/productos")
      .send({ nombre: "Nuevo", precio: 5000, stock: 3 });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(2);
  });

  it("acepta descripcion opcional como null", async () => {
    mockPool.query
      .mockResolvedValueOnce([{ insertId: 3 }])
      .mockResolvedValueOnce([[{ ...sample, id: 3, descripcion: null }]]);
    const res = await request(app)
      .post("/api/productos")
      .send({ nombre: "Sin desc", precio: 1000, stock: 1 });
    expect(res.status).toBe(201);
  });

  it("retorna 400 si falta nombre", async () => {
    const res = await request(app)
      .post("/api/productos")
      .send({ precio: 5000, stock: 3 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/obligatorio/i);
  });

  it("retorna 400 si falta precio", async () => {
    const res = await request(app)
      .post("/api/productos")
      .send({ nombre: "Test", stock: 3 });
    expect(res.status).toBe(400);
  });

  it("retorna 400 si falta stock", async () => {
    const res = await request(app)
      .post("/api/productos")
      .send({ nombre: "Test", precio: 5000 });
    expect(res.status).toBe(400);
  });

  it("retorna 500 si falla la base de datos", async () => {
    mockPool.query.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app)
      .post("/api/productos")
      .send({ nombre: "Test", precio: 5000, stock: 3 });
    expect(res.status).toBe(500);
  });
});

// ─── PUT /api/productos/:id ───────────────────────────────────────────────────

describe("PUT /api/productos/:id", () => {
  it("actualiza el producto y lo retorna", async () => {
    const actualizado = { ...sample, nombre: "Actualizado" };
    mockPool.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[actualizado]]);
    const res = await request(app)
      .put("/api/productos/1")
      .send({ nombre: "Actualizado", precio: 12000, stock: 8 });
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe("Actualizado");
  });

  it("retorna 404 si el producto no existe", async () => {
    mockPool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const res = await request(app)
      .put("/api/productos/999")
      .send({ nombre: "X", precio: 1000, stock: 1 });
    expect(res.status).toBe(404);
  });

  it("retorna 400 si falta nombre", async () => {
    const res = await request(app)
      .put("/api/productos/1")
      .send({ precio: 12000, stock: 8 });
    expect(res.status).toBe(400);
  });

  it("retorna 400 si falta precio", async () => {
    const res = await request(app)
      .put("/api/productos/1")
      .send({ nombre: "Test", stock: 8 });
    expect(res.status).toBe(400);
  });

  it("retorna 500 si falla la base de datos", async () => {
    mockPool.query.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app)
      .put("/api/productos/1")
      .send({ nombre: "Test", precio: 5000, stock: 3 });
    expect(res.status).toBe(500);
  });
});

// ─── DELETE /api/productos/:id ────────────────────────────────────────────────

describe("DELETE /api/productos/:id", () => {
  it("elimina el producto y confirma", async () => {
    mockPool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await request(app).delete("/api/productos/1");
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/eliminado/i);
  });

  it("retorna 404 si el producto no existe", async () => {
    mockPool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const res = await request(app).delete("/api/productos/999");
    expect(res.status).toBe(404);
  });

  it("retorna 500 si falla la base de datos", async () => {
    mockPool.query.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).delete("/api/productos/1");
    expect(res.status).toBe(500);
  });
});
