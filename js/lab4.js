// ===================================================
// Lab 4: Análisis AC (circuito RC medido con osciloscopio)
// Pre-verificación con fasores, mediciones de ganancia y desfase
// con alerta y diagnóstico, comparación (frecuencia de corte y
// gráficas de Bode) y envío al registro.
// ===================================================

const POTENCIA_MAX = 0.25;  // W, resistor de 1/4 W
const VOLTAJE_MAX_C = 50;   // V, voltaje máximo del capacitor (revisar el que usen en el laboratorio)
const UMBRAL = 10;          // % de error en la ganancia para avisar (definir con la directora)
const UMBRAL_FASE = 5;      // grados de diferencia en el desfase para avisar (definir con la directora)
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

// Número con coma decimal y signo menos tipográfico: -32.1 → "−32,1"
function formato(numero, decimales) {
  return numero.toFixed(decimales).replace('.', ',').replace('-', '−');
}

// Frecuencia legible: 1591.5 → "1,59 kHz", 500 → "500 Hz" (con espacio que no se separa)
function formatoFrecuencia(f) {
  if (f >= 1000) {
    let texto = (f / 1000).toFixed(2);
    texto = texto.replace(/0+$/, '').replace(/\.$/, '');
    return texto.replace('.', ',') + '\u00a0kHz';
  }
  return Math.round(f) + '\u00a0Hz';
}

// Frecuencia de corte en hertz enteros: 1591.5 → "1592 Hz"
function formatoHz(f) {
  return Math.round(f) + '\u00a0Hz';
}

function redondear(numero, decimales) {
  return Number(numero.toFixed(decimales));
}


// ---------- Números complejos (como en MATLAB: abs y angle) ----------
// Cada número complejo es un objeto con parte real (re) e imaginaria (im)

