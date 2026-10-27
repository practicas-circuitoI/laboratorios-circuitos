// ===================================================
// Registro: envía los resultados a la hoja de Google Sheets
// Sirve para todos los laboratorios.
// ===================================================

// Dirección que dio Apps Script al implementar (termina en /exec)
const URL_REGISTRO = 'https://script.google.com/macros/s/AKfycbzvCYrw7QasMl7wU4Ukk1EIdsnDjky200j3uJLK2dRmj4I3dxPYdcflKJffqCUHT5QF/exec';

// Aquí se recuerda en el dispositivo el último envío de esta página
const CLAVE_REGISTRO = 'registro-' + location.pathname;

// Muestra un mensaje debajo del botón de enviar
function mostrarEstadoEnvio(texto, tipo) {
  const estado = document.getElementById('estado-envio');
  estado.hidden = false;
  estado.className = 'estado-envio ' + tipo;
  estado.textContent = texto;
}

// Deja el código de grupo siempre igual: "7", "g7", "G 07" o "grupo 7" → "G07".
// Si no hay un número entre 1 y 99, devuelve '' (código no válido).
function normalizarGrupo(texto) {
  const numero = String(texto).match(/\d+/);
  if (!numero) return '';
  const n = parseInt(numero[0], 10);
  if (n < 1 || n > 99) return '';
  return 'G' + (n < 10 ? '0' : '') + n;
}

// Lee y guarda el último envío: { sesion, grupo, hora }
function leerEnvio() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_REGISTRO));
  } catch (error) {
    return null;
  }
}
function guardarEnvio(envio) {
  try {
    localStorage.setItem(CLAVE_REGISTRO, JSON.stringify(envio));
  } catch (error) {}
}

// Código al azar que identifica los envíos de un grupo desde este dispositivo.
// Si el grupo envía otra vez, la hoja marca la fila anterior como "Reemplazado".
function nuevaSesion() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

// Hora en formato 24 h, ej. "10:32"
function horaCorta(fechaISO) {
  return new Date(fechaISO).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function textoEnviado(envio) {
  return 'Resultados del grupo ' + envio.grupo + ' enviados a las ' + horaCorta(envio.hora) +
    '. Si corriges algo, envía de nuevo: en la hoja cuenta el último envío.';
}

// Revisa los datos, los envía y avisa si llegaron o no
function enviarRegistro(datos) {
  // 1. Código de grupo con formato fijo
  const grupo = normalizarGrupo(datos.grupo);
  if (grupo === '') {
    mostrarEstadoEnvio('Escribe el número de tu grupo, por ejemplo G07.', 'mal');
    return;
  }
  const campoGrupo = document.getElementById('grupo');
  campoGrupo.value = grupo;
  campoGrupo.dispatchEvent(new Event('change')); // para que quede guardado así
  datos.grupo = grupo;

  // 2. La pregunta "¿funcionó a la primera?" es obligatoria (indicador de la tesis)
  if (datos.primeraVez !== 'Sí' && datos.primeraVez !== 'No') {
    mostrarEstadoEnvio('Responde si el circuito funcionó a la primera antes de enviar.', 'mal');
    return;
  }

  if (URL_REGISTRO.indexOf('https://') !== 0) {
    mostrarEstadoEnvio('Falta configurar la dirección del registro en js/registro.js.', 'mal');
    return;
  }

  // 3. Mismo grupo en este dispositivo = misma sesión; otro grupo = sesión nueva
  let envio = leerEnvio();
  if (!envio || envio.grupo !== grupo) envio = { sesion: nuevaSesion(), grupo: grupo };
  datos.sesion = envio.sesion;

  const boton = document.getElementById('btn-enviar');
  boton.disabled = true;
  mostrarEstadoEnvio('Enviando…', 'info');

  fetch(URL_REGISTRO, { method: 'POST', body: JSON.stringify(datos) })
    .then(function (respuesta) {
      if (!respuesta.ok) throw new Error('Respuesta ' + respuesta.status);
      return respuesta.json();
    })
    .then(function (resultado) {
      // La hoja responde { ok: true } cuando guardó la fila
      if (!resultado || resultado.ok !== true) throw new Error('El registro no guardó la fila');
      envio.hora = new Date().toISOString();
      guardarEnvio(envio);
      mostrarEstadoEnvio(textoEnviado(envio), 'bien');
    })
    .catch(function () {
      mostrarEstadoEnvio('No se pudo enviar. Revisa tu conexión e intenta de nuevo; tus datos siguen guardados.', 'mal');
    })
    .finally(function () {
      boton.disabled = false;
    });
}

// Al abrir la página: si este dispositivo ya envió, se le recuerda al grupo
(function () {
  const envio = leerEnvio();
  if (envio && envio.hora && document.getElementById('estado-envio')) {
    mostrarEstadoEnvio(textoEnviado(envio), 'bien');
  }
})();