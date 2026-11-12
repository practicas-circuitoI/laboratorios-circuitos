// ===================================================
// Simulador del Lab 4: generador, circuito R–C y osciloscopio
//  - El estudiante arma el circuito en una protoboard (reto 1). Lo que miden
//    las puntas sale de resolver el circuito tal como quedó armado: análisis
//    nodal con fasores (números complejos) para cada armónico de la señal.
//  - 7 retos guiados, de fácil a difícil; cada uno se desbloquea al terminar
//    el anterior. Se revisan solos cada vez que algo cambia en la mesa.
//  - La mesa y el avance se guardan en este dispositivo.
//  - Atajo para revisar: simulador4.html?reto=5 abre directo en el reto 5
//    (marca los anteriores como hechos y deja la mesa lista para ese reto).
// ===================================================
(function () {
  'use strict';
  const $ = function (id) { return document.getElementById(id); };
  const CLAVE_MESA = 'simulador-mesa-lab4';
  const CLAVE_RETOS = 'simulador-circuitos-lab4';   // la lee js/practica.js en lab4.html
  const AMARILLO = '#f2d02f', AZUL = '#3cc8f0', NARANJA = '#f08a3c';

  // ---------- 1. El circuito ----------
  // Valores reales de las piezas (con su tolerancia): por eso lo medido no es exactamente lo teórico
  const R1 = 1000 * 1.012, C1 = 1e-9 * 0.97, R2 = 10000 * 0.994, C2 = 10e-9 * 1.025;
  const RS = 50;   // resistencia interna del generador

  // Números complejos como [real, imaginaria]
  function suma(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function entre(a, b) {
    const d = b[0] * b[0] + b[1] * b[1];
    return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
  }
  function modulo(a) { return Math.hypot(a[0], a[1]); }
  function angulo(a) { return Math.atan2(a[1], a[0]); }
  // R en paralelo con C: R / (1 + jωRC)
  function paralelo(R, C, w) { return entre([R, 0], [1, w * R * C]); }
  // Circuito bien armado, a una frecuencia: h = Vout / Vin y carga = Vin / (voltaje interno del generador).
  // Es la teoría con la que se revisan los retos 2 a 7.
  function circuito(f) {
    const w = 2 * Math.PI * f;
    const z1 = paralelo(R1, C1, w), z2 = paralelo(R2, C2, w), zin = suma(z1, z2);
    return { h: entre(z2, zin), carga: entre(zin, suma(zin, [RS, 0])) };
  }
  function resta(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function por(a, b) { return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]; }
  // Resuelve A·x = b con números complejos (eliminación de Gauss con pivoteo)
  function gauss(A, b) {
    const n = b.length;
    for (let k = 0; k < n; k++) {
      let m = k;
      for (let i = k + 1; i < n; i++) if (modulo(A[i][k]) > modulo(A[m][k])) m = i;
      let t = A[k]; A[k] = A[m]; A[m] = t;
      t = b[k]; b[k] = b[m]; b[m] = t;
      for (let i = k + 1; i < n; i++) {
        const f = entre(A[i][k], A[k][k]);
        for (let j = k; j < n; j++) A[i][j] = resta(A[i][j], por(f, A[k][j]));
        b[i] = resta(b[i], por(f, b[k]));
      }
    }
    const x = [];
    for (let k = n - 1; k >= 0; k--) {
      let s = b[k];
      for (let j = k + 1; j < n; j++) s = resta(s, por(A[k][j], x[j]));
      x[k] = entre(s, A[k][k]);
    }
    return x;
  }

  // ---------- 1b. La protoboard ----------
  // 8 columnas de 5 huecos (los 5 huecos de una columna están unidos por dentro)
  // y dos rieles a lo largo: + arriba y − abajo. En cada hueco cabe una sola pata.
  // Huecos: 'c3-2' = columna 3, fila 2 · 'p5' = riel +, hueco 5 · 'n5' = riel −, hueco 5
  const COLS = 8, FILAS = 5;
  const PB = { x0: 34, dx: 40, yP: 32, yNum: 64, y0: 88, dy: 36, yN: 274, w: 348, h: 304 };
  const BASES = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', '+', '−'];
  const PIEZAS = [
    { id: 'R1', tipo: 'r', patas: 2, nombre: 'R₁', valor: '1 kΩ', largo: 'R₁ (1 kΩ)', bandas: ['#7a4a1d', '#1d2230', '#d93025', '#c9a227'] },
    { id: 'C1', tipo: 'c', patas: 2, nombre: 'C₁', valor: '1 nF · 102', largo: 'C₁ (1 nF)' },
    { id: 'R2', tipo: 'r', patas: 2, nombre: 'R₂', valor: '10 kΩ', largo: 'R₂ (10 kΩ)', bandas: ['#7a4a1d', '#1d2230', '#f08a3c', '#c9a227'] },
    { id: 'C2', tipo: 'c', patas: 2, nombre: 'C₂', valor: '10 nF · 103', largo: 'C₂ (10 nF)' },
    { id: 'W1', tipo: 'w', patas: 2, nombre: 'Cable 1', valor: 'puente', largo: 'el cable puente 1', color: '#1f9d55' },
    { id: 'W2', tipo: 'w', patas: 2, nombre: 'Cable 2', valor: 'puente', largo: 'el cable puente 2', color: '#7b4fd0' },
    { id: 'GP', tipo: 'g', patas: 1, nombre: 'Rojo +', valor: 'generador', largo: 'el caimán rojo del generador', color: '#d93025', letra: '+' },
    { id: 'GN', tipo: 'g', patas: 1, nombre: 'Negro −', valor: 'generador', largo: 'el caimán negro del generador', color: '#1d2230', letra: '−' },
    { id: 'P1', tipo: 'p', patas: 1, nombre: 'Punta CH1', valor: 'gancho', largo: 'la punta de CH1', color: AMARILLO, letra: '1' },
    { id: 'T1', tipo: 't', patas: 1, nombre: 'Tierra CH1', valor: 'caimán', largo: 'la tierra de CH1', color: AMARILLO },
    { id: 'P2', tipo: 'p', patas: 1, nombre: 'Punta CH2', valor: 'gancho', largo: 'la punta de CH2', color: AZUL, letra: '2' },
    { id: 'T2', tipo: 't', patas: 1, nombre: 'Tierra CH2', valor: 'caimán', largo: 'la tierra de CH2', color: AZUL }
  ];
  const PIEZA = {};
  PIEZAS.forEach(function (p) { PIEZA[p.id] = p; });
  // Una forma correcta de armarlo (la usa el atajo ?reto=)
  const ARMADO = { R1: ['c2-2', 'c5-2'], C1: ['c2-3', 'c5-3'], R2: ['c5-4', 'n4'], C2: ['c5-5', 'n6'],
                   GP: ['c2-1'], GN: ['n1'], P1: ['c2-4'], T1: ['n2'], P2: ['c5-1'], T2: ['n8'] };

  function huecoValido(h) { return /^c[1-8]-[1-5]$/.test(h) || /^[pn][1-8]$/.test(h); }
  function posHueco(h) {
    const m = /^c(\d)-(\d)$/.exec(h);
    if (m) return { x: PB.x0 + (m[1] - 1) * PB.dx, y: PB.y0 + (m[2] - 1) * PB.dy };
    return { x: PB.x0 + (h.slice(1) - 1) * PB.dx, y: h[0] === 'p' ? PB.yP : PB.yN };
  }
  function baseDe(h) { return h[0] === 'c' ? h.split('-')[0] : (h[0] === 'p' ? '+' : '−'); }
  function nombreBase(b) { return b === '+' ? 'el riel +' : b === '−' ? 'el riel −' : 'la columna ' + b.slice(1); }
  // Quita lo que no tenga sentido de una protoboard guardada
  function protoLimpio(p) {
    const limpio = {}, usados = {};
    if (!p || typeof p !== 'object') return limpio;
    PIEZAS.forEach(function (pz) {
      const v = p[pz.id];
      if (!Array.isArray(v) || v.length !== pz.patas || !v.every(huecoValido) || v[0] === v[1]) return;
      if (v.some(function (h) { return usados[h]; })) return;
      v.forEach(function (h) { usados[h] = true; });
      limpio[pz.id] = v.slice();
    });
    return limpio;
  }

  // ---------- 2. Posiciones de las perillas ----------
  const RANGOS = [10, 100, 1e3, 1e4, 1e5, 1e6];
  const RANGO_TXT = ['10', '100', '1k', '10k', '100k', '1M'];
  // VOLTS/DIV en el conector; con el menú en 10X la pantalla muestra 10 veces más
  const VDIV = [0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5];
  const TDIV = [5e-8, 1e-7, 2.5e-7, 5e-7, 1e-6, 2.5e-6, 5e-6, 1e-5, 2.5e-5, 5e-5, 1e-4, 2.5e-4, 5e-4, 1e-3, 2.5e-3, 5e-3, 1e-2];
  const FORMAS = [
    ['seno', 'Senoidal', 'M2 7 C 6 -1, 10 -1, 14 7 S 22 15, 26 7'],
    ['cuadrada', 'Cuadrada', 'M2 11 V3 H9 V11 H16 V3 H23 V11 H26'],
    ['triangulo', 'Triangular', 'M2 11 L8 3 L14 11 L20 3 L26 11']
  ];

  // ---------- 3. La mesa (todo lo que se puede cambiar) ----------
  function mesaInicial() {
    return {
      // dial: FREQ × 100 (100 a 999) · ampl: Vpp × 20 (0 a 200) · offset: V × 10 (−50 a 50)
      gen: { forma: 'cuadrada', rango: 2, dial: 100, ampl: 100, offset: 0, salida: false },
      puntas: { ch1: 10, ch2: 1 },   // interruptor de cada punta
      sonda: { ch1: 1, ch2: 1 },     // lo que dice el menú de cada canal
      vdiv: { ch1: 7, ch2: 7 },
      tdiv: 11,
      medir: { ch1: false, ch2: false, frec: false },
      cursor: { on: false, c1: 3, c2: 7, sel: 1 },   // posición de los cursores en cuadros (0 a 10)
      menu: null,
      proto: {}   // pieza → huecos donde están sus patas, p. ej. R1: ['c2-2', 'c5-2']
    };
  }
  function leer(clave) {
    try { return JSON.parse(localStorage.getItem(clave)); } catch (error) { return null; }
  }
  function escribir(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (error) {}
  }
  let mesa = mesaInicial();
  (function () {
    const guardada = leer(CLAVE_MESA);
    if (!guardada || !guardada.gen) return;
    Object.keys(mesa).forEach(function (k) {
      if (guardada[k] === undefined) return;
      mesa[k] = (typeof mesa[k] === 'object' && mesa[k] !== null) ? Object.assign(mesa[k], guardada[k]) : guardada[k];
    });
    mesa.proto = protoLimpio(mesa.proto);
  })();
  function guardarMesa() { escribir(CLAVE_MESA, mesa); }

  function frecuencia() { return mesa.gen.dial / 100 * RANGOS[mesa.gen.rango]; }
  function amplitud() { return mesa.gen.ampl / 20; }
  function offset() { return mesa.gen.offset / 10; }
  function factor(ch) { return mesa.sonda[ch] / mesa.puntas[ch]; }   // lo que se ve ÷ lo real
  function vdiv(ch) { return VDIV[mesa.vdiv[ch]] * mesa.sonda[ch]; }  // V/div que dice la pantalla
  function tdiv() { return TDIV[mesa.tdiv]; }

  // ---------- 4. El circuito tal como quedó en la protoboard ----------
  // Une los huecos que quedan conectados: cada columna, cada riel y los cables puente.
  // Con conTierra, también une a "tierra" lo que toca el caimán negro y las pinzas de tierra
  // de las puntas: por dentro del generador y del osciloscopio todas esas tierras están unidas.
  function redesProto(conTierra) {
    const padre = {};
    function raiz(a) { while (padre[a] !== undefined) a = padre[a]; return a; }
    function unir(a, b) { a = raiz(a); b = raiz(b); if (a !== b) padre[a] = b; }
    ['W1', 'W2'].forEach(function (id) {
      const p = mesa.proto[id];
      if (p) unir(baseDe(p[0]), baseDe(p[1]));
    });
    if (conTierra) ['GN', 'T1', 'T2'].forEach(function (id) {
      const p = mesa.proto[id];
      if (p) unir(baseDe(p[0]), 'tierra');
    });
    return { de: function (h) { return raiz(baseDe(h)); }, base: raiz };
  }
  // Voltaje en cada punta por cada voltio interno del generador, a la frecuencia angular w (w = 0: continua).
  // Análisis nodal: Y·V = I, con el generador como fuente de corriente en paralelo con sus 50 Ω.
  function resolverProto(w) {
    const p = mesa.proto, R = redesProto(true), indice = {};
    let n = 0;
    function nodo(h) {
      const r = R.de(h);
      if (r === 'tierra') return -1;
      if (indice[r] === undefined) indice[r] = n++;
      return indice[r];
    }
    const ramas = [];
    [['R1', 1 / R1, 0], ['C1', 0, C1], ['R2', 1 / R2, 0], ['C2', 0, C2]].forEach(function (q) {
      if (p[q[0]]) ramas.push([nodo(p[q[0]][0]), nodo(p[q[0]][1]), [q[1], w * q[2]]]);
    });
    const g = p.GP ? nodo(p.GP[0]) : -2, s1 = p.P1 ? nodo(p.P1[0]) : -2, s2 = p.P2 ? nodo(p.P2[0]) : -2;
    const Y = [], I = [];
    for (let i = 0; i < n; i++) {
      Y.push([]);
      for (let j = 0; j < n; j++) Y[i].push([i === j ? 1e-12 : 0, 0]);   // fuga mínima: un nodo suelto queda en 0 V
      I.push([0, 0]);
    }
    ramas.forEach(function (r) {
      const a = r[0], b = r[1], y = r[2];
      if (a === b) return;   // las dos patas en el mismo nodo: en corto, no hace nada
      if (a >= 0) Y[a][a] = suma(Y[a][a], y);
      if (b >= 0) Y[b][b] = suma(Y[b][b], y);
      if (a >= 0 && b >= 0) { Y[a][b] = resta(Y[a][b], y); Y[b][a] = resta(Y[b][a], y); }
    });
    if (g >= 0) { Y[g][g] = suma(Y[g][g], [1 / RS, 0]); I[g] = [1 / RS, 0]; }
    const V = n ? gauss(Y, I) : [];
    return { v1: s1 >= 0 ? V[s1] : [0, 0], v2: s2 >= 0 ? V[s2] : [0, 0] };
  }

  // ---------- 4b. Señales: lo que llega a cada punta, armónico por armónico ----------
  function senales() {
    const g = mesa.gen, f = frecuencia(), A = amplitud() / 2;
    if (!g.salida) return { f: f, vin: [], vout: [], dcIn: 0, dcOut: 0 };
    const arm = [];
    if (g.forma === 'seno') arm.push([1, A]);
    else if (g.forma === 'cuadrada') {
      const N = 41;   // con suavizado para que no queden "orejas" en los bordes
      for (let n = 1; n < N; n += 2) {
        const x = Math.PI * n / N;
        arm.push([n, 4 * A / (Math.PI * n) * Math.sin(x) / x]);
      }
    } else {
      for (let n = 1; n < 26; n += 2) arm.push([n, 8 * A / (Math.PI * Math.PI * n * n) * (((n - 1) / 2) % 2 ? -1 : 1)]);
    }
    // El tiempo se cuenta desde lo que ve CH1 (el disparo): su parte principal cruza por cero subiendo en t = 0
    const fund = resolverProto(2 * Math.PI * f);
    const ref = angulo(modulo(fund.v1) > 1e-9 ? fund.v1 : (modulo(fund.v2) > 1e-9 ? fund.v2 : [1, 0]));
    const vin = [], vout = [];
    arm.forEach(function (p) {
      const n = p[0], c = n === 1 ? fund : resolverProto(2 * Math.PI * n * f);
      vin.push({ n: n, a: p[1] * modulo(c.v1), fi: angulo(c.v1) - n * ref });
      vout.push({ n: n, a: p[1] * modulo(c.v2), fi: angulo(c.v2) - n * ref });
    });
    const dc = resolverProto(0);
    return { f: f, vin: vin, vout: vout, dcIn: offset() * dc.v1[0], dcOut: offset() * dc.v2[0] };
  }
  function valor(lista, dc, f, t) {
    let v = dc;
    for (let i = 0; i < lista.length; i++) v += lista[i].a * Math.sin(2 * Math.PI * lista[i].n * f * t + lista[i].fi);
    return v;
  }
  // Mínimo y máximo en un periodo
  function extremos(lista, dc, f) {
    if (!lista.length) return [dc, dc];
    let mn = Infinity, mx = -Infinity;
    for (let k = 0; k < 720; k++) {
      const v = valor(lista, dc, f, k / 720 / f);
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    return [mn, mx];
  }

  // Lo que muestra el osciloscopio (con las puntas y los menús como estén)
  function lecturas() {
    const s = senales();
    const r = { s: s, f: s.f, hay: s.vin.length > 0, ciclos: 10 * tdiv() * s.f, ch: {} };
    ['ch1', 'ch2'].forEach(function (ch) {
      const lista = ch === 'ch1' ? s.vin : s.vout, dc = ch === 'ch1' ? s.dcIn : s.dcOut;
      const e = extremos(lista, dc, s.f), k = factor(ch), vd = vdiv(ch);
      r.ch[ch] = {
        lista: lista, dc: dc, k: k, vd: vd,
        pp: (e[1] - e[0]) * k,                       // pico a pico en pantalla
        cuadros: (e[1] - e[0]) * k / vd,
        sale: e[1] * k / vd > 4.02 || e[0] * k / vd < -4.02
      };
    });
    return r;
  }

  // ---------- 5. Números como los escribe el osciloscopio ----------
  function coma(x, d) { return x.toFixed(d).replace('.', ','); }
  function tres(x) { const a = Math.abs(x); return a >= 99.95 ? String(Math.round(x)) : coma(x, a >= 9.995 ? 1 : 2); }
  function voltios(v) { return Math.abs(v) >= 0.9995 ? tres(v) + ' V' : tres(v * 1000) + ' mV'; }
  function tiempo(t) {
    const a = Math.abs(t);
    if (a >= 0.9995e-3) return tres(t * 1e3) + ' ms';
    if (a >= 0.9995e-6) return tres(t * 1e6) + ' µs';
    return tres(t * 1e9) + ' ns';
  }
  function frecTexto(f) {
    if (f >= 1e6) return tres(f / 1e6) + ' MHz';
    if (f >= 1e3) return coma(f / 1e3, f >= 1e5 ? 1 : f >= 1e4 ? 2 : 3) + ' kHz';
    return coma(f, f >= 100 ? 1 : 2) + ' Hz';
  }
  // Pantalla del generador (LED): 4 cifras, con punto como el equipo
  function frecLed(f) {
    let v = f, u = 'Hz';
    if (f >= 1e6) { v = f / 1e6; u = 'MHz'; } else if (f >= 1e3) { v = f / 1e3; u = 'kHz'; }
    return v.toFixed(v >= 100 ? 1 : v >= 10 ? 2 : 3) + ' ' + u;
  }

  // ---------- 6. Dibujo de la pantalla del osciloscopio ----------
  const D = 40;   // 40 px por cuadro: 10 × 8 cuadros = 400 × 320
  function trazo(c, f, color) {
    const y = function (v) { return Math.max(-30, Math.min(350, 160 - v * c.k / c.vd * D)); };
    if (!c.lista.length) return '<line x1="0" y1="' + y(c.dc) + '" x2="400" y2="' + y(c.dc) + '" stroke="' + color + '" stroke-width="2.4"/>';
    const ciclos = 10 * tdiv() * f;
    if (ciclos > 40) {
      // Tantas ondas que se ven como una franja (como en el equipo de verdad)
      const e = extremos(c.lista, c.dc, f);
      return '<rect x="0" y="' + y(e[1]) + '" width="400" height="' + Math.max(2, y(e[0]) - y(e[1])) + '" fill="' + color + '" opacity=".75"/>';
    }
    const N = Math.min(1600, Math.max(400, Math.round(ciclos * 80)));
    let puntos = '';
    for (let i = 0; i <= N; i++) {
      const t = (i / N * 10 - 2) * tdiv();   // el disparo (t = 0) queda a 2 cuadros del borde izquierdo
      puntos += (i / N * 400).toFixed(1) + ',' + y(valor(c.lista, c.dc, f, t)).toFixed(1) + ' ';
    }
    return '<polyline points="' + puntos + '" fill="none" stroke="' + color + '" stroke-width="2.4" stroke-linejoin="round"/>';
  }
  function vdivTexto(v) { return v >= 0.9995 ? coma(v, 2) + 'V' : tres(v * 1000) + 'mV'; }

  function dibujarPantalla(r) {
    let s = '<defs><clipPath id="recorte"><rect width="400" height="320"/></clipPath></defs><rect width="400" height="346" fill="#05121a"/>';
    // Cuadrícula: 10 × 8 cuadros, con marcas finas en los ejes del centro
    for (let i = 1; i < 10; i++) s += '<line x1="' + i * D + '" y1="0" x2="' + i * D + '" y2="320" stroke="#2c3e48" stroke-width="' + (i === 5 ? 1.2 : 0.7) + '"' + (i === 5 ? '' : ' stroke-dasharray="2 3"') + '/>';
    for (let j = 1; j < 8; j++) s += '<line x1="0" y1="' + j * D + '" x2="400" y2="' + j * D + '" stroke="#2c3e48" stroke-width="' + (j === 4 ? 1.2 : 0.7) + '"' + (j === 4 ? '' : ' stroke-dasharray="2 3"') + '/>';
    for (let k = 0; k <= 50; k++) s += '<line x1="' + k * 8 + '" y1="157" x2="' + k * 8 + '" y2="163" stroke="#3d5361"/>';
    for (let k = 0; k <= 40; k++) s += '<line x1="197" y1="' + k * 8 + '" x2="203" y2="' + k * 8 + '" stroke="#3d5361"/>';
    s += '<g clip-path="url(#recorte)">' + trazo(r.ch.ch1, r.f, AMARILLO) + trazo(r.ch.ch2, r.f, AZUL) + '</g>';
    // Marcas de tierra de cada canal (borde izquierdo)
    s += '<path d="M0 154 l8 6 l-8 6 z" fill="' + AMARILLO + '"/><path d="M392 154 l-8 6 l8 6 z" fill="' + AZUL + '"/>';
    // Cursores de tiempo
    if (mesa.cursor.on) {
      [1, 2].forEach(function (n) {
        const x = mesa.cursor['c' + n] * D, elegido = mesa.cursor.sel === n;
        s += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="320" stroke="' + NARANJA + '" stroke-width="' + (elegido ? 2.4 : 1.6) + '" stroke-dasharray="6 4"/>';
        s += '<rect x="' + (x - 8) + '" y="298" width="16" height="18" rx="3" fill="' + NARANJA + '"' + (elegido ? '' : ' opacity=".6"') + '/>' +
             '<text x="' + x + '" y="312" text-anchor="middle" font-size="12" font-weight="800" fill="#05121a">' + n + '</text>';
      });
      const dt = (mesa.cursor.c2 - mesa.cursor.c1) * tdiv();
      s += '<rect x="6" y="6" width="134" height="26" rx="4" fill="#05121a" stroke="' + NARANJA + '"/>' +
           '<text x="14" y="24" font-size="14" font-weight="800" fill="' + NARANJA + '">Δt = ' + tiempo(dt) + '</text>';
    }
    // Mediciones (MEASURE)
    const filas = [];
    function pp(ch, color) {
      const c = r.ch[ch];
      if (!r.hay || c.pp < 1e-4) return [color, ch.toUpperCase() + ' Pk-Pk  ?'];   // sin señal en esa punta
      return [color, ch.toUpperCase() + ' Pk-Pk  ' + voltios(c.pp) + (c.sale ? ' ?' : '')];
    }
    if (mesa.medir.ch1) filas.push(pp('ch1', AMARILLO));
    if (mesa.medir.ch2) filas.push(pp('ch2', AZUL));
    if (mesa.medir.frec) filas.push(['#c9cfdb', 'CH1 Frec  ' + (r.hay && r.ch.ch1.pp >= 1e-4 && r.ciclos >= 1 ? frecTexto(r.f) : '?')]);
    if (filas.length) {
      const alto = 10 + filas.length * 20;
      s += '<rect x="214" y="6" width="180" height="' + alto + '" rx="4" fill="#05121a" stroke="#4a5a64"/>';
      filas.forEach(function (f, i) { s += '<text x="224" y="' + (24 + i * 20) + '" font-size="14" font-weight="800" fill="' + f[0] + '">' + f[1] + '</text>'; });
    }
    // Franja de abajo: escalas
    s += '<rect y="320" width="400" height="26" fill="#0b1c26"/>' +
         '<text x="8" y="338" font-size="13" font-weight="800" fill="' + AMARILLO + '">CH1 ' + vdivTexto(vdiv('ch1')) + '</text>' +
         '<text x="128" y="338" font-size="13" font-weight="800" fill="' + AZUL + '">CH2 ' + vdivTexto(vdiv('ch2')) + '</text>' +
         '<text x="392" y="338" text-anchor="end" font-size="13" font-weight="800" fill="#c9cfdb">M ' + tiempo(tdiv()).replace(' ', '') + '</text>';
    $('pantalla').innerHTML = s;
    $('pantalla').parentNode.classList.toggle('con-cursores', mesa.cursor.on);
  }

  // ---------- 7. Menú lateral del osciloscopio ----------
  function item(titulo, texto, accion, activo) {
    if (!accion) return '<div class="menu-item fijo"><span>' + titulo + '</span><b>' + texto + '</b></div>';
    return '<button class="menu-item' + (activo ? ' activo' : '') + '" data-accion="' + accion + '"><span>' + titulo + '</span><b>' + texto + '</b></button>';
  }
  function dibujarMenu() {
    const m = mesa.menu;
    let html;
    if (m === 'ch1' || m === 'ch2') {
      html = '<span class="menu-t ' + m + '">' + m.toUpperCase() + '</span>' + item('Acoplamiento', 'CC') +
             item('Sonda', mesa.sonda[m] + 'X', 'sonda', mesa.sonda[m] === 10) + item('Invertir', 'No');
    } else if (m === 'medir') {
      const est = function (on) { return on ? 'Encendida' : 'Apagada'; };
      html = '<span class="menu-t">MEASURE</span>' + item('CH1 Pk-Pk', est(mesa.medir.ch1), 'm-ch1', mesa.medir.ch1) +
             item('CH2 Pk-Pk', est(mesa.medir.ch2), 'm-ch2', mesa.medir.ch2) + item('CH1 Frec', est(mesa.medir.frec), 'm-frec', mesa.medir.frec);
    } else if (m === 'cursor') {
      html = '<span class="menu-t">CURSOR</span>' + item('Tipo', mesa.cursor.on ? 'Tiempo' : 'Apagado', 'c-tipo', mesa.cursor.on);
      if (mesa.cursor.on) html += item('Perilla mueve', 'Cursor 1', 'c-1', mesa.cursor.sel === 1) + item('Perilla mueve', 'Cursor 2', 'c-2', mesa.cursor.sel === 2);
    } else {
      html = '<p class="menu-vacio">Toca CH1 MENU, CH2 MENU, MEASURE o CURSOR</p>';
    }
    $('osc-menu').innerHTML = html;
    document.querySelectorAll('[data-menu]').forEach(function (b) {
      b.classList.toggle('activo', b.dataset.menu === m);
      b.setAttribute('aria-pressed', b.dataset.menu === m ? 'true' : 'false');
    });
  }
  $('osc-menu').addEventListener('click', function (evento) {
    const b = evento.target.closest('[data-accion]');
    if (!b) return;
    const a = b.dataset.accion, m = mesa.menu;
    if (a === 'sonda') mesa.sonda[m] = mesa.sonda[m] === 10 ? 1 : 10;
    else if (a === 'm-ch1') mesa.medir.ch1 = !mesa.medir.ch1;
    else if (a === 'm-ch2') mesa.medir.ch2 = !mesa.medir.ch2;
    else if (a === 'm-frec') mesa.medir.frec = !mesa.medir.frec;
    else if (a === 'c-tipo') mesa.cursor.on = !mesa.cursor.on;
    else if (a === 'c-1' || a === 'c-2') mesa.cursor.sel = a === 'c-1' ? 1 : 2;
    cambio();
  });
  document.querySelectorAll('[data-menu]').forEach(function (b) {
    b.addEventListener('click', function () {
      mesa.menu = mesa.menu === b.dataset.menu ? null : b.dataset.menu;
      cambio();
    });
  });

  // Los cursores también se arrastran directo en la pantalla
  let cursorArrastrado = null;
  function enCuadros(evento) {
    const caja = $('pantalla').getBoundingClientRect();
    return Math.max(0, Math.min(10, (evento.clientX - caja.left) / caja.width * 10));
  }
  $('pantalla').addEventListener('pointerdown', function (evento) {
    if (!mesa.cursor.on) return;
    // Si se toca cerca de una línea, se agarra esa; si no, se lleva ahí el cursor elegido en el menú
    const x = enCuadros(evento), d1 = Math.abs(x - mesa.cursor.c1), d2 = Math.abs(x - mesa.cursor.c2);
    cursorArrastrado = Math.min(d1, d2) <= 0.4 ? (d1 <= d2 ? 1 : 2) : mesa.cursor.sel;
    mesa.cursor.sel = cursorArrastrado;
    mesa.cursor['c' + cursorArrastrado] = Math.round(x * 100) / 100;
    this.setPointerCapture(evento.pointerId);
    cambio();
  });
  $('pantalla').addEventListener('pointermove', function (evento) {
    if (!cursorArrastrado) return;
    mesa.cursor['c' + cursorArrastrado] = Math.round(enCuadros(evento) * 100) / 100;
    cambio();
  });
  ['pointerup', 'pointercancel'].forEach(function (ev) {
    $('pantalla').addEventListener(ev, function () { cursorArrastrado = null; });
  });

  // ---------- 8. Perillas: se arrastran o se usan sus botones − y + ----------
  const repintar = [];
  function crearPerilla(caja, op) {
    caja.className = 'perilla';
    caja.innerHTML = '<span class="perilla-t">' + op.titulo + '</span>' +
      '<div class="perilla-fila"><button class="mm" data-d="-1" aria-label="Bajar ' + op.titulo + '">−</button>' +
      '<div class="pomo" tabindex="0" role="slider" aria-label="' + op.titulo + '"><svg viewBox="0 0 48 48" aria-hidden="true">' +
      '<circle cx="24" cy="24" r="21" class="pomo-c"/><line x1="24" y1="24" x2="24" y2="7" class="pomo-l"/></svg></div>' +
      '<button class="mm" data-d="1" aria-label="Subir ' + op.titulo + '">+</button></div>' +
      '<span class="perilla-v"></span>';
    const pomo = caja.querySelector('.pomo'), texto = caja.querySelector('.perilla-v');
    function mover(d) { if (op.paso(d)) cambio(); }
    // Un toque = un paso; si se deja presionado avanza solo (y más rápido después de un rato)
    caja.querySelectorAll('.mm').forEach(function (b) {
      let espera = null, repetir = null, inicio = 0;
      function parar() { clearTimeout(espera); clearInterval(repetir); espera = repetir = null; }
      b.addEventListener('pointerdown', function (evento) {
        evento.preventDefault();
        const d = Number(b.dataset.d);
        mover(d);
        inicio = Date.now();
        parar();
        espera = setTimeout(function () {
          repetir = setInterval(function () { mover(d * (Date.now() - inicio > 2000 ? 5 : 1)); }, 70);
        }, 400);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, parar); });
      b.addEventListener('keydown', function (evento) {
        if (evento.key === 'Enter' || evento.key === ' ') { evento.preventDefault(); mover(Number(b.dataset.d)); }
      });
    });
    // Arrastrar: hacia arriba o a la derecha sube
    let arrastre = null;
    pomo.addEventListener('pointerdown', function (evento) {
      evento.preventDefault();
      arrastre = { x: evento.clientX, y: evento.clientY, hechos: 0 };
      pomo.setPointerCapture(evento.pointerId);
      pomo.classList.add('girando');
    });
    pomo.addEventListener('pointermove', function (evento) {
      if (!arrastre) return;
      const total = Math.trunc(((evento.clientX - arrastre.x) - (evento.clientY - arrastre.y)) / (op.sensible || 6));
      if (total !== arrastre.hechos) { mover(total - arrastre.hechos); arrastre.hechos = total; }
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) {
      pomo.addEventListener(ev, function () { arrastre = null; pomo.classList.remove('girando'); });
    });
    pomo.addEventListener('keydown', function (evento) {
      const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[evento.key];
      if (d) { evento.preventDefault(); mover(d); }
    });
    repintar.push(function () {
      pomo.querySelector('svg').style.transform = 'rotate(' + (-135 + 270 * op.fraccion()) + 'deg)';
      texto.textContent = op.texto();
      pomo.setAttribute('aria-valuetext', op.texto());
    });
  }
  // Cambia un número dentro de sus límites; dice si cambió
  function mueve(obj, clave, d, min, max) {
    const nuevo = Math.max(min, Math.min(max, obj[clave] + d));
    if (nuevo === obj[clave]) return false;
    obj[clave] = nuevo;
    return true;
  }

  // ---------- 9. Generador ----------
  $('gen-formas').innerHTML = FORMAS.map(function (f) {
    return '<button data-forma="' + f[0] + '" aria-label="Onda ' + f[1].toLowerCase() + '" title="' + f[1] + '">' +
           '<svg viewBox="0 0 28 14" aria-hidden="true"><path d="' + f[2] + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></button>';
  }).join('');
  $('gen-rangos').innerHTML = RANGO_TXT.map(function (t, i) { return '<button data-rango="' + i + '">' + t + '</button>'; }).join('');
  $('gen-formas').addEventListener('click', function (evento) {
    const b = evento.target.closest('[data-forma]');
    if (b) { mesa.gen.forma = b.dataset.forma; cambio(); }
  });
  $('gen-rangos').addEventListener('click', function (evento) {
    const b = evento.target.closest('[data-rango]');
    if (b) { mesa.gen.rango = Number(b.dataset.rango); cambio(); }
  });
  $('gen-output').addEventListener('click', function () { mesa.gen.salida = !mesa.gen.salida; cambio(); });
  ['freq', 'ampl', 'offset'].forEach(function (id) {
    const div = document.createElement('div');
    div.id = 'perilla-' + id;
    $('gen-perillas').appendChild(div);
  });
  crearPerilla($('perilla-freq'), {
    titulo: 'FREQ', sensible: 4,
    paso: function (d) { return mueve(mesa.gen, 'dial', d, 100, 999); },
    fraccion: function () { return (mesa.gen.dial - 100) / 899; },
    texto: function () { return '× ' + coma(mesa.gen.dial / 100, 2); }
  });
  // AMPL no dice cuánto llega al circuito: eso se mide con el osciloscopio
  crearPerilla($('perilla-ampl'), {
    titulo: 'AMPL', sensible: 5,
    paso: function (d) { return mueve(mesa.gen, 'ampl', d, 0, 200); },
    fraccion: function () { return mesa.gen.ampl / 200; },
    texto: function () { return ''; }
  });
  crearPerilla($('perilla-offset'), {
    titulo: 'OFFSET', sensible: 6,
    paso: function (d) { return mueve(mesa.gen, 'offset', d, -50, 50); },
    fraccion: function () { return (mesa.gen.offset + 50) / 100; },
    texto: function () { return (mesa.gen.offset > 0 ? '+' : '') + coma(offset(), 1) + ' V'; }
  });
  function pintarGenerador() {
    $('gen-display').textContent = frecLed(frecuencia());
    document.querySelectorAll('[data-forma]').forEach(function (b) { b.classList.toggle('activo', b.dataset.forma === mesa.gen.forma); });
    document.querySelectorAll('[data-rango]').forEach(function (b) { b.classList.toggle('activo', Number(b.dataset.rango) === mesa.gen.rango); });
    const o = $('gen-output');
    o.classList.toggle('encendida', mesa.gen.salida);
    o.setAttribute('aria-pressed', mesa.gen.salida ? 'true' : 'false');
    o.textContent = mesa.gen.salida ? 'OUTPUT ON' : 'OUTPUT OFF';
  }

  // ---------- 10. Perillas del osciloscopio ----------
  ['ch1', 'ch2'].forEach(function (ch, i) {
    crearPerilla($('perilla-v' + (i + 1)), {
      titulo: 'Volts/div', sensible: 16,
      paso: function (d) { return mueve(mesa.vdiv, ch, d > 0 ? 1 : -1, 0, VDIV.length - 1); },
      fraccion: function () { return mesa.vdiv[ch] / (VDIV.length - 1); },
      texto: function () { return voltios(vdiv(ch)); }
    });
  });
  crearPerilla($('perilla-t'), {
    titulo: 'Sec/div', sensible: 16,
    paso: function (d) { return mueve(mesa, 'tdiv', d > 0 ? 1 : -1, 0, TDIV.length - 1); },
    fraccion: function () { return mesa.tdiv / (TDIV.length - 1); },
    texto: function () { return tiempo(tdiv()); }
  });
  crearPerilla($('perilla-c'), {
    titulo: 'Mover cursor', sensible: 4,
    paso: function (d) {
      if (!mesa.cursor.on) return false;
      const k = 'c' + mesa.cursor.sel, nuevo = Math.max(0, Math.min(10, Math.round((mesa.cursor[k] + d * 0.02) * 100) / 100));
      if (nuevo === mesa.cursor[k]) return false;
      mesa.cursor[k] = nuevo;
      return true;
    },
    fraccion: function () { return mesa.cursor.on ? mesa.cursor['c' + mesa.cursor.sel] / 10 : 0; },
    texto: function () { return mesa.cursor.on ? 'cursor ' + mesa.cursor.sel : 'apagados'; }
  });

  // ---------- 11. Esquema, protoboard y puntas ----------
  // Esquema de referencia (como el de la guía): Vin, R₁‖C₁ en serie con R₂‖C₂, CH1 en Vin y CH2 en Vout
  function dibujarEsquema() {
    const g = 'fill="none" stroke="#1d2230" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
    let s = '';
    s += '<circle cx="46" cy="112" r="17" ' + g + '/><path d="M36 112 C 40 102, 44 102, 46 112 S 52 122, 56 112" ' + g + '/>' +
         '<text x="24" y="117" text-anchor="end" class="e-n">V<tspan dy="4" class="e-sub">in</tspan></text>';
    s += '<path d="M46 95 V62 H138 l5 -7 l10 14 l10 -14 l10 14 l10 -14 l10 14 l5 -7 H316" ' + g + '/>';
    s += '<path d="M120 62 V30 H164 M164 20 V40 M172 20 V40 M172 30 H216 V62" ' + g + '/>';
    s += '<path d="M246 62 V84 l-7 5 l14 10 l-14 10 l14 10 l-14 10 l14 10 l-7 5 V156" ' + g + '/>';
    s += '<path d="M284 62 V105 M272 105 H296 M272 113 H296 M284 113 V156" ' + g + '/>';
    s += '<path d="M46 129 V156 H284 M110 156 V164 M100 164 H120 M104 169 H116 M108 174 H112" ' + g + '/>';
    s += '<circle cx="246" cy="62" r="3.5" fill="#1d2230"/><circle cx="246" cy="156" r="3.5" fill="#1d2230"/>' +
         '<circle cx="84" cy="62" r="5" fill="#1d63c4"/><circle cx="316" cy="62" r="5" fill="#1d63c4"/>';
    s += '<text x="84" y="50" text-anchor="middle" class="e-ch">CH1</text><text x="316" y="50" text-anchor="middle" class="e-ch">CH2</text>' +
         '<text x="316" y="86" text-anchor="middle" class="e-n">V<tspan dy="4" class="e-sub">out</tspan></text>' +
         '<text x="168" y="15" text-anchor="middle" class="e-n">C₁ <tspan class="e-v">1 nF</tspan></text>' +
         '<text x="168" y="88" text-anchor="middle" class="e-n">R₁ <tspan class="e-v">1 kΩ</tspan></text>' +
         '<text x="234" y="108" text-anchor="end" class="e-n">R₂</text><text x="234" y="123" text-anchor="end" class="e-v">10 kΩ</text>' +
         '<text x="300" y="108" class="e-n">C₂</text><text x="300" y="123" class="e-v">10 nF</text>' +
         '<text x="178" y="150" text-anchor="middle" class="e-s">tierra común</text>';
    $('esquema').innerHTML = s;
  }

  // Estado mientras se arma: la pieza en la mano, la columna que se está mostrando y un aviso
  let sel = null;        // { id, patas: [], antes } al poner una pieza · { id, mover: k } al mover una de sus patas
  let mostrada = null;   // columna o riel resaltado al tocar un hueco vacío
  let aviso = '';
  function todosLosHuecos() {
    const lista = [];
    for (let c = 1; c <= COLS; c++) {
      lista.push('p' + c, 'n' + c);
      for (let f = 1; f <= FILAS; f++) lista.push('c' + c + '-' + f);
    }
    return lista;
  }
  // Qué pata está en un hueco (también la primera pata de la pieza que se está poniendo)
  function ocupante(h) {
    for (const id in mesa.proto) {
      const k = mesa.proto[id].indexOf(h);
      if (k >= 0) return { id: id, k: k };
    }
    if (sel && sel.patas && sel.patas.indexOf(h) >= 0) return { id: sel.id, k: 0, mano: true };
    return null;
  }
  function tituloHueco(h) {
    if (h[0] === 'c') { const m = h.split('-'); return 'Columna ' + m[0].slice(1) + ', hueco ' + m[1]; }
    return 'Riel ' + (h[0] === 'p' ? '+' : '−') + ', hueco ' + h.slice(1);
  }

  // Dibujos de cada pieza
  function simboloTierra(x, y, color) {
    return '<path d="M' + x + ' ' + (y - 4) + ' v3 M' + (x - 4.5) + ' ' + (y - 1) + ' h9 M' + (x - 3) + ' ' + (y + 2) + ' h6 M' + (x - 1.2) + ' ' + (y + 5) + ' h2.4" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round" fill="none"/>';
  }
  function cabeza(pz, x, y, r) {
    if (pz.tipo === 't') return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#1d2230" stroke="' + pz.color + '" stroke-width="3"/>' + simboloTierra(x, y, '#ffffff');
    const letra = pz.tipo === 'g' ? '#ffffff' : '#1d2230';
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + pz.color + '" stroke="#1d2230" stroke-width="1.5"/>' +
           '<text x="' + x + '" y="' + (y + 4) + '" text-anchor="middle" class="pb-letra" style="fill:' + letra + '">' + pz.letra + '</text>';
  }
  function cuerpo(pz, x, y, ang) {
    if (pz.tipo === 'c') return '<circle cx="' + x + '" cy="' + y + '" r="9" fill="#e39a35" stroke="#a8641a" stroke-width="1.5"/>';
    let s = '<g transform="translate(' + x + ' ' + y + ') rotate(' + ang + ')"><rect x="-14" y="-6" width="28" height="12" rx="6" fill="#e8d2a2" stroke="#a88b55" stroke-width="1.2"/>';
    [-9, -4, 1, 8].forEach(function (bx, i) { s += '<rect x="' + bx + '" y="-6" width="3" height="12" fill="' + pz.bandas[i] + '"/>'; });
    return s + '</g>';
  }
  function icono(pz) {
    let s = '';
    if (pz.tipo === 'r' || pz.tipo === 'c') s = '<line x1="1" y1="9" x2="29" y2="9" stroke="#8e95a3" stroke-width="2"/>' + (pz.tipo === 'c'
      ? '<circle cx="15" cy="9" r="6.5" fill="#e39a35" stroke="#a8641a" stroke-width="1.2"/>'
      : '<rect x="6" y="4" width="18" height="10" rx="5" fill="#e8d2a2" stroke="#a88b55"/>' +
        [9, 13, 17, 21].map(function (bx, i) { return '<rect x="' + bx + '" y="4" width="2" height="10" fill="' + pz.bandas[i] + '"/>'; }).join(''));
    else if (pz.tipo === 'w') s = '<path d="M3 14 Q15 -3 27 14" fill="none" stroke="' + pz.color + '" stroke-width="3.2" stroke-linecap="round"/>';
    else s = cabeza(pz, 15, 9, 7.5);
    return '<svg viewBox="0 0 30 18" aria-hidden="true">' + s + '</svg>';
  }
  // Cable que sale de un caimán o de una punta hacia el borde más cercano (al equipo)
  function cableAfuera(pz, a) {
    const der = a.x > PB.w / 2, ex = der ? PB.w + 6 : -6, ey = Math.min(PB.h - 4, a.y + 30);
    const d = 'M' + a.x + ' ' + a.y + ' C ' + (a.x + (der ? 30 : -30)) + ' ' + (a.y + 4) + ', ' + (ex + (der ? -24 : 24)) + ' ' + ey + ', ' + ex + ' ' + ey;
    const color = pz.tipo === 't' ? '#1d2230' : pz.color;
    return '<path d="' + d + '" fill="none" stroke="#1d2230" stroke-width="5.5" stroke-linecap="round" opacity=".85"/>' +
           '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="3.2" stroke-linecap="round"/>';
  }
  function etiqueta(texto, x, y) {
    return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="middle" class="pb-et">' + texto + '</text>';
  }

  function dibujarProto() {
    const W = PB.w, H = PB.h, luz = {};
    if (mostrada) luz[mostrada] = true;
    let s = '<rect x="1" y="1" width="' + (W - 2) + '" height="' + (H - 2) + '" rx="12" fill="#f4f2ea" stroke="#c9ced8" stroke-width="2"/>';
    // Rieles: + arriba (línea roja) y − abajo (línea azul), unidos a lo largo
    [['+', PB.yP, '#d93025', -12], ['−', PB.yN, '#1d63c4', 12]].forEach(function (r) {
      s += '<rect x="16" y="' + (r[1] - 15) + '" width="' + (W - 32) + '" height="30" rx="6" fill="' + (luz[r[0]] ? '#cfe0fb' : '#e9e6dc') + '"/>' +
           '<line x1="20" y1="' + (r[1] + r[3]) + '" x2="' + (W - 20) + '" y2="' + (r[1] + r[3]) + '" stroke="' + r[2] + '" stroke-width="2"/>' +
           '<text x="9" y="' + (r[1] + 6) + '" text-anchor="middle" class="pb-riel" style="fill:' + r[2] + '">' + r[0] + '</text>';
    });
    // Columnas: cada una con sus 5 huecos unidos por dentro
    for (let c = 1; c <= COLS; c++) {
      const x = PB.x0 + (c - 1) * PB.dx;
      s += '<rect x="' + (x - 15) + '" y="' + (PB.y0 - 16) + '" width="30" height="' + ((FILAS - 1) * PB.dy + 32) + '" rx="8" fill="' + (luz['c' + c] ? '#cfe0fb' : '#e9e6dc') + '"/>' +
           '<text x="' + x + '" y="' + PB.yNum + '" text-anchor="middle" class="pb-num">' + c + '</text>';
    }
    todosLosHuecos().forEach(function (h) {
      const q = posHueco(h);
      s += '<rect x="' + (q.x - 4.5) + '" y="' + (q.y - 4.5) + '" width="9" height="9" rx="2" fill="#4a4f5c"/>';
      if (sel && sel.patas && !ocupante(h)) s += '<circle cx="' + q.x + '" cy="' + q.y + '" r="9" fill="none" stroke="#1d63c4" stroke-width="1.5" opacity=".35"/>';
    });
    // Piezas puestas y la que se está poniendo (si ya tiene su primera pata)
    const puestas = [];
    PIEZAS.forEach(function (pz) { if (mesa.proto[pz.id]) puestas.push([pz, mesa.proto[pz.id]]); });
    if (sel && sel.patas && sel.patas.length) puestas.push([PIEZA[sel.id], sel.patas]);
    let capas = ['', '', '', ''];   // 0 patas y cables puente · 1 cuerpos y nombres · 2 cables al equipo · 3 caimanes y puntas
    puestas.forEach(function (it) {
      const pz = it[0], v = it[1], a = posHueco(v[0]);
      if (pz.patas === 1) { capas[2] += cableAfuera(pz, a); capas[3] += cabeza(pz, a.x, a.y, 8.5); return; }
      if (v.length === 1) {   // pieza a medio poner: solo tiene la primera pata
        capas[3] += '<circle cx="' + a.x + '" cy="' + a.y + '" r="11" fill="none" stroke="#1d63c4" stroke-width="3"/><circle cx="' + a.x + '" cy="' + a.y + '" r="4" fill="#8e95a3"/>' +
                    etiqueta(pz.nombre, a.x, a.y - 16);
        return;
      }
      const b = posHueco(v[1]), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (pz.tipo === 'w') {
        capas[0] += '<path d="M' + a.x + ' ' + a.y + ' Q ' + mx + ' ' + (my - 18) + ' ' + b.x + ' ' + b.y + '" fill="none" stroke="' + pz.color + '" stroke-width="4" stroke-linecap="round"/>' +
                    '<circle cx="' + a.x + '" cy="' + a.y + '" r="3.5" fill="' + pz.color + '"/><circle cx="' + b.x + '" cy="' + b.y + '" r="3.5" fill="' + pz.color + '"/>';
        return;
      }
      let ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      if (ang > 90) ang -= 180; else if (ang < -90) ang += 180;
      const rad = ang * Math.PI / 180, nx = Math.sin(rad), ny = -Math.cos(rad);   // perpendicular, hacia arriba
      capas[0] += '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" stroke="#8e95a3" stroke-width="2.2" stroke-linecap="round"/>' +
                  '<circle cx="' + a.x + '" cy="' + a.y + '" r="3" fill="#8e95a3"/><circle cx="' + b.x + '" cy="' + b.y + '" r="3" fill="#8e95a3"/>';
      capas[1] += cuerpo(pz, mx, my, ang) + etiqueta(pz.nombre, mx + nx * 17, my + ny * 17 + 4);
    });
    s += capas.join('');
    // Lo que se está moviendo: anillo naranja en la pata elegida
    if (sel && sel.mover !== undefined) {
      const q = posHueco(mesa.proto[sel.id][sel.mover]);
      s += '<circle cx="' + q.x + '" cy="' + q.y + '" r="12" fill="none" stroke="' + NARANJA + '" stroke-width="3"/>';
    }
    // Zonas para tocar cada hueco
    todosLosHuecos().forEach(function (h) {
      const q = posHueco(h);
      s += '<circle data-hueco="' + h + '" cx="' + q.x + '" cy="' + q.y + '" r="17" fill="transparent"><title>' + tituloHueco(h) + '</title></circle>';
    });
    return s;
  }

  $('bandeja').innerHTML = [['Piezas', ['R1', 'C1', 'R2', 'C2', 'W1', 'W2']], ['Generador', ['GP', 'GN']], ['Osciloscopio', ['P1', 'T1', 'P2', 'T2']]].map(function (grupo) {
    return '<div class="bandeja-grupo"><span class="grupo-t">' + grupo[0] + '</span><div class="bandeja-botones">' +
      grupo[1].map(function (id) {
        const pz = PIEZA[id];
        return '<button class="pieza" data-pieza="' + id + '" aria-pressed="false">' + icono(pz) +
               '<span class="pieza-txt"><b>' + pz.nombre + '</b><small>' + pz.valor + '</small></span></button>';
      }).join('') + '</div></div>';
  }).join('');

  function textoEstado() {
    if (aviso) return aviso;
    if (sel && sel.mover !== undefined) return 'Moviendo una pata de ' + PIEZA[sel.id].largo + ': toca el hueco nuevo, o la misma pata para dejarla donde estaba.';
    if (sel) {
      const pz = PIEZA[sel.id];
      if (pz.patas === 1) return 'Toca el hueco donde va ' + pz.largo + '.';
      return pz.largo.charAt(0).toUpperCase() + pz.largo.slice(1) + ': toca el hueco de la ' + (sel.patas.length ? 'segunda' : 'primera') + ' pata.';
    }
    if (mostrada) return mostrada.length === 1
      ? 'El riel ' + mostrada + ' está unido a lo largo: todo lo que pongas en él queda conectado.'
      : 'Los 5 huecos de la columna ' + mostrada.slice(1) + ' están unidos por dentro: lo que pongas en ellos queda conectado.';
    return 'Toca una pieza de la bandeja y luego el hueco de cada pata. Para mover algo, toca su pata en la protoboard.';
  }
  function pintarProto() {
    $('proto').innerHTML = dibujarProto();
    document.querySelectorAll('[data-pieza]').forEach(function (b) {
      const id = b.dataset.pieza, mano = !!sel && sel.id === id;
      b.classList.toggle('puesta', !!mesa.proto[id]);
      b.classList.toggle('elegida', mano);
      b.setAttribute('aria-pressed', mano ? 'true' : 'false');
    });
    $('proto-estado').textContent = textoEstado();
    $('btn-quitar').disabled = !(sel && (sel.mover !== undefined || sel.antes));
    $('btn-vaciar-proto').disabled = !sel && !Object.keys(mesa.proto).length;
  }
  // Suelta la pieza que está en la mano; si se estaba moviendo, vuelve a donde estaba
  function soltar() {
    if (!sel) return false;
    const volver = sel.antes && !mesa.proto[sel.id];
    if (volver) mesa.proto[sel.id] = sel.antes;
    sel = null;
    return volver;
  }
  $('bandeja').addEventListener('click', function (evento) {
    const b = evento.target.closest('[data-pieza]');
    if (!b) return;
    const id = b.dataset.pieza, misma = sel && sel.id === id;
    aviso = '';
    mostrada = null;
    soltar();
    if (!misma) {
      // Al tocar una pieza que ya estaba puesta, se levanta para ponerla en otro lado
      sel = { id: id, patas: [], antes: mesa.proto[id] || null };
      delete mesa.proto[id];
    }
    cambio();
  });
  function tocarHueco(h) {
    const o = ocupante(h);
    aviso = '';
    if (sel && sel.mover !== undefined) {
      if (o && o.id === sel.id && o.k === sel.mover) sel = null;
      else if (o) aviso = 'Ese hueco ya tiene una pata de ' + PIEZA[o.id].nombre + '. Elige uno libre.';
      else { mesa.proto[sel.id][sel.mover] = h; sel = null; }
    } else if (sel) {
      if (o) aviso = o.mano ? 'Ahí ya está la primera pata. Toca otro hueco para la segunda.' : 'Ese hueco ya tiene una pata de ' + PIEZA[o.id].nombre + '. Elige uno libre.';
      else {
        sel.patas.push(h);
        if (sel.patas.length === PIEZA[sel.id].patas) { mesa.proto[sel.id] = sel.patas; sel = null; }
      }
    } else if (o) {
      sel = { id: o.id, mover: o.k };
      mostrada = null;
    } else {
      mostrada = mostrada === baseDe(h) ? null : baseDe(h);
    }
    cambio();
  }
  $('proto').addEventListener('click', function (evento) {
    const t = evento.target.closest('[data-hueco]');
    if (t) tocarHueco(t.dataset.hueco);
  });
  $('btn-quitar').addEventListener('click', function () {
    if (!sel) return;
    delete mesa.proto[sel.id];
    sel = null;
    aviso = '';
    cambio();
  });
  $('btn-vaciar-proto').addEventListener('click', function () {
    mesa.proto = {};
    sel = null;
    aviso = '';
    mostrada = null;
    cambio();
  });
  document.addEventListener('keydown', function (evento) {
    if (evento.key === 'Escape' && sel) { soltar(); aviso = ''; cambio(); }
  });

  // Interruptor ×1 / ×10 de cada punta y dónde quedó enganchada
  $('puntas4').innerHTML = ['ch1', 'ch2'].map(function (ch) {
    return '<div class="punta4 ' + ch + '"><span class="punta-nombre"><i aria-hidden="true"></i><span>Punta de ' + ch.toUpperCase() +
           '<small id="donde-' + ch + '"></small></span></span>' +
           '<button class="interruptor" data-punta="' + ch + '" aria-label="Interruptor de la punta de ' + ch.toUpperCase() + '">' +
           '<span data-x="1">×1</span><span data-x="10">×10</span></button></div>';
  }).join('');
  $('puntas4').addEventListener('click', function (evento) {
    const b = evento.target.closest('[data-punta]');
    if (!b) return;
    const ch = b.dataset.punta;
    mesa.puntas[ch] = mesa.puntas[ch] === 10 ? 1 : 10;
    cambio();
  });
  function pintarPuntas() {
    document.querySelectorAll('[data-punta]').forEach(function (b) {
      const x = mesa.puntas[b.dataset.punta];
      b.querySelectorAll('span').forEach(function (s) { s.classList.toggle('activo', Number(s.dataset.x) === x); });
      b.setAttribute('aria-valuetext', '×' + x);
      b.title = 'Ahora en ×' + x + ' (toca para cambiar)';
    });
    [['ch1', 'P1'], ['ch2', 'P2']].forEach(function (q) {
      const p = mesa.proto[q[1]];
      $('donde-' + q[0]).textContent = p ? 'enganchada en ' + nombreBase(baseDe(p[0])) : 'sin conectar';
    });
  }

  // ---------- 12. Los 7 retos ----------
  // Dibujitos del mapa (el CSS de .mini-esq pinta los textos de negro; por eso llevan style)
  function onda(x0, w, cy, a, fase, color, ciclos) {
    let p = '';
    for (let k = 0; k <= 100; k++) p += (x0 + k / 100 * w).toFixed(1) + ',' + (cy - a * Math.sin(2 * Math.PI * (ciclos || 2) * k / 100 + (fase || 0))).toFixed(1) + ' ';
    return '<polyline points="' + p + '" fill="none" stroke="' + color + '" stroke-width="2.6"/>';
  }
  function mini(cuerpo) { return '<svg class="mini-esq" viewBox="0 0 220 130" aria-hidden="true">' + cuerpo + '</svg>'; }
  const NEGRO = '<rect x="10" y="10" width="200" height="110" rx="10" fill="#05121a"/>';
  // Protoboard pequeña: rieles, huecos, R₁ y C₁ en paralelo y dos puntas
  const MINI_PROTO = (function () {
    let s = '<rect x="14" y="14" width="192" height="102" rx="10" fill="#f4f2ea" stroke="#c9ced8" stroke-width="2"/>' +
            '<line x1="24" y1="24" x2="196" y2="24" stroke="#d93025" stroke-width="2"/><line x1="24" y1="108" x2="196" y2="108" stroke="#1d63c4" stroke-width="2"/>';
    for (let c = 0; c < 8; c++) {
      s += '<rect x="' + (31 + c * 22) + '" y="98" width="5" height="5" rx="1" fill="#4a4f5c"/>';
      for (let f = 0; f < 4; f++) s += '<rect x="' + (31 + c * 22) + '" y="' + (36 + f * 16) + '" width="5" height="5" rx="1" fill="#4a4f5c"/>';
    }
    return s + '<line x1="55" y1="54" x2="143" y2="54" stroke="#8e95a3" stroke-width="2.5"/><rect x="85" y="48" width="28" height="12" rx="6" fill="#e8d2a2" stroke="#a88b55"/>' +
           '<rect x="90" y="48" width="3" height="12" fill="#7a4a1d"/><rect x="95" y="48" width="3" height="12" fill="#1d2230"/><rect x="100" y="48" width="3" height="12" fill="#d93025"/>' +
           '<line x1="55" y1="70" x2="143" y2="70" stroke="#8e95a3" stroke-width="2.5"/><circle cx="99" cy="70" r="8" fill="#e39a35" stroke="#a8641a" stroke-width="1.5"/>' +
           '<circle cx="55" cy="38" r="7" fill="#d93025" stroke="#1d2230" stroke-width="1.5"/><circle cx="55" cy="86" r="7" fill="' + AMARILLO + '" stroke="#1d2230" stroke-width="1.5"/>' +
           '<circle cx="143" cy="38" r="7" fill="' + AZUL + '" stroke="#1d2230" stroke-width="1.5"/>';
  })();
  const MINIS = [
    mini(MINI_PROTO),
    mini('<rect x="20" y="22" width="180" height="86" rx="10" fill="#c9ced8"/><rect x="32" y="34" width="156" height="34" rx="5" fill="#1a0606"/>' +
         '<text x="180" y="59" text-anchor="end" style="fill:#ff4a3a;font-family:Courier New,monospace;font-size:20px">24.60 kHz</text>' + onda(40, 90, 90, 9, 0, '#1d2230') +
         '<rect x="146" y="80" width="38" height="18" rx="5" fill="#1d63c4"/><text x="165" y="93" text-anchor="middle" style="fill:white;font-size:10px">ON</text>'),
    mini('<path d="M22 66 H120" stroke="#1d2230" stroke-width="10" stroke-linecap="round"/><rect x="120" y="54" width="54" height="24" rx="12" fill="#3a3f4a"/>' +
         '<path d="M174 66 h24" stroke="#9aa1b2" stroke-width="4"/><rect x="128" y="58" width="38" height="16" rx="8" fill="#1d63c4"/>' +
         '<text x="147" y="70" text-anchor="middle" style="fill:white;font-size:11px">×10</text><text x="110" y="108" text-anchor="middle" style="fill:#1d63c4">punta ×10 = menú 10X</text>'),
    mini(NEGRO + onda(20, 180, 65, 36, 0, AMARILLO) + '<path d="M196 29 V101 M190 35 l6 -6 l6 6 M190 95 l6 6 l6 -6" stroke="white" stroke-width="2" fill="none"/>' +
         '<text x="150" y="70" text-anchor="end" style="fill:white">2 Vpp</text>'),
    mini(NEGRO + onda(20, 180, 60, 34, 0, AMARILLO) + onda(20, 180, 60, 17, -0.86, AZUL) + '<text x="110" y="114" text-anchor="middle" style="fill:white;font-size:12px">Vout / Vin</text>'),
    mini(NEGRO + onda(20, 180, 58, 32, 0, AMARILLO) + onda(20, 180, 58, 32, -0.86, AZUL) +
         '<path d="M65 20 V98 M77 20 V98" stroke="' + NARANJA + '" stroke-width="2" stroke-dasharray="4 3"/><text x="110" y="114" text-anchor="middle" style="fill:' + NARANJA + ';font-size:12px">Δt → fase</text>'),
    mini('<rect x="10" y="10" width="200" height="110" rx="10" fill="#f5f6fa"/><path d="M30 20 V98 H200" stroke="#9aa1b2" stroke-width="1.5" fill="none"/>' +
         '<path d="M30 26 C 70 30, 95 92, 125 92 S 175 40, 200 28" stroke="#1d63c4" stroke-width="3" fill="none"/>' +
         '<circle cx="58" cy="34" r="5" fill="#d93025"/><circle cx="104" cy="84" r="5" fill="#d93025"/><circle cx="170" cy="50" r="5" fill="#d93025"/>' +
         '<text x="58" y="114" text-anchor="middle" class="suave">2,46k</text><text x="104" y="114" text-anchor="middle" class="suave">24,6k</text><text x="170" y="114" text-anchor="middle" class="suave">246k</text>')
  ];

  // Ayudas para revisar
  function cerca(x, objetivo, relativo) { return Math.abs(x - objetivo) <= Math.abs(objetivo) * relativo; }
  function numero(texto) {
    if (texto === undefined || texto === null) return null;
    const limpio = String(texto).replace(/−/g, '-').replace(',', '.').replace(/[^0-9.\-]/g, '');
    if (!limpio || limpio === '-' || limpio === '.') return null;
    const n = parseFloat(limpio);
    return isFinite(n) ? n : null;
  }
  function campo(id) { return numero((memo().campos || {})[id]); }
  // Un voltaje escrito: si pasa de 20 se entiende que está en mV (976 → 0,976 V)
  function campoVoltios(id) { const v = campo(id); return v === null ? null : (Math.abs(v) > 20 ? v / 1000 : v); }
  function genEn(f) {
    const g = mesa.gen;
    return g.salida && g.forma === 'seno' && cerca(frecuencia(), f, 0.01) && g.offset === 0;
  }
  function puntasBien() { return mesa.puntas.ch1 === 10 && mesa.puntas.ch2 === 10 && mesa.sonda.ch1 === 10 && mesa.sonda.ch2 === 10; }
  function vinBien(r) { const c = r.ch.ch1; return !c.sale && c.pp >= 1.9 && c.pp <= 2.1; }
  // Primer paso de los retos 5 y 6: que la mesa siga como quedó en los anteriores
  function base(r) {
    let pista = null;
    if (!genEn(24600)) pista = 'Deja el generador como en el reto 2: senoidal, 24,6 kHz, OUTPUT ON y OFFSET en 0 V.';
    else if (!puntasBien()) pista = 'Las dos puntas y los dos menús deben estar en ×10 (reto 3).';
    else if (!vinBien(r)) pista = 'CH1 debe marcar 2 Vpp (entre 1,90 y 2,10 V): ajusta AMPL como en el reto 4.';
    return { ok: !pista, texto: 'Generador en 24,6 kHz, puntas en ×10 y CH1 en 2 Vpp', pista: pista };
  }
  function pistaVolts(c, ch, nombre) {
    if (c.cuadros > 8 || c.sale) return 'La onda ' + nombre + ' se sale de la pantalla: gira ' + ch + ' VOLTS/DIV hacia un valor más grande (+).';
    return 'La onda ' + nombre + ' se ve pequeña (' + coma(c.cuadros, 1) + ' cuadros): gira ' + ch + ' VOLTS/DIV hacia un valor más pequeño (−).';
  }
  function voltsBien(c) { return !c.sale && c.cuadros >= 3 && c.cuadros <= 8; }

  const FRECS = [[2460, '1', '2,46 kHz', '1k', '5 µs'], [24600, '2', '24,6 kHz', '10k', '5 µs'], [246000, '3', '246 kHz', '100k', '250 ns']];

  // Revisión del armado en la protoboard. Aquí no se juntan las tierras internas de los equipos,
  // para poder decir dónde quedó cada caimán y cada pinza.
  function revisarArmado() {
    const p = mesa.proto, R = redesProto(false);
    const red = function (id, k) { return p[id] ? R.de(p[id][k || 0]) : null; };
    const miembros = {};
    BASES.forEach(function (b) { const r = R.base(b); (miembros[r] = miembros[r] || []).push(b); });
    function nombre(r) { return (miembros[r] || [r]).map(nombreBase).join(' y '); }
    function paralelo(x, y) {
      const N = PIEZA[x].nombre, M = PIEZA[y].nombre, texto = N + ' y ' + M + ' en paralelo';
      const enCorto = [x, y].filter(function (id) { return p[id] && red(id, 0) === red(id, 1); })[0];
      if (enCorto) {
        const K = PIEZA[enCorto].nombre;
        return { ok: false, error: true, texto: texto, pista: K + ' tiene las dos patas en ' + nombre(red(enCorto, 0)) + '. Ahí todo está unido por dentro, así que ' + K + ' queda en corto: pon cada pata en una columna distinta.' };
      }
      if (!p[x] || !p[y]) return { ok: false, texto: texto, pista: 'Toca ' + (p[x] ? M : N) + ' en la bandeja y luego dos huecos de columnas distintas.' };
      const A = [red(x, 0), red(x, 1)], B = [red(y, 0), red(y, 1)];
      if (B.indexOf(A[0]) < 0 || B.indexOf(A[1]) < 0) {
        return { ok: false, error: true, texto: texto, pista: 'Todavía no están en paralelo: ' + N + ' y ' + M + ' deben tener sus patas en las mismas dos columnas, una pata de cada una en cada columna.' };
      }
      return { ok: true, texto: texto, nodos: A };
    }
    const par1 = paralelo('R1', 'C1'), par2 = paralelo('R2', 'C2');
    const a = { lista: [par1, par2], nombre: nombre, vin: null, vout: null, gnd: null };
    const serie = { ok: false, texto: 'R₁‖C₁ en serie con R₂‖C₂' };
    if (!par1.ok || !par2.ok) serie.pista = 'Primero deja listos los dos pares en paralelo.';
    else {
      const comunes = par1.nodos.filter(function (n) { return par2.nodos.indexOf(n) >= 0; });
      if (comunes.length === 1) {
        serie.ok = true;
        a.vout = comunes[0];
        a.vin = par1.nodos[0] === a.vout ? par1.nodos[1] : par1.nodos[0];
        a.gnd = par2.nodos[0] === a.vout ? par2.nodos[1] : par2.nodos[0];
      } else if (comunes.length === 2) {
        serie.error = true;
        serie.pista = 'Los cuatro quedaron en paralelo: R₂‖C₂ está en las mismas dos columnas que R₁‖C₁. Deben compartir solo una columna, que será Vout.';
      } else serie.pista = 'Une los dos pares: R₂‖C₂ debe tener una columna en común con R₁‖C₁. Esa columna común es Vout.';
    }
    a.lista.push(serie);
    const listo = serie.ok, falta = 'Primero arma R₁‖C₁ en serie con R₂‖C₂.';
    // Generador: el rojo entra por R₁‖C₁ y el negro va a la tierra del circuito
    const gen = { ok: false, texto: 'Generador: rojo en Vin y negro en tierra', pista: falta };
    if (listo) {
      const rp = red('GP'), rn = red('GN');
      if (p.GP && p.GN && rp === rn) {
        gen.error = true;
        gen.pista = 'Los dos caimanes del generador quedaron en ' + nombre(rp) + ': así el generador está en corto. El rojo va en ' + nombre(a.vin) + ' y el negro en ' + nombre(a.gnd) + '.';
      } else if (p.GP && rp !== a.vin) {
        gen.error = true;
        gen.pista = (rp === a.vout ? 'El rojo está en Vout. ' : rp === a.gnd ? 'El rojo está en el lado de tierra: el circuito quedaría al revés. ' : 'El rojo no toca el circuito. ') +
                    'El generador entra por R₁‖C₁ (1 kΩ y 1 nF): el rojo va en ' + nombre(a.vin) + '.';
      } else if (p.GN && rn !== a.gnd) {
        gen.error = true;
        gen.pista = 'El negro va en ' + nombre(a.gnd) + ', el lado libre de R₂‖C₂: es la tierra del circuito.' +
                    (rn === a.vin || rn === a.vout ? ' Donde está ahora pone ' + (rn === a.vin ? 'Vin' : 'Vout') + ' en corto con tierra.' : '');
      } else if (!p.GP || !p.GN) {
        gen.pista = 'Toca los caimanes del generador en la bandeja: el rojo va en ' + nombre(a.vin) + ' (el lado libre de R₁‖C₁) y el negro en ' + nombre(a.gnd) + ' (el lado libre de R₂‖C₂).';
      } else gen.ok = true;
    }
    a.lista.push(gen);
    // Puntas: CH1 en la entrada y CH2 en la salida
    [['P1', 'CH1', 'vin', 'Vin', 'donde entra el generador'], ['P2', 'CH2', 'vout', 'Vout', 'entre R₁‖C₁ y R₂‖C₂']].forEach(function (q) {
      const item = { ok: false, texto: 'Punta de ' + q[1] + ' en ' + q[3], pista: falta };
      if (listo) {
        const r = red(q[0]), objetivo = a[q[2]];
        if (!p[q[0]]) item.pista = 'Toca "Punta ' + q[1] + '" en la bandeja y engánchala en ' + nombre(objetivo) + ', ' + q[4] + '.';
        else if (r !== objetivo) {
          item.error = true;
          const cambiada = q[2] === 'vin' ? (r === a.vout ? 'Está en Vout, pero CH1 mide la entrada. ' : '') : (r === a.vin ? 'Está en Vin, pero CH2 mide la salida. ' : '');
          item.pista = cambiada + 'Va en ' + nombre(objetivo) + ', ' + q[4] + '.';
        } else item.ok = true;
      }
      a.lista.push(item);
    });
    // Pinzas de tierra de las puntas
    const tierras = { ok: false, texto: 'Tierras de CH1 y CH2 en la tierra del circuito', pista: falta };
    if (listo) {
      const mal = ['T1', 'T2'].filter(function (id) { return p[id] && red(id) !== a.gnd; })[0];
      if (mal) {
        const r = red(mal), cual = r === a.vin ? 'Vin' : r === a.vout ? 'Vout' : null, ch = mal === 'T1' ? 'CH1' : 'CH2';
        tierras.error = true;
        tierras.pista = cual
          ? 'La tierra de ' + ch + ' está en ' + cual + '. Por dentro, las tierras de las puntas y la del generador están unidas: esa pinza pone ' + cual + ' en corto con tierra. Muévela a ' + nombre(a.gnd) + '.'
          : 'La tierra de ' + ch + ' no toca la tierra del circuito: muévela a ' + nombre(a.gnd) + '.';
      } else if (!p.T1 || !p.T2) tierras.pista = 'Pon las pinzas de tierra de CH1 y CH2 en ' + nombre(a.gnd) + ', con el negro del generador.';
      else tierras.ok = true;
    }
    a.lista.push(tierras);
    a.ok = a.lista.every(function (c) { return c.ok; });
    return a;
  }
  // En los retos 2 a 7 el circuito tiene que seguir bien armado
  function chequeoArmado() {
    const a = revisarArmado(), falla = a.lista.filter(function (c) { return !c.ok; })[0];
    return { ok: a.ok, error: !a.ok, texto: 'Circuito armado en la protoboard',
             pista: falla ? 'Algo cambió en la protoboard: revisa «' + falla.texto + '» como en el reto 1.' : '' };
  }

  const RETOS = [
    {
      titulo: 'Arma el circuito en la protoboard', nivel: 'Fácil', meta: 'R₁‖C₁ + R₂‖C₂',
      texto: 'Arma en la protoboard el circuito del esquema: R₁ en paralelo con C₁, en serie con R₂ en paralelo con C₂. Después conecta el generador y las dos puntas del osciloscopio.',
      pista: 'Los 5 huecos de cada columna están unidos por dentro. Dos piezas quedan en paralelo si comparten las mismas dos columnas, y en serie si comparten solo una: esa columna común es Vout. El riel − de abajo sirve como tierra.',
      revisar: function () { return revisarArmado().lista; },
      exito: function () {
        const a = revisarArmado();
        return 'Quedó armado: Vin en ' + a.nombre(a.vin) + ', Vout en ' + a.nombre(a.vout) + ' y la tierra en ' + a.nombre(a.gnd) + '. Ahora enciende el generador.';
      }
    },
    {
      titulo: 'Enciende el generador', nivel: 'Fácil', meta: 'senoidal · 24,6 kHz',
      texto: 'El generador alimenta el circuito. Ponlo a dar una onda senoidal de 24,6 kHz y enciende su salida.',
      pista: 'FUNCIÓN: la onda redonda. RANGO: 10k. Gira FREQ hasta que la pantalla roja diga 24.60 kHz y toca OUTPUT.',
      revisar: function () {
        const g = mesa.gen;
        return [
          { ok: g.forma === 'seno', texto: 'Onda senoidal', pista: 'En FUNCIÓN toca la onda redonda. Las otras dos son la cuadrada y la triangular.' },
          { ok: cerca(frecuencia(), 24600, 0.01), texto: 'Frecuencia de 24,6 kHz',
            pista: g.rango !== 3 ? 'La frecuencia es FREQ × RANGO. Toca el RANGO 10k: así FREQ va de 10 a 99,9 kHz.'
                                 : 'Gira FREQ hasta que la pantalla roja diga 24.60 kHz (FREQ en 2,46 × 10k).' },
          { ok: g.salida, texto: 'Salida encendida (OUTPUT ON)', pista: 'Toca OUTPUT: si está apagado, al circuito no le llega nada.' },
          { ok: g.offset === 0, error: g.offset !== 0, texto: 'OFFSET en 0 V', pista: 'Gira OFFSET hasta 0 V: si no, la onda queda corrida hacia arriba o hacia abajo.' }
        ];
      },
      exito: function () {
        return 'El generador da una senoidal de 24,6 kHz. Mira el osciloscopio: si ves una franja en vez de ondas, es porque caben muchísimas; eso lo arreglas en el reto 4.';
      }
    },
    {
      titulo: 'Puntas en ×10', nivel: 'Fácil', meta: 'CH1 y CH2',
      texto: 'En el laboratorio las puntas se usan en ×10. El interruptor de cada punta y el menú de su canal tienen que decir lo mismo; si no, el osciloscopio marca 10 veces más o 10 veces menos.',
      pista: 'Los interruptores están en las puntas, debajo del circuito. Después: CH1 MENU → Sonda → 10X, y lo mismo con CH2 MENU.',
      revisar: function () {
        return ['ch1', 'ch2'].map(function (ch) {
          const p = mesa.puntas[ch], s = mesa.sonda[ch], N = ch.toUpperCase();
          let pista;
          if (p === 10 && s === 1) pista = 'La punta está en ×10 pero el menú dice 1X: el osciloscopio marca 10 veces menos. Toca ' + N + ' MENU → Sonda.';
          else if (p === 1 && s === 10) pista = 'El menú dice 10X pero la punta está en ×1: marca 10 veces más. Cambia el interruptor de la punta de ' + N + ' a ×10.';
          else pista = 'Pon el interruptor de la punta de ' + N + ' en ×10 (debajo del circuito) y luego ' + N + ' MENU → Sonda → 10X.';
          return { ok: p === 10 && s === 10, error: p !== s, texto: N + ': punta en ×10 y menú en 10X', pista: pista };
        });
      },
      exito: function () { return 'Punta y menú coinciden en los dos canales: ahora el osciloscopio muestra el voltaje real del circuito.'; }
    },
    {
      titulo: '2 Vpp en la entrada', nivel: 'Medio', meta: 'CH1 = 2,0 Vpp',
      texto: 'El Lab 4 pide Vin = 2 Vpp. Se ajusta con la perilla AMPL del generador, pero se mide en el osciloscopio, con CH1.',
      pista: 'SEC/DIV en 10 µs. MEASURE → enciende CH1 Pk-Pk. Gira AMPL hasta que marque 2,00 V y deja CH1 VOLTS/DIV en 500 mV.',
      revisar: function (r) {
        const c = r.ch.ch1;
        let pistaAmpl;
        if (c.sale) pistaAmpl = 'La onda amarilla se sale de la pantalla y la medición sale con ?: gira CH1 VOLTS/DIV hacia un valor más grande (+).';
        else pistaAmpl = 'Marca ' + voltios(c.pp) + (c.pp > 2.1 ? ': todavía es mucho. Gira AMPL del generador hacia abajo (−).' : ': falta. Gira AMPL del generador hacia arriba (+).');
        return [
          { ok: genEn(24600) && puntasBien(), texto: 'Generador en 24,6 kHz y puntas en ×10', pista: 'Deja la mesa como quedó en los retos 2 y 3.' },
          { ok: r.ciclos >= 1 && r.ciclos <= 5, texto: 'SEC/DIV: se ven entre 1 y 5 ondas',
            pista: r.ciclos > 5 ? 'Se ven demasiadas ondas: gira SEC/DIV hacia un valor más pequeño (−).' : 'No alcanza a verse una onda completa: gira SEC/DIV hacia un valor más grande (+).' },
          { ok: mesa.medir.ch1, texto: 'Medición CH1 Pk-Pk encendida', pista: 'Toca MEASURE y, en el menú de la derecha de la pantalla, enciende CH1 Pk-Pk.' },
          { ok: vinBien(r), texto: 'CH1 marca 2,00 Vpp (entre 1,90 y 2,10 V)', pista: pistaAmpl },
          { ok: voltsBien(c), texto: 'CH1 VOLTS/DIV: la onda amarilla ocupa entre 3 y 8 cuadros', pista: pistaVolts(c, 'CH1', 'amarilla') }
        ];
      },
      exito: function (r) {
        return 'Vin = ' + voltios(r.ch.ch1.pp) + ' pico a pico. La perilla AMPL no dice cuánto le llega al circuito: por eso Vin siempre se mide con el osciloscopio.';
      }
    },
    {
      titulo: 'Mide Vout', nivel: 'Medio', meta: 'Vout / Vin',
      texto: 'CH2 está en la salida del circuito. Mide cuánto sale pico a pico y compáralo con lo que entra.',
      pista: 'MEASURE → enciende CH2 Pk-Pk. CH2 VOLTS/DIV en 200 mV. Vout / Vin = lo que marca CH2 ÷ lo que marca CH1 (los dos en voltios).',
      campos: [['vout', 'Vout (lo que marca CH2)', 'Ej: 0,95 V'], ['razon', 'Vout / Vin', 'Ej: 0,47']],
      revisar: function (r) {
        const c2 = r.ch.ch2, vout = campoVoltios('vout'), razon = campo('razon'), real = c2.pp / r.ch.ch1.pp;
        const voutOk = vout !== null && Math.abs(vout - c2.pp) <= Math.max(0.02, c2.pp * 0.02);
        const razonOk = razon !== null && Math.abs(razon - real) <= 0.02;
        return [
          base(r),
          { ok: mesa.medir.ch2, texto: 'Medición CH2 Pk-Pk encendida', pista: 'Toca MEASURE y enciende CH2 Pk-Pk.' },
          { ok: voltsBien(c2), texto: 'CH2 VOLTS/DIV: la onda azul ocupa entre 3 y 8 cuadros', pista: pistaVolts(c2, 'CH2', 'azul') },
          { ok: voutOk, error: vout !== null && !voutOk, texto: 'Escribe Vout',
            pista: vout === null ? 'Escribe en la casilla lo que marca CH2 Pk-Pk. Si viene en mV, sirve igual: 976 mV = 0,976 V.' : 'Ese número no es el que marca CH2 Pk-Pk. Revísalo.' },
          { ok: razonOk, error: razon !== null && !razonOk, texto: 'Escribe Vout / Vin',
            pista: razon === null ? 'Divide Vout entre Vin, los dos en voltios.' : 'Revisa la división: Vout ÷ Vin, los dos en voltios (mV ÷ 1000).' }
        ];
      },
      exito: function (r) {
        return 'Vout / Vin = ' + coma(r.ch.ch2.pp / r.ch.ch1.pp, 2) + ': a 24,6 kHz sale más o menos la mitad de lo que entra. Con los valores nominales, la teoría da 0,50.';
      }
    },
    {
      titulo: 'Mide el desfase', nivel: 'Difícil', meta: 'Δt → fase',
      texto: 'A 24,6 kHz, Vout llega un poco después que Vin. Mide ese retraso Δt con los cursores y conviértelo a grados.',
      pista: 'SEC/DIV en 5 µs. CURSOR → Tipo: Tiempo. Lleva el cursor 1 a donde la onda amarilla cruza el centro subiendo y el cursor 2 al mismo punto de la azul. Luego φ = −360 × f × Δt.',
      campos: [['dt', 'Δt (en µs)', 'Ej: 5,30'], ['fase', 'Fase φ (en grados)', 'Ej: −45', 'text']],
      revisar: function (r) {
        const f = frecuencia(), T = 1 / f, td = tdiv(), cu = mesa.cursor, tol = T * 3 / 360;   // 3° de margen
        const t1 = (cu.c1 - 2) * td, t2 = (cu.c2 - 2) * td;
        const retraso = -angulo(circuito(f).h) / (2 * Math.PI * f);
        // Cursor 1: Vin cruza por cero subiendo en t = k·T (y bajando en (k + ½)·T)
        const k1 = Math.round(t1 / T);
        const ok1 = cu.on && Math.abs(t1 - k1 * T) <= tol;
        const bajando1 = Math.abs(t1 - (Math.round(t1 / T - 0.5) + 0.5) * T) <= tol;
        // Cursor 2: Vout cruza por cero subiendo justo después del cursor 1
        const ok2 = ok1 && Math.abs(t2 - (k1 * T + retraso)) <= tol;
        const cursor2EnVin = Math.abs(t2 - Math.round(t2 / T) * T) <= tol;
        const leido = (cu.c2 - cu.c1) * td;
        const dt = campo('dt'), fase = campo('fase');
        const dtOk = dt !== null && Math.abs(dt * 1e-6 - leido) <= Math.max(0.02e-6, Math.abs(leido) * 0.02);
        const faseOk = dtOk && fase !== null && Math.abs(fase - (-360 * f * dt * 1e-6)) <= 1;
        let p1 = 'Arrastra el cursor 1 en la pantalla (o gíralo con la perilla CURSOR) hasta donde la onda amarilla cruza la línea del centro subiendo. Con SEC/DIV en 5 µs se ve más ancho.';
        if (bajando1) p1 = 'Ahí la onda amarilla cruza el centro bajando: busca el cruce donde va subiendo.';
        let p2 = 'Lleva el cursor 2 al primer cruce de la onda azul subiendo, a la derecha del cursor 1. Afina con la perilla CURSOR (en el menú elige Cursor 2).';
        if (cu.c2 < cu.c1) p2 = 'El cursor 2 va a la derecha del cursor 1: Vout llega después que Vin.';
        else if (cursor2EnVin) p2 = 'El cursor 2 está en la onda amarilla: va en la azul (Vout), que cruza un poco después.';
        let pf = 'Calcula φ = −360 × 24 600 × Δt, con Δt en segundos (5 µs = 0,000005 s).';
        if (fase !== null && fase > 0) pf = 'Vout llega después que Vin: la fase es negativa.';
        else if (fase !== null) pf = 'Revisa la cuenta: φ = −360 × 24 600 × Δt, con Δt en segundos.';
        return [
          base(r),
          { ok: cu.on, texto: 'Cursores encendidos (CURSOR → Tipo: Tiempo)', pista: 'Toca CURSOR y, en el menú de la derecha, cambia Tipo a Tiempo.' },
          { ok: ok1, error: cu.on && bajando1, texto: 'Cursor 1 donde Vin (amarilla) cruza por cero subiendo', pista: p1 },
          { ok: ok2, error: ok1 && (cu.c2 < cu.c1 || cursor2EnVin), texto: 'Cursor 2 donde Vout (azul) cruza por cero subiendo', pista: p2 },
          { ok: dtOk, error: dt !== null && !dtOk, texto: 'Escribe Δt',
            pista: dt === null ? 'Escribe el Δt que aparece arriba a la izquierda de la pantalla, en µs.' : 'No coincide con el Δt de la pantalla (' + tiempo(leido) + ').' },
          { ok: faseOk, error: fase !== null && dtOk && !faseOk, texto: 'Escribe la fase: φ = −360 × f × Δt', pista: pf }
        ];
      },
      exito: function () {
        return 'φ ≈ ' + coma(campo('fase'), 1) + '°: Vout va ' + coma(campo('dt'), 2) + ' µs atrasada respecto a Vin. Con los valores nominales la teoría da −48,3°.';
      }
    },
    {
      titulo: 'Barrido de frecuencia', nivel: 'Reto final', meta: '3 frecuencias',
      texto: 'Repite las medidas en las tres frecuencias del Lab 4, siempre con Vin = 2 Vpp, y mira qué pasa con Vout y con la fase.',
      pista: 'Deja FREQ en 2,46 y cambia el RANGO: 1k, 10k y 100k. En cada una revisa que CH1 siga en 2 Vpp, mide CH2 Pk-Pk y Δt, y calcula φ = −360 × f × Δt. Para 246 kHz usa SEC/DIV de 250 ns y CH2 en 50 mV.',
      tabla: true,
      pregunta: '¿En cuál de las tres frecuencias Vout se atrasa más?',
      opciones: [['A', '2,46 kHz'], ['B', '24,6 kHz'], ['C', '246 kHz']],
      revisar: function (r) {
        const mem = memo();
        mem.visitas = mem.visitas || {};
        const lista = FRECS.map(function (fr) {
          const f = fr[0];
          // Queda anotado que el estudiante puso esa frecuencia con Vin = 2 Vpp
          if (genEn(f) && puntasBien() && vinBien(r) && !mem.visitas[f]) { mem.visitas[f] = true; guardarRetos(); }
          const c = circuito(f), voutT = 2 * modulo(c.h), faseT = angulo(c.h) * 180 / Math.PI;
          const vout = campoVoltios('vout' + fr[1]), fase = campo('fase' + fr[1]);
          const vOk = vout !== null && Math.abs(vout - voutT) <= Math.max(0.02, voutT * 0.06);
          const fOk = fase !== null && Math.abs(fase - faseT) <= 5;
          const visto = !!mem.visitas[f];
          let pista;
          if (!visto) pista = 'Pon el generador en ' + fr[2] + ' (RANGO ' + fr[3] + ', FREQ en 2,46) y revisa que CH1 marque 2 Vpp.';
          else if (!vOk) pista = vout === null ? 'Mide Vout con CH2 Pk-Pk (ajusta CH2 VOLTS/DIV) y escríbelo en la tabla.' : 'Ese Vout no coincide: mide otra vez CH2 Pk-Pk en ' + fr[2] + '.';
          else if (fase === null) pista = 'Mide Δt con los cursores (SEC/DIV en ' + fr[4] + ') y calcula φ = −360 × f × Δt.';
          else pista = fase > 0 ? 'Vout llega después que Vin: la fase es negativa.' : 'Esa fase no coincide: revisa Δt y la cuenta −360 × f × Δt (f en Hz y Δt en segundos).';
          return { ok: visto && vOk && fOk, error: (vout !== null && !vOk) || (fase !== null && !fOk), texto: fr[2] + ': Vin = 2 Vpp, Vout y fase', pista: pista };
        });
        const resp = mem.respuesta;
        lista.push({ ok: resp === 'B', error: !!resp && resp !== 'B', texto: '¿En cuál de las tres frecuencias Vout se atrasa más?',
                     pista: resp ? 'Compara las tres fases de la tabla: la más negativa es la que más se atrasa.' : 'Elige una respuesta debajo de la tabla.' });
        return lista;
      },
      exito: function () {
        return 'El desfase sube y vuelve a bajar. A baja frecuencia mandan las resistencias y a alta frecuencia los capacitores: en los dos extremos la fase se acerca a 0°. En medio, cerca de 50 kHz, está el mayor desfase (≈ −55°).';
      }
    }
  ];
  RETOS.forEach(function (reto, i) { reto.mini = MINIS[i]; });
  const TOTAL = RETOS.length;

  // ---------- 13. Avance guardado ----------
  function progresoInicial() { return { v: 2, actual: 0, hechos: [], memo: {} }; }
  let guiado = leer(CLAVE_RETOS);
  if (!guiado || !Array.isArray(guiado.hechos)) guiado = progresoInicial();
  if (!guiado.memo) guiado.memo = {};
  function guardarRetos() { escribir(CLAVE_RETOS, guiado); }
  // Antes eran 6 retos: con la protoboard como reto 1, los que ya estaban corren un puesto
  if (guiado.v !== 2) {
    const memoNuevo = {};
    Object.keys(guiado.memo).forEach(function (k) { memoNuevo[String(Number(k) + 1)] = guiado.memo[k]; });
    guiado = { v: 2, actual: 0, memo: memoNuevo,
               hechos: guiado.hechos.map(function (i) { return i + 1; }).filter(function (i) { return i < TOTAL; }) };
    guardarRetos();
  }
  function memo() {
    const k = String(guiado.actual);
    if (!guiado.memo[k]) guiado.memo[k] = {};
    return guiado.memo[k];
  }
  function primeroSinHacer() {
    for (let i = 0; i < TOTAL; i++) if (guiado.hechos.indexOf(i) < 0) return i;
    return TOTAL;
  }
  function desbloqueado(i) { return guiado.hechos.indexOf(i) >= 0 || i <= primeroSinHacer(); }

  // ---------- 14. Mapa, tarjeta y revisión ----------
  function mostrarPuntos() {
    let html = '';
    for (let i = 0; i < TOTAL; i++) {
      const hecho = guiado.hechos.indexOf(i) >= 0;
      const clase = i === guiado.actual ? 'ahora' : (hecho ? 'hecho' : '');
      html += '<button class="' + clase + '" data-reto="' + i + '"' + (desbloqueado(i) ? '' : ' disabled') +
              ' aria-label="Reto ' + (i + 1) + '">' + (hecho && i !== guiado.actual ? '✓' : (i + 1)) + '</button>';
    }
    $('reto-puntos').innerHTML = html;
    $('mapa-progreso').textContent = guiado.hechos.length + ' de ' + TOTAL + ' hechos · cada uno se desbloquea al terminar el anterior';
    $('mapa').innerHTML = RETOS.map(function (c, i) {
      const hecho = guiado.hechos.indexOf(i) >= 0;
      const est = i === guiado.actual ? 'ahora' : (hecho ? 'hecho' : (desbloqueado(i) ? 'libre' : 'bloqueado'));
      const etiqueta = { ahora: 'Ahora', hecho: '✓ Hecho', libre: 'Disponible', bloqueado: '🔒' }[est];
      let barras = '';
      for (let k = 0; k < TOTAL; k++) barras += '<i class="' + (k <= i ? 'lleno' : '') + '"></i>';
      return '<button class="circuito ' + est + '" data-reto="' + i + '"' + (est === 'bloqueado' ? ' disabled aria-label="Reto ' + (i + 1) + ', bloqueado"' : '') + '>' +
             '<span class="cab"><span>Reto ' + (i + 1) + '</span><span class="estado ' + est + '">' + etiqueta + '</span></span>' +
             c.mini + '<span class="nombre">' + c.titulo + '</span><span class="meta">' + c.meta + '</span>' +
             '<span class="dificultad">' + barras + '</span><span class="dificultad-txt">' + c.nivel + '</span></button>';
    }).join('');
  }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  function mostrarReto() {
    $('reto-pista').hidden = true;
    $('btn-pista').textContent = 'Ver pista';
    $('reto-exito').hidden = true;
    mostrarPuntos();
    if (guiado.actual >= TOTAL) {
      $('reto-num').textContent = TOTAL + ' de ' + TOTAL + ' retos';
      $('reto-titulo').textContent = '¡Completaste los ' + TOTAL + ' retos del Lab 4!';
      $('reto-texto').textContent = 'Ya sabes armar el circuito en la protoboard, configurar el generador, poner las puntas en ×10, ajustar Vin con el osciloscopio, medir Vout y el desfase con los cursores, ' +
                                    'y cómo cambian con la frecuencia. ¡Listo para el laboratorio!';
      $('reto-check').innerHTML = '';
      $('reto-extra').innerHTML = '';
      $('btn-pista').hidden = true;
      $('btn-siguiente').disabled = false;
      $('btn-siguiente').textContent = 'Repetir los retos';
      return;
    }
    const reto = RETOS[guiado.actual], mem = memo();
    mem.campos = mem.campos || {};
    $('reto-num').textContent = 'Reto ' + (guiado.actual + 1) + ' de ' + TOTAL + ' · ' + reto.nivel;
    $('reto-titulo').textContent = reto.titulo;
    $('reto-texto').textContent = reto.texto;
    $('reto-pista').innerHTML = '<strong>Pista:</strong> ' + reto.pista;
    $('btn-pista').hidden = false;
    $('btn-siguiente').textContent = guiado.actual === TOTAL - 1 ? 'Terminar →' : 'Siguiente reto →';
    let extra = '';
    if (reto.campos) {
      extra += '<div class="campos-reto">' + reto.campos.map(function (c) {
        return '<label class="campo"><span>' + c[1] + '</span><input type="text"' + (c[3] ? '' : ' inputmode="decimal"') +
               ' data-campo="' + c[0] + '" placeholder="' + c[2] + '" autocomplete="off" value="' + esc(mem.campos[c[0]] || '') + '"></label>';
      }).join('') + '</div>';
    }
    if (reto.tabla) {
      extra += '<div class="tabla-reto-caja"><table class="tabla-reto"><thead><tr><th>Frecuencia</th><th>Vout (Vpp)</th><th>Fase φ (°)</th></tr></thead><tbody>' +
        FRECS.map(function (fr) {
          return '<tr><th scope="row">' + fr[2] + '</th>' +
                 '<td><input type="text" inputmode="decimal" data-campo="vout' + fr[1] + '" aria-label="Vout a ' + fr[2] + '" placeholder="Vpp" autocomplete="off" value="' + esc(mem.campos['vout' + fr[1]] || '') + '"></td>' +
                 '<td><input type="text" data-campo="fase' + fr[1] + '" aria-label="Fase a ' + fr[2] + '" placeholder="°" autocomplete="off" value="' + esc(mem.campos['fase' + fr[1]] || '') + '"></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    if (reto.opciones) {
      extra += '<p class="pregunta-reto">' + reto.pregunta + '</p><div class="opciones-reto" role="group" aria-label="Respuestas">' +
        reto.opciones.map(function (o) { return '<button data-opcion="' + o[0] + '">' + o[0] + '. ' + o[1] + '</button>'; }).join('') + '</div>';
    }
    $('reto-extra').innerHTML = extra;
    revisarReto();
  }

  // Marca ✓ o ✗ en cada paso y habilita "Siguiente"
  function revisarReto(r) {
    if (guiado.actual >= TOTAL) return;
    r = r || lecturas();
    const reto = RETOS[guiado.actual], mem = memo();
    const lista = (guiado.actual > 0 ? [chequeoArmado()] : []).concat(reto.revisar(r));
    let yaMarcado = false;
    $('reto-check').innerHTML = lista.map(function (c) {
      let clase = 'si', icono = '✓', ayuda = '';
      if (!c.ok) {
        const esElSiguiente = !yaMarcado;
        yaMarcado = true;
        if (c.error) { clase = 'no'; icono = '✗'; }
        else if (esElSiguiente) { clase = 'ahora'; icono = '→'; }
        else { clase = 'falta'; icono = '·'; }
        if (esElSiguiente && c.pista) ayuda = '<small>' + c.pista + '</small>';
      }
      return '<li class="' + clase + '"><b>' + icono + '</b><span>' + c.texto + ayuda + '</span></li>';
    }).join('');
    $('reto-extra').querySelectorAll('[data-opcion]').forEach(function (b) { b.classList.toggle('elegida', b.dataset.opcion === mem.respuesta); });
    const cumplido = lista.every(function (c) { return c.ok; });
    if (cumplido && guiado.hechos.indexOf(guiado.actual) < 0) {
      guiado.hechos.push(guiado.actual);
      guardarRetos();
      mostrarPuntos();
    }
    if (cumplido) {
      $('reto-exito').innerHTML = '<strong>¡Lo lograste!</strong> ' + reto.exito(r);
      $('reto-exito').hidden = false;
    } else {
      $('reto-exito').hidden = true;
    }
    $('btn-siguiente').disabled = guiado.hechos.indexOf(guiado.actual) < 0;
  }

  $('reto-extra').addEventListener('input', function (evento) {
    const id = evento.target.dataset && evento.target.dataset.campo;
    if (!id) return;
    memo().campos[id] = evento.target.value;
    guardarRetos();
    revisarReto();
  });
  $('reto-extra').addEventListener('click', function (evento) {
    const b = evento.target.closest('[data-opcion]');
    if (!b) return;
    memo().respuesta = b.dataset.opcion;
    guardarRetos();
    revisarReto();
  });
  function irA(i) {
    guiado.actual = i;
    guardarRetos();
    mostrarReto();
  }
  $('btn-pista').addEventListener('click', function () {
    const pista = $('reto-pista');
    pista.hidden = !pista.hidden;
    this.textContent = pista.hidden ? 'Ver pista' : 'Ocultar pista';
  });
  $('btn-siguiente').addEventListener('click', function () {
    if (guiado.actual >= TOTAL) {
      guiado = progresoInicial();   // "Repetir los retos"
      guardarRetos();
      mostrarReto();
    } else {
      irA(guiado.actual + 1);
    }
    $('reto-guiado').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  function elegirDesde(evento) {
    const boton = evento.target.closest('[data-reto]');
    if (!boton || boton.disabled) return;
    irA(Number(boton.dataset.reto));
    if (evento.currentTarget.id === 'mapa') $('reto-guiado').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('reto-puntos').addEventListener('click', elegirDesde);
  $('mapa').addEventListener('click', elegirDesde);

  // ---------- 15. Todo junto: cada cambio guarda, dibuja y revisa ----------
  function pintar() {
    const r = lecturas();
    pintarGenerador();
    dibujarPantalla(r);
    dibujarMenu();
    pintarPuntas();
    pintarProto();
    repintar.forEach(function (f) { f(); });
    revisarReto(r);
  }
  function cambio() {
    guardarMesa();
    pintar();
  }
  $('btn-vaciar').addEventListener('click', function () {
    mesa = mesaInicial();
    sel = null;
    mostrada = null;
    aviso = '';
    cambio();
  });

  // Mesa como queda al terminar los primeros n retos (para el atajo ?reto=)
  function prepararHasta(n) {
    const m = mesaInicial();
    if (n >= 1) m.proto = JSON.parse(JSON.stringify(ARMADO));
    if (n >= 2) Object.assign(m.gen, { forma: 'seno', rango: 3, dial: 246, salida: true, offset: 0 });
    if (n >= 3) { m.puntas = { ch1: 10, ch2: 10 }; m.sonda = { ch1: 10, ch2: 10 }; }
    if (n >= 4) {
      m.gen.ampl = Math.round(2 / modulo(circuito(24600).carga) * 20);
      m.vdiv.ch1 = VDIV.indexOf(0.05);
      m.tdiv = TDIV.indexOf(1e-5);
      m.medir.ch1 = true;
    }
    if (n >= 5) { m.vdiv.ch2 = VDIV.indexOf(0.02); m.medir.ch2 = true; }
    if (n >= 6) {
      m.tdiv = TDIV.indexOf(5e-6);
      m.cursor = { on: true, c1: 2, c2: Math.round((2 - angulo(circuito(24600).h) / (2 * Math.PI * 24600) / 5e-6) * 100) / 100, sel: 2 };
    }
    mesa = m;
    guardarMesa();
  }
  const pedido = Number(new URLSearchParams(location.search).get('reto'));
  if (pedido >= 1 && pedido <= TOTAL) {
    guiado.actual = pedido - 1;
    for (let i = 0; i < guiado.actual; i++) if (guiado.hechos.indexOf(i) < 0) guiado.hechos.push(i);
    guardarRetos();
    prepararHasta(pedido - 1);
  }
  if (guiado.actual > TOTAL) guiado.actual = 0;

  dibujarEsquema();
  mostrarReto();
  pintar();
})();