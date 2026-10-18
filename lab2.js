// ===================================================
// Lab 2: Leyes de Kirchhoff
// Pre-verificación (ecuaciones de malla), mediciones con alerta,
// comparación con lo teórico y LTspice, y envío al registro.
// ===================================================

const POTENCIA_MAX = 0.25; // W, resistores de 1/4 W
const UMBRAL = 10;         // % de error a partir del cual se avisa (definir con la directora)
const CLAVE_EVENTOS = 'eventos-' + location.pathname;
let ultimaComparacion = null; // resultados que se envían al registro

// Nombre y unidad de cada magnitud que se mide
const MAGNITUDES = {
  I1:  { nombre: 'I<sub>1</sub>',  texto: 'I1',  unidad: 'mA' },
  I2:  { nombre: 'I<sub>2</sub>',  texto: 'I2',  unidad: 'mA' },
  I3:  { nombre: 'I<sub>3</sub>',  texto: 'I3',  unidad: 'mA' },
  VR1: { nombre: 'V<sub>R1</sub>', texto: 'VR1', unidad: 'V' },
  VR2: { nombre: 'V<sub>R2</sub>', texto: 'VR2', unidad: 'V' },
  VR3: { nombre: 'V<sub>R3</sub>', texto: 'VR3', unidad: 'V' },
  VR4: { nombre: 'V<sub>R4</sub>', texto: 'VR4', unidad: 'V' }
};


// ---------- Funciones de ayuda ----------

// Convierte lo que escribió el estudiante en número (acepta coma o punto)
function leerNumero(id) {
  return leerNumeroDe(document.getElementById(id));
}
function leerNumeroDe(campo) {
  const texto = campo.value.trim().replace(',', '.');
  if (texto === '') return NaN;
  return Number(texto);
}

// Escribe un número con coma decimal y los decimales que se pidan
function formato(numero, decimales) {
  return numero.toFixed(decimales).replace('.', ',');
}

// Redondea un número (se envía al registro con punto decimal)
function redondear(numero, decimales) {
  return Number(numero.toFixed(decimales));
}

// Une nombres en una frase: ["R1"] → "R1"; ["R1","R2","R4"] → "R1, R2 y R4"
function lista(nombres) {
  if (nombres.length === 1) return nombres[0];
  return nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1];
}


// ---------- Cálculo del circuito ----------

// Lee V, R1, R2, R3 y R4. Devuelve null si falta algo o no tiene sentido.
function leerCircuito() {
  const c = { V: leerNumero('v'), R1: leerNumero('r1'), R2: leerNumero('r2'), R3: leerNumero('r3'), R4: leerNumero('r4') };
  const valores = [c.V, c.R1, c.R2, c.R3, c.R4];
  for (let i = 0; i < valores.length; i++) {
    if (isNaN(valores[i]) || valores[i] <= 0) return null;
  }
  return c;
}

// Resuelve las ecuaciones de malla, con Ia e Ib en sentido horario:
//   Malla 1:  (R1 + R2)·Ia −           R2·Ib = V
//   Malla 2:       −R2·Ia + (R2 + R3 + R4)·Ib = 0
// En MATLAB sería: A = [R1+R2, -R2; -R2, R2+R3+R4]; b = [V; 0]; x = A\b
// Aquí se usa la regla de Cramer, que sirve para sistemas de 2×2.
function resolverCircuito(c) {
  const a11 = c.R1 + c.R2;
  const a12 = -c.R2;
  const a21 = -c.R2;
  const a22 = c.R2 + c.R3 + c.R4;
  const det = a11 * a22 - a12 * a21;
  const Ia = (c.V * a22 - a12 * 0) / det;
  const Ib = (a11 * 0 - a21 * c.V) / det;
  const I1 = Ia, I2 = Ia - Ib, I3 = Ib; // corrientes de rama (A)
  return {
    a11: a11, a22: a22,
    I1: I1, I2: I2, I3: I3,
    // Valores teóricos en las mismas unidades de la tabla (mA y V)
    teorico: {
      I1: I1 * 1000, I2: I2 * 1000, I3: I3 * 1000,
      VR1: I1 * c.R1, VR2: I2 * c.R2, VR3: I3 * c.R3, VR4: I3 * c.R4
    }
  };
}


// ---------- 3. Pre-verificación ----------

