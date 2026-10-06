// js/compras.js
import { listar, crear, actualizar, nuevoId } from "./api.js";
import { estado } from "./state.js";
import {
  formatearMoneda, escapeHTML, mismoId, mostrarToast, leerItems, formatearFecha, fechaLocalISO
} from "./utils.js";
import { redibujarCatalogo } from "./catalogo.js";
import { redibujarProductos } from "./productos.js";
import { abrirModal } from "./modal.js";

const el = (id) => document.getElementById(id);

let itemsCompra = [];
let guardandoCompra = false;
let proveedores = [];
let compras = [];

function calcularTotalCompra() {
  return itemsCompra.reduce((acc, it) => acc + (it.costo * it.cantidad), 0);
}

function dibujarItemsCompra() {
  const contenedor = el("compra-items-lista");
  if (itemsCompra.length === 0) {
    contenedor.innerHTML = '<p style="color: var(--color-ink-soft); font-size: 0.85rem;">No has agregado productos a la compra.</p>';
    el("compra-total-txt").textContent = "$0";
    return;
  }

  contenedor.innerHTML = itemsCompra.map((it, idx) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid var(--color-line); font-size: 0.85rem;">
      <span><strong>${escapeHTML(it.nombre)}</strong> (${it.cantidad} u. × ${formatearMoneda(it.costo)})</span>
      <div>
        <span style="font-weight: 600; margin-right: 12px;">${formatearMoneda(it.costo * it.cantidad)}</span>
        <button type="button" data-idx="${idx}" class="btn-eliminar-item-compra" style="background:none; border:none; cursor:pointer;">🗑️</button>
      </div>
    </div>
  `).join("");

  el("compra-total-txt").textContent = formatearMoneda(calcularTotalCompra());
}

async function cargarSelectores() {
  try {
    const [listaProveedores, productos] = await Promise.all([
      listar("proveedores"),
      listar("productos")
    ]);
    
    proveedores = listaProveedores;
    estado.productos = productos;

    el("compra-proveedor").innerHTML = '<option value="">Selecciona proveedor...</option>' +
      proveedores.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.nombre)}</option>`).join("");

    el("compra-producto").innerHTML = '<option value="">Selecciona producto...</option>' +
      productos.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.nombre)}</option>`).join("");
  } catch (e) {
    mostrarToast("Error al cargar datos para compras: " + e.message, 4000);
  }
}

function agregarItemCompra() {
  const prodId = el("compra-producto").value;
  const cantidad = Number(el("compra-cantidad").value) || 0;
  const costo = Number(el("compra-costo").value) || 0;

  if (!prodId) return mostrarToast("Selecciona un producto.");
  if (cantidad <= 0) return mostrarToast("Ingresa una cantidad válida.");

  const prod = estado.productos.find(p => mismoId(p.id, prodId));
  if (!prod) return mostrarToast("Producto no encontrado.");

  itemsCompra.push({
    productoId: prod.id,
    nombre: prod.nombre,
    cantidad,
    costo: costo || Number(prod.costo) || 0
  });

  el("compra-producto").value = "";
  el("compra-cantidad").value = "1";
  el("compra-costo").value = "";
  dibujarItemsCompra();
}

async function guardarCompra() {
  if (guardandoCompra) return;
  const proveedorId = el("compra-proveedor").value;
  if (!proveedorId) return mostrarToast("Selecciona un proveedor.");
  if (itemsCompra.length === 0) return mostrarToast("Agrega al menos un producto a la compra.");

  const btn = el("btn-guardar-compra");
  guardandoCompra = true;
  btn.disabled = true;
  btn.textContent = "Guardando compra...";

  try {
    const total = calcularTotalCompra();
    const ahora = new Date().toISOString();

    // 1. Guardar registro en la pestaña 'compras'
    await crear("compras", {
      id: nuevoId(),
      fecha: ahora,
      proveedorId,
      total,
      itemsJson: itemsCompra
    });

    // 2. Aumentar stock y actualizar costo en la pestaña 'productos'
    for (const item of itemsCompra) {
      const prod = estado.productos.find(p => mismoId(p.id, item.productoId));
      if (prod) {
        const nuevoStock = Number(prod.stock || 0) + item.cantidad;
        await actualizar("productos", {
          id: prod.id,
          stock: nuevoStock,
          costo: item.costo
        });
        prod.stock = nuevoStock;
        prod.costo = item.costo;
      }
    }

    itemsCompra = [];
    dibujarItemsCompra();
    redibujarCatalogo();
    redibujarProductos();
    cargarHistorialCompras();
    mostrarToast("¡Compra registrada y stock actualizado! ✓");
  } catch (e) {
    mostrarToast("Error al registrar la compra: " + e.message, 4500);
  } finally {
    guardandoCompra = false;
    btn.disabled = false;
    btn.textContent = "💾 Registrar Compra";
  }
}

// ---------- Historial de compras (listado y detalle) ----------
function nombreProveedor(id) {
  const p = proveedores.find((p) => mismoId(p.id, id));
  return p ? p.nombre : "Proveedor eliminado";
}

async function cargarHistorialCompras() {
  const lista = el("historial-compras-lista");
  lista.innerHTML = '<p class="estado-carga">Cargando compras...</p>';
  try {
    const [listaCompras, listaProveedores] = await Promise.all([listar("compras"), listar("proveedores")]);
    proveedores = listaProveedores;
    compras = listaCompras.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    llenarFiltroProveedores();
    dibujarHistorialCompras();
  } catch (e) {
    lista.innerHTML = `
      <div class="estado-error">
        <p>${escapeHTML(e.message)}</p>
        <button type="button" id="btn-reintentar-compras" class="btn-add">Reintentar</button>
      </div>`;
    el("btn-reintentar-compras").onclick = cargarHistorialCompras;
  }
}

function llenarFiltroProveedores() {
  const select = el("filtro-compra-proveedor");
  const actual = select.value;
  select.innerHTML = '<option value="">Todos los proveedores</option>' +
    proveedores.map((p) => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.nombre)}</option>`).join("");
  select.value = actual;

  // Mantiene al día el selector del registro de compra (por si se creó un proveedor)
  const registro = el("compra-proveedor");
  const elegido = registro.value;
  registro.innerHTML = '<option value="">Selecciona proveedor...</option>' +
    proveedores.map((p) => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.nombre)}</option>`).join("");
  registro.value = elegido;
}

function dibujarHistorialCompras() {
  const lista = el("historial-compras-lista");
  const proveedor = el("filtro-compra-proveedor").value;
  const desde = el("filtro-compra-desde").value;
  const hasta = el("filtro-compra-hasta").value;

  const filtradas = compras.filter((c) => {
    const dia = fechaLocalISO(c.fecha);
    if (proveedor && !mismoId(c.proveedorId, proveedor)) return false;
    if (desde && dia < desde) return false;
    if (hasta && dia > hasta) return false;
    return true;
  });

  const total = filtradas.reduce((acc, c) => acc + Number(c.total || 0), 0);
  el("historial-compras-resumen").textContent =
    `${filtradas.length} compra${filtradas.length === 1 ? "" : "s"} · Total ${formatearMoneda(total)}`;

  if (filtradas.length === 0) {
    lista.innerHTML = '<p class="historial-vacio">No hay compras con esos filtros.</p>';
    return;
  }

  lista.innerHTML = filtradas.map((c) => {
    const unidades = leerItems(c).reduce((acc, it) => acc + Number(it.cantidad || 0), 0);
    return `
      <div class="registro-fila">
        <div class="registro-info">
          <strong>${formatearMoneda(c.total)}</strong>
          <span>${formatearFecha(c.fecha)} · ${escapeHTML(nombreProveedor(c.proveedorId))} · ${unidades} unidad${unidades === 1 ? "" : "es"}</span>
        </div>
        <button type="button" class="btn-recuperar btn-ver-compra" data-id="${escapeHTML(c.id)}">Ver detalle</button>
      </div>`;
  }).join("");
}

function mostrarDetalleCompra(compra) {
  const filas = leerItems(compra).map((it) => `
    <tr>
      <td>${escapeHTML(it.nombre)}</td>
      <td class="num">${Number(it.cantidad)}</td>
      <td class="num">${formatearMoneda(it.costo)}</td>
      <td class="num">${formatearMoneda(Number(it.costo) * Number(it.cantidad))}</td>
    </tr>`).join("");

  abrirModal(`
    <h3>Detalle de compra</h3>
    <div class="factura-datos">
      <p><strong>Compra N°:</strong> ${escapeHTML(String(compra.id).slice(0, 8).toUpperCase())}</p>
      <p><strong>Fecha:</strong> ${formatearFecha(compra.fecha)}</p>
      <p><strong>Proveedor:</strong> ${escapeHTML(nombreProveedor(compra.proveedorId))}</p>
    </div>
    <div class="tabla-scroll">
      <table class="tabla-detalle">
        <thead>
          <tr><th>Producto</th><th class="num">Cant.</th><th class="num">Costo unit.</th><th class="num">Subtotal</th></tr>
        </thead>
        <tbody>${filas || '<tr><td colspan="4">Sin productos</td></tr>'}</tbody>
      </table>
    </div>
    <div class="invoice-totals">
      <div class="row total"><span>Total</span><span>${formatearMoneda(compra.total)}</span></div>
    </div>
    <div class="modal-buttons">
      <button type="button" class="btn-modal-secundario" data-cerrar-modal>Cerrar</button>
    </div>`);
}

// La usa main.js cuando se crea, edita o elimina un producto desde el CRUD
export function refrescarProductosCompra() {
  const select = el("compra-producto");
  const elegido = select.value;
  select.innerHTML = '<option value="">Selecciona producto...</option>' +
    estado.productos.map((p) => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.nombre)}</option>`).join("");
  select.value = elegido;
}

