// ===================================================
// Simulador de conexiones · Labs 1 y 2
// Mesa virtual SIN FUENTE con hasta dos multímetros Fluke 75 y tres
// bancos de tres resistencias. Se conecta un cable tocando dos bornes.
// En Ω el multímetro calcula la resistencia equivalente entre sus
// puntas, como lo haría uno real; en V y en A marca cero (no hay fuente).
// ===================================================

// ---------- Datos fijos ----------
const VALORES = [100, 220, 330, 470, 680, 1000, 1500, 2200, 3300, 4700, 6800, 10000]; // Ω nominales
const TOLERANCIA = 0.05;          // ±5 %, como las resistencias reales
const R_SHUNT_A = 0.01;           // Ω: por dentro, el borne A está unido a COM por esta resistencia
const R_SHUNT_MA = 1;             // Ω: lo mismo para el borne mA
const R_VOLTIMETRO = 10e6;        // Ω: resistencia de entrada en V
const LIMITE_CONTINUIDAD = 210;   // Ω: el Fluke 75 pita por debajo de este valor
const COLORES = { rojo: '#d93025', negro: '#1d2230', amarillo: '#f2b705', azul: '#1d63c4', verde: '#0f7f68', blanco: '#ffffff' };

// Posiciones del selector, en el orden del dial
const POSICIONES = [
  { id: 'off', texto: 'OFF' }, { id: 'vac', texto: 'V~' }, { id: 'vdc', texto: 'V⎓' }, { id: 'mv', texto: 'mV' },
  { id: 'ohm', texto: 'Ω' }, { id: 'cont', texto: '·)))' }, { id: 'ma', texto: 'mA' }, { id: 'a', texto: 'A' }
];
// Bornes del multímetro (x dentro del dibujo de 170 de ancho)
const BORNES_MED = [
  { id: 'A', texto: 'A', x: 32, color: '#d93025' },
  { id: 'mA', texto: 'mA', x: 68, color: '#d93025' },
  { id: 'COM', texto: 'COM', x: 104, color: '#1d2230' },
  { id: 'V', texto: 'VΩ', x: 140, color: '#d93025' }
];
// Rangos de resistencia del Fluke 75 (3200 cuentas)
const RANGOS_OHM = [
  { max: 320, factor: 1, dec: 1, unidad: 'Ω' },
  { max: 3200, factor: 1e-3, dec: 3, unidad: 'kΩ' },
  { max: 32000, factor: 1e-3, dec: 2, unidad: 'kΩ' },
  { max: 320000, factor: 1e-3, dec: 1, unidad: 'kΩ' },
  { max: 3.2e6, factor: 1e-6, dec: 3, unidad: 'MΩ' },
  { max: 32e6, factor: 1e-6, dec: 2, unidad: 'MΩ' }
];
const BANCOS = ['B1', 'B2', 'B3'];
const IDS_RES = [];
BANCOS.forEach(function (b) { ['R1', 'R2', 'R3'].forEach(function (r) { IDS_RES.push(b + '.' + r); }); });

// ---------- Desde dónde se abrió: ?lab=1, ?lab=2 o la portada ----------
const parametros = new URLSearchParams(location.search);
const desdeLab = parametros.get('lab') === '1' || parametros.get('lab') === '2';
const labOrigen = parametros.get('lab') === '2' ? '2' : '1';
// Cada lab y la práctica libre guardan su propia mesa
const CLAVE_MESA = desdeLab ? 'simulador-mesa-lab' + labOrigen : 'simulador-mesa-libre';
if (labOrigen === '2') {
  document.body.classList.remove('lab-ohm');
  document.body.classList.add('lab-kirchhoff');
  document.getElementById('simbolo').textContent = 'ΣI';
}
const enlaceVolver = document.getElementById('volver');
if (desdeLab) {
  enlaceVolver.href = 'lab' + labOrigen + '.html';
  enlaceVolver.textContent = '← Volver al Lab ' + labOrigen;
} else {
  // Se abrió desde la portada ("¡Acá puedes practicar!")
  enlaceVolver.href = 'index.html';
  enlaceVolver.textContent = '← Volver a los laboratorios';
}


// ---------- Estado de la mesa (se guarda en el dispositivo) ----------
function nuevoMultimetro() { return { modo: 'off', rango: null, hold: null }; }

function estadoInicial() {
  const valores = {}, factores = {};
  IDS_RES.forEach(function (id) {
    valores[id] = 1000;
    factores[id] = 1 + (Math.random() * 2 - 1) * TOLERANCIA;   // valor real = nominal × factor
  });
  return { cables: [], valores: valores, factores: factores, multimetros: { M1: nuevoMultimetro() },
           sonido: true, solas: {}, retos: { '1': [], '2': [] }, labRetos: labOrigen };
}

function cargarEstado() {
  let guardado = null;
  try { guardado = JSON.parse(localStorage.getItem(CLAVE_MESA)); } catch (error) { guardado = null; }
  const base = estadoInicial();
  if (!guardado || !guardado.valores || !guardado.multimetros) return base;
  // Se completa lo que falte, por si el archivo guardado es de una versión anterior
  IDS_RES.forEach(function (id) {
    if (VALORES.indexOf(guardado.valores[id]) < 0) guardado.valores[id] = base.valores[id];
    if (!(guardado.factores && guardado.factores[id] > 0)) {
      guardado.factores = guardado.factores || {};
      guardado.factores[id] = base.factores[id];
    }
  });
  guardado.cables = Array.isArray(guardado.cables) ? guardado.cables : [];
  guardado.solas = guardado.solas || {};
  guardado.retos = guardado.retos || { '1': [], '2': [] };
  if (!guardado.multimetros.M1) guardado.multimetros.M1 = nuevoMultimetro();
  guardado.labRetos = labOrigen;
  return guardado;
}

let estado = cargarEstado();
let colorActual = 'rojo';
let bornePendiente = null;   // primer borne de un cable que se está conectando
let cableElegido = null;     // índice del cable tocado
let ultimoResultado = null;  // lecturas del último cálculo
let pitando = {};            // para no repetir el pitido de continuidad

function guardarEstado() {
  try { localStorage.setItem(CLAVE_MESA, JSON.stringify(estado)); } catch (error) {}
}

function multimetros() { return Object.keys(estado.multimetros).sort(); }

function todosLosBornes() {
  const lista = [];
  multimetros().forEach(function (m) { BORNES_MED.forEach(function (b) { lista.push(m + '.' + b.id); }); });
  IDS_RES.forEach(function (id) { lista.push(id + '.a', id + '.b'); });
  return lista;
}

