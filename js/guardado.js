// ===================================================
// Guardado automático
// Guarda en el dispositivo lo que el estudiante escribe y marca, para que
// no se pierda si la pantalla se bloquea o la página se recarga.
// Sirve para todas las páginas de laboratorio: solo hay que enlazarlo.
// ===================================================

// Cada página guarda sus datos con su propio nombre (ej. "datos2-/lab1.html").
// "datos2" porque ahora cada valor se guarda con el nombre de su casilla, no por su posición.
const CLAVE = 'datos2-' + location.pathname;

// Todos los campos de la página (textos, casillas y opciones)
const campos = document.querySelectorAll('input');

// Las casillas y opciones se guardan como marcadas o no; los textos, con su valor
function esCasilla(campo) {
  return campo.type === 'checkbox' || campo.type === 'radio';
}

// Nombre fijo de cada campo, para que su valor vuelva siempre a la misma casilla
// aunque después se agreguen o se muevan campos en la página:
//   - si tiene id, el id (ej. "id:voltaje")
//   - si es una opción Sí/No, el nombre del grupo de opciones (ej. "opcion:primera")
//   - si está en una tabla, su clase y sus datos (ej. "campo:medida|v=2")
//   - si es una casilla de la lista de chequeo, el texto de su etiqueta
function claveDe(campo) {
  if (campo.id) return 'id:' + campo.id;
  if (campo.type === 'radio') return 'opcion:' + campo.name;
  const fila = campo.closest('tr');
  const datos = Object.assign({}, fila ? fila.dataset : {}, campo.dataset);
  const partes = Object.keys(datos).sort().map(function (nombre) {
    return nombre + '=' + datos[nombre];
  });
  if (partes.length > 0) return 'campo:' + campo.className + '|' + partes.join(',');
  const etiqueta = campo.closest('label');
  if (etiqueta) return 'texto:' + etiqueta.textContent.replace(/\s+/g, ' ').trim();
  return null; // sin un nombre fijo, ese campo no se guarda
}

// Los nombres se calculan una sola vez, al abrir la página y antes de que
// el resto del código del laboratorio cambie la tabla
const claves = Array.from(campos).map(claveDe);

function guardar() {
  const valores = {};
  campos.forEach(function (campo, i) {
    const clave = claves[i];
    if (!clave) return;
    if (campo.type === 'radio') {
      if (campo.checked) valores[clave] = campo.value; // se guarda cuál opción se eligió
    } else {
      valores[clave] = esCasilla(campo) ? campo.checked : campo.value;
    }
  });
  try {
    localStorage.setItem(CLAVE, JSON.stringify(valores));
  } catch (error) {
    // Si el navegador no deja guardar, la página sigue funcionando igual
  }
}

function recuperar() {
  let valores = null;
  try {
    valores = JSON.parse(localStorage.getItem(CLAVE));
  } catch (error) {
    valores = null;
  }
  if (!valores) return;
  campos.forEach(function (campo, i) {
    const clave = claves[i];
    if (!clave || valores[clave] === undefined) return;
    if (campo.type === 'radio') {
      campo.checked = valores[clave] === campo.value;
    } else if (esCasilla(campo)) {
      campo.checked = valores[clave];
    } else {
      campo.value = valores[clave];
    }
  });
}

// Borra todo lo de esta página: los campos, las alertas registradas y el envío.
// Así, si otro grupo usa el mismo dispositivo, empieza de cero.
function borrarTodo() {
  try {
    localStorage.removeItem(CLAVE);
    localStorage.removeItem('datos-' + location.pathname);    // datos de la versión anterior
    localStorage.removeItem('eventos-' + location.pathname);  // alertas y correcciones
    localStorage.removeItem('registro-' + location.pathname); // envío al registro
  } catch (error) {}
  campos.forEach(function (campo) {
    if (esCasilla(campo)) {
      campo.checked = false;
    } else {
      campo.value = '';
    }
  });
  const caja = document.getElementById('resultado-pre');
  if (caja) caja.hidden = true;
  const estado = document.getElementById('estado-envio');
  if (estado) estado.hidden = true;
}

// 1. Al abrir la página, recupera lo que había
recuperar();

// 2. Cada vez que algo cambia, lo guarda
campos.forEach(function (campo) {
  campo.addEventListener('input', guardar);
  campo.addEventListener('change', guardar);
});

// 3. Botón "Borrar mis datos": pide tocarlo dos veces para evitar accidentes
const botonBorrar = document.getElementById('borrar-datos');
let confirmando = false;
if (botonBorrar) {
  botonBorrar.addEventListener('click', function () {
    if (!confirmando) {
      confirmando = true;
      botonBorrar.textContent = '¿Seguro? Toca otra vez para borrar';
      setTimeout(function () {
        confirmando = false;
        botonBorrar.textContent = 'Borrar mis datos';
      }, 4000);
      return;
    }
    borrarTodo();
    confirmando = false;
    botonBorrar.textContent = 'Datos borrados';
  });
}