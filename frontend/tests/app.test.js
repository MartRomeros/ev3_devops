/**
 * @jest-environment jsdom
 *
 * app.js ejecuta código al cargarse (getElementById, addEventListener, cargarProductos).
 * Por eso el DOM y el mock de fetch se preparan ANTES de require('../app.js').
 * jest.resetModules() garantiza un módulo fresco por cada test.
 */

const HTML = `
  <table>
    <thead><tr><th>ID</th></tr></thead>
    <tbody id="tbodyProductos"></tbody>
  </table>
  <button id="btnCargar">Cargar</button>
  <button id="btnGuardar">Guardar</button>
  <button id="btnCancelar">Cancelar</button>
  <h2 id="formTitle">Nuevo producto</h2>
  <div id="status" class="status"></div>
  <input id="nombre" />
  <textarea id="descripcion"></textarea>
  <input id="precio" type="number" />
  <input id="stock" type="number" />
`;

const mockProductos = [
  { id: 1, nombre: "Alimento Cachorro", descripcion: "Para cachorros", precio: 19990, stock: 15 },
  { id: 2, nombre: "Alimento Adulto", descripcion: "Para adultos", precio: 17990, stock: 8 },
];

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function setupFetch(data, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: jest.fn().mockResolvedValue(data),
  });
}

beforeEach(async () => {
  document.body.innerHTML = HTML;
  setupFetch(mockProductos);
  global.confirm = jest.fn(() => true);
  jest.spyOn(console, "error").mockImplementation(() => {});

  jest.resetModules();
  require("../app.js");

  // Esperar a que cargarProductos() (llamado al cargar el módulo) resuelva
  await flushPromises();

  // Limpiar el contador de llamadas del fetch inicial para que los tests
  // midan solo sus propias interacciones
  jest.clearAllMocks();
  setupFetch(mockProductos); // restaurar implementación tras clearAllMocks
  global.confirm = jest.fn(() => true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Carga inicial ────────────────────────────────────────────────────────────

describe("Carga inicial", () => {
  it("renderiza filas en la tabla con los productos del servidor", () => {
    const rows = document.querySelectorAll("#tbodyProductos tr");
    expect(rows.length).toBe(mockProductos.length);
  });

  it("muestra el nombre del producto en cada fila", () => {
    const celdas = document.querySelectorAll("#tbodyProductos td:nth-child(2)");
    expect(celdas[0].textContent).toBe(mockProductos[0].nombre);
    expect(celdas[1].textContent).toBe(mockProductos[1].nombre);
  });

  it("muestra estado ok tras carga exitosa", () => {
    const status = document.getElementById("status");
    expect(status.textContent).toMatch(/cargados/i);
    expect(status.className).toContain("ok");
  });
});

// ─── Botón Cargar ─────────────────────────────────────────────────────────────

describe("Botón Cargar", () => {
  it("vuelve a llamar fetch al hacer click", async () => {
    document.getElementById("btnCargar").click();
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("muestra error en el estado si el servidor falla", async () => {
    setupFetch([], false);
    document.getElementById("btnCargar").click();
    await flushPromises();
    expect(document.getElementById("status").className).toContain("error");
  });
});

// ─── Validación del formulario ────────────────────────────────────────────────

describe("Validación del formulario", () => {
  it("muestra error si el nombre está vacío", async () => {
    document.getElementById("precio").value = "1000";
    document.getElementById("stock").value = "5";
    document.getElementById("btnGuardar").click();
    await flushPromises();
    const status = document.getElementById("status");
    expect(status.className).toContain("error");
    expect(status.textContent).toMatch(/nombre/i);
  });

  it("muestra error si el precio es NaN", async () => {
    document.getElementById("nombre").value = "Test";
    document.getElementById("precio").value = "";
    document.getElementById("stock").value = "5";
    document.getElementById("btnGuardar").click();
    await flushPromises();
    expect(document.getElementById("status").className).toContain("error");
    expect(document.getElementById("status").textContent).toMatch(/precio/i);
  });

  it("muestra error si el precio es negativo", async () => {
    document.getElementById("nombre").value = "Test";
    document.getElementById("precio").value = "-1";
    document.getElementById("stock").value = "5";
    document.getElementById("btnGuardar").click();
    await flushPromises();
    expect(document.getElementById("status").className).toContain("error");
  });

  it("muestra error si el stock es negativo", async () => {
    document.getElementById("nombre").value = "Test";
    document.getElementById("precio").value = "1000";
    document.getElementById("stock").value = "-1";
    document.getElementById("btnGuardar").click();
    await flushPromises();
    expect(document.getElementById("status").className).toContain("error");
    expect(document.getElementById("status").textContent).toMatch(/stock/i);
  });

  it("no llama fetch si la validación falla", async () => {
    document.getElementById("btnGuardar").click();
    await flushPromises();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ─── Crear producto (POST) ────────────────────────────────────────────────────

describe("Crear producto", () => {
  it("hace POST al guardar un producto nuevo", async () => {
    const nuevo = { id: 3, nombre: "Nuevo", descripcion: "", precio: 5000, stock: 3 };
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(nuevo) })
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue([...mockProductos, nuevo]) });

    document.getElementById("nombre").value = "Nuevo";
    document.getElementById("precio").value = "5000";
    document.getElementById("stock").value = "3";
    document.getElementById("btnGuardar").click();
    await flushPromises();

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/productos",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("renderiza los productos tras crear uno nuevo", async () => {
    const nuevo = { id: 3, nombre: "Nuevo", descripcion: "", precio: 5000, stock: 3 };
    const listaActualizada = [...mockProductos, nuevo];
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(nuevo) })
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(listaActualizada) });

    document.getElementById("nombre").value = "Nuevo";
    document.getElementById("precio").value = "5000";
    document.getElementById("stock").value = "3";
    document.getElementById("btnGuardar").click();
    await flushPromises();

    expect(document.querySelectorAll("#tbodyProductos tr").length).toBe(3);
  });

  it("muestra error si el servidor rechaza la creación", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: jest.fn().mockResolvedValue({ message: "Error del servidor" }),
    });

    document.getElementById("nombre").value = "Test";
    document.getElementById("precio").value = "1000";
    document.getElementById("stock").value = "5";
    document.getElementById("btnGuardar").click();
    await flushPromises();

    expect(document.getElementById("status").className).toContain("error");
  });
});

