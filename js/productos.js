// js/productos.js
// CRUD de productos (listar, crear, editar, eliminar) y edición rápida desde el flujo de venta.
import { listar, crear, actualizar, eliminar, nuevoId } from "./api.js";
import { estado } from "./state.js";
import { formatearMoneda, escapeHTML, mismoId, mostrarToast, leerItems } from "./utils.js";
import { abrirModal, cerrarModal } from "./modal.js";
import { redibujarCatalogo } from "./catalogo.js";

const el = (id) => document.getElementById(id);
const controlaStock = (p) => p.seguimientoInventario === true || p.seguimientoInventario === "true";

let guardando = false;
let alCambiarProducto = () => {};   // lo define main.js (actualiza la venta en curso y compras)

function nombreCategoria(id) {
  const c = estado.categorias.find((c) => mismoId(c.id, id));
  return c ? c.nombre : "Sin categoría";
}

// ---------- Listado ----------
export function redibujarProductos() {
  const lista = el("productos-lista");
  if (!lista) return;
  const termino = el("buscador-productos").value.trim().toLowerCase();
  const productos = estado.productos.filter((p) =>
    String(p.nombre).toLowerCase().includes(termino) ||
    String(p.codigo || "").toLowerCase().includes(termino)
  );

  if (productos.length === 0) {
    lista.innerHTML = '<p class="historial-vacio">No hay productos que coincidan.</p>';
    return;
  }

  lista.innerHTML = productos.map((p) => {
    const stock = controlaStock(p) ? `Stock: ${Number(p.stock)}` : "Sin seguimiento";
    const codigo = p.codigo ? `${escapeHTML(p.codigo)} · ` : "";
    return `
      <div class="registro-fila">
        <div class="registro-info">
          <strong>${escapeHTML(p.nombre)}</strong>
          <span>${codigo}${escapeHTML(nombreCategoria(p.categoriaId))} · Precio ${formatearMoneda(p.precio)} · Costo ${formatearMoneda(p.costo)} · ${stock}</span>
        </div>
        <div class="registro-acciones">
          <button type="button" class="btn-vaciar btn-editar-producto" data-id="${escapeHTML(p.id)}">✏️ Editar</button>
          <button type="button" class="btn-vaciar btn-eliminar-producto" data-id="${escapeHTML(p.id)}">🗑️ Eliminar</button>
        </div>
      </div>`;
  }).join("");
}

async function cargarProductos() {
  el("productos-lista").innerHTML = '<p class="estado-carga">Cargando productos...</p>';
  try {
    const [productos, categorias] = await Promise.all([listar("productos"), listar("categorias")]);
    estado.productos = productos;
    estado.categorias = categorias;
    redibujarProductos();
    redibujarCatalogo();
  } catch (e) {
    el("productos-lista").innerHTML = `
      <div class="estado-error">
        <p>${escapeHTML(e.message)}</p>
        <button type="button" id="btn-reintentar-productos" class="btn-add">Reintentar</button>
      </div>`;
    el("btn-reintentar-productos").onclick = cargarProductos;
  }
}

// ---------- Formulario (crear / editar / edición rápida) ----------
// rapido = true: solo nombre, categoría, precio y costo (el stock se ajusta desde el CRUD)
export function abrirFormularioProducto(id = null, { rapido = false } = {}) {
  const p = id ? estado.productos.find((x) => mismoId(x.id, id)) : null;
  if (id && !p) return mostrarToast("El producto ya no existe. Recarga el catálogo.", 3500);

  const sigue = p ? controlaStock(p) : true;
  const opcionesCategoria = estado.categorias.map((c) =>
    `<option value="${escapeHTML(c.id)}" ${p && mismoId(p.categoriaId, c.id) ? "selected" : ""}>${escapeHTML(c.nombre)}</option>`
  ).join("");

  const camposCompletos = rapido ? "" : `
    <div class="campo">
      <label for="prod-codigo">Código</label>
      <input type="text" id="prod-codigo" value="${escapeHTML(p?.codigo ?? "")}" placeholder="Ej: CUA-001">
    </div>
    <label class="check-linea">
      <input type="checkbox" id="prod-seguimiento" ${sigue ? "checked" : ""}>
      Llevar seguimiento de inventario
    </label>
    <div class="campo" id="campo-prod-stock">
      <label for="prod-stock">Stock</label>
      <input type="number" id="prod-stock" min="0" step="1" value="${p ? Number(p.stock) || 0 : 0}">
    </div>`;

  const titulo = rapido ? "Editar producto (venta en curso)" : (p ? "Editar producto" : "Nuevo producto");

  abrirModal(`
    <h3>${titulo}</h3>
    <form id="form-producto" class="form-modal" novalidate>
      <div class="campo">
        <label for="prod-nombre">Nombre *</label>
        <input type="text" id="prod-nombre" value="${escapeHTML(p?.nombre ?? "")}" required>
      </div>
      <div class="campo">
        <label for="prod-categoria">Categoría *</label>
        <select id="prod-categoria">
          <option value="">Selecciona categoría...</option>
          ${opcionesCategoria}
        </select>
      </div>
      <div class="form-modal-fila">
        <div class="campo">
          <label for="prod-precio">Precio de venta *</label>
          <input type="number" id="prod-precio" min="0" step="1" value="${p ? Number(p.precio) || 0 : ""}">
        </div>
        <div class="campo">
          <label for="prod-costo">Costo</label>
          <input type="number" id="prod-costo" min="0" step="1" value="${p ? Number(p.costo) || 0 : ""}">
        </div>
      </div>
      ${camposCompletos}
      <div class="modal-buttons">
        <button type="button" class="btn-modal-secundario" data-cerrar-modal>Cancelar</button>
        <button type="submit" class="btn-add" id="btn-guardar-producto">💾 Guardar</button>
      </div>
    </form>`);

  // El stock solo aplica si hay seguimiento de inventario
  const check = el("prod-seguimiento");
  if (check) {
    const alternar = () => el("campo-prod-stock").classList.toggle("oculto", !check.checked);
    check.addEventListener("change", alternar);
    alternar();
  }

  el("form-producto").addEventListener("submit", (e) => {
    e.preventDefault();
    guardarProducto(p, rapido);
  });
  el("prod-nombre").focus();
}

