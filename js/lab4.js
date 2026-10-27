// ===================================================
// Lab 4: Uso del osciloscopio y análisis en AC (Práctica IV)
// Circuito: R1‖C1 en serie con R2‖C2; Vout se toma sobre R2‖C2.
// Cálculo teórico (Tablas 1 y 2), mediciones con alerta y diagnóstico,
// comparación con LTspice (Tabla 9), gráficas y envío al registro.
// ===================================================

const UMBRAL = 10;          // % de error en Vout/Vin (criterio de la guía)
const UMBRAL_FASE = 5;      // grados de diferencia en la fase para avisar (definir con la directora)
const FRECUENCIAS = [2460, 24600, 246000];  // Hz, las tres de la guía
const F_TABLA1 = 24600;                      // Hz, frecuencia de la Tabla 1
const CLAVE_EVENTOS = 'eventos-' + location.pathname;
const filas = document.querySelectorAll('#tabla-ac tr[data-f]');
let ultimaComparacion = null; // resultados que se envían al registro
let graficaGanancia = null;
let graficaFase = null;


// ---------- Ayudas para leer y escribir números ----------

// Convierte lo que escribió el estudiante en número (acepta coma o punto)
function leerNumero(id) {
  return leerNumeroDe(document.getElementById(id));
}
function leerNumeroDe(campo) {
  const texto = campo.value.trim().replace(',', '.');
  if (texto === '') return NaN;
  return Number(texto);
}

// Número con coma decimal y signo menos tipográfico: -48.3141 → "−48,314"
function formato(numero, decimales) {
  return numero.toFixed(decimales).replace('.', ',').replace('-', '−');
}

// Frecuencia legible: 2460 → "2,46 kHz", 246000 → "246 kHz", 1e6 → "1 MHz"
function formatoFrecuencia(f) {
  let valor = f, unidad = 'Hz';
  if (f >= 1e6) { valor = f / 1e6; unidad = 'MHz'; }
  else if (f >= 1000) { valor = f / 1000; unidad = 'kHz'; }
  let texto = valor.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return texto.replace('.', ',') + '\u00a0' + unidad;
}

function redondear(numero, decimales) {
  return Number(numero.toFixed(decimales));
}


// ---------- Números complejos (como en MATLAB: abs y angle) ----------
// Cada número complejo es un objeto con parte real (re) e imaginaria (im)