// ─── Editar producto ──────────────────────────────────────────────────────────

describe("Editar producto", () => {
  it("carga los datos del producto en el formulario", async () => {
    const p = mockProductos[0];
    global.fetch.mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(p) });

    document.querySelector(".btn-editar").click();
    await flushPromises();

    expect(document.getElementById("nombre").value).toBe(p.nombre);
    expect(document.getElementById("precio").value).toBe(String(p.precio));
    expect(document.getElementById("stock").value).toBe(String(p.stock));
    expect(document.getElementById("formTitle").textContent).toMatch(`#${p.id}`);
  });

  it("hace PUT al guardar un producto en modo edición", async () => {
    const p = mockProductos[0];
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(p) }) // GET editar
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(p) }) // PUT guardar
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(mockProductos) }); // GET reload

    document.querySelector(".btn-editar").click();
    await flushPromises();

    jest.clearAllMocks();
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(p) })
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(mockProductos) });

    document.getElementById("btnGuardar").click();
    await flushPromises();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/api/productos/${p.id}`),
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("muestra error si falla la carga del producto a editar", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, json: jest.fn().mockResolvedValue({}) });

    document.querySelector(".btn-editar").click();
    await flushPromises();

    expect(document.getElementById("status").className).toContain("error");
  });
});

// ─── Eliminar producto ────────────────────────────────────────────────────────

describe("Eliminar producto", () => {
  it("hace DELETE al confirmar la eliminación", async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ message: "Eliminado" }) })
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue([mockProductos[1]]) });

    document.querySelector(".btn-eliminar").click();
    await flushPromises();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/api/productos/${mockProductos[0].id}`),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("no hace DELETE si el usuario cancela el confirm", async () => {
    global.confirm = jest.fn(() => false);

    document.querySelector(".btn-eliminar").click();
    await flushPromises();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("actualiza la tabla tras eliminar", async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ message: "Eliminado" }) })
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue([mockProductos[1]]) });

    document.querySelector(".btn-eliminar").click();
    await flushPromises();

    expect(document.querySelectorAll("#tbodyProductos tr").length).toBe(1);
  });

  it("muestra error si falla la eliminación en el servidor", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, json: jest.fn().mockResolvedValue({}) });

    document.querySelector(".btn-eliminar").click();
    await flushPromises();

    expect(document.getElementById("status").className).toContain("error");
  });
});

// ─── Cancelar edición ─────────────────────────────────────────────────────────

describe("Cancelar edición", () => {
  it("limpia todos los campos del formulario", () => {
    document.getElementById("nombre").value = "algo";
    document.getElementById("precio").value = "999";
    document.getElementById("btnCancelar").click();
    expect(document.getElementById("nombre").value).toBe("");
    expect(document.getElementById("precio").value).toBe("");
  });

  it("restaura el título del formulario", () => {
    document.getElementById("formTitle").textContent = "Editar producto #1";
    document.getElementById("btnCancelar").click();
    expect(document.getElementById("formTitle").textContent).toBe("Nuevo producto");
  });

  it("muestra mensaje de cancelación en el estado", () => {
    document.getElementById("btnCancelar").click();
    expect(document.getElementById("status").textContent).toMatch(/cancelada/i);
  });
});