function valorReal(id) { return estado.valores[id] * estado.factores[id]; }


// ---------- Textos ----------
function formatoNominal(valor) {
  if (valor >= 1000) return String(valor / 1000).replace('.', ',') + '\u00a0kΩ';
  return valor + '\u00a0Ω';
}
function nombreResistencia(id) {
  const partes = id.split('.');
  return partes[1] + ' del banco ' + partes[0].slice(1);
}
function nombreBorne(borne) {
  const partes = borne.split('.');
  if (partes[0].charAt(0) === 'M') {
    const b = BORNES_MED.filter(function (x) { return x.id === partes[1]; })[0];
    return 'borne ' + b.texto + ' de ' + partes[0];
  }
  return nombreResistencia(partes[0] + '.' + partes[1]) + (partes[2] === 'a' ? ' (arriba)' : ' (abajo)');
}
function conComa(texto) { return texto.replace('.', ','); }


// ---------- Posición de cada equipo en la mesa ----------
const MED = { ancho: 170, alto: 316 };
const BANCO = { ancho: 370, alto: 185 };

function disposicion() {
  const angosto = document.getElementById('mesa').clientWidth < 640;
  if (angosto) {
    // Celular: los multímetros arriba y los bancos uno debajo del otro
    return { ancho: 400, alto: 950, angosto: true, pos: {
      M1: { x: 20, y: 12 }, M2: { x: 210, y: 12 },
      B1: { x: 15, y: 350 }, B2: { x: 15, y: 553 }, B3: { x: 15, y: 756 } } };
  }
  // Computador: los multímetros arriba a la izquierda, una ayuda debajo y los bancos a la derecha
  return { ancho: 800, alto: 640, angosto: false, pos: {
    M1: { x: 20, y: 20 }, M2: { x: 205, y: 20 }, ayuda: { x: 20, y: 356 },
    B1: { x: 410, y: 20 }, B2: { x: 410, y: 226 }, B3: { x: 410, y: 432 } } };
}

// Coordenadas de un borne dentro de la mesa
function posicionBorne(borne, d) {
  const partes = borne.split('.');
  if (partes[0].charAt(0) === 'M') {
    const p = d.pos[partes[0]];
    const b = BORNES_MED.filter(function (x) { return x.id === partes[1]; })[0];
    return { x: p.x + b.x, y: p.y + 290 };
  }
  const p = d.pos[partes[0]];
  const i = Number(partes[1].slice(1)) - 1;
  return { x: p.x + 62 + i * 118, y: p.y + (partes[2] === 'a' ? 46 : 158) };
}


// ---------- El circuito: redes, elementos y cálculo ----------
// Une los bornes que están conectados por cables (cada grupo es una "red" o nodo)
function construirRedes() {
  const padre = {};
  function raiz(x) { while (padre[x] !== x) { padre[x] = padre[padre[x]]; x = padre[x]; } return x; }
  todosLosBornes().forEach(function (b) { padre[b] = b; });
  estado.cables.forEach(function (c) {
    if (padre[c.a] === undefined || padre[c.b] === undefined) return;
    const ra = raiz(c.a), rb = raiz(c.b);
    if (ra !== rb) padre[ra] = rb;
  });
  const red = {};
  todosLosBornes().forEach(function (b) { red[b] = raiz(b); });
  return red;
}

// Resistencias del banco y resistencias internas de los multímetros
function listaElementos(red) {
  const lista = [];
  IDS_RES.forEach(function (id) {
    lista.push({ tipo: 'R', id: id, n1: red[id + '.a'], n2: red[id + '.b'], R: valorReal(id) });
  });
  multimetros().forEach(function (m) {
    lista.push({ tipo: 'A', id: m, n1: red[m + '.A'], n2: red[m + '.COM'], R: R_SHUNT_A });
    lista.push({ tipo: 'mA', id: m, n1: red[m + '.mA'], n2: red[m + '.COM'], R: R_SHUNT_MA });
    const modo = estado.multimetros[m].modo;
    if (modo === 'vdc' || modo === 'vac' || modo === 'mv') {
      lista.push({ tipo: 'V', id: m, n1: red[m + '.V'], n2: red[m + '.COM'], R: R_VOLTIMETRO });
    }
  });
  return lista.filter(function (e) { return e.n1 !== e.n2; });  // un elemento en corto no conduce
}

// Resuelve G·v = i con eliminación de Gauss (como v = G\i en MATLAB)
function resolver(G, i) {
  const n = i.length;
  for (let k = 0; k < n; k++) {
    let mayor = k;
    for (let f = k + 1; f < n; f++) if (Math.abs(G[f][k]) > Math.abs(G[mayor][k])) mayor = f;
    const tmp = G[k]; G[k] = G[mayor]; G[mayor] = tmp;
    const t = i[k]; i[k] = i[mayor]; i[mayor] = t;
    for (let f = k + 1; f < n; f++) {
      const m = G[f][k] / G[k][k];
      if (m === 0) continue;
      for (let c = k; c < n; c++) G[f][c] -= m * G[k][c];
      i[f] -= m * i[k];
    }
  }
  const v = new Array(n).fill(0);
  for (let k = n - 1; k >= 0; k--) {
    let suma = i[k];
    for (let c = k + 1; c < n; c++) suma -= G[k][c] * v[c];
    v[k] = suma / G[k][k];
  }
  return v;
}

