// js/api.js

// ÚNICO archivo que conoce la URL del servicio y hace fetch.

// En la entrega final (MVP 3) solo este archivo cambia.
 
// Pega aquí la URL de tu aplicación web (la que termina en /exec).

const API_URL = "https://script.google.com/macros/s/AKfycbzy-4CFf7aDspwyGjh02IJxrRX2_8ce0eXF2LnMO8Q4w4kCdD9xvP1rm7YWZM1wdrMD/exec";
 
// ---------- Núcleo: hace la petición y valida la respuesta ----------

async function llamar(url, opciones) {

  let respuesta;

  try {

    respuesta = await fetch(url, opciones);

  } catch (e) {

    throw new Error("No se pudo conectar con el servicio. Revisa tu conexión a internet.");

  }
 
  let json;

  try {

    json = await respuesta.json();

  } catch (e) {

    throw new Error(

      "El servicio respondió algo inesperado. Revisa que la URL termine en /exec " +

      "y que el acceso sea 'Cualquier persona'."

    );

  }
 
  if (!json.success) throw new Error(json.message || "Error desconocido del servicio.");

  return json.data;

}
 
// ---------- Operaciones públicas ----------
 
// Peticiones GET en curso: si dos módulos piden el mismo recurso a la vez, comparten la respuesta

const enCurso = new Map();
 
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
 
// Apps Script a veces responde una página HTML de error cuando recibe muchas peticiones

// juntas. Leer no cambia datos, así que un GET se puede reintentar sin riesgo.

async function listarConReintento(recurso, intentos = 3) {

  for (let i = 1; ; i++) {

    try {

      return await llamar(`${API_URL}?resource=${encodeURIComponent(recurso)}`);

    } catch (e) {

      if (i >= intentos) throw e;

      await esperar(600 * i);

    }

  }

}
 
// Listar: devuelve un arreglo de registros

export function listar(recurso) {

  if (!enCurso.has(recurso)) {

    const promesa = listarConReintento(recurso).finally(() => enCurso.delete(recurso));

    enCurso.set(recurso, promesa);

  }

  return enCurso.get(recurso);

}
 
function enviar(recurso, accion, datos) {

  return llamar(`${API_URL}?resource=${encodeURIComponent(recurso)}`, {

    method: "POST",

    // text/plain evita el "preflight" de CORS que Apps Script no soporta

    headers: { "Content-Type": "text/plain;charset=utf-8" },

    body: JSON.stringify({ action: accion, data: datos })

  });

}
 
// Crear: genera el id automáticamente (si no envías uno)

export function crear(recurso, datos) {

  return enviar(recurso, "create", { id: crypto.randomUUID(), ...datos });

}
 
// Actualizar: datos debe incluir el id y solo los campos que cambian

export function actualizar(recurso, datos) {

  return enviar(recurso, "update", datos);

}
 
// Eliminar por id

export function eliminar(recurso, id) {

  return enviar(recurso, "delete", { id });

}
 
// Id nuevo (útil cuando necesitas el id antes de crear, por ejemplo en una venta)

export function nuevoId() {

  return crypto.randomUUID();

}

 
