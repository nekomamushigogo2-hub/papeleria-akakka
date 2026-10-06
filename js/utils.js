// js/utils.js
// Funciones pequeñas que usan todas las vistas.

export function formatearMoneda(valor) {
  return Number(valor || 0).toLocaleString("es-CO", {
    style: "currency", currency: "COP", minimumFractionDigits: 0
  });
}

// Evita que un nombre con < > " se interprete como HTML (los datos vienen de afuera)
export function escapeHTML(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// Sheets a veces devuelve como número un id que parece número: se compara como texto
export function mismoId(a, b) {
  return String(a) === String(b);
}

export function mostrarToast(mensaje, duracionMs = 2500) {
  const toast = document.getElementById("notificacion");
  if (!toast) return;
  toast.textContent = mensaje;
  toast.classList.add("visible");
  clearTimeout(toast._timeoutId);
  toast._timeoutId = setTimeout(() => toast.classList.remove("visible"), duracionMs);
}

// itemsJson llega del servicio como texto JSON: lo convierte a arreglo sin romper la vista
export function leerItems(registro) {
  const items = registro?.itemsJson;
  if (Array.isArray(items)) return items;
  try {
    const lista = JSON.parse(items || "[]");
    return Array.isArray(lista) ? lista : [];
  } catch (e) {
    return [];
  }
}

// "2026-10-06T15:30:00.000Z" -> "06/10/2026, 10:30 a. m." (hora local)
export function formatearFecha(fecha) {
  const d = new Date(fecha);
  if (isNaN(d)) return "Sin fecha";
  return d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

// Fecha local en formato YYYY-MM-DD, para comparar con un <input type="date">
export function fechaLocalISO(fecha) {
  const d = new Date(fecha);
  if (isNaN(d)) return "";
  const dos = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}