// Calcula lo que marca cada multímetro
function calcular() {
  const red = construirRedes();
  const elementos = listaElementos(red);

  // Partes del circuito unidas por elementos (componentes conexas)
  const padre = {};
  function raiz(x) { while (padre[x] !== x) { padre[x] = padre[padre[x]]; x = padre[x]; } return x; }
  elementos.forEach(function (e) {
    if (padre[e.n1] === undefined) padre[e.n1] = e.n1;
    if (padre[e.n2] === undefined) padre[e.n2] = e.n2;
    const a = raiz(e.n1), b = raiz(e.n2);
    if (a !== b) padre[a] = b;
  });
  function componente(n) { return padre[n] === undefined ? null : raiz(n); }

  // Qué hace cada multímetro
  const lecturas = {};
  const activos = [];   // óhmetros que inyectan su corriente de prueba
  multimetros().forEach(function (m) {
    const modo = estado.multimetros[m].modo;
    const p = red[m + '.V'], q = red[m + '.COM'];
    const l = { modo: modo, p: p, q: q, valor: 0, abierto: false, comp: null };
    if (modo === 'ohm' || modo === 'cont') {
      if (p === q) {
        l.valor = 0;
      } else if (componente(p) === null || componente(p) !== componente(q)) {
        l.abierto = true;   // no hay camino entre las puntas: OL
      } else {
        l.comp = componente(p);
        activos.push(m);
      }
    }
    lecturas[m] = l;
  });

  // Se resuelve cada parte del circuito donde hay un óhmetro midiendo
  const partes = {};
  activos.forEach(function (m) { (partes[lecturas[m].comp] = partes[lecturas[m].comp] || []).push(m); });
  Object.keys(partes).forEach(function (comp) {
    const nodos = Object.keys(padre).filter(function (n) { return raiz(n) === comp; });
    const tierra = nodos[0];
    const indice = {};
    nodos.slice(1).forEach(function (n, k) { indice[n] = k; });
    const n = nodos.length - 1;
    const G = [], corriente = new Array(n).fill(0);
    for (let f = 0; f < n; f++) G.push(new Array(n).fill(0));
    elementos.forEach(function (e) {
      if (raiz(e.n1) !== comp) return;
      const g = 1 / e.R, a = indice[e.n1], b = indice[e.n2];
      if (a !== undefined) G[a][a] += g;
      if (b !== undefined) G[b][b] += g;
      if (a !== undefined && b !== undefined) { G[a][b] -= g; G[b][a] -= g; }
    });
    // Cada óhmetro inyecta 1 A (la escala no importa: la lectura es V/I)
    partes[comp].forEach(function (m) {
      const l = lecturas[m];
      if (indice[l.p] !== undefined) corriente[indice[l.p]] += 1;
      if (indice[l.q] !== undefined) corriente[indice[l.q]] -= 1;
    });
    const v = n > 0 ? resolver(G, corriente) : [];
    function tension(nodo) { return nodo === tierra ? 0 : v[indice[nodo]]; }
    partes[comp].forEach(function (m) {
      const l = lecturas[m];
      l.valor = Math.abs(tension(l.p) - tension(l.q));
      l.interferencia = partes[comp].length > 1;
    });
  });

  // Resistencias que forman parte de lo que mide cada óhmetro
  multimetros().forEach(function (m) {
    const l = lecturas[m];
    l.resistencias = l.comp === null ? [] : elementos.filter(function (e) {
      return e.tipo === 'R' && raiz(e.n1) === l.comp;
    }).map(function (e) { return e.id; });
  });

  return { red: red, elementos: elementos, lecturas: lecturas };
}


// ---------- Lo que muestra la pantalla del Fluke 75 ----------
function pantalla(m) {
  const mm = estado.multimetros[m];
  const l = ultimoResultado.lecturas[m];
  if (mm.modo === 'off') return { digitos: '', unidad: '', barra: 0, auto: false };
  let r;
  if (mm.modo === 'ohm' || mm.modo === 'cont') {
    r = lecturaOhm(l, mm.rango);
  } else if (mm.modo === 'vdc') {
    r = { digitos: '0.000', unidad: 'V⎓', barra: 0 };
  } else if (mm.modo === 'vac') {
    r = { digitos: '0.000', unidad: 'V~', barra: 0 };
  } else if (mm.modo === 'mv') {
    r = { digitos: '0.0', unidad: 'mV', barra: 0 };
  } else if (mm.modo === 'ma') {
    r = { digitos: '0.00', unidad: 'mA', barra: 0 };
  } else {
    r = { digitos: '0.00', unidad: 'A', barra: 0 };
  }
  r.auto = mm.rango === null;
  if (mm.hold) { r.digitos = mm.hold.digitos; r.unidad = mm.hold.unidad; r.barra = mm.hold.barra; }
  r.hold = !!mm.hold;
  r.pita = mm.modo === 'cont' && !l.abierto && l.valor < LIMITE_CONTINUIDAD;
  return r;
}

// Escoge el rango (automático o el elegido con RANGE) y arma el número
function lecturaOhm(l, rangoFijo) {
  const valor = l.abierto ? Infinity : l.valor;
  let rango;
  if (rangoFijo === null || rangoFijo === undefined) {
    rango = RANGOS_OHM.filter(function (r) { return valor < r.max; })[0];
    if (!rango) return { digitos: 'OL', unidad: 'MΩ', barra: 31 };
  } else {
    rango = RANGOS_OHM[rangoFijo];
    if (valor >= rango.max) return { digitos: 'OL', unidad: rango.unidad, barra: 31 };
  }
  return {
    digitos: (valor * rango.factor).toFixed(rango.dec),
    unidad: rango.unidad,
    barra: Math.round(Math.min(1, valor / rango.max) * 31)
  };
}


// ---------- Dibujo ----------
const NS = 'http://www.w3.org/2000/svg';
const lienzo = document.getElementById('lienzo');