function verificar() {
  const caja = document.getElementById('resultado-pre');
  caja.hidden = false;

  const c = leerCircuito();
  if (!c) {
    caja.className = 'resultado peligro';
    caja.innerHTML = '<p>Completa los cinco valores con números mayores que cero, por ejemplo 10, 1000, 2200, 1000 y 3300.</p>';
    return;
  }
  const s = resolverCircuito(c);

  // Voltaje y potencia de cada resistor (cada uno es un "objeto", como un struct de MATLAB)
  const resistores = [
    { nombre: 'R<sub>1</sub>', R: c.R1, I: s.I1, corriente: 'I<sub>1</sub>' },
    { nombre: 'R<sub>2</sub>', R: c.R2, I: s.I2, corriente: 'I<sub>2</sub>' },
    { nombre: 'R<sub>3</sub>', R: c.R3, I: s.I3, corriente: 'I<sub>3</sub>' },
    { nombre: 'R<sub>4</sub>', R: c.R4, I: s.I3, corriente: 'I<sub>3</sub>' }
  ];
  let filas = '';
  let peor = resistores[0];
  const excedidos = []; // los que pasan de 0,25 W
  const calientes = []; // los que pasan del 50 % de 0,25 W
  resistores.forEach(function (r) {
    r.V = r.I * r.R;
    r.P = r.I * r.I * r.R;
    if (r.P > peor.P) peor = r;
    if (r.P > POTENCIA_MAX) {
      excedidos.push(r.nombre);
    } else if (r.P > POTENCIA_MAX / 2) {
      calientes.push(r.nombre);
    }
    filas +=
      '<tr>' +
        '<td>' + r.nombre + ' (' + r.corriente + ')</td>' +
        '<td>' + formato(r.I * 1000, 2) + '&nbsp;mA</td>' +
        '<td>' + formato(r.V, 2) + '&nbsp;V</td>' +
        '<td>' + formato(r.P * 1000, 1) + '&nbsp;mW</td>' +
      '</tr>';
  });

  let estado;
  let mensaje;
  if (excedidos.length > 0) {
    estado = 'peligro';
    mensaje = 'No enciendas la fuente: ' + lista(excedidos) +
      (excedidos.length > 1 ? ' se van' : ' se va') +
      ' a sobrecalentar. Baja el voltaje o usa resistencias mayores.';
  } else if (calientes.length > 0) {
    estado = 'precaucion';
    mensaje = 'Puedes medir, pero ' + lista(calientes) +
      (calientes.length > 1 ? ' se van' : ' se va') +
      ' a calentar. Mide rápido o baja el voltaje.';
  } else {
    estado = 'ok';
    mensaje = 'Valores seguros. Puedes armar el circuito.';
  }

  caja.className = 'resultado ' + estado;
  caja.innerHTML =
    '<p><strong>' + mensaje + '</strong></p>' +
    '<p>Ecuaciones de malla (I<sub>a</sub> e I<sub>b</sub> en sentido horario):</p>' +
    '<div class="ecuaciones">' +
      'Malla 1: ' + formato(s.a11, 0) + '·I<sub>a</sub> − ' + formato(c.R2, 0) + '·I<sub>b</sub> = ' + formato(c.V, 1) + '<br>' +
      'Malla 2: −' + formato(c.R2, 0) + '·I<sub>a</sub> + ' + formato(s.a22, 0) + '·I<sub>b</sub> = 0' +
    '</div>' +
    '<div class="tabla-scroll"><table>' +
      '<tr><th>Resistor</th><th>Corriente</th><th>Voltaje</th><th>Potencia</th></tr>' +
      filas +
    '</table></div>' +
    '<p>Mayor potencia: ' + peor.nombre + ', ' + formato(peor.P / POTENCIA_MAX * 100, 0) + '&nbsp;% de 0,25&nbsp;W.</p>' +
    '<p>Comprobación LKC en el nodo A: I<sub>1</sub> = I<sub>2</sub> + I<sub>3</sub> → ' +
      formato(s.I1 * 1000, 2) + ' = ' + formato(s.I2 * 1000, 2) + ' + ' + formato(s.I3 * 1000, 2) + '&nbsp;mA</p>';
}


// ---------- 5. Mediciones con alerta ----------

