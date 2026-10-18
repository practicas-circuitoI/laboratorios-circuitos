// ===================================================
// Lab 1: pre-verificación de la Ley de Ohm
// Lee el voltaje y la resistencia, calcula corriente y potencia,
// y avisa si el resistor se va a sobrecalentar.
// ===================================================

const POTENCIA_MAX = 0.25; // W, resistor de 1/4 W (como una constante en MATLAB)

// Convierte lo que escribió el estudiante en número.
// Acepta coma o punto decimal: "4,5" y "4.5" valen lo mismo.
function leerNumero(id) {
  const texto = document.getElementById(id).value.trim().replace(',', '.');
  if (texto === '') return NaN;
  return Number(texto);
}

// Escribe un número con coma decimal y los decimales que se pidan
function formato(numero, decimales) {
  return numero.toFixed(decimales).replace('.', ',');
}

function verificar() {
  const V = leerNumero('voltaje');
  const R = leerNumero('resistencia');
  const caja = document.getElementById('resultado-pre');
  caja.hidden = false;

  // 1. Revisar que los datos tengan sentido
  if (isNaN(V) || isNaN(R)) {
    caja.className = 'resultado peligro';
    caja.innerHTML = '<p>Escribe el voltaje y la resistencia con números, por ejemplo 5 y 1000.</p>';
    return;
  }
  if (V <= 0 || R <= 0) {
    caja.className = 'resultado peligro';
    caja.innerHTML = '<p>El voltaje y la resistencia deben ser mayores que cero.</p>';
    return;
  }

  // 2. Calcular, igual que en MATLAB
  const I = V / R;                          // corriente (A)
  const P = V * I;                          // potencia (W)
  const Vmax = Math.sqrt(POTENCIA_MAX * R); // voltaje máximo seguro (V)
  const porcentaje = P / POTENCIA_MAX * 100;

  // 3. Elegir el mensaje según qué tan cerca está del límite
  let estado;
  let mensaje;
  if (P > POTENCIA_MAX) {
    estado = 'peligro';
    mensaje = 'No enciendas la fuente: el resistor se va a sobrecalentar. Baja el voltaje.';
  } else if (porcentaje > 50) {
    estado = 'precaucion';
    mensaje = 'Puedes medir, pero el resistor se va a calentar. Mide rápido o baja el voltaje.';
  } else {
    estado = 'ok';
    mensaje = 'Valores seguros. Puedes armar el circuito.';
  }

  // 4. Mostrar el resultado en la página (&nbsp; evita que la unidad quede sola en otra línea)
  caja.className = 'resultado ' + estado;
  caja.innerHTML =
    '<p><strong>' + mensaje + '</strong></p>' +
    '<ul>' +
      '<li>Corriente esperada: ' + formato(I * 1000, 2) + '&nbsp;mA</li>' +
      '<li>Potencia en el resistor: ' + formato(P, 3) + '&nbsp;W (' + formato(porcentaje, 0) + '&nbsp;% de 0,25&nbsp;W)</li>' +
      '<li>Voltaje máximo seguro con ' + formato(R, 0) + '&nbsp;Ω: ' + formato(Vmax, 1) + '&nbsp;V</li>' +
    '</ul>';
}

// Al hacer clic en "Verificar", se ejecuta verificar()
document.getElementById('btn-verificar').addEventListener('click', verificar);

// Si al abrir la página ya había datos guardados, muestra el resultado de una vez
if (document.getElementById('voltaje').value && document.getElementById('resistencia').value) {
  verificar();
}


// ===================================================
// Etapa 5: mediciones con alerta y comparación
// ===================================================

const UMBRAL = 10; // % de error a partir del cual se avisa (definir con la directora)
const CLAVE_EVENTOS = 'eventos-' + location.pathname;
const medidas = document.querySelectorAll('.medida');
let grafica = null;
let ultimaComparacion = null; // resultados que se envían al registro

// Guarda en el dispositivo cuándo aparece y cuándo se corrige cada alerta.
// Con esto se calculará el tiempo de detección de fallas (indicador de la tesis).
function registrarEvento(tipo, voltaje) {
  let eventos = [];
  try {
    eventos = JSON.parse(localStorage.getItem(CLAVE_EVENTOS)) || [];
  } catch (error) {
    eventos = [];
  }
  eventos.push({ tipo: tipo, voltaje: voltaje, hora: new Date().toISOString() });
  try {
    localStorage.setItem(CLAVE_EVENTOS, JSON.stringify(eventos));
  } catch (error) {}
}