function complejo(re, im) { return { re: re, im: im }; }
function sumar(a, b) { return complejo(a.re + b.re, a.im + b.im); }
function restar(a, b) { return complejo(a.re - b.re, a.im - b.im); }
function multiplicar(a, b) { return complejo(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re); }
function dividir(a, b) {
  const d = b.re * b.re + b.im * b.im;
  return complejo((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
}
function magnitud(z) { return Math.hypot(z.re, z.im); }                        // abs(z)
function anguloGrados(z) { return Math.atan2(z.im, z.re) * 180 / Math.PI; }   // angle(z) en grados

// Forma rectangular: "976,7 − j151,0"
function textoRectangular(z, decimales) {
  return formato(z.re, decimales) + (z.im < 0 ? '&nbsp;−&nbsp;j' : '&nbsp;+&nbsp;j') + formato(Math.abs(z.im), decimales);
}
// Forma polar: "988,3 ∠ −8,788°"
function textoPolar(z, decimales) {
  return formato(magnitud(z), decimales) + '&nbsp;∠&nbsp;' + formato(anguloGrados(z), 3) + '°';
}


// ---------- El circuito ----------

// Lee R1, C1, R2 y C2 (los capacitores en nF). Devuelve null si falta algo.
function leerComponentes() {
  const R1 = leerNumero('r1'), C1 = leerNumero('c1');
  const R2 = leerNumero('r2'), C2 = leerNumero('c2');
  if (!(R1 > 0) || !(C1 > 0) || !(R2 > 0) || !(C2 > 0)) return null;
  return { R1: R1, C1: C1 * 1e-9, R2: R2, C2: C2 * 1e-9, C1nF: C1, C2nF: C2 };
}

// Impedancia de un resistor en paralelo con un capacitor: Z = R / (1 + jωRC)
function paralelo(R, C, f) {
  return dividir(complejo(R, 0), complejo(1, 2 * Math.PI * f * R * C));
}

// Divisor de tensión con impedancias: Vout/Vin = Z2 / (Z1 + Z2)
function respuesta(f, c) {
  const Z1 = paralelo(c.R1, c.C1, f);
  const Z2 = paralelo(c.R2, c.C2, f);
  const Zeq = sumar(Z1, Z2);
  const H = dividir(Z2, Zeq);
  return { Z1: Z1, Z2: Z2, Zeq: Zeq, H: H, ganancia: magnitud(H), fase: anguloGrados(H) };
}

// Retraso esperado en µs a partir de la fase (positivo = Vout atrasada)
function retrasoMicro(fase, f) {
  return -fase / (360 * f) * 1e6;
}


// ---------- 3. Cálculo teórico (Tablas 1 y 2) ----------

// Dibuja una flecha de (x1, y1) a (x2, y2) para el diagrama fasorial
function flecha(x1, y1, x2, y2, color) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const largo = 11;
  const p1 = (x2 - largo * Math.cos(ang - 0.4)) + ',' + (y2 - largo * Math.sin(ang - 0.4));
  const p2 = (x2 - largo * Math.cos(ang + 0.4)) + ',' + (y2 - largo * Math.sin(ang + 0.4));
  const xf = x2 - 8 * Math.cos(ang);
  const yf = y2 - 8 * Math.sin(ang);
  return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + xf + '" y2="' + yf + '" stroke="' + color + '" stroke-width="3"/>' +
         '<polygon points="' + x2 + ',' + y2 + ' ' + p1 + ' ' + p2 + '" fill="' + color + '"/>';
}

// Diagrama fasorial: Vin en el eje, Vout desde el origen y VZ1 desde la punta de Vout hasta la de Vin
function diagramaFasorial(Vin, Vout) {
  const escala = 270 / magnitud(Vin);                    // Vin mide 270 píxeles
  const arriba = Math.max(0, Vout.im) * escala;           // cuánto sube Vout sobre el eje
  const abajo = Math.max(0, -Vout.im) * escala;           // cuánto baja Vout bajo el eje
  const ox = 24, oy = 28 + arriba;                        // origen
  const alto = oy + abajo + 34;
  const xs = ox + escala * Vin.re, ys = oy;
  const xo = ox + escala * Vout.re, yo = oy - escala * Vout.im;
  const theta = Math.atan2(Vout.im, Vout.re);
  const colorVin = '#1d2230', colorVout = '#1d63c4', colorZ1 = '#c9600f';

  // Ángulo de Vout marcado con un arco en el origen
  const radio = 46;
  const arco = 'M' + (ox + radio) + ' ' + oy + ' A' + radio + ' ' + radio + ' 0 0 ' + (theta < 0 ? 1 : 0) + ' ' +
               (ox + radio * Math.cos(theta)) + ' ' + (oy - radio * Math.sin(theta));
  const xa = ox + (radio + 10) * Math.cos(theta / 2);
  const ya = oy - (radio + 10) * Math.sin(theta / 2) + 4;
  const abajoTexto = theta < 0 ? -12 : 20;

  return '<svg class="fasores" viewBox="0 0 330 ' + alto + '" role="img" aria-label="Diagrama fasorial: Vin, Vout y VZ1">' +
    '<line x1="' + ox + '" y1="' + oy + '" x2="316" y2="' + oy + '" stroke="#c9ced9" stroke-width="1"/>' +
    '<path d="' + arco + '" fill="none" stroke="#7a8194" stroke-width="1.5"/>' +
    '<text x="' + xa + '" y="' + ya + '" fill="#4a5164" font-size="12">' + formato(theta * 180 / Math.PI, 3) + '°</text>' +
    flecha(ox, oy, xs, ys, colorVin) +
    flecha(ox, oy, xo, yo, colorVout) +
    flecha(xo, yo, xs, ys, colorZ1) +
    '<text x="' + (ox + xs) / 2 + '" y="' + (oy + abajoTexto) + '" fill="' + colorVin + '" text-anchor="middle">V<tspan dy="4" font-size="11">in</tspan></text>' +
    '<text x="' + ((ox + xo) / 2 - 12) + '" y="' + ((oy + yo) / 2 + 4) + '" fill="' + colorVout + '" text-anchor="end">V<tspan dy="4" font-size="11">out</tspan></text>' +
    '<text x="' + ((xo + xs) / 2 + 10) + '" y="' + ((yo + ys) / 2 + 16) + '" fill="' + colorZ1 + '">V<tspan dy="4" font-size="11">Z1</tspan></text>' +
  '</svg>';
}

function verificar() {
  const caja = document.getElementById('resultado-pre');
  caja.hidden = false;

  const c = leerComponentes();
  const Vpp = leerNumero('vpp');
  if (!c || !(Vpp > 0)) {
    caja.className = 'resultado peligro';
    caja.innerHTML = '<p>Completa los cinco valores con números mayores que cero, por ejemplo 1000, 1, 10000, 10 y 2.</p>';
    return;
  }

  // Tabla 1: análisis a 24,6 kHz con Vin = (Vpp/2)∠0° (amplitud, como en la guía)
  const f = F_TABLA1;
  const w = 2 * Math.PI * f;
  const Xc1 = 1 / (w * c.C1);
  const Xc2 = 1 / (w * c.C2);
  const r = respuesta(f, c);
  const Vin = complejo(Vpp / 2, 0);
  const Vout = multiplicar(Vin, r.H);
  const VZ1 = restar(Vin, Vout);

  const fila1 = function (nombre, valor) { return '<tr><td>' + nombre + '</td><td>' + valor + '</td></tr>'; };
  const impedancia = function (z) { return textoRectangular(z, 1) + ' = ' + textoPolar(z, 1); };

  // Tabla 2: las tres frecuencias
  let filas2 = '';
  FRECUENCIAS.forEach(function (fr) {
    const t = respuesta(fr, c);
    filas2 += '<tr><td>' + formatoFrecuencia(fr) + '</td><td>' + formato(t.ganancia, 4) + '</td><td>' +
              formato(t.fase, 3) + '</td><td>' + formato(t.ganancia * Vpp, 3) + '</td><td>' +
              formato(retrasoMicro(t.fase, fr), 3) + '</td></tr>';
  });

  caja.className = 'resultado ok';
  caja.innerHTML =
    '<p><strong>Tabla 1. Resultados teóricos a ' + formatoFrecuencia(f) + '</strong> (V<sub>in</sub> = ' +
       formato(Vpp / 2, 3) + '&nbsp;∠&nbsp;0°&nbsp;V)</p>' +
    '<div class="tabla-scroll"><table>' +
      '<tr><th>Magnitud</th><th>Resultado</th></tr>' +
      fila1('X<sub>C1</sub> (Ω)', formato(Xc1, 1)) +
      fila1('X<sub>C2</sub> (Ω)', formato(Xc2, 1)) +
      fila1('Z<sub>1</sub> (Ω)', impedancia(r.Z1)) +
      fila1('Z<sub>2</sub> (Ω)', impedancia(r.Z2)) +
      fila1('Z<sub>eq</sub> (Ω)', impedancia(r.Zeq)) +
      fila1('Magnitud de V<sub>out</sub> (V)', formato(magnitud(Vout), 4)) +
      fila1('Fase de V<sub>out</sub> (°)', formato(anguloGrados(Vout), 3)) +
      fila1('V<sub>out</sub> pico a pico (V)', formato(2 * magnitud(Vout), 4)) +
    '</table></div>' +
    diagramaFasorial(Vin, Vout) +
    '<p>V<sub>in</sub> = V<sub>Z1</sub> + V<sub>out</sub> como fasores. Ojo: |V<sub>Z1</sub>| + |V<sub>out</sub>| = ' +
       formato(magnitud(VZ1) + magnitud(Vout), 3) + '&nbsp;V, distinto de |V<sub>in</sub>| = ' + formato(Vpp / 2, 3) +
       '&nbsp;V: en AC los voltajes no se suman como números.</p>' +
    '<p><strong>Tabla 2. Respuesta teórica a tres frecuencias</strong></p>' +
    '<div class="tabla-scroll"><table class="tabla-compacta">' +
      '<tr><th>Frec.</th><th>|V<sub>out</sub>/V<sub>in</sub>|</th><th>Fase<br>(°)</th><th>V<sub>out</sub><br>(Vpp)</th><th>Δt<br>(µs)</th></tr>' +
      filas2 +
    '</table></div>' +
    '<p>Las columnas V<sub>out</sub> y Δt son lo que deberías ver en el osciloscopio con ' + formato(Vpp, 2) +
       '&nbsp;Vpp en CH1.</p>';
}


// ---------- 5. Mediciones con alerta y diagnóstico ----------

// Guarda en el dispositivo cuándo aparece y cuándo se corrige cada alerta
// (sirve para el tiempo de detección de fallas, indicador de la tesis)
function registrarEvento(tipo, frecuencia) {
  let eventos = [];
  try {
    eventos = JSON.parse(localStorage.getItem(CLAVE_EVENTOS)) || [];
  } catch (error) {
    eventos = [];
  }
  eventos.push({ tipo: tipo, frecuencia: frecuencia, hora: new Date().toISOString() });
  try {
    localStorage.setItem(CLAVE_EVENTOS, JSON.stringify(eventos));
  } catch (error) {}
}

// Lee la medición de una fila. Devuelve null si faltan Vin o Vout.
function medicionDe(fila) {
  const vin = leerNumeroDe(fila.querySelector('.ch1'));
  const vout = leerNumeroDe(fila.querySelector('.ch2'));
  const dt = leerNumeroDe(fila.querySelector('.dt'));
  if (isNaN(vin) || isNaN(vout)) return null;
  const f = Number(fila.dataset.f);
  return {
    f: f,
    vin: vin,
    vout: vout,
    dt: isNaN(dt) ? null : dt,
    ganancia: vin > 0 ? vout / vin : NaN,                 // Vout/Vin medida
    fase: isNaN(dt) ? null : -360 * f * dt / 1e6          // grados (negativo = atrasada)
  };
}

// ¿x está cerca de "valor"? (tolerancia relativa, 0.1 = 10 %)
function cerca(x, valor, tolerancia) {
  return Math.abs(x - valor) / Math.abs(valor) < tolerancia;
}

// Elige la causa más probable según cómo es el error
function diagnosticar(m, teo, c) {
  if (!(m.vin > 0) || m.vout <= 0.02 * m.vin) {
    return 'Un canal marca casi cero: revisa que la punta esté en su punto, que el canal esté encendido y que el circuito no tenga un elemento en corto (mídelo con el Fluke).';
  }
  const r = m.ganancia / teo.ganancia;
  const msjSonda = 'La relación es unas 10 veces mayor o menor: la atenuación de un canal no coincide con la punta (×10). En el menú del canal, opción Sonda, ajústela a ×10.';
  if (cerca(r, 10, 0.3)) return msjSonda;
  if (m.ganancia > 1.05) {
    return 'V<sub>out</sub> no puede ser mayor que V<sub>in</sub> en este circuito: revisa que no hayas intercambiado los canales (CH1 en la entrada y CH2 en la salida).';
  }
  if (m.ganancia >= 0.97) {
    return 'V<sub>out</sub> es casi igual a V<sub>in</sub>: un capacitor o resistor está mal conectado o en cortocircuito. Revisa el montaje con la Figura 1 y mide los componentes con el Fluke.';
  }
  // ¿Coincide con el circuito armado con elementos intercambiados?
  const cambios = [
    { texto: 'R<sub>1</sub> y R<sub>2</sub> intercambiadas', c: { R1: c.R2, C1: c.C1, R2: c.R1, C2: c.C2 } },
    { texto: 'C<sub>1</sub> y C<sub>2</sub> intercambiados', c: { R1: c.R1, C1: c.C2, R2: c.R2, C2: c.C1 } },
    { texto: 'las dos redes R‖C intercambiadas', c: { R1: c.R2, C1: c.C2, R2: c.R1, C2: c.C1 } }
  ];
  for (let i = 0; i < cambios.length; i++) {
    if (cerca(m.ganancia, respuesta(m.f, cambios[i].c).ganancia, 0.06) && !cerca(m.ganancia, teo.ganancia, 0.1)) {
      return 'Lo medido coincide con el circuito armado con ' + cambios[i].texto + '. Revisa el montaje con la Figura 1 y el código de colores. ' +
             'Si el montaje está bien, revisa que los dos canales estén en ×10 y que anotaste los dos valores en Vpp.';
    }
  }
  if (cerca(r, 0.1, 0.3)) return msjSonda;
  if (cerca(r, 2, 0.15) || cerca(r, 0.5, 0.15)) {
    return 'La relación es casi el doble o la mitad: parece que en un canal anotaste el valor pico (Vp) y en el otro el pico a pico (Vpp). Anota los dos en Vpp.';
  }
  if (cerca(r, 2.83, 0.1) || cerca(r, 0.354, 0.1)) {
    return 'Parece que en un canal anotaste el valor rms y en el otro el pico a pico (Vpp). Anota los dos en Vpp.';
  }
  if (m.fase !== null) {
    if (m.dt < 0) {
      return 'El Δt salió negativo: en este circuito V<sub>out</sub> va atrasada. Si V<sub>out</sub> cruza por cero después que V<sub>in</sub>, anota Δt positivo (la fase queda negativa).';
    }
    const rf = m.fase / teo.fase;
    if (cerca(rf, 1000, 0.3) || cerca(rf, 0.001, 0.3)) {
      return 'La fase es unas 1000 veces mayor o menor: escribe Δt en microsegundos (µs).';
    }
  }
  const errorGanancia = Math.abs(m.ganancia - teo.ganancia) / teo.ganancia * 100;
  if (errorGanancia > UMBRAL) {
    return 'V<sub>out</sub>/V<sub>in</sub> no coincide: revisa la tolerancia de los componentes (usa los valores medidos de la Tabla 5 en la sección 3), la frecuencia real del generador y la carga de las puntas. Si sigue igual, actualiza LTspice con los valores medidos.';
  }
  return 'La fase no coincide: mide Δt entre dos cruces por cero en el mismo sentido, con los cursores y una escala horizontal pequeña' +
         (m.f >= 100000 ? ' (a 246&nbsp;kHz usa 250&nbsp;ns/div o menos).' : '.');
}

function chip(bien, texto) {
  return '<span class="chip ' + (bien ? 'bien' : 'mal') + '">' + texto + '</span>';
}

// Revisa una fila: valores teóricos, errores, alerta y diagnóstico
function revisarFila(fila, registrar) {
  const celdaTeo = fila.querySelector('.teo');
  const celdaError = fila.querySelector('.error');
  const estabaEnAlerta = fila.classList.contains('alerta');
  const f = Number(fila.dataset.f);
  const c = leerComponentes();
  let alerta = false;
  fila.dataset.diagnostico = '';

  if (!c) {
    celdaTeo.textContent = '—';
    celdaError.textContent = '—';
  } else {
    const teo = respuesta(f, c);
    celdaTeo.innerHTML = formato(teo.ganancia, 4) + '<br>' + formato(teo.fase, 3) + '°';
    const m = medicionDe(fila);
    if (!m) {
      celdaError.textContent = '—';
    } else if (!(m.vin > 0)) {
      celdaError.innerHTML = chip(false, 'V<sub>in</sub>&nbsp;=&nbsp;0');
      alerta = true;
      fila.dataset.diagnostico = diagnosticar(m, teo, c);
    } else {
      // Error de Vout/Vin (%) y diferencia de la fase (grados)
      const errorG = Math.abs(m.ganancia - teo.ganancia) / teo.ganancia * 100;
      let html = chip(errorG <= UMBRAL, (errorG > 999 ? '>999' : formato(errorG, 1)) + '&nbsp;%');
      if (errorG > UMBRAL) alerta = true;
      if (m.fase !== null) {
        const difFase = Math.abs(m.fase - teo.fase);
        html += chip(difFase <= UMBRAL_FASE, (difFase > 999 ? '>999' : formato(difFase, 3)) + '°');
        if (difFase > UMBRAL_FASE) alerta = true;
      }
      celdaError.innerHTML = html;
      if (alerta) fila.dataset.diagnostico = diagnosticar(m, teo, c);
    }
  }

  if (alerta) {
    fila.classList.add('alerta');
    if (registrar && !estabaEnAlerta) registrarEvento('alerta', f);
  } else {
    fila.classList.remove('alerta');
    if (registrar && estabaEnAlerta) registrarEvento('corregido', f);
  }
}

// Muestra el aviso con una sugerencia por cada fila en rojo
function mostrarAvisoMediciones() {
  let html = '';
  filas.forEach(function (fila) {
    if (fila.classList.contains('alerta')) {
      html += '<li><strong>' + formatoFrecuencia(Number(fila.dataset.f)) + ':</strong> ' + fila.dataset.diagnostico + '</li>';
    }
  });
  document.getElementById('diagnostico').innerHTML = html;
  document.getElementById('aviso-mediciones').hidden = html === '';
}


// ---------- 6. Comparación (Tabla 9) ----------

// Valor de LTspice escrito para una frecuencia ('sim-g' = Vout/Vin, 'sim-f' = fase)
function valorSim(clase, f) {
  return leerNumeroDe(document.querySelector('.' + clase + '[data-f="' + f + '"]'));
}

// Escribe en una celda de la Tabla 9
function celda(clase, f, html) {
  document.querySelector('.' + clase + '[data-f="' + f + '"]').innerHTML = html;
}

// Marca del eje de frecuencias: solo potencias de 10 (100 Hz, 1 kHz, ...)
function marcaFrecuencia(valor) {
  const exponente = Math.log10(valor);
  if (Math.abs(exponente - Math.round(exponente)) > 1e-6) return '';
  return formatoFrecuencia(valor);
}

// Curva teórica entre 100 Hz y 10 MHz (como el análisis AC de LTspice)
function curvaTeorica(c, campo) {
  const puntos = [];
  for (let i = 0; i <= 100; i++) {
    const f = 100 * Math.pow(10, 5 * i / 100);
    puntos.push({ x: f, y: respuesta(f, c)[campo] });
  }
  return puntos;
}

// Frecuencia donde Vout se atrasa más (para "Para profundizar")
function faseMaxima(c) {
  let mejor = { f: 100, fase: 0 };
  for (let i = 0; i <= 2000; i++) {
    const f = 100 * Math.pow(10, 5 * i / 2000);
    const fase = respuesta(f, c).fase;
    if (fase < mejor.fase) mejor = { f: f, fase: fase };
  }
  // Afinar alrededor del mejor punto (búsqueda ternaria en escala logarítmica)
  let a = Math.log10(mejor.f) - 0.003, b = Math.log10(mejor.f) + 0.003;
  for (let i = 0; i < 60; i++) {
    const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3;
    if (respuesta(Math.pow(10, m1), c).fase < respuesta(Math.pow(10, m2), c).fase) b = m2; else a = m1;
  }
  const f = Math.pow(10, (a + b) / 2);
  return { f: f, fase: respuesta(f, c).fase };
}

// Crea (o actualiza) una gráfica con lo teórico, LTspice y lo medido
function graficar(grafica, idCanvas, teoricos, simulados, medidos, minY, maxY, decimales) {
  if (grafica) {
    grafica.data.datasets[0].data = teoricos;
    grafica.data.datasets[1].data = simulados;
    grafica.data.datasets[2].data = medidos;
    grafica.options.scales.y.min = minY;
    grafica.options.scales.y.max = maxY;
    grafica.update();
    return grafica;
  }
  const estilo = getComputedStyle(document.body);
  Chart.defaults.font.family = estilo.fontFamily;
  Chart.defaults.color = '#4a5164';
  return new Chart(document.getElementById(idCanvas), {
    type: 'scatter',
    data: {
      datasets: [
        { label: 'Teórico', data: teoricos, type: 'line', borderColor: '#7a8194', borderWidth: 2,
          borderDash: [6, 4], pointRadius: 0, fill: false, order: 3 },
        { label: 'LTspice', data: simulados, backgroundColor: '#ffffff', borderColor: '#7a8194',
          borderWidth: 2, pointStyle: 'rectRot', pointRadius: 8, pointHoverRadius: 10, order: 2 },
        { label: 'Medido', data: medidos, backgroundColor: estilo.getPropertyValue('--color').trim(),
          borderColor: '#ffffff', borderWidth: 2, pointRadius: 5, pointHoverRadius: 7, order: 1 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { type: 'logarithmic', min: 100, max: 1e7, title: { display: true, text: 'Frecuencia' },
             ticks: { callback: marcaFrecuencia, autoSkip: false, maxRotation: 0 }, grid: { color: '#eef0f4' } },
        y: { min: minY, max: maxY, grid: { color: '#eef0f4' } }
      },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              return ctx.dataset.label + ': ' + formatoFrecuencia(ctx.parsed.x) + ', ' + formato(ctx.parsed.y, decimales);
            }
          }
        }
      }
    }
  });
}

