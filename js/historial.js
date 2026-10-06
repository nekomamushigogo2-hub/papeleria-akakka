// js/historial.js
// Historial de ventas cerradas: listado con filtros, detalle y factura (imprimir / PDF).
import { listar } from "./api.js";
import { estado } from "./state.js";
import {
  formatearMoneda, escapeHTML, mismoId, leerItems, formatearFecha, fechaLocalISO
} from "./utils.js";
import { abrirModal } from "./modal.js";

const el = (id) => document.getElementById(id);

// Datos del comercio que aparecen en la factura (configuración, no datos del negocio)
const COMERCIO = {
  nombre: "Papel y Luna",
  descripcion: "Papelería y miscelánea",
  logo: "img/logo.png"
};

let ventasCerradas = [];

function nombreCliente(id) {
  if (!id) return "Sin cliente";
  const c = estado.clientes.find((c) => mismoId(c.id, id));
  return c ? c.nombre : "Cliente eliminado";
}

// ---------- Factura (detalle de una venta cerrada) ----------
export function mostrarFactura(venta) {
  const items = leerItems(venta);
  const filas = items.map((l) => `
    <tr>
      <td>${escapeHTML(l.nombre)}</td>
      <td class="num">${Number(l.cantidad)}</td>
      <td class="num">${formatearMoneda(l.precio)}</td>
      <td class="num">${formatearMoneda(Number(l.precio) * Number(l.cantidad))}</td>
    </tr>`).join("");

  const esEfectivo = venta.metodoPago === "Efectivo";
  const pagoEfectivo = esEfectivo ? `
    <div class="row"><span>Recibido</span><span>${formatearMoneda(venta.valorRecibido)}</span></div>
    <div class="row"><span>Cambio</span><span>${formatearMoneda(venta.cambio)}</span></div>` : "";

  abrirModal(`
    <div class="factura-doc">
      <div class="factura-encabezado">
        <img src="${COMERCIO.logo}" alt="Logo ${COMERCIO.nombre}">
        <div>
          <h3>${COMERCIO.nombre}</h3>
          <p>${COMERCIO.descripcion}</p>
        </div>
      </div>

      <div class="factura-datos">
        <p><strong>Factura N°:</strong> ${escapeHTML(String(venta.id).slice(0, 8).toUpperCase())}</p>
        <p><strong>Fecha:</strong> ${formatearFecha(venta.fecha)}</p>
        <p><strong>Cliente:</strong> ${escapeHTML(nombreCliente(venta.clienteId))}</p>
        <p><strong>Método de pago:</strong> ${escapeHTML(venta.metodoPago || "Efectivo")}</p>
      </div>

      <div class="tabla-scroll">
        <table class="tabla-detalle">
          <thead>
            <tr><th>Producto</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Subtotal</th></tr>
          </thead>
          <tbody>${filas || '<tr><td colspan="4">Sin productos</td></tr>'}</tbody>
        </table>
      </div>

      <div class="invoice-totals">
        <div class="row"><span>Subtotal</span><span>${formatearMoneda(venta.subtotal ?? venta.total)}</span></div>
        <div class="row total"><span>Total</span><span>${formatearMoneda(venta.total)}</span></div>
        ${pagoEfectivo}
      </div>

      <p class="factura-gracias">¡Gracias por tu compra!</p>
    </div>

    <div class="modal-buttons no-imprimir">
      <button type="button" class="btn-imprimir" id="btn-imprimir-factura">🖨️ Imprimir / PDF</button>
      <button type="button" class="btn-modal-secundario" data-cerrar-modal>Cerrar</button>
    </div>`);

  el("btn-imprimir-factura").addEventListener("click", () => window.print());
}

// ---------- Listado ----------
export async function cargarHistorial() {
  const lista = el("historial-ventas-lista");
  lista.innerHTML = '<p class="estado-carga">Cargando historial...</p>';
  try {
    const [ventas, clientes] = await Promise.all([listar("ventas"), listar("clientes")]);
    estado.clientes = clientes;
    ventasCerradas = ventas
      .filter((v) => v.estado === "cerrada")
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    llenarFiltroClientes();
    dibujarHistorial();
  } catch (e) {
    lista.innerHTML = `
      <div class="estado-error">
        <p>${escapeHTML(e.message)}</p>
        <button type="button" id="btn-reintentar-historial" class="btn-add">Reintentar</button>
      </div>`;
    el("btn-reintentar-historial").onclick = cargarHistorial;
  }
}

function llenarFiltroClientes() {
  const select = el("filtro-venta-cliente");
  const actual = select.value;
  select.innerHTML = '<option value="">Todos los clientes</option>' +
    estado.clientes.map((c) => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.nombre)}</option>`).join("");
  select.value = actual;
}

function dibujarHistorial() {
  const lista = el("historial-ventas-lista");
  const desde = el("filtro-venta-desde").value;
  const hasta = el("filtro-venta-hasta").value;
  const metodo = el("filtro-venta-metodo").value;
  const cliente = el("filtro-venta-cliente").value;

  const filtradas = ventasCerradas.filter((v) => {
    const dia = fechaLocalISO(v.fecha);
    if (desde && dia < desde) return false;
    if (hasta && dia > hasta) return false;
    if (metodo && v.metodoPago !== metodo) return false;
    if (cliente && !mismoId(v.clienteId, cliente)) return false;
    return true;
  });

  const total = filtradas.reduce((acc, v) => acc + Number(v.total || 0), 0);
  el("historial-ventas-resumen").textContent =
    `${filtradas.length} venta${filtradas.length === 1 ? "" : "s"} · Total ${formatearMoneda(total)}`;

  if (filtradas.length === 0) {
    lista.innerHTML = '<p class="historial-vacio">No hay ventas cerradas con esos filtros.</p>';
    return;
  }

  lista.innerHTML = filtradas.map((v) => `
    <div class="registro-fila">
      <div class="registro-info">
        <strong>${formatearMoneda(v.total)}</strong>
        <span>${formatearFecha(v.fecha)} · ${escapeHTML(v.metodoPago || "Efectivo")} · ${escapeHTML(nombreCliente(v.clienteId))}</span>
      </div>
      <button type="button" class="btn-recuperar btn-ver-venta" data-id="${escapeHTML(v.id)}">Ver factura</button>
    </div>`).join("");
}

export function iniciarHistorial() {
  ["filtro-venta-desde", "filtro-venta-hasta", "filtro-venta-metodo", "filtro-venta-cliente"]
    .forEach((id) => el(id).addEventListener("change", dibujarHistorial));

  el("btn-limpiar-filtros-venta").addEventListener("click", () => {
    ["filtro-venta-desde", "filtro-venta-hasta", "filtro-venta-metodo", "filtro-venta-cliente"]
      .forEach((id) => el(id).value = "");
    dibujarHistorial();
  });

  el("btn-recargar-historial").addEventListener("click", cargarHistorial);

  el("historial-ventas-lista").addEventListener("click", (e) => {
    const b = e.target.closest(".btn-ver-venta");
    if (!b) return;
    const venta = ventasCerradas.find((v) => mismoId(v.id, b.dataset.id));
    if (venta) mostrarFactura(venta);
  });

  return cargarHistorial();
}