export function iniciarCompras() {
  cargarSelectores();
  dibujarItemsCompra();
  cargarHistorialCompras();

  ["filtro-compra-proveedor", "filtro-compra-desde", "filtro-compra-hasta"]
    .forEach((id) => el(id).addEventListener("change", dibujarHistorialCompras));
  el("btn-recargar-compras").addEventListener("click", cargarHistorialCompras);

  el("historial-compras-lista").addEventListener("click", (e) => {
    const b = e.target.closest(".btn-ver-compra");
    if (!b) return;
    const compra = compras.find((c) => mismoId(c.id, b.dataset.id));
    if (compra) mostrarDetalleCompra(compra);
  });

  el("btn-agregar-item-compra").addEventListener("click", agregarItemCompra);
  el("btn-guardar-compra").addEventListener("click", guardarCompra);

  el("compra-items-lista").addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-eliminar-item-compra");
    if (!btn) return;
    const idx = Number(btn.dataset.idx);
    itemsCompra.splice(idx, 1);
    dibujarItemsCompra();
  });

  // Al cambiar de producto, sugerir su costo actual
  el("compra-producto").addEventListener("change", (e) => {
    const prod = estado.productos.find(p => mismoId(p.id, e.target.value));
    if (prod && prod.costo) {
      el("compra-costo").value = prod.costo;
    }
  });
}