function actualizarComparacion() {
  const resumen = document.getElementById('resumen-comparacion');
  const cajaGrafica = document.getElementById('caja-grafica');
  const c = leerComponentes();

  // 1. Llenar la Tabla 9, frecuencia por frecuencia
  const medidos = [];
  FRECUENCIAS.forEach(function (f) {
    const fila = document.querySelector('#tabla-ac tr[data-f="' + f + '"]');
    const m = medicionDe(fila);
    const teo = c ? respuesta(f, c) : null;
    celda('c-gteo', f, teo ? formato(teo.ganancia, 4) : '—');
    celda('c-fteo', f, teo ? formato(teo.fase, 3) : '—');
    celda('c-gmed', f, m && m.vin > 0 ? formato(m.ganancia, 4) : '—');
    celda('c-fmed', f, m && m.fase !== null ? formato(m.fase, 3) : '—');
    if (teo && m && m.vin > 0) {
      m.errorG = Math.abs(m.ganancia - teo.ganancia) / teo.ganancia * 100;
      m.difFase = m.fase === null ? null : Math.abs(m.fase - teo.fase);
      celda('c-gerr', f, chip(m.errorG <= UMBRAL, (m.errorG > 999 ? '>999' : formato(m.errorG, 1))));
      celda('c-fdif', f, m.difFase === null ? '—' : chip(m.difFase <= UMBRAL_FASE, m.difFase > 999 ? '>999' : formato(m.difFase, 3)));
      const simG = valorSim('sim-g', f);
      m.errorSim = simG > 0 ? Math.abs(m.ganancia - simG) / simG * 100 : null;
      medidos.push(m);
    } else {
      celda('c-gerr', f, '—');
      celda('c-fdif', f, '—');
    }
  });

  if (!c || medidos.length < 2) {
    resumen.innerHTML = '<p>Completa el cálculo teórico y al menos dos mediciones para ver los indicadores.</p>';
    cajaGrafica.hidden = true;
    ultimaComparacion = null;
    return;
  }

  // 2. Indicadores
  let suma = 0, peor = medidos[0];
  medidos.forEach(function (m) {
    suma += m.errorG;
    if (m.errorG > peor.errorG) peor = m;
  });
  const promedio = suma / medidos.length;
  const conFase = medidos.filter(function (m) { return m.difFase !== null; });
  let promedioFase = null, peorFase = null;
  if (conFase.length > 0) {
    promedioFase = conFase.reduce(function (a, m) { return a + m.difFase; }, 0) / conFase.length;
    peorFase = conFase.reduce(function (a, m) { return m.difFase > a.difFase ? m : a; });
  }
  const conSim = medidos.filter(function (m) { return m.errorSim !== null; });
  const promedioSim = conSim.length > 0
    ? conSim.reduce(function (a, m) { return a + m.errorSim; }, 0) / conSim.length
    : null;
  const en24 = medidos.filter(function (m) { return m.f === F_TABLA1; })[0];

  ultimaComparacion = {
    promedio: promedio, maximo: peor.errorG, promedioFase: promedioFase,
    maximoFase: peorFase ? peorFase.difFase : null, promedioSim: promedioSim,
    ganancia24: en24 ? en24.ganancia : null
  };

  const texto = function (valor, decimales, unidad) {
    return valor === null ? '—' : formato(valor, decimales) + (unidad === '°' ? '' : '&nbsp;') + unidad;
  };
  resumen.innerHTML =
    '<ul class="indicadores">' +
      '<li><span>Error promedio de V<sub>out</sub>/V<sub>in</sub></span><strong>' + texto(promedio, 1, '%') + '</strong></li>' +
      '<li><span>Error máximo (a ' + formatoFrecuencia(peor.f) + ')</span><strong>' + texto(peor.errorG, 1, '%') + '</strong></li>' +
      '<li><span>Diferencia promedio de fase</span><strong>' + texto(promedioFase, 3, '°') + '</strong></li>' +
      '<li><span>Diferencia máxima de fase' + (peorFase ? ' (a ' + formatoFrecuencia(peorFase.f) + ')' : '') + '</span><strong>' +
         texto(peorFase ? peorFase.difFase : null, 3, '°') + '</strong></li>' +
      '<li><span>V<sub>out</sub>/V<sub>in</sub> medido a 24,6&nbsp;kHz</span><strong>' + (en24 ? formato(en24.ganancia, 4) : '—') + '</strong></li>' +
      '<li><span>Error promedio frente a LTspice</span><strong>' + texto(promedioSim, 1, '%') + '</strong></li>' +
    '</ul>';

  // 3. Gráficas (necesitan la librería Chart.js, que se carga de internet)
  cajaGrafica.hidden = false;
  const max = faseMaxima(c);
  document.getElementById('nota-maximo').innerHTML = 'Para profundizar: según la teoría, V<sub>out</sub> se atrasa más (' +
    formato(max.fase, 3) + '°) cerca de ' + formatoFrecuencia(max.f) + '.';
  if (typeof Chart === 'undefined') {
    document.getElementById('nota-maximo').innerHTML += ' Las gráficas necesitan internet para cargarse.';
    return;
  }
  const simG = [], simF = [];
  FRECUENCIAS.forEach(function (f) {
    const g = valorSim('sim-g', f), fa = valorSim('sim-f', f);
    if (g > 0) simG.push({ x: f, y: g });
    if (!isNaN(fa)) simF.push({ x: f, y: fa });
  });
  const medG = medidos.map(function (m) { return { x: m.f, y: m.ganancia }; });
  const medF = conFase.map(function (m) { return { x: m.f, y: m.fase }; });
  // Los ejes se amplían si algún valor se sale del rango normal
  const valoresG = medG.concat(simG).map(function (p) { return p.y; });
  const maxG = Math.max(1, Math.ceil(Math.max.apply(null, valoresG.concat([0])) * 11) / 10);
  const valoresF = medF.concat(simF).map(function (p) { return p.y; });
  const minF = Math.min(-60, Math.floor((Math.min.apply(null, valoresF.concat([0])) - 5) / 10) * 10);
  const maxF = Math.max(0, Math.ceil((Math.max.apply(null, valoresF.concat([-60])) + 5) / 10) * 10);
  graficaGanancia = graficar(graficaGanancia, 'grafica-ganancia', curvaTeorica(c, 'ganancia'), simG, medG, 0, maxG, 4);
  graficaFase = graficar(graficaFase, 'grafica-fase', curvaTeorica(c, 'fase'), simF, medF, minF, maxF, 3);
}