function dibujarMultimetro(m, p) {
  const r = pantalla(m);
  const mm = estado.multimetros[m];
  let s = '<g transform="translate(' + p.x + ',' + p.y + ')">';
  // Funda amarilla y cuerpo
  s += '<rect width="170" height="316" rx="22" fill="#f2c230" stroke="#c4961a" stroke-width="2"/>';
  s += '<rect x="10" y="10" width="150" height="296" rx="14" fill="#383d48"/>';
  s += '<text x="22" y="29" font-size="12" font-weight="800" fill="#f2c230">FLUKE</text>';
  s += '<text x="68" y="29" font-size="12" font-weight="700" fill="#ffffff">75</text>';
  s += '<text x="148" y="29" text-anchor="end" font-size="11" font-weight="700" fill="#c9cfdb">' + m + '</text>';
  // Pantalla
  s += '<rect x="20" y="36" width="130" height="64" rx="6" fill="#c7d3b0" stroke="#8d9a78"/>';
  if (mm.modo !== 'off') {
    if (r.auto) s += '<text x="26" y="48" font-size="8" font-weight="700" fill="#33402a">AUTO</text>';
    if (r.hold) s += '<text x="56" y="48" font-size="8" font-weight="700" fill="#33402a">HOLD</text>';
    if (r.pita) s += '<text x="90" y="48" font-size="9" font-weight="700" fill="#33402a">·)))</text>';
    s += '<text x="112" y="79" text-anchor="end" font-size="27" font-weight="700" font-family="\'Courier New\', monospace" fill="#1f2a17">' + r.digitos + '</text>';
    s += '<text x="145" y="79" text-anchor="end" font-size="11" font-weight="700" fill="#1f2a17">' + r.unidad + '</text>';
    for (let k = 0; k < 31; k++) {
      s += '<rect x="' + (26 + k * 3.8).toFixed(1) + '" y="88" width="2.6" height="6" fill="' + (k < r.barra ? '#1f2a17' : '#b3c09c') + '"/>';
    }
  }
  // Botones RANGE y HOLD
  s += '<g data-boton="' + m + '.range"><rect x="24" y="107" width="58" height="18" rx="9" fill="#5a606d"/>' +
       '<text x="53" y="119.5" text-anchor="middle" font-size="9" font-weight="700" fill="#ffffff">RANGE</text></g>';
  s += '<g data-boton="' + m + '.hold"><rect x="88" y="107" width="58" height="18" rx="9" fill="#5a606d"/>' +
       '<text x="117" y="119.5" text-anchor="middle" font-size="9" font-weight="700" fill="#ffffff">HOLD</text></g>';
  // Selector giratorio
  const cx = 85, cy = 196;
  const indice = POSICIONES.map(function (x) { return x.id; }).indexOf(mm.modo);
  POSICIONES.forEach(function (pos, k) {
    const ang = (-147 + k * 42) * Math.PI / 180;
    const lx = cx + 55 * Math.sin(ang), ly = cy - 55 * Math.cos(ang);
    const activa = k === indice;
    s += '<g data-modo="' + m + '.' + pos.id + '"><circle cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="13" fill="' +
         (activa ? '#f2c230' : 'transparent') + '"/>' +
         '<text x="' + lx.toFixed(1) + '" y="' + (ly + 4).toFixed(1) + '" text-anchor="middle" font-size="' + (pos.id === 'cont' ? 8 : 10) +
         '" font-weight="700" fill="' + (activa ? '#1d2230' : '#e9ecf2') + '">' + pos.texto + '</text></g>';
  });
  const angulo = (-147 + indice * 42) * Math.PI / 180;
  s += '<g data-selector="' + m + '"><circle cx="' + cx + '" cy="' + cy + '" r="31" fill="#1d2230" stroke="#0d0f14" stroke-width="3"/>' +
       '<circle cx="' + cx + '" cy="' + cy + '" r="21" fill="#2b2f38"/>' +
       '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + 27 * Math.sin(angulo)).toFixed(1) + '" y2="' + (cy - 27 * Math.cos(angulo)).toFixed(1) +
       '" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/></g>';
  // Bornes de entrada
  BORNES_MED.forEach(function (b) {
    s += '<text x="' + b.x + '" y="271" text-anchor="middle" font-size="9" font-weight="700" fill="#e9ecf2">' + b.texto + '</text>';
    s += '<circle cx="' + b.x + '" cy="290" r="11" fill="#14161b" stroke="' + b.color + '" stroke-width="3.5"/>';
    s += '<circle cx="' + b.x + '" cy="290" r="4" fill="#000000"/>';
  });
  s += '<text x="50" y="310" text-anchor="middle" font-size="6" fill="#c9cfdb">10 A · 300 mA FUSED</text>';
  return s + '</g>';
}

function dibujarBanco(b, p) {
  let s = '<g transform="translate(' + p.x + ',' + p.y + ')">';
  s += '<rect width="370" height="185" rx="8" fill="#26282e"/>';
  s += '<text x="12" y="16" font-size="11" font-weight="800" fill="#ffffff">BANCO ' + b.slice(1) + '</text>';
  s += '<text x="358" y="16" text-anchor="end" font-size="10" fill="#c9cfdb">carga resistiva · 3 resistencias</text>';
  s += '<rect x="6" y="24" width="358" height="155" rx="4" fill="#e9a23b" stroke="#b9781f" stroke-width="2"/>';
  for (let i = 0; i < 3; i++) {
    const id = b + '.R' + (i + 1);
    const cx = 62 + i * 118;
    const valor = estado.valores[id];
    // Cables internos y símbolo de resistencia variable
    s += '<line x1="' + cx + '" y1="57" x2="' + cx + '" y2="74" stroke="#1d2230" stroke-width="2.5"/>';
    s += '<line x1="' + cx + '" y1="130" x2="' + cx + '" y2="147" stroke="#1d2230" stroke-width="2.5"/>';
    s += '<rect x="' + (cx - 9) + '" y="74" width="18" height="56" fill="#f5d39a" stroke="#1d2230" stroke-width="2.5"/>';
    s += '<line x1="' + (cx - 17) + '" y1="124" x2="' + (cx + 15) + '" y2="80" stroke="#1d2230" stroke-width="2"/>';
    s += '<polygon points="' + (cx + 17) + ',77 ' + (cx + 7) + ',81 ' + (cx + 14) + ',88" fill="#1d2230"/>';
    s += '<text x="' + (cx - 24) + '" y="106" text-anchor="end" font-size="13" font-weight="800" fill="#1d2230">R' + (i + 1) + '</text>';
    // Perilla con su valor
    const k = VALORES.indexOf(valor);
    const ang = (-135 + k * (270 / (VALORES.length - 1))) * Math.PI / 180;
    const px = cx + 42, py = 94;
    s += '<g data-perilla="' + id + '"><rect x="' + (px - 26) + '" y="70" width="52" height="66" rx="8" fill="transparent"/>' +
         '<circle cx="' + px + '" cy="' + py + '" r="16" fill="#1d2230" stroke="#0d0f14" stroke-width="2"/>' +
         '<line x1="' + px + '" y1="' + py + '" x2="' + (px + 12 * Math.sin(ang)).toFixed(1) + '" y2="' + (py - 12 * Math.cos(ang)).toFixed(1) +
         '" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>' +
         '<text x="' + px + '" y="128" text-anchor="middle" font-size="11" font-weight="800" fill="#1d2230">' + formatoNominal(valor) + '</text></g>';
    // Bornes (rojo arriba, negro abajo)
    s += '<circle cx="' + cx + '" cy="46" r="11" fill="#c62828" stroke="#7a1414" stroke-width="2"/><circle cx="' + cx + '" cy="46" r="4" fill="#3a0a0a"/>';
    s += '<circle cx="' + cx + '" cy="158" r="11" fill="#1d2230" stroke="#000000" stroke-width="2"/><circle cx="' + cx + '" cy="158" r="4" fill="#000000"/>';
  }
  return s + '</g>';
}

// Espacio punteado donde va el segundo multímetro (al tocarlo se añade)
function dibujarEspacioM2(p) {
  return '<g data-boton="agregar" transform="translate(' + p.x + ',' + p.y + ')">' +
    '<rect width="170" height="316" rx="22" fill="#f5f6fa" stroke="#9aa1b2" stroke-width="2" stroke-dasharray="8 6"/>' +
    '<circle cx="85" cy="140" r="26" fill="#ffffff" stroke="#9aa1b2" stroke-width="2"/>' +
    '<text x="85" y="150" text-anchor="middle" font-size="30" font-weight="700" fill="#6b7280">+</text>' +
    '<text x="85" y="196" text-anchor="middle" font-size="13" font-weight="700" fill="#4a5164">Añadir</text>' +
    '<text x="85" y="214" text-anchor="middle" font-size="13" font-weight="700" fill="#4a5164">multímetro M2</text></g>';
}