function leerFormulario(original, rapido) {
  const nombre = el("prod-nombre").value.trim();
  const categoriaId = el("prod-categoria").value;
  const precioTxt = el("prod-precio").value;
  const costoTxt = el("prod-costo").value;
  const precio = Number(precioTxt);
  const costo = costoTxt === "" ? 0 : Number(costoTxt);

  if (!nombre) throw new Error("El nombre es obligatorio.");
  if (!categoriaId) throw new Error("Selecciona una categoría.");
  if (precioTxt === "" || !Number.isInteger(precio) || precio <= 0) {
    throw new Error("El precio debe ser un número entero mayor que 0.");
  }
  if (!Number.isInteger(costo) || costo < 0) throw new Error("El costo debe ser un número entero mayor o igual a 0.");

  const repetido = estado.productos.some((p) =>
    !mismoId(p.id, original?.id) && String(p.nombre).trim().toLowerCase() === nombre.toLowerCase()
  );
  if (repetido) throw new Error(`Ya existe un producto llamado "${nombre}".`);

  const datos = { nombre, categoriaId, precio, costo };
  if (rapido) return datos;

  const codigo = el("prod-codigo").value.trim();
  const seguimientoInventario = el("prod-seguimiento").checked;
  const stock = seguimientoInventario ? Number(el("prod-stock").value) : 0;
  if (seguimientoInventario && (!Number.isInteger(stock) || stock < 0)) {
    throw new Error("El stock debe ser un número entero mayor o igual a 0.");
  }
  if (codigo && estado.productos.some((p) =>
    !mismoId(p.id, original?.id) && String(p.codigo || "").toLowerCase() === codigo.toLowerCase())) {
    throw new Error(`El código "${codigo}" ya está en uso.`);
  }

  return { ...datos, codigo, seguimientoInventario, stock };
}

async function guardarProducto(original, rapido) {
  if (guardando) return;

  let datos;
  try {
    datos = leerFormulario(original, rapido);
  } catch (e) {
    return mostrarToast(e.message, 3500);
  }

  const boton = el("btn-guardar-producto");
  guardando = true;
  boton.disabled = true;
  boton.textContent = "Guardando...";

  try {
    let guardado;
    if (original) {
      await actualizar("productos", { id: original.id, ...datos });
      guardado = Object.assign(original, datos);   // mismo objeto que usa el catálogo
    } else {
      guardado = await crear("productos", { id: nuevoId(), ...datos });
      estado.productos.push(guardado);
    }

    cerrarModal();
    redibujarProductos();
    redibujarCatalogo();
    alCambiarProducto(guardado);
    mostrarToast(original ? "Producto actualizado ✓" : "Producto creado ✓");
  } catch (e) {
    mostrarToast("Error al guardar: " + e.message, 4000);
    boton.disabled = false;
    boton.textContent = "💾 Guardar";
  } finally {
    guardando = false;
  }
}

// ---------- Eliminar ----------
async function eliminarProducto(id, boton) {
  const p = estado.productos.find((x) => mismoId(x.id, id));
  if (!p) return;

  if (estado.venta.some((l) => mismoId(l.productoId, id))) {
    return mostrarToast("Quita el producto de la venta en curso antes de eliminarlo.", 4000);
  }
  if (!confirm(`¿Eliminar el producto "${p.nombre}"? Esta acción no se puede deshacer.`)) return;

  boton.disabled = true;
  try {
    // Las ventas abiertas guardadas aún dependen del producto para poder cerrarse
    const ventas = await listar("ventas");
    const enAbierta = ventas.some((v) => v.estado === "abierta" &&
      leerItems(v).some((l) => mismoId(l.productoId, id)));
    if (enAbierta) {
      boton.disabled = false;
      return mostrarToast("No se puede eliminar: el producto está en una venta abierta.", 4000);
    }

    await eliminar("productos", id);
    estado.productos = estado.productos.filter((x) => !mismoId(x.id, id));
    redibujarProductos();
    redibujarCatalogo();
    alCambiarProducto(null);
    mostrarToast("Producto eliminado ✓");
  } catch (e) {
    boton.disabled = false;
    mostrarToast("Error al eliminar: " + e.message, 4000);
  }
}

// ---------- Arranque ----------
export function iniciarProductos({ onCambio } = {}) {
  if (onCambio) alCambiarProducto = onCambio;

  el("buscador-productos").addEventListener("input", redibujarProductos);
  el("btn-nuevo-producto").addEventListener("click", () => abrirFormularioProducto());
  el("btn-recargar-productos").addEventListener("click", cargarProductos);

  el("productos-lista").addEventListener("click", (e) => {
    const editar = e.target.closest(".btn-editar-producto");
    const borrar = e.target.closest(".btn-eliminar-producto");
    if (editar) abrirFormularioProducto(editar.dataset.id);
    if (borrar) eliminarProducto(borrar.dataset.id, borrar);
  });

  // Los productos los trae el catálogo al iniciar (main.js llama redibujarProductos después)
  el("productos-lista").innerHTML = '<p class="estado-carga">Cargando productos...</p>';
}