const medidas = document.querySelectorAll('.medida');   // lo que marca el multímetro
const simulados = document.querySelectorAll('.sim');    // lo que dio LTspice

// Guarda en el dispositivo cuándo aparece y cuándo se corrige cada alerta
// (sirve para el tiempo de detección de fallas)
function registrarEvento(tipo, magnitud) {
  let eventos = [];
  try {
    eventos = JSON.parse(localStorage.getItem(CLAVE_EVENTOS)) || [];
  } catch (error) {
    eventos = [];
  }
  eventos.push({ tipo: tipo, magnitud: magnitud, hora: new Date().toISOString() });
  try {
    localStorage.setItem(CLAVE_EVENTOS, JSON.stringify(eventos));
  } catch (error) {}
}

// Devuelve los valores teóricos, o null si la pre-verificación está incompleta
function valoresTeoricos() {
  const c = leerCircuito();
  return c ? resolverCircuito(c).teorico : null;
}

// Revisa una fila: muestra el valor teórico, el error y el aviso
function revisarFila(campo, registrar) {
  const fila = campo.closest('tr');
  const mag = campo.dataset.mag;
  const celdaTeo = fila.querySelector('.teo');
  const celdaError = fila.querySelector('.error');
  const estabaEnAlerta = fila.classList.contains('alerta');
  const teo = valoresTeoricos();

  if (!teo) {
    celdaTeo.textContent = 'teórico: —';
    celdaError.textContent = '—';
    fila.classList.remove('alerta');
    return;
  }
  celdaTeo.textContent = 'teórico: ' + formato(teo[mag], 2);

  const medida = leerNumeroDe(campo);
  if (isNaN(medida)) {
    celdaError.textContent = '—';
    fila.classList.remove('alerta');
    return;
  }

  const error = Math.abs(medida - teo[mag]) / teo[mag] * 100;
  if (error > UMBRAL) {
    celdaError.innerHTML = '<span class="chip mal">' + formato(error, 1) + '&nbsp;%</span>';
    fila.classList.add('alerta');
    if (registrar && !estabaEnAlerta) registrarEvento('alerta', mag);
  } else {
    celdaError.innerHTML = '<span class="chip bien">' + formato(error, 1) + '&nbsp;%</span>';
    fila.classList.remove('alerta');
    if (registrar && estabaEnAlerta) registrarEvento('corregido', mag);
  }
}

// Muestra el consejo debajo de las tablas si alguna fila está en alerta
function mostrarAvisoMediciones() {
  const hayAlerta = document.querySelector('#mediciones tr.alerta') !== null;
  document.getElementById('aviso-mediciones').hidden = !hayAlerta;
}


// ---------- 6. Comparación ----------

// Busca el valor escrito para una magnitud (en las medidas o en LTspice)
function valorDe(grupo, mag) {
  let valor = NaN;
  grupo.forEach(function (campo) {
    if (campo.dataset.mag === mag) valor = leerNumeroDe(campo);
  });
  return valor;
}

// Arma una línea de comprobación de una ley de Kirchhoff
function lineaLey(titulo, textoIzq, izq, textoDer, der, unidad) {
  const dif = Math.abs(izq - der) / Math.abs(izq) * 100;
  const chip = dif <= UMBRAL ? 'bien' : 'mal';
  return {
    dif: dif,
    html:
      '<li><span>' + titulo + '</span>' +
      '<span>' + textoIzq + ' = ' + formato(izq, 2) + '&nbsp;' + unidad + ' · ' +
      textoDer + ' = ' + formato(der, 2) + '&nbsp;' + unidad + '</span>' +
      '<span class="chip ' + chip + '">diferencia ' + formato(dif, 1) + '&nbsp;%</span></li>'
  };
}