// Recuadro con la ayuda rápida (solo en computador)
function dibujarAyuda(p) {
  const parrafos = [['Toca un borne y luego otro para conectar', 'un cable (el color se elige arriba).'],
                    ['Toca un cable para elegirlo y quitarlo.'],
                    ['Toca una posición del selector, por', 'ejemplo Ω, para medir resistencia.'],
                    ['Toca la perilla de una resistencia', 'para cambiar su valor.']];
  let s = '<g transform="translate(' + p.x + ',' + p.y + ')">' +
    '<rect width="355" height="262" rx="14" fill="#ffffff" stroke="#d5d9e3"/>' +
    '<text x="20" y="36" font-size="15" font-weight="800" fill="#1d2230">Cómo conectar</text>';
  let y = 70;
  parrafos.forEach(function (lineas) {
    lineas.forEach(function (l) {
      s += '<text x="20" y="' + y + '" font-size="13" fill="#4a5164">' + l + '</text>';
      y += 21;
    });
    y += 13;
  });
  return s + '</g>';
}

// Cable: curva que cuelga un poco entre los dos bornes
function caminoCable(a, b) {
  const caida = 35 + 0.25 * Math.abs(a.x - b.x) + 0.1 * Math.abs(a.y - b.y);
  return 'M' + a.x + ' ' + a.y + ' C' + a.x + ' ' + (a.y + caida) + ' ' + b.x + ' ' + (b.y + caida) + ' ' + b.x + ' ' + b.y;
}

function dibujar() {
  const d = disposicion();
  lienzo.setAttribute('viewBox', '0 0 ' + d.ancho + ' ' + d.alto);
  let s = '<rect width="' + d.ancho + '" height="' + d.alto + '" fill="#e6e9f0"/>';
  multimetros().forEach(function (m) { s += dibujarMultimetro(m, d.pos[m]); });
  if (!estado.multimetros.M2) s += dibujarEspacioM2(d.pos.M2);
  if (d.pos.ayuda) s += dibujarAyuda(d.pos.ayuda);
  BANCOS.forEach(function (b) { s += dibujarBanco(b, d.pos[b]); });
  // Cables
  estado.cables.forEach(function (c, k) {
    const a = posicionBorne(c.a, d), b = posicionBorne(c.b, d);
    const camino = caminoCable(a, b);
    const color = COLORES[c.color] || COLORES.rojo;
    const elegido = k === cableElegido;
    s += '<g data-cable="' + k + '">' +
         '<path d="' + camino + '" fill="none" stroke="transparent" stroke-width="18"/>' +
         (elegido ? '<path d="' + camino + '" fill="none" stroke="#ffd54a" stroke-width="13" stroke-linecap="round" opacity="0.9"/>' : '') +
         '<path d="' + camino + '" fill="none" stroke="#0d0f14" stroke-width="7" stroke-linecap="round" opacity="0.55"/>' +
         '<path d="' + camino + '" fill="none" stroke="' + color + '" stroke-width="4.5" stroke-linecap="round"/></g>';
  });
  // Clavijas de los cables y zonas para tocar los bornes
  estado.cables.forEach(function (c) {
    [c.a, c.b].forEach(function (borne) {
      const p = posicionBorne(borne, d);
      s += '<circle cx="' + p.x + '" cy="' + p.y + '" r="7" fill="' + (COLORES[c.color] || COLORES.rojo) + '" stroke="#0d0f14" stroke-width="1.5" pointer-events="none"/>';
    });
  });
  todosLosBornes().forEach(function (borne) {
    const p = posicionBorne(borne, d);
    if (borne === bornePendiente) {
      s += '<circle cx="' + p.x + '" cy="' + p.y + '" r="16" fill="none" stroke="' + COLORES[colorActual] +
           '" stroke-width="4" stroke-dasharray="5 4" pointer-events="none"/>';
    }
    s += '<circle data-borne="' + borne + '" cx="' + p.x + '" cy="' + p.y + '" r="19" fill="transparent">' +
         '<title>' + nombreBorne(borne) + '</title></circle>';
  });
  lienzo.innerHTML = s;
}


// ---------- Lecturas, avisos y ejercicios ----------
function tieneCable(borne) {
  return estado.cables.some(function (c) { return c.a === borne || c.b === borne; });
}

// Si el óhmetro mide exactamente entre los extremos de una resistencia, cuál es
function resistenciaEntre(l, red) {
  return IDS_RES.filter(function (id) {
    const a = red[id + '.a'], b = red[id + '.b'];
    return (a === l.p && b === l.q) || (a === l.q && b === l.p);
  })[0] || null;
}

function mostrarLecturas() {
  const lista = document.getElementById('lecturas');
  let html = '';
  multimetros().forEach(function (m) {
    const r = pantalla(m);
    const pos = POSICIONES.filter(function (x) { return x.id === estado.multimetros[m].modo; })[0];
    const texto = estado.multimetros[m].modo === 'off' ? 'apagado' : (r.digitos === 'OL' ? 'OL' : conComa(r.digitos)) + '\u00a0' + r.unidad;
    html += '<li><span>' + m + ' · Fluke 75 en ' + pos.texto + (r.hold ? ' (HOLD)' : '') + '</span><strong>' + texto + '</strong></li>';
  });
  lista.innerHTML = html;
}