// Revisa una fila: calcula la corriente teórica, el error y muestra el aviso
function revisarFila(campo, registrar) {
  const fila = campo.closest('tr');
  const celdaTeorica = fila.querySelector('.teorica');
  const celdaError = fila.querySelector('.error');
  const V = Number(campo.dataset.v);
  const R = leerNumero('resistencia');
  const estabaEnAlerta = fila.classList.contains('alerta');

  // Sin resistencia no hay corriente teórica
  if (isNaN(R) || R <= 0) {
    celdaTeorica.textContent = '—';
    celdaError.textContent = '—';
    fila.classList.remove('alerta');
    return;
  }
  const teorica = V / R * 1000; // mA
  celdaTeorica.textContent = formato(teorica, 2);

  // Sin medición todavía
  const medida = leerNumeroDe(campo);
  if (isNaN(medida)) {
    celdaError.textContent = '—';
    fila.classList.remove('alerta');
    return;
  }

  // Error porcentual entre lo medido y lo teórico
  const error = Math.abs(medida - teorica) / teorica * 100;
  if (error > UMBRAL) {
    celdaError.innerHTML = '<span class="chip mal">' + formato(error, 1) + '&nbsp;%</span>';
    fila.classList.add('alerta');
    if (registrar && !estabaEnAlerta) registrarEvento('alerta', V);
  } else {
    celdaError.innerHTML = '<span class="chip bien">' + formato(error, 1) + '&nbsp;%</span>';
    fila.classList.remove('alerta');
    if (registrar && estabaEnAlerta) registrarEvento('corregido', V);
  }
}

// Igual que leerNumero, pero recibe el campo en vez de su id
function leerNumeroDe(campo) {
  const texto = campo.value.trim().replace(',', '.');
  if (texto === '') return NaN;
  return Number(texto);
}

// Calcula los indicadores de la comparación y dibuja la gráfica V–I
function actualizarComparacion() {
  const R = leerNumero('resistencia');
  const resumen = document.getElementById('resumen-comparacion');
  const cajaGrafica = document.getElementById('caja-grafica');

  // Reunir las mediciones escritas
  const puntos = [];  // cada punto: { x: corriente en mA, y: voltaje en V }
  medidas.forEach(function (campo) {
    const medida = leerNumeroDe(campo);
    if (!isNaN(medida)) puntos.push({ x: medida, y: Number(campo.dataset.v) });
  });

  if (isNaN(R) || R <= 0 || puntos.length < 2) {
    resumen.innerHTML = '<p>Escribe la resistencia en la pre-verificación y al menos dos mediciones para ver la comparación.</p>';
    cajaGrafica.hidden = true;
    ultimaComparacion = null;
    return;
  }

  // Error promedio y máximo
  let suma = 0;
  let maximo = 0;
  let vMaximo = 0;
  puntos.forEach(function (p) {
    const teorica = p.y / R * 1000;
    const error = Math.abs(p.x - teorica) / teorica * 100;
    suma += error;
    if (error > maximo) {
      maximo = error;
      vMaximo = p.y;
    }
  });
  const promedio = suma / puntos.length;

  // Resistencia experimental: pendiente de la recta V–I por mínimos cuadrados
  // (lo mismo que polyfit(I, V, 1) en MATLAB)
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  const n = puntos.length;
  puntos.forEach(function (p) {
    const I = p.x / 1000; // A
    sx += I;
    sy += p.y;
    sxy += I * p.y;
    sxx += I * I;
  });
  const Rexp = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  ultimaComparacion = { promedio: promedio, maximo: maximo, Rexp: isFinite(Rexp) ? Rexp : null };
  const textoRexp = isFinite(Rexp) ? formato(Rexp, 0) + '&nbsp;Ω' : '—';
  const textoDif = isFinite(Rexp) ? formato(Math.abs(Rexp - R) / R * 100, 1) + '&nbsp;%' : '—';

  resumen.innerHTML =
    '<ul class="indicadores">' +
      '<li><span>Error promedio</span><strong>' + formato(promedio, 1) + '&nbsp;%</strong></li>' +
      '<li><span>Error máximo (a ' + vMaximo + '&nbsp;V)</span><strong>' + formato(maximo, 1) + '&nbsp;%</strong></li>' +
      '<li><span>R experimental (pendiente V–I)</span><strong>' + textoRexp + '</strong></li>' +
      '<li><span>Diferencia con ' + formato(R, 0) + '&nbsp;Ω</span><strong>' + textoDif + '</strong></li>' +
    '</ul>';

  // Gráfica (necesita la librería Chart.js, que se carga de internet)
  cajaGrafica.hidden = false;
  if (typeof Chart === 'undefined') {
    cajaGrafica.innerHTML = '<p class="nota">La gráfica necesita internet para cargarse.</p>';
    return;
  }
  const vMax = Math.max.apply(null, puntos.map(function (p) { return p.y; }));
  const linea = [{ x: 0, y: 0 }, { x: vMax / R * 1000, y: vMax }];

  if (grafica) {
    grafica.data.datasets[0].data = puntos;
    grafica.data.datasets[1].data = linea;
    grafica.update();
    return;
  }
  const estilo = getComputedStyle(document.body);
  Chart.defaults.font.family = estilo.fontFamily;
  Chart.defaults.color = '#4a5164';
  grafica = new Chart(document.getElementById('grafica-vi'), {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Medido',
          data: puntos,
          backgroundColor: estilo.getPropertyValue('--color').trim(),
          borderColor: '#ffffff',
          borderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8
        },
        {
          label: 'Teórico (V = I·R)',
          data: linea,
          type: 'line',
          borderColor: '#7a8194',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { beginAtZero: true, title: { display: true, text: 'Corriente (mA)' }, grid: { color: '#eef0f4' } },
        y: { beginAtZero: true, title: { display: true, text: 'Voltaje (V)' }, grid: { color: '#eef0f4' } }
      },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              return ctx.dataset.label + ': ' + formato(ctx.parsed.x, 2) + ' mA, ' + formato(ctx.parsed.y, 1) + ' V';
            }
          }
        }
      }
    }
  });
}