function actualizarComparacion() {
  const resumen = document.getElementById('resumen-comparacion');
  const c = leerCircuito();
  const teo = c ? resolverCircuito(c).teorico : null;

  // Errores de cada medición frente a lo teórico y frente a LTspice
  const errores = [];
  const erroresSim = [];
  Object.keys(MAGNITUDES).forEach(function (mag) {
    const med = valorDe(medidas, mag);
    const sim = valorDe(simulados, mag);
    if (teo && !isNaN(med)) errores.push({ mag: mag, error: Math.abs(med - teo[mag]) / teo[mag] * 100 });
    if (!isNaN(med) && !isNaN(sim) && sim !== 0) erroresSim.push(Math.abs(med - sim) / Math.abs(sim) * 100);
  });

  if (!teo || errores.length < 2) {
    resumen.innerHTML = '<p>Completa la pre-verificación y al menos dos mediciones para ver la comparación.</p>';
    ultimaComparacion = null;
    return;
  }

  let suma = 0;
  let peor = errores[0];
  errores.forEach(function (e) {
    suma += e.error;
    if (e.error > peor.error) peor = e;
  });
  const promedio = suma / errores.length;
  let promedioSim = null;
  if (erroresSim.length > 0) {
    promedioSim = erroresSim.reduce(function (a, b) { return a + b; }, 0) / erroresSim.length;
  }

  // Leyes de Kirchhoff con los valores medidos
  const m = {};
  Object.keys(MAGNITUDES).forEach(function (mag) { m[mag] = valorDe(medidas, mag); });
  const leyes = [];
  let lkc = null, lkv1 = null, lkv2 = null;
  if (!isNaN(m.I1) && !isNaN(m.I2) && !isNaN(m.I3)) {
    lkc = lineaLey('LKC en el nodo A', 'I<sub>1</sub>', m.I1, 'I<sub>2</sub> + I<sub>3</sub>', m.I2 + m.I3, 'mA');
    leyes.push(lkc.html);
  }
  if (!isNaN(m.VR1) && !isNaN(m.VR2)) {
    lkv1 = lineaLey('LKV en la malla 1', 'V', c.V, 'V<sub>R1</sub> + V<sub>R2</sub>', m.VR1 + m.VR2, 'V');
    leyes.push(lkv1.html);
  }
  if (!isNaN(m.VR2) && !isNaN(m.VR3) && !isNaN(m.VR4)) {
    lkv2 = lineaLey('LKV en la malla 2', 'V<sub>R2</sub>', m.VR2, 'V<sub>R3</sub> + V<sub>R4</sub>', m.VR3 + m.VR4, 'V');
    leyes.push(lkv2.html);
  }

  ultimaComparacion = {
    promedio: promedio, maximo: peor.error, promedioSim: promedioSim,
    lkc: lkc ? lkc.dif : null, lkv1: lkv1 ? lkv1.dif : null, lkv2: lkv2 ? lkv2.dif : null
  };

  resumen.innerHTML =
    '<ul class="indicadores">' +
      '<li><span>Error promedio frente a lo teórico</span><strong>' + formato(promedio, 1) + '&nbsp;%</strong></li>' +
      '<li><span>Error máximo (' + MAGNITUDES[peor.mag].nombre + ')</span><strong>' + formato(peor.error, 1) + '&nbsp;%</strong></li>' +
      '<li><span>Error promedio frente a LTspice</span><strong>' +
        (promedioSim === null ? '—' : formato(promedioSim, 1) + '&nbsp;%') + '</strong></li>' +
    '</ul>' +
    (leyes.length > 0
      ? '<p class="tabla-titulo">Leyes de Kirchhoff con tus mediciones</p><ul class="leyes">' + leyes.join('') + '</ul>'
      : '<p class="nota">Mide las tres corrientes o los voltajes de una malla para comprobar las leyes de Kirchhoff.</p>');
}

// Revisa todas las filas y la comparación (sin registrar eventos)
function revisarTodo() {
  medidas.forEach(function (campo) { revisarFila(campo, false); });
  mostrarAvisoMediciones();
  actualizarComparacion();
}


// ---------- 7. Enviar resultados ----------

// Resume las alertas guardadas: cuántas hubo, cuántas se corrigieron
// y cuánto se tardó en promedio en corregirlas (en segundos)
function resumenAlertas() {
  let eventos = [];
  try {
    eventos = JSON.parse(localStorage.getItem(CLAVE_EVENTOS)) || [];
  } catch (error) {
    eventos = [];
  }
  let alertas = 0, corregidas = 0, sumaSegundos = 0;
  const abiertas = {}; // magnitud -> hora de la alerta que aún no se corrige
  eventos.forEach(function (ev) {
    if (ev.tipo === 'alerta') {
      alertas++;
      abiertas[ev.magnitud] = new Date(ev.hora);
    } else if (ev.tipo === 'corregido' && abiertas[ev.magnitud]) {
      corregidas++;
      sumaSegundos += (new Date(ev.hora) - abiertas[ev.magnitud]) / 1000;
      delete abiertas[ev.magnitud];
    }
  });
  return { alertas: alertas, corregidas: corregidas, tiempoMedio: corregidas > 0 ? redondear(sumaSegundos / corregidas, 1) : '' };
}