function avisos() {
  const red = ultimoResultado.red;
  const lista = [];
  multimetros().forEach(function (m) {
    const modo = estado.multimetros[m].modo;
    const l = ultimoResultado.lecturas[m];
    const conectado = BORNES_MED.some(function (b) { return tieneCable(m + '.' + b.id); });
    if (!conectado) return;
    const enV = tieneCable(m + '.V'), enCOM = tieneCable(m + '.COM');
    const enA = tieneCable(m + '.A'), enmA = tieneCable(m + '.mA');
    if (modo === 'off') {
      lista.push({ tipo: 'info', texto: m + ' está apagado: gira el selector a Ω para medir resistencia.' });
      return;
    }
    if (modo === 'vdc' || modo === 'vac' || modo === 'mv' || modo === 'ma' || modo === 'a') {
      lista.push({ tipo: 'info', texto: m + ' está en ' + (modo === 'ma' || modo === 'a' ? 'corriente' : 'voltaje') +
        ': en esta mesa no hay fuente, así que marca cero. Para medir resistencia usa la posición Ω.' });
    }
    if (modo === 'ohm' || modo === 'cont') {
      if ((enA || enmA) && !enV) {
        lista.push({ tipo: 'error', texto: m + ': la punta roja está en el borne ' + (enA ? 'A' : 'mA') +
          '. Para medir resistencia va en el borne VΩ; los bornes A y mA son para corriente.' });
      } else if (enV !== enCOM) {
        lista.push({ tipo: 'error', texto: m + ': falta conectar la punta ' + (enV ? 'negra en COM' : 'roja en VΩ') + '.' });
      } else if (enV && enCOM && l.p === l.q) {
        lista.push({ tipo: 'error', texto: m + ': las dos puntas están en el mismo punto, por eso marca casi 0 Ω (cortocircuito).' });
      } else if (enV && enCOM && l.abierto) {
        lista.push({ tipo: 'info', texto: m + ' marca OL: entre sus puntas no hay un camino cerrado (circuito abierto). Revisa que las resistencias queden conectadas entre COM y VΩ.' });
      } else if (enV && enCOM) {
        const id = resistenciaEntre(l, red);
        if (id && Math.abs(l.valor - valorReal(id)) / valorReal(id) > 0.01) {
          lista.push({ tipo: 'info', texto: m + ' mide entre los extremos de ' + nombreResistencia(id) + ', pero esa resistencia está conectada a otras: lo que marca es el equivalente de todo lo conectado. Si querías medirla sola, desconecta uno de sus extremos.' });
        }
      }
      if (l.interferencia) {
        lista.push({ tipo: 'error', texto: 'Los dos multímetros están midiendo resistencia sobre el mismo circuito: se interfieren y las lecturas no son correctas. Mide con uno a la vez.' });
      }
    }
    // Puntas en A o mA y COM a la vez: así se mide corriente, en serie
    ['A', 'mA'].forEach(function (j) {
      if (tieneCable(m + '.' + j) && enCOM && red[m + '.' + j] !== red[m + '.COM']) {
        lista.push({ tipo: 'error', texto: m + ' tiene puntas en ' + j + ' y COM: por dentro esos bornes están unidos, es casi un cortocircuito. Así se mide corriente y va en serie; conectado en paralelo, con una fuente encendida, quemaría el fusible.' });
      }
    });
  });
  // Quitar avisos repetidos (el de interferencia sale una vez por multímetro)
  const vistos = {};
  const unicos = lista.filter(function (a) { if (vistos[a.texto]) return false; vistos[a.texto] = true; return true; });
  const caja = document.getElementById('avisos');
  caja.innerHTML = unicos.length === 0 ? '' :
    '<p class="tabla-titulo">Avisos</p><ul class="avisos-lista">' +
    unicos.map(function (a) { return '<li class="' + a.tipo + '">' + a.texto + '</li>'; }).join('') + '</ul>';
}

// Óhmetros que están midiendo (sin interferencia), con su lectura
function medicionesValidas() {
  return multimetros().map(function (m) { return ultimoResultado.lecturas[m]; }).filter(function (l) {
    return (l.modo === 'ohm' || l.modo === 'cont') && !l.abierto && l.p !== l.q && !l.interferencia;
  });
}
function cerca(valor, objetivo, tolerancia) { return Math.abs(valor - objetivo) / objetivo <= tolerancia; }

// Recuerda qué resistencias se midieron solas (para el Lab 2)
function anotarMedidasSolas() {
  medicionesValidas().forEach(function (l) {
    const id = resistenciaEntre(l, ultimoResultado.red);
    if (id && Math.abs(l.valor - valorReal(id)) / valorReal(id) < 0.002) estado.solas[id] = estado.valores[id];
  });
}

function hayMedida(objetivo, minimoResistencias) {
  return medicionesValidas().some(function (l) {
    return cerca(l.valor, objetivo, 0.06) && l.resistencias.length >= minimoResistencias;
  });
}

const RETOS = {
  '1': [
    { texto: 'Pon el selector de un multímetro en Ω y conecta las puntas en COM y VΩ.',
      ayuda: 'La punta negra siempre va en COM; para resistencia, la roja va en VΩ.',
      cumple: function () {
        return multimetros().some(function (m) {
          return estado.multimetros[m].modo === 'ohm' && tieneCable(m + '.COM') && tieneCable(m + '.V');
        });
      } },
    { texto: 'Ajusta una resistencia en 1 kΩ y mídela sola.',
      ayuda: 'Debe marcar cerca de 1 kΩ, pero no exacto: la tolerancia es de ±5 %.',
      cumple: function () {
        return medicionesValidas().some(function (l) {
          const id = resistenciaEntre(l, ultimoResultado.red);
          return id && estado.valores[id] === 1000 && Math.abs(l.valor - valorReal(id)) / valorReal(id) < 0.002;
        });
      } },
    { texto: 'Conecta dos resistencias de 1 kΩ en serie y mide la equivalente.',
      ayuda: 'En serie se suman: R = R₁ + R₂ ≈ 2 kΩ.',
      cumple: function () { return hayMedida(2000, 2); } },
    { texto: 'Ahora conéctalas en paralelo y mide.',
      ayuda: 'En paralelo: R = R₁·R₂ / (R₁ + R₂) ≈ 500 Ω.',
      cumple: function () { return hayMedida(500, 2); } }
  ],
  '2': [
    { texto: 'Ajusta cuatro resistencias con los valores del Lab 2: R₁ = 1 kΩ, R₂ = 2,2 kΩ, R₃ = 1 kΩ y R₄ = 3,3 kΩ.',
      ayuda: 'Toca la perilla de cada resistencia para cambiar su valor.',
      cumple: function () {
        const cuenta = function (v) { return IDS_RES.filter(function (id) { return estado.valores[id] === v; }).length; };
        return cuenta(1000) >= 2 && cuenta(2200) >= 1 && cuenta(3300) >= 1;
      } },
    { texto: 'Mide cada una por separado antes de armar el circuito.',
      ayuda: 'Se mide con la resistencia sola: si ya está conectada a otras, el valor cambia.',
      cumple: function () {
        const medidas = Object.keys(estado.solas).filter(function (id) { return estado.solas[id] === estado.valores[id]; });
        const cuenta = function (v) { return medidas.filter(function (id) { return estado.valores[id] === v; }).length; };
        return cuenta(1000) >= 2 && cuenta(2200) >= 1 && cuenta(3300) >= 1;
      } },
    { texto: 'Conecta R₃ y R₄ en serie y mide la equivalente.',
      ayuda: 'R₃ + R₄ ≈ 4,3 kΩ.',
      cumple: function () { return hayMedida(4300, 2); } },
    { texto: 'Arma el circuito completo visto desde la fuente: R₁ en serie con R₂ ∥ (R₃ + R₄), y mide.',
      ayuda: 'R = 1 kΩ + (2,2 kΩ · 4,3 kΩ) / (2,2 kΩ + 4,3 kΩ) ≈ 2,46 kΩ.',
      cumple: function () { return hayMedida(2455, 4); } }
  ]
};

