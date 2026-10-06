// js/main.js
import { iniciarCatalogo } from "./catalogo.js";
import { iniciarVenta, agregarAVenta, actualizarLineasProducto } from "./venta.js";
import { iniciarCompras, refrescarProductosCompra } from "./compras.js";
import { iniciarEntidades } from "./entidades.js";
import { iniciarModal } from "./modal.js";
import { iniciarHistorial } from "./historial.js";
import { iniciarProductos, redibujarProductos } from "./productos.js";

// --- MODO OSCURO ---
const btnTema = document.getElementById("btn-tema");
if (btnTema) {
  // Aplicar preferencia guardada
  if (localStorage.getItem("tema") === "oscuro") {
    document.body.classList.add("dark-mode");
    btnTema.textContent = "☀️";
  }

  btnTema.addEventListener("click", () => {
    const esOscuro = document.body.classList.toggle("dark-mode");
    btnTema.textContent = esOscuro ? "☀️" : "🌙";
    localStorage.setItem("tema", esOscuro ? "oscuro" : "claro");
  });
}

iniciarModal();
iniciarVenta();
iniciarProductos({
  // Al crear/editar/eliminar un producto se actualiza la venta en curso y el selector de compras
  onCambio: (producto) => {
    actualizarLineasProducto(producto);
    refrescarProductosCompra();
  }
});
iniciarCatalogo((producto, cantidad) => agregarAVenta(producto, cantidad))
  .then(redibujarProductos);
iniciarCompras();
iniciarEntidades();
iniciarHistorial();