// Reúne todo lo que se envía al registro
function recogerDatos(grupo) {
  const c = leerCircuito();
  const casillas = document.querySelectorAll('#montaje input[type="checkbox"]');
  let marcadas = 0;
  casillas.forEach(function (caja) { if (caja.checked) marcadas++; });

  const primera = document.querySelector('input[name="primera"]:checked');
  let primeraVez = 'Sin responder';
  if (primera) primeraVez = primera.value === 'si' ? 'Sí' : 'No';

  // Mediciones como texto: "I1: 4,05 mA (LTspice 4,07); ..." y al final las leyes
  const partes = [];
  Object.keys(MAGNITUDES).forEach(function (mag) {
    const med = valorDe(medidas, mag);
    const sim = valorDe(simulados, mag);
    if (isNaN(med)) return;
    let texto = MAGNITUDES[mag].texto + ': ' + formato(med, 2) + ' ' + MAGNITUDES[mag].unidad;
    if (!isNaN(sim)) texto += ' (LTspice ' + formato(sim, 2) + ')';
    partes.push(texto);
  });
  const u = ultimaComparacion;
  if (u.lkc !== null) partes.push('LKC dif ' + formato(u.lkc, 1) + ' %');
  if (u.lkv1 !== null) partes.push('LKV1 dif ' + formato(u.lkv1, 1) + ' %');
  if (u.lkv2 !== null) partes.push('LKV2 dif ' + formato(u.lkv2, 1) + ' %');
  if (u.promedioSim !== null) partes.push('Error vs LTspice ' + formato(u.promedioSim, 1) + ' %');

  const alertas = resumenAlertas();
  return {
    grupo: grupo,
    laboratorio: 'Lab 2 - Leyes de Kirchhoff',
    voltaje: c.V,
    resistencia: 'R1=' + c.R1 + '; R2=' + c.R2 + '; R3=' + c.R3 + '; R4=' + c.R4,
    chequeo: marcadas + ' de ' + casillas.length,
    primeraVez: primeraVez,
    mediciones: partes.join('; '),
    errorPromedio: redondear(u.promedio, 2),
    errorMaximo: redondear(u.maximo, 2),
    rExperimental: '',
    alertas: alertas.alertas,
    corregidas: alertas.corregidas,
    tiempoMedio: alertas.tiempoMedio
  };
}


// ---------- Conectar todo con la página ----------

// Botón "Calcular" de la pre-verificación
document.getElementById('btn-verificar').addEventListener('click', function () {
  verificar();
  revisarTodo();
});

// Si cambia algún valor de la pre-verificación, se recalcula la tabla
['v', 'r1', 'r2', 'r3', 'r4'].forEach(function (id) {
  document.getElementById(id).addEventListener('change', revisarTodo);
});

// Al terminar de escribir una medición, se revisa esa fila
medidas.forEach(function (campo) {
  campo.addEventListener('change', function () {
    revisarFila(campo, true);
    mostrarAvisoMediciones();
    actualizarComparacion();
  });
});

// Los valores de LTspice solo cambian la comparación
simulados.forEach(function (campo) {
  campo.addEventListener('change', actualizarComparacion);
});

// Después de "Borrar mis datos", se limpia también la tabla
document.getElementById('borrar-datos').addEventListener('click', function () {
  setTimeout(revisarTodo, 0);
});

// Botón "Enviar resultados"
document.getElementById('btn-enviar').addEventListener('click', function () {
  const grupo = document.getElementById('grupo').value.trim().toUpperCase();
  if (grupo === '') {
    mostrarEstadoEnvio('Escribe el código de tu grupo antes de enviar.', 'mal');
    return;
  }
  if (!ultimaComparacion) {
    mostrarEstadoEnvio('Completa la pre-verificación y al menos dos mediciones antes de enviar.', 'mal');
    return;
  }
  enviarRegistro(recogerDatos(grupo));
});

// Al abrir la página, muestra lo que había guardado
if (leerCircuito()) verificar();
revisarTodo();