function revisarRetos() {
  ['1', '2'].forEach(function (lab) {
    RETOS[lab].forEach(function (reto, k) {
      if (estado.retos[lab].indexOf(k) < 0 && reto.cumple()) estado.retos[lab].push(k);
    });
  });
}

function mostrarRetos() {
  const lab = estado.labRetos;
  document.querySelectorAll('.pestana').forEach(function (b) {
    b.classList.toggle('activa', b.dataset.lab === lab);
    b.setAttribute('aria-selected', b.dataset.lab === lab ? 'true' : 'false');
  });
  document.getElementById('retos').innerHTML = RETOS[lab].map(function (reto, k) {
    const hecho = estado.retos[lab].indexOf(k) >= 0;
    return '<li class="' + (hecho ? 'hecho' : '') + '">' + reto.texto + '<span>' + reto.ayuda + '</span></li>';
  }).join('');
}


// ---------- Sonido de continuidad ----------
let audio = null;
function pitar() {
  if (!estado.sonido) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audio.createOscillator(), vol = audio.createGain();
    osc.frequency.value = 2400;
    vol.gain.value = 0.05;
    osc.connect(vol); vol.connect(audio.destination);
    osc.start(); osc.stop(audio.currentTime + 0.35);
  } catch (error) {}
}


// ---------- Actualizar todo después de cada cambio ----------
function actualizar() {
  ultimoResultado = calcular();
  multimetros().forEach(function (m) {
    const r = pantalla(m);
    if (r.pita && !pitando[m]) pitar();
    pitando[m] = r.pita;
  });
  anotarMedidasSolas();
  revisarRetos();
  dibujar();
  mostrarLecturas();
  avisos();
  mostrarRetos();
  actualizarBarra();
  guardarEstado();
}

function actualizarBarra() {
  document.getElementById('btn-multimetro').textContent = estado.multimetros.M2 ? 'Quitar multímetro M2' : 'Añadir multímetro';
  document.getElementById('btn-quitar-cable').disabled = cableElegido === null;
  const sonido = document.getElementById('btn-sonido');
  sonido.textContent = 'Sonido: ' + (estado.sonido ? 'sí' : 'no');
  sonido.setAttribute('aria-pressed', estado.sonido ? 'true' : 'false');
  document.querySelectorAll('.color').forEach(function (b) { b.classList.toggle('activo', b.dataset.color === colorActual); });
}

function mensaje(texto) { document.getElementById('estado-mesa').textContent = texto; }


// ---------- Lo que pasa al tocar la mesa ----------
lienzo.addEventListener('click', function (evento) {
  const objetivo = evento.target.closest('[data-borne], [data-cable], [data-modo], [data-selector], [data-boton], [data-perilla]');
  cerrarMenu();
  if (!objetivo) {
    if (cableElegido !== null) { cableElegido = null; actualizar(); }
    return;
  }
  if (objetivo.dataset.borne) return tocarBorne(objetivo.dataset.borne);
  if (objetivo.dataset.cable !== undefined) {
    const k = Number(objetivo.dataset.cable);
    cableElegido = cableElegido === k ? null : k;
    if (cableElegido !== null) {
      const c = estado.cables[k];
      mensaje('Cable elegido: de ' + nombreBorne(c.a) + ' a ' + nombreBorne(c.b) + '. Toca “Quitar cable” para quitarlo.');
    } else {
      mensaje('Toca un borne para empezar un cable.');
    }
    return actualizar();
  }
  if (objetivo.dataset.modo) {
    const partes = objetivo.dataset.modo.split('.');
    return cambiarModo(partes[0], partes[1]);
  }
  if (objetivo.dataset.selector) {
    const m = objetivo.dataset.selector;
    const k = POSICIONES.map(function (x) { return x.id; }).indexOf(estado.multimetros[m].modo);
    return cambiarModo(m, POSICIONES[(k + 1) % POSICIONES.length].id);
  }
  if (objetivo.dataset.boton === 'agregar') return agregarQuitarM2();
  if (objetivo.dataset.boton) {
    const partes = objetivo.dataset.boton.split('.');
    return partes[1] === 'range' ? botonRange(partes[0]) : botonHold(partes[0]);
  }
  if (objetivo.dataset.perilla) abrirMenu(objetivo.dataset.perilla, objetivo);
});

function tocarBorne(borne) {
  cableElegido = null;
  if (bornePendiente === null) {
    bornePendiente = borne;
    mensaje('Primer extremo: ' + nombreBorne(borne) + '. Ahora toca otro borne (o el mismo para cancelar).');
  } else if (bornePendiente === borne) {
    bornePendiente = null;
    mensaje('Cable cancelado.');
  } else {
    const repetido = estado.cables.some(function (c) {
      return (c.a === bornePendiente && c.b === borne) || (c.a === borne && c.b === bornePendiente);
    });
    if (!repetido) estado.cables.push({ a: bornePendiente, b: borne, color: colorActual });
    mensaje(repetido ? 'Ya había un cable entre esos dos bornes.' : 'Cable conectado: de ' + nombreBorne(bornePendiente) + ' a ' + nombreBorne(borne) + '.');
    bornePendiente = null;
  }
  actualizar();
}

function cambiarModo(m, modo) {
  estado.multimetros[m].modo = modo;
  estado.multimetros[m].rango = null;   // al girar el selector vuelve a AUTO
  estado.multimetros[m].hold = null;
  actualizar();
}

function botonRange(m) {
  const mm = estado.multimetros[m];
  if (mm.modo !== 'ohm' && mm.modo !== 'cont') {
    mensaje('En esta mesa RANGE solo cambia algo en Ω: en V y en A el multímetro marca cero.');
    return;
  }
  // AUTO → rango del valor actual → siguiente... → después del último vuelve a AUTO
  if (mm.rango === null) {
    const l = ultimoResultado.lecturas[m];
    const valor = l.abierto ? Infinity : l.valor;
    const k = RANGOS_OHM.map(function (r) { return valor < r.max; }).indexOf(true);
    mm.rango = k < 0 ? RANGOS_OHM.length - 1 : k;
  } else {
    mm.rango = mm.rango + 1 < RANGOS_OHM.length ? mm.rango + 1 : null;
  }
  mensaje(mm.rango === null ? m + ' volvió a rango automático (AUTO).' :
    m + ' en rango manual de ' + conComa(String(RANGOS_OHM[mm.rango].max * RANGOS_OHM[mm.rango].factor)) + ' ' + RANGOS_OHM[mm.rango].unidad + '. Si el valor no cabe, marca OL.');
  actualizar();
}