// Revisa toda la tabla y la comparación (sin registrar eventos)
function revisarTodo() {
  medidas.forEach(function (campo) { revisarFila(campo, false); });
  mostrarAvisoMediciones();
  actualizarComparacion();
}

// Muestra el consejo debajo de la tabla si alguna fila está en alerta
function mostrarAvisoMediciones() {
  const hayAlerta = document.querySelector('.tabla-mediciones tr.alerta') !== null;
  document.getElementById('aviso-mediciones').hidden = !hayAlerta;
}

// Cuando el estudiante termina de escribir una medición, se revisa esa fila
medidas.forEach(function (campo) {
  campo.addEventListener('change', function () {
    revisarFila(campo, true);
    mostrarAvisoMediciones();
    actualizarComparacion();
  });
});

// Si cambia la resistencia o se presiona Verificar, se recalcula todo
document.getElementById('resistencia').addEventListener('change', revisarTodo);
document.getElementById('btn-verificar').addEventListener('click', revisarTodo);

// Después de "Borrar mis datos", se limpia también la tabla y la gráfica
document.getElementById('borrar-datos').addEventListener('click', function () {
  setTimeout(revisarTodo, 0);
});

// Al abrir la página, revisa lo que había guardado
revisarTodo();


// ===================================================
// Etapa 7: enviar los resultados al registro (Google Sheets)
// ===================================================

// Redondea un número a los decimales indicados (se envía con punto decimal)
function redondear(numero, decimales) {
  return Number(numero.toFixed(decimales));
}

// Resume las alertas guardadas: cuántas hubo, cuántas se corrigieron
// y cuánto se tardó en promedio en corregirlas (en segundos)
function resumenAlertas() {
  let eventos = [];
  try {
    eventos = JSON.parse(localStorage.getItem(CLAVE_EVENTOS)) || [];
  } catch (error) {
    eventos = [];
  }
  let alertas = 0;
  let corregidas = 0;
  let sumaSegundos = 0;
  const abiertas = {}; // voltaje -> hora de la alerta que aún no se corrige
  eventos.forEach(function (ev) {
    if (ev.tipo === 'alerta') {
      alertas++;
      abiertas[ev.voltaje] = new Date(ev.hora);
    } else if (ev.tipo === 'corregido' && abiertas[ev.voltaje]) {
      corregidas++;
      sumaSegundos += (new Date(ev.hora) - abiertas[ev.voltaje]) / 1000;
      delete abiertas[ev.voltaje];
    }
  });
  return {
    alertas: alertas,
    corregidas: corregidas,
    tiempoMedio: corregidas > 0 ? redondear(sumaSegundos / corregidas, 1) : ''
  };
}

// Reúne todo lo que se envía al registro
function recogerDatos(grupo) {
  const casillas = document.querySelectorAll('#montaje input[type="checkbox"]');
  let marcadas = 0;
  casillas.forEach(function (c) { if (c.checked) marcadas++; });

  const primera = document.querySelector('input[name="primera"]:checked');
  let primeraVez = 'Sin responder';
  if (primera) primeraVez = primera.value === 'si' ? 'Sí' : 'No';

  const textoMediciones = [];
  medidas.forEach(function (campo) {
    if (campo.value.trim() !== '') textoMediciones.push(campo.dataset.v + ' V: ' + campo.value.trim() + ' mA');
  });

  const alertas = resumenAlertas();
  return {
    grupo: grupo,
    laboratorio: 'Lab 1 - Ley de Ohm',
    voltaje: leerNumero('voltaje'),
    resistencia: leerNumero('resistencia'),
    chequeo: marcadas + ' de ' + casillas.length,
    primeraVez: primeraVez,
    mediciones: textoMediciones.join('; '),
    errorPromedio: redondear(ultimaComparacion.promedio, 2),
    errorMaximo: redondear(ultimaComparacion.maximo, 2),
    rExperimental: ultimaComparacion.Rexp === null ? '' : redondear(ultimaComparacion.Rexp, 1),
    alertas: alertas.alertas,
    corregidas: alertas.corregidas,
    tiempoMedio: alertas.tiempoMedio
  };
}

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
