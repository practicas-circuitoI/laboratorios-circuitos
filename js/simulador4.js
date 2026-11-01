// ===================================================
// Simulador del Lab 4: generador, circuito R–C y osciloscopio
//  - El circuito se resuelve con fasores (números complejos) para cada
//    armónico de la señal del generador.
//  - 6 retos guiados, de fácil a difícil; cada uno se desbloquea al terminar
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
  // Para una frecuencia: h = Vout / Vin y carga = Vin / (voltaje interno del generador)
  function circuito(f) {
    const w = 2 * Math.PI * f;
    const z1 = paralelo(R1, C1, w), z2 = paralelo(R2, C2, w), zin = suma(z1, z2);
    return { h: entre(z2, zin), carga: entre(zin, suma(zin, [RS, 0])) };
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
      menu: null
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
  })();
  function guardarMesa() { escribir(CLAVE_MESA, mesa); }

  function frecuencia() { return mesa.gen.dial / 100 * RANGOS[mesa.gen.rango]; }
  function amplitud() { return mesa.gen.ampl / 20; }
  function offset() { return mesa.gen.offset / 10; }
  function factor(ch) { return mesa.sonda[ch] / mesa.puntas[ch]; }   // lo que se ve ÷ lo real
  function vdiv(ch) { return VDIV[mesa.vdiv[ch]] * mesa.sonda[ch]; }  // V/div que dice la pantalla
  function tdiv() { return TDIV[mesa.tdiv]; }

  // ---------- 4. Señales: Vin y Vout de verdad, armónico por armónico ----------
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
    // El tiempo se cuenta desde Vin: su parte principal cruza por cero subiendo en t = 0
    const ref = angulo(circuito(f).carga);
    const vin = [], vout = [];
    arm.forEach(function (p) {
      const n = p[0], c = circuito(n * f), a = p[1] * modulo(c.carga), fi = angulo(c.carga) - n * ref;
      vin.push({ n: n, a: a, fi: fi });
      vout.push({ n: n, a: a * modulo(c.h), fi: fi + angulo(c.h) });
    });
    const dcIn = offset() * (R1 + R2) / (R1 + R2 + RS);
    return { f: f, vin: vin, vout: vout, dcIn: dcIn, dcOut: dcIn * R2 / (R1 + R2) };
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
      if (!r.hay) return [color, ch.toUpperCase() + ' Pk-Pk  ?'];
      return [color, ch.toUpperCase() + ' Pk-Pk  ' + voltios(c.pp) + (c.sale ? ' ?' : '')];
    }
    if (mesa.medir.ch1) filas.push(pp('ch1', AMARILLO));
    if (mesa.medir.ch2) filas.push(pp('ch2', AZUL));
    if (mesa.medir.frec) filas.push(['#c9cfdb', 'CH1 Frec  ' + (r.hay && r.ciclos >= 1 ? frecTexto(r.f) : '?')]);
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

  // ---------- 11. El circuito y las puntas ----------
  function dibujarCircuito() {
    const g = 'fill="none" stroke="#1d2230" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"';
    // Resistencia vertical (zigzag) y capacitor vertical (dos placas)
    function rv(x, y) { return '<path d="M' + x + ' ' + y + ' v12 l-8 4 l16 8 l-16 8 l16 8 l-16 8 l16 8 l-8 4 v12" ' + g + '/>'; }
    function cv(x, y) { return '<path d="M' + x + ' ' + y + ' v31 M' + (x - 14) + ' ' + (y + 31) + ' h28 M' + (x - 14) + ' ' + (y + 39) + ' h28 M' + x + ' ' + (y + 39) + ' v31" ' + g + '/>'; }
    function bloque(y, r, rv1, c, cv1) {
      return '<path d="M110 ' + y + ' H210 M110 ' + (y + 90) + ' H210 M110 ' + y + ' v10 M210 ' + y + ' v10 M110 ' + (y + 80) + ' v10 M210 ' + (y + 80) + ' v10" ' + g + '/>' +
             rv(110, y + 10) + cv(210, y + 10) +
             '<text x="94" y="' + (y + 42) + '" text-anchor="end" class="c-n">' + r + '</text><text x="94" y="' + (y + 60) + '" text-anchor="end" class="c-v">' + rv1 + '</text>' +
             '<text x="230" y="' + (y + 42) + '" class="c-n">' + c + '</text><text x="230" y="' + (y + 60) + '" class="c-v">' + cv1 + '</text>';
    }
    let s = '';
    // Cable del generador: rojo a IN, negro a tierra
    s += '<path d="M36 0 V34" stroke="#1d2230" stroke-width="7" stroke-linecap="round"/>' +
         '<path d="M36 34 Q36 58 56 60" ' + g.replace('#1d2230', '#d93025') + '/><path d="M36 34 V370 H56" ' + g + '/>' +
         '<text x="48" y="16" class="c-s">del generador (OUT)</text>';
    s += '<circle cx="62" cy="60" r="6" fill="#f7f7f2" stroke="#1d2230" stroke-width="2.5"/><text x="62" y="84" text-anchor="middle" class="c-s">IN</text>';
    s += '<path d="M68 60 H160 V100" ' + g + '/>' + bloque(100, 'R₁', '1 kΩ', 'C₁', '1 nF') + '<path d="M160 190 V240" ' + g + '/>' +
         bloque(240, 'R₂', '10 kΩ', 'C₂', '10 nF') + '<path d="M160 330 V370 H68" ' + g + '/>';
    s += '<circle cx="62" cy="370" r="6" fill="#f7f7f2" stroke="#1d2230" stroke-width="2.5"/><text x="62" y="394" text-anchor="middle" class="c-s">GND</text>';
    // Puntos de prueba con las puntas: CH1 en Vin, CH2 en Vout
    [[60, 'Vin', AMARILLO, 'a CH1'], [215, 'Vout', AZUL, 'a CH2']].forEach(function (p) {
      const y = p[0];
      s += '<circle cx="160" cy="' + y + '" r="4.5" fill="#1d2230"/><path d="M160 ' + y + ' H270" ' + g + '/>' +
           '<circle cx="276" cy="' + y + '" r="6" fill="#f7f7f2" stroke="#1d2230" stroke-width="2.5"/>' +
           '<circle cx="276" cy="' + y + '" r="11" fill="none" stroke="' + p[2] + '" stroke-width="4"/>' +
           '<path d="M287 ' + y + ' H320" stroke="' + p[2] + '" stroke-width="5" stroke-linecap="round"/>' +
           '<text x="262" y="' + (y - 16) + '" text-anchor="end" class="c-n">' + p[1] + '</text>' +
           '<text x="318" y="' + (y + 24) + '" text-anchor="end" class="c-s">' + p[3] + '</text>';
    });
    // Pinzas de tierra de las dos puntas
    s += '<rect x="196" y="364" width="16" height="12" rx="3" fill="#1d2230"/><rect x="228" y="364" width="16" height="12" rx="3" fill="#1d2230"/>' +
         '<path d="M160 370 H250" ' + g + '/><text x="220" y="396" text-anchor="middle" class="c-s">tierra de las puntas</text>';
    $('circuito').innerHTML = s;
  }
  $('puntas4').innerHTML = ['ch1', 'ch2'].map(function (ch) {
    return '<div class="punta4 ' + ch + '"><span class="punta-nombre"><i aria-hidden="true"></i>Punta de ' + ch.toUpperCase() + '</span>' +
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
  }

  // ---------- 12. Los 6 retos ----------
  // Dibujitos del mapa (el CSS de .mini-esq pinta los textos de negro; por eso llevan style)
  function onda(x0, w, cy, a, fase, color, ciclos) {
    let p = '';
    for (let k = 0; k <= 100; k++) p += (x0 + k / 100 * w).toFixed(1) + ',' + (cy - a * Math.sin(2 * Math.PI * (ciclos || 2) * k / 100 + (fase || 0))).toFixed(1) + ' ';
    return '<polyline points="' + p + '" fill="none" stroke="' + color + '" stroke-width="2.6"/>';
  }
  function mini(cuerpo) { return '<svg class="mini-esq" viewBox="0 0 220 130" aria-hidden="true">' + cuerpo + '</svg>'; }
  const NEGRO = '<rect x="10" y="10" width="200" height="110" rx="10" fill="#05121a"/>';
  const MINIS = [
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
  // Primer paso de los retos 4 y 5: que la mesa siga como quedó en los anteriores
  function base(r) {
    let pista = null;
    if (!genEn(24600)) pista = 'Deja el generador como en el reto 1: senoidal, 24,6 kHz, OUTPUT ON y OFFSET en 0 V.';
    else if (!puntasBien()) pista = 'Las dos puntas y los dos menús deben estar en ×10 (reto 2).';
    else if (!vinBien(r)) pista = 'CH1 debe marcar 2 Vpp (entre 1,90 y 2,10 V): ajusta AMPL como en el reto 3.';
    return { ok: !pista, texto: 'Generador en 24,6 kHz, puntas en ×10 y CH1 en 2 Vpp', pista: pista };
  }
  function pistaVolts(c, ch, nombre) {
    if (c.cuadros > 8 || c.sale) return 'La onda ' + nombre + ' se sale de la pantalla: gira ' + ch + ' VOLTS/DIV hacia un valor más grande (+).';
    return 'La onda ' + nombre + ' se ve pequeña (' + coma(c.cuadros, 1) + ' cuadros): gira ' + ch + ' VOLTS/DIV hacia un valor más pequeño (−).';
  }
  function voltsBien(c) { return !c.sale && c.cuadros >= 3 && c.cuadros <= 8; }

  const FRECS = [[2460, '1', '2,46 kHz', '1k', '5 µs'], [24600, '2', '24,6 kHz', '10k', '5 µs'], [246000, '3', '246 kHz', '100k', '250 ns']];

  const RETOS = [
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
        return 'El generador da una senoidal de 24,6 kHz. Mira el osciloscopio: si ves una franja en vez de ondas, es porque caben muchísimas; eso lo arreglas en el reto 3.';
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
          { ok: genEn(24600) && puntasBien(), texto: 'Generador en 24,6 kHz y puntas en ×10', pista: 'Deja la mesa como quedó en los retos 1 y 2.' },
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
  function progresoInicial() { return { actual: 0, hechos: [], memo: {} }; }
  let guiado = leer(CLAVE_RETOS);
  if (!guiado || !Array.isArray(guiado.hechos)) guiado = progresoInicial();
  if (!guiado.memo) guiado.memo = {};
  function guardarRetos() { escribir(CLAVE_RETOS, guiado); }
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
      $('reto-titulo').textContent = '¡Completaste los 6 retos del Lab 4!';
      $('reto-texto').textContent = 'Ya sabes configurar el generador, poner las puntas en ×10, ajustar Vin con el osciloscopio, medir Vout y el desfase con los cursores, ' +
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
    const reto = RETOS[guiado.actual], lista = reto.revisar(r), mem = memo();
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
    repintar.forEach(function (f) { f(); });
    revisarReto(r);
  }
  function cambio() {
    guardarMesa();
    pintar();
  }
  $('btn-vaciar').addEventListener('click', function () {
    mesa = mesaInicial();
    cambio();
  });

  // Mesa como queda al terminar los primeros n retos (para el atajo ?reto=)
  function prepararHasta(n) {
    const m = mesaInicial();
    if (n >= 1) Object.assign(m.gen, { forma: 'seno', rango: 3, dial: 246, salida: true, offset: 0 });
    if (n >= 2) { m.puntas = { ch1: 10, ch2: 10 }; m.sonda = { ch1: 10, ch2: 10 }; }
    if (n >= 3) {
      m.gen.ampl = Math.round(2 / modulo(circuito(24600).carga) * 20);
      m.vdiv.ch1 = VDIV.indexOf(0.05);
      m.tdiv = TDIV.indexOf(1e-5);
      m.medir.ch1 = true;
    }
    if (n >= 4) { m.vdiv.ch2 = VDIV.indexOf(0.02); m.medir.ch2 = true; }
    if (n >= 5) {
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

  dibujarCircuito();
  mostrarReto();
  pintar();
})();