function botonHold(m) {
  const mm = estado.multimetros[m];
  if (mm.modo === 'off') return;
  if (mm.hold) {
    mm.hold = null;
    mensaje(m + ': HOLD desactivado, la lectura vuelve a cambiar.');
  } else {
    const r = pantalla(m);
    mm.hold = { digitos: r.digitos, unidad: r.unidad, barra: r.barra };
    mensaje(m + ': HOLD congela la lectura en la pantalla.');
  }
  actualizar();
}


// ---------- Menú de valores de las resistencias ----------
const menu = document.getElementById('menu-valores');
function abrirMenu(id, elemento) {
  const caja = elemento.getBoundingClientRect(), mesa = document.getElementById('mesa').getBoundingClientRect();
  menu.innerHTML = '<p>' + nombreResistencia(id) + '</p>' + VALORES.map(function (v) {
    return '<button data-valor="' + v + '" class="' + (estado.valores[id] === v ? 'activo' : '') + '">' + formatoNominal(v) + '</button>';
  }).join('');
  menu.dataset.id = id;
  menu.hidden = false;
  const ancho = menu.offsetWidth, alto = menu.offsetHeight;
  let x = caja.left - mesa.left + caja.width / 2 - ancho / 2;
  let y = caja.bottom - mesa.top + 4;
  x = Math.max(6, Math.min(x, mesa.width - ancho - 6));
  if (y + alto > mesa.height - 6) y = Math.max(6, caja.top - mesa.top - alto - 4);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
}
function cerrarMenu() { menu.hidden = true; }
menu.addEventListener('click', function (evento) {
  const boton = evento.target.closest('[data-valor]');
  if (!boton) return;
  const id = menu.dataset.id;
  estado.valores[id] = Number(boton.dataset.valor);
  cerrarMenu();
  mensaje(nombreResistencia(id) + ' ajustada en ' + formatoNominal(estado.valores[id]) + '.');
  actualizar();
});
document.addEventListener('click', function (evento) {
  if (!menu.hidden && !evento.target.closest('#menu-valores') && !evento.target.closest('[data-perilla]')) cerrarMenu();
});


// ---------- Barra de herramientas ----------
const cajaColores = document.getElementById('colores');
cajaColores.innerHTML = '<span>Cable:</span>' + Object.keys(COLORES).map(function (nombre) {
  return '<button class="color" data-color="' + nombre + '" style="background:' + COLORES[nombre] + '" aria-label="Cable ' + nombre + '"></button>';
}).join('');
cajaColores.addEventListener('click', function (evento) {
  const boton = evento.target.closest('[data-color]');
  if (!boton) return;
  colorActual = boton.dataset.color;
  actualizarBarra();
  if (bornePendiente) dibujar();
});

document.getElementById('btn-multimetro').addEventListener('click', agregarQuitarM2);
function agregarQuitarM2() {
  if (estado.multimetros.M2) {
    delete estado.multimetros.M2;
    estado.cables = estado.cables.filter(function (c) { return c.a.indexOf('M2.') !== 0 && c.b.indexOf('M2.') !== 0; });
    if (bornePendiente && bornePendiente.indexOf('M2.') === 0) bornePendiente = null;
    mensaje('Se quitó el multímetro M2 y sus cables.');
  } else {
    estado.multimetros.M2 = nuevoMultimetro();
    mensaje('Se añadió el multímetro M2.');
  }
  cableElegido = null;
  actualizar();
}

document.getElementById('btn-quitar-cable').addEventListener('click', function () {
  if (cableElegido === null) return;
  estado.cables.splice(cableElegido, 1);
  cableElegido = null;
  mensaje('Cable quitado.');
  actualizar();
});

// "Quitar todos" pide tocarlo dos veces
let confirmandoTodos = false;
document.getElementById('btn-quitar-todos').addEventListener('click', function () {
  const boton = this;
  if (!confirmandoTodos) {
    confirmandoTodos = true;
    boton.textContent = '¿Seguro? Toca otra vez';
    setTimeout(function () { confirmandoTodos = false; boton.textContent = 'Quitar todos los cables'; }, 4000);
    return;
  }
  confirmandoTodos = false;
  boton.textContent = 'Quitar todos los cables';
  estado.cables = [];
  cableElegido = null;
  bornePendiente = null;
  mensaje('Se quitaron todos los cables.');
  actualizar();
});

document.getElementById('btn-sonido').addEventListener('click', function () {
  estado.sonido = !estado.sonido;
  actualizar();
});

// Pestañas de ejercicios
document.querySelectorAll('.pestana').forEach(function (b) {
  b.addEventListener('click', function () { estado.labRetos = b.dataset.lab; mostrarRetos(); });
});
document.getElementById('btn-reiniciar-retos').addEventListener('click', function () {
  estado.retos[estado.labRetos] = [];
  if (estado.labRetos === '2') estado.solas = {};
  actualizar();
});

// "Dejar la mesa como al principio" pide tocarlo dos veces
let confirmandoVaciar = false;
document.getElementById('btn-vaciar').addEventListener('click', function () {
  const boton = this;
  if (!confirmandoVaciar) {
    confirmandoVaciar = true;
    boton.textContent = '¿Seguro? Toca otra vez';
    setTimeout(function () { confirmandoVaciar = false; boton.textContent = 'Dejar la mesa como al principio'; }, 4000);
    return;
  }
  confirmandoVaciar = false;
  boton.textContent = 'Dejar la mesa como al principio';
  estado = estadoInicial();
  cableElegido = null;
  bornePendiente = null;
  mensaje('La mesa quedó como al principio, con resistencias nuevas.');
  actualizar();
});

// Al girar el celular o cambiar el tamaño de la ventana, se reacomoda la mesa
let anchoAnterior = 0;
window.addEventListener('resize', function () {
  const ancho = document.getElementById('mesa').clientWidth;
  if ((ancho < 640) !== (anchoAnterior < 640)) { cerrarMenu(); dibujar(); }
  anchoAnterior = ancho;
});

// ---------- Al abrir la página ----------
anchoAnterior = document.getElementById('mesa').clientWidth;
actualizar();