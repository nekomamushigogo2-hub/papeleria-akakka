// js/modal.js
// Ventana emergente reutilizable (factura, detalle de compra y formulario de producto).

const modal = () => document.getElementById("modal");
const contenido = () => document.getElementById("modal-contenido");

export function abrirModal(html) {
  contenido().innerHTML = html;
  modal().classList.remove("oculto");
}

export function cerrarModal() {
  modal().classList.add("oculto");
  contenido().innerHTML = "";
}

export function iniciarModal() {
  // Se cierra al hacer clic fuera de la tarjeta o en cualquier botón con data-cerrar-modal
  modal().addEventListener("click", (e) => {
    if (e.target === modal() || e.target.closest("[data-cerrar-modal]")) cerrarModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal().classList.contains("oculto")) cerrarModal();
  });
}
