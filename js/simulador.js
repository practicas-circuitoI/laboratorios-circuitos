// ===================================================
// Simulador de conexiones · Labs 1 y 2
// Mesa virtual SIN FUENTE con hasta dos multímetros Fluke 75 y tres
// bancos de tres resistencias. Se conecta un cable tocando dos bornes.
// En Ω el multímetro calcula la resistencia equivalente entre sus
// puntas, como lo haría uno real; en V y en A marca cero (no hay fuente).
// ===================================================

// ---------- Datos fijos ----------
const CLAVE_MESA = 'simulador-mesa';
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

// ---------- Laboratorio desde el que se abrió (?lab=1 o ?lab=2) ----------
const parametros = new URLSearchParams(location.search);
const labOrigen = parametros.get('lab') === '2' ? '2' : '1';
if (labOrigen === '2') {
  document.body.classList.remove('lab-ohm');
  document.body.classList.add('lab-kirchhoff');
  document.getElementById('simbolo').textContent = 'ΣI';
}
document.getElementById('volver').href = 'lab' + labOrigen + '.html';
document.getElementById('volver').textContent = '← Volver al Lab ' + labOrigen;


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