// Revisa todas las filas y la comparación (sin registrar eventos)
function revisarTodo() {
  filas.forEach(function (fila) { revisarFila(fila, false); });
  mostrarAvisoMediciones();
  actualizarComparacion();
}


// ---------- Copiar resultados para pegarlos en la guía ----------

// Arma las Tablas 8 y 9 como texto separado por tabulaciones (se pega bien en Word o Excel)
function textoParaGuia() {
  const c = leerComponentes();
  const texto = function (v, d) { return v === null || v === undefined || isNaN(v) ? '' : formato(v, d); };
  const lineas8 = ['Tabla 8. Mediciones a tres frecuencias',
    ['Frecuencia', 'Vin (Vpp)', 'Vout (Vpp)', 'Vout / Vin medida', 'Δt (µs)', 'Fase (°)'].join('\t')];
  const lineas9 = ['Tabla 9. Comparación teórico, simulado y medido',
    ['Frecuencia', '|Vout/Vin| teórico', '|Vout/Vin| LTspice', '|Vout/Vin| medido', 'Error (%)',
     'Fase teórica (°)', 'Fase LTspice (°)', 'Fase medida (°)'].join('\t')];
  FRECUENCIAS.forEach(function (f) {
    const fila = document.querySelector('#tabla-ac tr[data-f="' + f + '"]');
    const m = medicionDe(fila);
    const teo = c ? respuesta(f, c) : null;
    const nombre = formatoFrecuencia(f).replace('\u00a0', ' ');
    lineas8.push([nombre, m ? texto(m.vin, 3) : '', m ? texto(m.vout, 3) : '', m ? texto(m.ganancia, 4) : '',
                  m && m.dt !== null ? texto(m.dt, 3) : '', m && m.fase !== null ? texto(m.fase, 3) : ''].join('\t'));
    const error = teo && m && m.vin > 0 ? Math.abs(m.ganancia - teo.ganancia) / teo.ganancia * 100 : null;
    lineas9.push([nombre, teo ? texto(teo.ganancia, 4) : '', texto(valorSim('sim-g', f), 4), m ? texto(m.ganancia, 4) : '',
                  texto(error, 1), teo ? texto(teo.fase, 3) : '', texto(valorSim('sim-f', f), 3),
                  m && m.fase !== null ? texto(m.fase, 3) : ''].join('\t'));
  });
  return lineas8.join('\n') + '\n\n' + lineas9.join('\n');
}

