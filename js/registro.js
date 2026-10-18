// ===================================================
// Registro: envía los resultados a la hoja de Google Sheets
// Sirve para todos los laboratorios.
// ===================================================

// Pega aquí la dirección que te dio Apps Script al implementar (termina en /exec)
const URL_REGISTRO = 'https://script.google.com/macros/s/AKfycbzvCYrw7QasMl7wU4Ukk1EIdsnDjky200j3uJLK2dRmj4I3dxPYdcflKJffqCUHT5QF/exec';

// Muestra un mensaje debajo del botón de enviar
function mostrarEstadoEnvio(texto, tipo) {
  const estado = document.getElementById('estado-envio');
  estado.hidden = false;
  estado.className = 'estado-envio ' + tipo;
  estado.textContent = texto;
}

// Envía los datos y avisa si llegaron o no
function enviarRegistro(datos) {
  if (URL_REGISTRO.indexOf('https://') !== 0) {
    mostrarEstadoEnvio('Falta configurar la dirección del registro en js/registro.js.', 'mal');
    return;
  }
  const boton = document.getElementById('btn-enviar');
  boton.disabled = true;
  mostrarEstadoEnvio('Enviando…', 'info');

  fetch(URL_REGISTRO, { method: 'POST', body: JSON.stringify(datos) })
    .then(function (respuesta) {
      if (!respuesta.ok) throw new Error('Respuesta ' + respuesta.status);
      return respuesta.json();
    })
    .then(function () {
      const hora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
      mostrarEstadoEnvio('Resultados enviados a las ' + hora + '. ¡Gracias!', 'bien');
    })
    .catch(function () {
      mostrarEstadoEnvio('No se pudo enviar. Revisa tu conexión e intenta de nuevo; tus datos siguen guardados.', 'mal');
    })
    .finally(function () {
      boton.disabled = false;
    });
}