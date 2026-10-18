// ===================================================
// Guardado automático
// Guarda en el dispositivo lo que el estudiante escribe y marca, para que
// no se pierda si la pantalla se bloquea o la página se recarga.
// Sirve para todas las páginas de laboratorio: solo hay que enlazarlo.
// ===================================================

// Cada página guarda sus datos con su propio nombre (ej. "datos-/lab1.html")
const CLAVE = 'datos-' + location.pathname;

// Todos los campos de la página (textos, casillas y opciones)
const campos = document.querySelectorAll('input');

// Las casillas y opciones se guardan como marcadas o no; los textos, con su valor
function esCasilla(campo) {
  return campo.type === 'checkbox' || campo.type === 'radio';
}

function guardar() {
  const valores = [];
  campos.forEach(function (campo) {
    valores.push(esCasilla(campo) ? campo.checked : campo.value);
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
    if (valores[i] === undefined) return;
    if (esCasilla(campo)) {
      campo.checked = valores[i];
    } else {
      campo.value = valores[i];
    }
  });
}

function borrarTodo() {
  try {
    localStorage.removeItem(CLAVE);
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