function copiarResultados() {
  const estado = document.getElementById('estado-copiar');
  const texto = textoParaGuia();
  const listo = function () {
    estado.hidden = false;
    estado.textContent = 'Copiado. Pégalo en la guía (Word) o en Excel con Ctrl + V.';
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(texto).then(listo, function () { copiarConArea(texto); listo(); });
  } else {
    copiarConArea(texto);
    listo();
  }
}

// Plan B para copiar en navegadores antiguos
function copiarConArea(texto) {
  const area = document.createElement('textarea');
  area.value = texto;
  document.body.appendChild(area);
  area.select();
  try { document.execCommand('copy'); } catch (error) {}
  document.body.removeChild(area);
}


// ---------- 7. Enviar resultados ----------

// Resume las alertas guardadas: cuántas hubo, cuántas se corrigieron y en cuánto tiempo
function resumenAlertas() {
  let eventos = [];
  try {
    eventos = JSON.parse(localStorage.getItem(CLAVE_EVENTOS)) || [];
  } catch (error) {
    eventos = [];
  }
  let alertas = 0, corregidas = 0, sumaSegundos = 0;
  const abiertas = {}; // frecuencia -> hora de la alerta que aún no se corrige
  eventos.forEach(function (ev) {
    if (ev.tipo === 'alerta') {
      alertas++;
      abiertas[ev.frecuencia] = new Date(ev.hora);
    } else if (ev.tipo === 'corregido' && abiertas[ev.frecuencia]) {
      corregidas++;
      sumaSegundos += (new Date(ev.hora) - abiertas[ev.frecuencia]) / 1000;
      delete abiertas[ev.frecuencia];
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
  filas.forEach(function (fila) {
    const m = medicionDe(fila);
    if (m) {
      const simG = valorSim('sim-g', m.f), simF = valorSim('sim-f', m.f);
      textoMediciones.push(formatoFrecuencia(m.f).replace('\u00a0', ' ') + ': Vin ' + fila.querySelector('.ch1').value.trim() +
        ' Vpp, Vout ' + fila.querySelector('.ch2').value.trim() + ' Vpp' +
        (m.dt === null ? '' : ', Δt ' + fila.querySelector('.dt').value.trim() + ' µs') +
        (isNaN(simG) && isNaN(simF) ? '' : ' (LTspice ' + (isNaN(simG) ? '—' : formato(simG, 4)) + '; ' + (isNaN(simF) ? '—' : formato(simF, 3)) + '°)'));
    }
  });
  const u = ultimaComparacion;
  const extra = [
    'Vout/Vin a 24,6 kHz ' + (u.ganancia24 === null ? '—' : u.ganancia24.toFixed(4).replace('.', ',')),
    'dif. fase prom. ' + (u.promedioFase === null ? '—' : u.promedioFase.toFixed(3).replace('.', ',') + '°'),
    'error vs LTspice ' + (u.promedioSim === null ? '—' : u.promedioSim.toFixed(1).replace('.', ',') + ' %')
  ];

  const alertas = resumenAlertas();
  return {
    grupo: grupo,
    laboratorio: 'Lab 4 - Osciloscopio y AC',
    voltaje: leerNumero('vpp'),
    resistencia: 'R1=' + document.getElementById('r1').value.trim() + ' Ω; C1=' + document.getElementById('c1').value.trim() +
                 ' nF; R2=' + document.getElementById('r2').value.trim() + ' Ω; C2=' + document.getElementById('c2').value.trim() + ' nF',
    chequeo: marcadas + ' de ' + casillas.length,
    primeraVez: primeraVez,
    mediciones: textoMediciones.join('; ') + ' | ' + extra.join('; '),
    errorPromedio: redondear(u.promedio, 2),
    errorMaximo: redondear(u.maximo, 2),
    rExperimental: '',
    alertas: alertas.alertas,
    corregidas: alertas.corregidas,
    tiempoMedio: alertas.tiempoMedio
  };
}


// ---------- Qué pasa cuando el estudiante escribe o toca algo ----------

// Botón Calcular
document.getElementById('btn-verificar').addEventListener('click', function () {
  verificar();
  revisarTodo();
});

// Si cambian los datos del circuito, se recalcula todo
['r1', 'c1', 'r2', 'c2', 'vpp'].forEach(function (id) {
  document.getElementById(id).addEventListener('change', function () {
    if (!document.getElementById('resultado-pre').hidden) verificar();
    revisarTodo();
  });
});

// Cada medición se revisa cuando el estudiante termina de escribirla
filas.forEach(function (fila) {
  fila.querySelectorAll('input').forEach(function (campo) {
    campo.addEventListener('change', function () {
      revisarFila(fila, true);
      mostrarAvisoMediciones();
      actualizarComparacion();
    });
  });
});

// Los valores de LTspice solo cambian la comparación
document.querySelectorAll('.sim-g, .sim-f').forEach(function (campo) {
  campo.addEventListener('change', actualizarComparacion);
});

// Botón para copiar las Tablas 8 y 9
document.getElementById('btn-copiar').addEventListener('click', copiarResultados);

// Después de "Borrar mis datos", se limpia también la tabla y las gráficas
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
    mostrarEstadoEnvio('Completa el cálculo teórico y al menos dos mediciones antes de enviar.', 'mal');
    return;
  }
  enviarRegistro(recogerDatos(grupo));
});

// Al abrir la página, recupera lo que había guardado
if (leerComponentes() && leerNumero('vpp') > 0) verificar();
revisarTodo();