function complejo(re, im) { return { re: re, im: im }; }
function multiplicar(a, b) { return complejo(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re); }
function dividir(a, b) {
  const d = b.re * b.re + b.im * b.im;
  return complejo((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
}
function magnitud(z) { return Math.hypot(z.re, z.im); }                        // abs(z)
function anguloGrados(z) { return Math.atan2(z.im, z.re) * 180 / Math.PI; }   // angle(z) en grados

// Forma rectangular: "7,16 − j4,50"
function textoRectangular(z, decimales) {
  return formato(z.re, decimales) + (z.im < 0 ? '&nbsp;−&nbsp;j' : '&nbsp;+&nbsp;j') + formato(Math.abs(z.im), decimales);
}
// Forma polar: "8,47 ∠ −32,1°"
function textoPolar(z, decimales) {
  return formato(magnitud(z), decimales) + '&nbsp;∠&nbsp;' + formato(anguloGrados(z), 1) + '°';
}


// ---------- Datos del circuito ----------

// Lee R y C (C se escribe en nF). Devuelve null si falta algo.
function leerRC() {
  const R = leerNumero('r');
  const CnF = leerNumero('c');
  if (!(R > 0) || !(CnF > 0)) return null;
  return { R: R, C: CnF * 1e-9, CnF: CnF };
}

// Lee los cuatro valores de la pre-verificación. Devuelve null si falta algo.
function leerCircuito() {
  const rc = leerRC();
  const Vpp = leerNumero('vpp');
  const f = leerNumero('frecuencia');
  if (!rc || !(Vpp > 0) || !(f > 0)) return null;
  return { Vpp: Vpp, f: f, R: rc.R, C: rc.C, CnF: rc.CnF };
}

// Respuesta teórica del circuito: H = VC / Vs = 1 / (1 + jωRC)
function respuesta(f, R, C) {
  const wRC = 2 * Math.PI * f * R * C;
  return {
    ganancia: 1 / Math.sqrt(1 + wRC * wRC),       // |H|
    fase: -Math.atan(wRC) * 180 / Math.PI         // ángulo de H en grados
  };
}


// ---------- 3. Pre-verificación ----------

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

// Diagrama fasorial: Vs en el eje, VR adelantado y VC desde la punta de VR hasta la de Vs
function diagramaFasorial(Vs, VR, VC) {
  const ox = 24, oy = 172;                 // origen
  const escala = 270 / magnitud(Vs);       // Vs mide 270 píxeles
  const px = function (z) { return ox + escala * z.re; };
  const py = function (z) { return oy - escala * z.im; };
  const xs = px(Vs), ys = py(Vs);
  const xr = px(VR), yr = py(VR);
  const theta = Math.atan2(VR.im, VR.re);
  const colorVs = '#1d2230', colorVR = '#1d63c4', colorVC = '#c9600f';

  // Ángulo marcado con un arco en el origen
  const radio = 42;
  const arco = 'M' + (ox + radio) + ' ' + oy + ' A' + radio + ' ' + radio + ' 0 0 0 ' +
               (ox + radio * Math.cos(theta)) + ' ' + (oy - radio * Math.sin(theta));
  const xa = ox + (radio + 14) * Math.cos(theta / 2);
  const ya = oy - (radio + 14) * Math.sin(theta / 2) + 4;

  // Ángulo recto entre VR y VC
  const ux = -Math.cos(theta), uy = Math.sin(theta);           // de la punta de VR hacia el origen
  const lv = Math.hypot(xs - xr, ys - yr);
  const vx = (xs - xr) / lv, vy = (ys - yr) / lv;              // de la punta de VR hacia la de Vs
  const t = 9;
  const recto = (xr + t * ux) + ',' + (yr + t * uy) + ' ' +
                (xr + t * ux + t * vx) + ',' + (yr + t * uy + t * vy) + ' ' +
                (xr + t * vx) + ',' + (yr + t * vy);

  return '<svg class="fasores" viewBox="0 0 330 200" role="img" aria-label="Diagrama fasorial: Vs, VR y VC">' +
    '<line x1="' + ox + '" y1="' + oy + '" x2="316" y2="' + oy + '" stroke="#c9ced9" stroke-width="1"/>' +
    '<path d="' + arco + '" fill="none" stroke="#7a8194" stroke-width="1.5"/>' +
    '<text x="' + xa + '" y="' + ya + '" fill="#4a5164" font-size="12">' + formato(theta * 180 / Math.PI, 1) + '°</text>' +
    '<polyline points="' + recto + '" fill="none" stroke="#7a8194" stroke-width="1.5"/>' +
    flecha(ox, oy, xs, ys, colorVs) +
    flecha(ox, oy, xr, yr, colorVR) +
    flecha(xr, yr, xs, ys, colorVC) +
    '<text x="' + (ox + xs) / 2 + '" y="' + (oy + 20) + '" fill="' + colorVs + '" text-anchor="middle">V<tspan dy="4" font-size="11">s</tspan></text>' +
    '<text x="' + ((ox + xr) / 2 - 10) + '" y="' + ((oy + yr) / 2 - 6) + '" fill="' + colorVR + '" text-anchor="end">V<tspan dy="4" font-size="11">R</tspan></text>' +
    '<text x="' + ((xr + xs) / 2 + 10) + '" y="' + ((yr + ys) / 2 - 6) + '" fill="' + colorVC + '">V<tspan dy="4" font-size="11">C</tspan></text>' +
  '</svg>';
}

function verificar() {
  const caja = document.getElementById('resultado-pre');
  caja.hidden = false;

  const c = leerCircuito();
  if (!c) {
    caja.className = 'resultado peligro';
    caja.innerHTML = '<p>Completa los cuatro valores con números mayores que cero, por ejemplo 10, 1000, 1000 y 100.</p>';
    return;
  }

  // 1. Impedancia y fasores a la frecuencia escrita (amplitudes pico a pico, Vs como referencia)
  const w = 2 * Math.PI * c.f;
  const Xc = 1 / (w * c.C);                         // reactancia del capacitor (Ω)
  const fc = 1 / (2 * Math.PI * c.R * c.C);         // frecuencia de corte (Hz)
  const Z = complejo(c.R, -Xc);                     // Z = R − jXc
  const Vs = complejo(c.Vpp, 0);
  const I = dividir(Vs, Z);                         // A pico a pico
  const VR = multiplicar(I, complejo(c.R, 0));      // VR = I·R
  const VC = multiplicar(I, complejo(0, -Xc));      // VC = I·(−jXc)
  const ImA = complejo(I.re * 1000, I.im * 1000);   // corriente en mA
  const retraso = -anguloGrados(VC) / (360 * c.f) * 1e6; // µs que CH2 va detrás de CH1

  // 2. Seguridad: el peor caso para R es a frecuencia muy alta (C actúa como un corto)
  //    y para C es a frecuencia muy baja (recibe todo el voltaje del generador)
  const Vrms = c.Vpp / (2 * Math.SQRT2);
  const Pmax = Vrms * Vrms / c.R;
  const porcentaje = Pmax / POTENCIA_MAX * 100;
  const Vpico = c.Vpp / 2;

  let estado;
  let mensaje;
  if (Pmax > POTENCIA_MAX) {
    estado = 'peligro';
    mensaje = 'No enciendas el generador: el resistor se puede sobrecalentar a frecuencias altas. Baja la amplitud.';
  } else if (Vpico > VOLTAJE_MAX_C) {
    estado = 'peligro';
    mensaje = 'No enciendas el generador: el capacitor recibiría más de ' + VOLTAJE_MAX_C + '&nbsp;V. Baja la amplitud.';
  } else if (porcentaje > 50) {
    estado = 'precaucion';
    mensaje = 'Puedes medir, pero el resistor se va a calentar a frecuencias altas. Mide rápido o baja la amplitud.';
  } else {
    estado = 'ok';
    mensaje = 'Valores seguros. Puedes armar el circuito.';
  }

  const fila = function (nombre, z) {
    return '<tr><td>' + nombre + '</td><td>' + textoRectangular(z, 2) + '</td><td>' + textoPolar(z, 2) + '</td></tr>';
  };

  caja.className = 'resultado ' + estado;
  caja.innerHTML =
    '<p><strong>' + mensaje + '</strong></p>' +
    '<ul>' +
      '<li>Frecuencia de corte: f<sub>c</sub> = 1/(2πRC) = ' + formatoHz(fc) + '</li>' +
      '<li>A ' + formatoFrecuencia(c.f) + ': X<sub>C</sub> = ' + formato(Xc, 0) + '&nbsp;Ω y ' +
          'Z = ' + textoRectangular(Z, 0) + ' = ' + textoPolar(Z, 0) + '&nbsp;Ω</li>' +
      '<li>Potencia máxima en el resistor: ' + formato(Pmax * 1000, 1) + '&nbsp;mW (' + formato(porcentaje, 0) + '&nbsp;% de 0,25&nbsp;W)</li>' +
    '</ul>' +
    '<p>Fasores a ' + formatoFrecuencia(c.f) + ' (valores pico a pico, V<sub>s</sub> como referencia):</p>' +
    '<div class="tabla-scroll"><table>' +
      '<tr><th>Fasor</th><th>Rectangular</th><th>Polar</th></tr>' +
      fila('V<sub>s</sub> (V)', Vs) +
      fila('I (mA)', ImA) +
      fila('V<sub>R</sub> (V)', VR) +
      fila('V<sub>C</sub> (V)', VC) +
    '</table></div>' +
    diagramaFasorial(Vs, VR, VC) +
    '<p><strong>En el osciloscopio</strong> deberías ver CH2 con unos ' + formato(magnitud(VC), 2) + '&nbsp;Vpp, ' +
       'atrasada ' + formato(retraso, 0) + '&nbsp;µs (' + formato(anguloGrados(VC), 1) + '°) respecto a CH1.</p>' +
    '<p>Ojo: |V<sub>R</sub>| + |V<sub>C</sub>| = ' + formato(magnitud(VR) + magnitud(VC), 2) + '&nbsp;Vpp, más que los ' +
       formato(c.Vpp, 2) + '&nbsp;Vpp del generador. En AC los voltajes se suman como fasores ' +
       '(V<sub>R</sub> + V<sub>C</sub> = V<sub>s</sub>), no como números.</p>';
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

// Lee la medición de una fila. Devuelve null si faltan CH1 o CH2.
function medicionDe(fila) {
  const ch1 = leerNumeroDe(fila.querySelector('.ch1'));
  const ch2 = leerNumeroDe(fila.querySelector('.ch2'));
  const dt = leerNumeroDe(fila.querySelector('.dt'));
  if (isNaN(ch1) || isNaN(ch2)) return null;
  const f = Number(fila.dataset.f);
  return {
    f: f,
    ch1: ch1,
    ch2: ch2,
    dt: isNaN(dt) ? null : dt,
    ganancia: ch1 > 0 ? ch2 / ch1 : NaN,                 // |VC / Vs| medida
    fase: isNaN(dt) ? null : -360 * f * dt / 1e6         // grados (negativo = atrasada)
  };
}

// ¿x está cerca de "valor"? (tolerancia relativa, 0.1 = 10 %)
function cerca(x, valor, tolerancia) {
  return Math.abs(x - valor) / Math.abs(valor) < tolerancia;
}

// Elige la causa más probable según cómo es el error
function diagnosticar(m, teo, rc) {
  if (!(m.ch1 > 0) || m.ch2 <= 0.02 * m.ch1) {
    return 'Un canal marca casi cero: revisa que la sonda esté en su punto, que el canal esté encendido y que su acoplamiento no esté en GND.';
  }
  const r = m.ganancia / teo.ganancia;
  if (cerca(r, 10, 0.3) || cerca(r, 0.1, 0.3)) {
    return 'La ganancia es unas 10 veces mayor o menor: la atenuación de una sonda (×1 o ×10) no coincide con la de su canal.';
  }
  if (cerca(r, 2, 0.15) || cerca(r, 0.5, 0.15)) {
    return 'La ganancia es casi el doble o la mitad: parece que en un canal anotaste el valor pico (Vp) y en el otro el pico a pico (Vpp). Anota los dos en Vpp.';
  }
  if (cerca(r, 2.83, 0.1) || cerca(r, 0.354, 0.1)) {
    return 'Parece que en un canal anotaste el valor eficaz (Vrms) y en el otro el pico a pico (Vpp). Anota los dos en Vpp.';
  }
  if (m.ganancia > 1.05) {
    return 'CH2 no puede ser mayor que CH1 en este circuito: revisa que no hayas intercambiado los canales (CH1 en el generador y CH2 en el capacitor).';
  }
  const wRC = 2 * Math.PI * m.f * rc.R * rc.C;
  const gananciaR = wRC / Math.sqrt(1 + wRC * wRC);   // lo que mediría CH2 sobre el resistor
  if (cerca(m.ganancia, gananciaR, 0.1) && !cerca(m.ganancia, teo.ganancia, 0.1)) {
    return 'Parece que CH2 está midiendo el resistor y no el capacitor. Pon la punta de CH2 entre R y C, con su caimán en la tierra común.';
  }
  if (m.fase !== null) {
    if (m.dt < 0) {
      return 'El Δt salió negativo: en este circuito el voltaje del capacitor va atrasado. Anota el retraso de CH2 como número positivo y revisa que no hayas intercambiado los canales.';
    }
    const rf = m.fase / teo.fase;
    if (cerca(rf, 1000, 0.3) || cerca(rf, 0.001, 0.3)) {
      return 'El desfase es unas 1000 veces mayor o menor: escribe Δt en microsegundos (µs).';
    }
  }
  const errorGanancia = Math.abs(m.ganancia - teo.ganancia) / teo.ganancia * 100;
  if (errorGanancia > UMBRAL) {
    return 'La ganancia no coincide con la teórica: revisa la frecuencia real del generador, los valores reales de R y C (el capacitor puede tener 10 o 20 % de tolerancia) y que las tierras estén en el mismo punto.';
  }
  return 'El desfase no coincide: mide Δt entre dos cruces por cero en el mismo sentido (las dos señales subiendo), amplía la base de tiempo o usa los cursores.';
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
  const rc = leerRC();
  let alerta = false;
  fila.dataset.diagnostico = '';

  if (!rc) {
    celdaTeo.textContent = 'teórico: —';
    celdaError.textContent = '—';
  } else {
    const teo = respuesta(f, rc.R, rc.C);
    celdaTeo.innerHTML = '|H| ' + formato(teo.ganancia, 3) + '<br>φ ' + formato(teo.fase, 1) + '°';
    const m = medicionDe(fila);
    if (!m) {
      celdaError.textContent = '—';
    } else if (!(m.ch1 > 0)) {
      celdaError.innerHTML = chip(false, 'CH1 = 0');
      alerta = true;
      fila.dataset.diagnostico = diagnosticar(m, teo, rc);
    } else {
      // Error de la ganancia (%) y diferencia del desfase (grados)
      const errorG = Math.abs(m.ganancia - teo.ganancia) / teo.ganancia * 100;
      let html = chip(errorG <= UMBRAL, (errorG > 999 ? '>999' : formato(errorG, 1)) + '&nbsp;%');
      if (errorG > UMBRAL) alerta = true;
      if (m.fase !== null) {
        const difFase = Math.abs(m.fase - teo.fase);
        html += chip(difFase <= UMBRAL_FASE, formato(difFase, 1) + '°');
        if (difFase > UMBRAL_FASE) alerta = true;
      }
      celdaError.innerHTML = html;
      if (alerta) fila.dataset.diagnostico = diagnosticar(m, teo, rc);
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


// ---------- 6. Comparación ----------

// Escribe las frecuencias del eje logarítmico: 100 Hz, 1 kHz, 10 kHz...
function marcaFrecuencia(valor) {
  const exponente = Math.log10(valor);
  if (Math.abs(exponente - Math.round(exponente)) > 1e-6) return '';
  return formatoFrecuencia(valor);
}

// Curva teórica con 61 puntos entre 50 Hz y 20 kHz
function curvaTeorica(rc, campo) {
  const puntos = [];
  for (let i = 0; i <= 60; i++) {
    const f = 50 * Math.pow(400, i / 60);
    puntos.push({ x: f, y: respuesta(f, rc.R, rc.C)[campo] });
  }
  return puntos;
}

// Crea (o actualiza) una gráfica con los puntos medidos, la curva teórica y la línea de fc
function graficar(grafica, idCanvas, medidos, teoricos, fc, minY, maxY, decimales) {
  const lineaFc = [{ x: fc, y: minY }, { x: fc, y: maxY }];
  if (grafica) {
    grafica.data.datasets[0].data = medidos;
    grafica.data.datasets[1].data = teoricos;
    grafica.data.datasets[2].data = lineaFc;
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
        { label: 'Medido', data: medidos, backgroundColor: estilo.getPropertyValue('--color').trim(),
          borderColor: '#ffffff', borderWidth: 2, pointRadius: 6, pointHoverRadius: 8 },
        { label: 'Teórico', data: teoricos, type: 'line', borderColor: '#7a8194', borderWidth: 2,
          borderDash: [6, 4], pointRadius: 0, fill: false },
        { label: 'fc teórica', data: lineaFc, type: 'line', borderColor: '#c9ced9', borderWidth: 2,
          pointRadius: 0, fill: false }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { type: 'logarithmic', min: 50, max: 20000, title: { display: true, text: 'Frecuencia' },
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
  const rc = leerRC();

  // Reunir las mediciones completas
  const puntos = [];
  filas.forEach(function (fila) {
    const m = medicionDe(fila);
    if (rc && m && m.ch1 > 0) {
      const teo = respuesta(m.f, rc.R, rc.C);
      m.errorG = Math.abs(m.ganancia - teo.ganancia) / teo.ganancia * 100;
      m.difFase = m.fase === null ? null : Math.abs(m.fase - teo.fase);
      puntos.push(m);
    }
  });

  if (!rc || puntos.length < 2) {
    resumen.innerHTML = '<p>Completa R y C en la pre-verificación y al menos dos mediciones para ver la comparación.</p>';
    cajaGrafica.hidden = true;
    ultimaComparacion = null;
    return;
  }

  // Error de la ganancia: promedio y máximo
  let suma = 0;
  let peor = puntos[0];
  puntos.forEach(function (p) {
    suma += p.errorG;
    if (p.errorG > peor.errorG) peor = p;
  });
  const promedio = suma / puntos.length;

  // Diferencia promedio del desfase (solo filas con Δt)
  const conFase = puntos.filter(function (p) { return p.difFase !== null; });
  const promedioFase = conFase.length > 0
    ? conFase.reduce(function (a, p) { return a + p.difFase; }, 0) / conFase.length
    : null;

  // Frecuencia de corte experimental a partir de la ganancia:
  // |H| = 1/√(1 + (2πfτ)²)  →  τ = √(1/|H|² − 1) / (2πf),  fc = 1/(2πτ)
  // Promedio ponderado: pesan más las mediciones cerca y por encima de fc, donde el cálculo es más preciso
  let sumaPesos = 0;
  let sumaLog = 0;
  puntos.forEach(function (p) {
    if (p.ganancia > 0.05 && p.ganancia < 0.98) {
      const tau = Math.sqrt(1 / (p.ganancia * p.ganancia) - 1) / (2 * Math.PI * p.f);
      const peso = Math.pow(1 - p.ganancia * p.ganancia, 2);
      sumaLog += peso * Math.log(tau);
      sumaPesos += peso;
    }
  });
  const fcExp = sumaPesos > 0 ? 1 / (2 * Math.PI * Math.exp(sumaLog / sumaPesos)) : null;
  const fcTeo = 1 / (2 * Math.PI * rc.R * rc.C);
  const fcSim = leerNumero('fc-ltspice');
  const difTeo = fcExp === null ? null : Math.abs(fcExp - fcTeo) / fcTeo * 100;
  const difSim = fcExp === null || !(fcSim > 0) ? null : Math.abs(fcExp - fcSim) / fcSim * 100;

  ultimaComparacion = {
    promedio: promedio, maximo: peor.errorG, promedioFase: promedioFase,
    fcExp: fcExp, fcTeo: fcTeo, fcSim: fcSim > 0 ? fcSim : null, difTeo: difTeo, difSim: difSim
  };

  const texto = function (valor, decimales, unidad) {
    return valor === null ? '—' : formato(valor, decimales) + (unidad === '°' ? '' : '&nbsp;') + unidad;
  };
  resumen.innerHTML =
    '<ul class="indicadores">' +
      '<li><span>Error promedio de la ganancia</span><strong>' + texto(promedio, 1, '%') + '</strong></li>' +
      '<li><span>Error máximo (a ' + formatoFrecuencia(peor.f) + ')</span><strong>' + texto(peor.errorG, 1, '%') + '</strong></li>' +
      '<li><span>Diferencia promedio del desfase</span><strong>' + texto(promedioFase, 1, '°') + '</strong></li>' +
      '<li><span>f<sub>c</sub> experimental</span><strong>' + (fcExp === null ? '—' : formatoHz(fcExp)) + '</strong></li>' +
      '<li><span>Diferencia con f<sub>c</sub> teórica (' + formatoHz(fcTeo) + ')</span><strong>' + texto(difTeo, 1, '%') + '</strong></li>' +
      '<li><span>Diferencia con f<sub>c</sub> de LTspice' + (fcSim > 0 ? ' (' + formatoHz(fcSim) + ')' : '') + '</span><strong>' + texto(difSim, 1, '%') + '</strong></li>' +
    '</ul>';

  // Gráficas de Bode (necesitan la librería Chart.js, que se carga de internet)
  cajaGrafica.hidden = false;
  if (typeof Chart === 'undefined') {
    cajaGrafica.innerHTML = '<p class="nota">Las gráficas necesitan internet para cargarse.</p>';
    return;
  }
  const medidosG = puntos.map(function (p) { return { x: p.f, y: p.ganancia }; });
  const medidosF = conFase.map(function (p) { return { x: p.f, y: p.fase }; });
  // Los ejes se amplían si alguna medición se sale del rango normal
  const maxG = Math.max(1.1, Math.ceil(Math.max.apply(null, medidosG.map(function (p) { return p.y; })) * 11) / 10);
  const fases = medidosF.map(function (p) { return p.y; });
  const minF = Math.min(-90, Math.floor((Math.min.apply(null, fases.concat([0])) - 5) / 10) * 10);
  const maxF = Math.max(0, Math.ceil((Math.max.apply(null, fases.concat([-90])) + 5) / 10) * 10);
  graficaGanancia = graficar(graficaGanancia, 'grafica-ganancia', medidosG, curvaTeorica(rc, 'ganancia'), fcTeo, 0, maxG, 3);
  graficaFase = graficar(graficaFase, 'grafica-fase', medidosF, curvaTeorica(rc, 'fase'), fcTeo, minF, maxF, 1);
}

// Revisa todas las filas y la comparación (sin registrar eventos)
function revisarTodo() {
  filas.forEach(function (fila) { revisarFila(fila, false); });
  mostrarAvisoMediciones();
  actualizarComparacion();
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
      textoMediciones.push(formatoFrecuencia(m.f).replace('\u00a0', ' ') + ': CH1 ' + fila.querySelector('.ch1').value.trim() +
        ' Vpp, CH2 ' + fila.querySelector('.ch2').value.trim() + ' Vpp' +
        (m.dt === null ? '' : ', Δt ' + fila.querySelector('.dt').value.trim() + ' µs'));
    }
  });
  const u = ultimaComparacion;
  const extra = [
    'fc experimental ' + (u.fcExp === null ? '—' : Math.round(u.fcExp) + ' Hz'),
    'fc teórica ' + Math.round(u.fcTeo) + ' Hz',
    'fc LTspice ' + (u.fcSim === null ? '—' : Math.round(u.fcSim) + ' Hz'),
    'desfase prom. ' + (u.promedioFase === null ? '—' : u.promedioFase.toFixed(1).replace('.', ',') + '°')
  ];

  const alertas = resumenAlertas();
  return {
    grupo: grupo,
    laboratorio: 'Lab 4 - Análisis AC',
    voltaje: leerNumero('vpp'),
    resistencia: 'R=' + document.getElementById('r').value.trim() + ' Ω; C=' + document.getElementById('c').value.trim() + ' nF',
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
['vpp', 'frecuencia', 'r', 'c'].forEach(function (id) {
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

// La frecuencia de corte de LTspice solo cambia la comparación
document.getElementById('fc-ltspice').addEventListener('change', actualizarComparacion);

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
    mostrarEstadoEnvio('Completa la pre-verificación y al menos dos mediciones antes de enviar.', 'mal');
    return;
  }
  enviarRegistro(recogerDatos(grupo));
});

// Al abrir la página, recupera lo que había guardado
if (leerCircuito()) verificar();
revisarTodo();