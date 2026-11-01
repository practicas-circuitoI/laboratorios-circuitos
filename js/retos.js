// ===================================================
// Retos y circuitos guiados del simulador
//  - Desde la portada (sin ?lab=): práctica libre con 8 retos.
//  - Desde el Lab 1 o el Lab 2 (?lab=1 o ?lab=2): 6 circuitos de ese
//    laboratorio, de fácil a difícil; cada uno se desbloquea al terminar el anterior.
// Usa lo que ya calcula js/simulador.js (estado, ultimoResultado, pantalla…)
// y revisa el reto actual cada vez que algo cambia en la mesa.
// ===================================================
(function () {
  const MODO = desdeLab ? 'lab' + labOrigen : 'libre';
  const CLAVE_GUIADO = MODO === 'libre' ? 'simulador-retos-guiados' : 'simulador-circuitos-' + MODO;
  const PALABRA = MODO === 'libre' ? 'Reto' : 'Circuito';
  const ICONO = '<svg class="icono" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="3"/>' +
                '<rect x="8" y="5" width="8" height="4" rx="1"/><circle cx="12" cy="15.5" r="3"/></svg>';
  const $ = function (id) { return document.getElementById(id); };

  // ---------- Aspecto según desde dónde se abrió ----------
  if (MODO === 'libre') {
    // Práctica libre: amarillo y negro, como el Fluke
    document.body.classList.remove('lab-ohm');
    document.body.classList.add('lab-libre');
    $('simbolo').innerHTML = ICONO;
    document.querySelector('.encabezado-lab p').textContent = 'Práctica libre: 8 retos para aprender a medir con el Fluke 75.';
    document.title = 'Práctica libre · Simulador de conexiones';
  } else {
    // Desde un lab: el color del lab y su mapa de 6 circuitos
    document.querySelector('.encabezado-lab h1').textContent = 'Simulador del Lab ' + labOrigen;
    document.querySelector('.encabezado-lab p').textContent = labOrigen === '1'
      ? '6 circuitos de la Ley de Ohm, de fácil a difícil.'
      : '6 circuitos para entender el circuito de Kirchhoff, de fácil a difícil.';
    document.title = 'Simulador del Lab ' + labOrigen + ' · Circuitos I';
    $('mapa-circuitos').hidden = false;
  }
  $('reto-guiado').hidden = false;
  $('seccion-ejercicios').hidden = true;

  // ---------- Progreso guardado en el dispositivo ----------
  // memo guarda lo que cada reto necesita recordar (lo que ya se midió, respuestas, pasos logrados)
  function progresoInicial() { return { actual: 0, hechos: [], respuesta: '', preparado: false, memo: {} }; }
  let guiado;
  try { guiado = JSON.parse(localStorage.getItem(CLAVE_GUIADO)); } catch (error) { guiado = null; }
  if (!guiado || !Array.isArray(guiado.hechos)) guiado = progresoInicial();
  if (!guiado.memo) guiado.memo = {};
  function guardarGuiado() {
    try { localStorage.setItem(CLAVE_GUIADO, JSON.stringify(guiado)); } catch (error) {}
  }
  function memo() {
    const k = String(guiado.actual);
    if (!guiado.memo[k]) guiado.memo[k] = {};
    return guiado.memo[k];
  }

  // ---------- Ayudas para revisar la mesa ----------
  // El multímetro con el que se está trabajando: el primero que tenga cables
  function medidor() {
    const lista = multimetros();
    return lista.filter(function (m) {
      return BORNES_MED.some(function (b) { return tieneCable(m + '.' + b.id); });
    })[0] || lista[0];
  }
  function lecturaDe(m) { return ultimoResultado.lecturas[m]; }
  function midiendo(m) {
    const l = lecturaDe(m);
    return estado.multimetros[m].modo === 'ohm' && tieneCable(m + '.V') && tieneCable(m + '.COM') &&
           !l.abierto && l.p !== l.q && !l.interferencia;
  }
  function textoLectura(m) {
    const r = pantalla(m);
    return r.digitos === 'OL' ? 'OL' : conComa(r.digitos) + ' ' + r.unidad;
  }
  function enKilo(ohmios) { return conComa((ohmios / 1000).toFixed(3)) + ' kΩ'; }
  function cercaDe(valor, objetivo, margen) { return Math.abs(valor - objetivo) / objetivo < margen; }
  function serie(a, b) { return a + b; }
  function paralelo(a, b) { return a * b / (a + b); }
  function nodo(id, lado) { return ultimoResultado.red[id + '.' + lado]; }
  function conValor(v) { return IDS_RES.filter(function (id) { return estado.valores[id] === v; }); }

  // La resistencia que el óhmetro mide sola (sin nada más conectado), o null
  function medidaSola(m) {
    if (!midiendo(m)) return null;
    const l = lecturaDe(m), id = resistenciaEntre(l, ultimoResultado.red);
    return id && cercaDe(l.valor, valorReal(id), 0.002) ? id : null;
  }
  // ¿Hay en los bancos resistencias con esos valores? Ej.: [1000, 1000, 2200]
  function hayValores(lista) {
    const cuenta = {};
    lista.forEach(function (v) { cuenta[v] = (cuenta[v] || 0) + 1; });
    return Object.keys(cuenta).every(function (v) { return conValor(Number(v)).length >= cuenta[v]; });
  }
  // Busca resistencias con esos valores nominales cuya combinación (fórmula) dé lo que marca el óhmetro
  function combinacion(m, valores, formula) {
    if (!midiendo(m)) return null;
    const l = lecturaDe(m), ids = l.resistencias;
    let hallado = null;
    (function elegir(usados) {
      if (hallado) return;
      if (usados.length === valores.length) {
        if (cercaDe(l.valor, formula.apply(null, usados.map(valorReal)), 0.002)) hallado = usados.slice();
        return;
      }
      ids.forEach(function (id) {
        if (hallado || usados.indexOf(id) >= 0 || estado.valores[id] !== valores[usados.length]) return;
        usados.push(id); elegir(usados); usados.pop();
      });
    })([]);
    return hallado;
  }
  // Busca dos resistencias cualesquiera que, juntas, den lo que marca el óhmetro
  function parejas(l) {
    const ids = l.resistencias, encontrado = { serie: null, paralelo: null };
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = valorReal(ids[i]), b = valorReal(ids[j]);
        if (cercaDe(l.valor, a + b, 0.002)) encontrado.serie = [ids[i], ids[j]];
        if (cercaDe(l.valor, a * b / (a + b), 0.002)) encontrado.paralelo = [ids[i], ids[j]];
      }
    }
    return encontrado;
  }

  // Revisiones que se repiten: { ok, texto, error, pista, fijo }
  //   error: true  → algo está mal conectado (sale en rojo)
  //   pista        → ayuda que aparece cuando ese es el paso que sigue
  //   fijo: 'x'    → una vez logrado, queda logrado aunque después se desarme
  function selectorEnOhm(m) {
    const modo = estado.multimetros[m].modo;
    if (modo === 'ohm') return { ok: true, texto: 'Selector en Ω' };
    const pos = POSICIONES.filter(function (x) { return x.id === modo; })[0];
    return { ok: false, error: modo !== 'off',
             texto: modo === 'off' ? 'El multímetro está apagado: gira el selector a Ω'
                                   : 'El selector está en ' + pos.texto + ': para medir resistencia va en Ω' };
  }
  function puntaNegra(m) {
    return tieneCable(m + '.COM') ? { ok: true, texto: 'Punta negra en COM' }
                                  : { ok: false, texto: 'Conecta un cable en el borne COM: ahí va siempre la punta negra' };
  }
  function puntaRoja(m) {
    if (tieneCable(m + '.A') || tieneCable(m + '.mA')) {
      return { ok: false, error: true, texto: 'Hay un cable en el borne ' + (tieneCable(m + '.A') ? 'A' : 'mA') +
                                 ': ese borne es para corriente. Para medir resistencia la punta roja va en VΩ' };
    }
    return tieneCable(m + '.V') ? { ok: true, texto: 'Punta roja en VΩ' }
                                : { ok: false, texto: 'Conecta un cable en el borne VΩ: ahí va la punta roja' };
  }
  function puntas(m) { return [selectorEnOhm(m), puntaNegra(m), puntaRoja(m)]; }
  // Revisión de "valores ajustados" con su pista
  function valoresListos(lista, textoOk, textoFalta, pista) {
    return hayValores(lista) ? { ok: true, texto: textoOk } : { ok: false, texto: textoFalta, pista: pista };
  }

  // ---------- Circuito del Lab 2: esquema que se pinta y avance paso a paso ----------
  // Cada grupo (id="e-…") se pinta de verde cuando esa parte está bien armada
  const ESQUEMA_LAB2 =
    '<svg class="esquema-reto" viewBox="0 0 590 330" role="img" aria-label="Esquema: R1 en serie con R2 en paralelo con R3 más R4">' +
    '<g class="parte" id="e-r1"><path d="M60 55 H130"/><path d="M130 55 l5 -10 l10 20 l10 -20 l10 20 l10 -20 l10 20 l10 -20 l10 20 l10 -20 l10 20 l5 -10"/><path d="M230 55 H300"/></g>' +
    '<g class="parte" id="e-r2"><path d="M300 55 V105"/><path d="M300 105 l-10 5 l20 10 l-20 10 l20 10 l-20 10 l20 10 l-20 10 l20 10 l-20 10 l20 10 l-10 5"/><path d="M300 205 V285"/></g>' +
    '<g class="parte" id="e-r34"><path d="M300 55 H450 V85"/><path d="M450 85 l-10 5 l20 10 l-20 10 l20 10 l-20 10 l20 10 l-20 10 l20 10 l-10 5"/><path d="M450 165 V185"/>' +
      '<path d="M450 185 l-10 5 l20 10 l-20 10 l20 10 l-20 10 l20 10 l-20 10 l20 10 l-10 5"/><path d="M450 265 V285 H300"/></g>' +
    '<g class="parte" id="e-medir"><path d="M60 285 H300"/></g>' +
    '<circle cx="50" cy="55" r="11" fill="#d93025"/><circle cx="50" cy="285" r="11" fill="#1d2230"/>' +
    '<circle cx="300" cy="55" r="5" fill="#1d2230"/><circle cx="300" cy="285" r="5" fill="#1d2230"/>' +
    '<text x="50" y="30" text-anchor="middle" fill="#d93025">VΩ</text><text x="50" y="318" text-anchor="middle">COM</text>' +
    '<text x="300" y="38" text-anchor="middle">A</text><text x="300" y="312" text-anchor="middle">B</text>' +
    '<text x="180" y="28" text-anchor="middle">R₁ = 1 kΩ</text><text x="316" y="160">R₂ = 2,2 kΩ</text>' +
    '<text x="466" y="130">R₃ = 1 kΩ</text><text x="466" y="230">R₄ = 3,3 kΩ</text></svg>';

  function pintarEsquema(nivel) {
    const partes = { 'e-r34': 2, 'e-r2': 3, 'e-r1': 4, 'e-medir': 5 };
    Object.keys(partes).forEach(function (id) {
      const parte = $(id);
      if (!parte) return;
      parte.classList.toggle('listo', nivel >= partes[id]);
      parte.classList.toggle('siguiente', nivel >= 1 && partes[id] === nivel + 1);
    });
  }

  // Revisa hasta dónde va armado el circuito del Lab 2 (nivel 0 a 5), sin importar qué bancos se usen.
  // También devuelve los nodos A y B y cuáles resistencias hacen de R1…R4.
  function progresoLab2(m) {
    const de1k = conValor(1000), de22 = conValor(2200), de33 = conValor(3300);
    const valores = de1k.length >= 2 && de22.length >= 1 && de33.length >= 1;
    const otro = function (lado) { return lado === 'a' ? 'b' : 'a'; };
    const cuantos = function (n) { return todosLosBornes().filter(function (b) { return ultimoResultado.red[b] === n; }).length; };
    const res = { nivel: valores ? 1 : 0, valores: valores };
    if (!valores) return res;
    const subir = function (n, datos) { if (n > res.nivel || (n === res.nivel && !res.A && datos.A)) { res.nivel = n; Object.assign(res, datos); } };
    de1k.forEach(function (x) {
      de33.forEach(function (y) {
        ['a', 'b'].forEach(function (lx) {
          ['a', 'b'].forEach(function (ly) {
            // Paso 2: R3 y R4 comparten un punto donde no hay nada más
            const union = nodo(x, lx);
            if (union !== nodo(y, ly) || cuantos(union) !== 2) return;
            const e1 = nodo(x, otro(lx)), e2 = nodo(y, otro(ly));
            if (e1 === e2) return;
            subir(2, {});
            de22.forEach(function (z) {
              // Paso 3: R2 entre los dos extremos de la serie
              const za = nodo(z, 'a'), zb = nodo(z, 'b');
              if (!((za === e1 && zb === e2) || (za === e2 && zb === e1))) return;
              subir(3, { e1: e1, e2: e2, r2: z, r3: x, r4: y });
              de1k.forEach(function (w) {
                if (w === x) return;
                ['a', 'b'].forEach(function (lw) {
                  // Paso 4: otra de 1 kΩ con un borne en el nodo A
                  const A = nodo(w, lw), libre = nodo(w, otro(lw));
                  if (A !== e1 && A !== e2) return;
                  const B = A === e1 ? e2 : e1;
                  if (libre === A || libre === B) return;
                  const datos = { A: A, B: B, libre: libre, r1: w, r2: z, r3: x, r4: y };
                  subir(4, datos);
                  // Paso 5: el Fluke mide entre el borne libre de R1 y el nodo B, y da lo esperado
                  const p = ultimoResultado.red[m + '.V'], q = ultimoResultado.red[m + '.COM'];
                  const puntasBien = (p === libre && q === B) || (p === B && q === libre);
                  const esperado = valorReal(w) + paralelo(valorReal(z), valorReal(x) + valorReal(y));
                  if (puntasBien && midiendo(m) && cercaDe(lecturaDe(m).valor, esperado, 0.002)) subir(5, datos);
                });
              });
            });
          });
        });
      });
    });
    return res;
  }

  // El circuito completo del Lab 2 (reto 7 de la práctica libre y circuito 4 del Lab 2)
  const CIRCUITO_LAB2 = {
    titulo: 'El circuito del Lab 2',
    texto: 'Arma este circuito con las resistencias de los bancos y mídelo con el Fluke. Ve paso a paso: cada parte del esquema se pone verde cuando la armas bien, y la que sigue parpadea en amarillo.',
    pista: 'Empieza por la rama de la derecha (R₃ + R₄), después pon R₂ al lado y por último R₁. Mide al final, entre el borne libre de R₁ y el nodo B.',
    esquema: ESQUEMA_LAB2,
    revisar: function (m) {
      const p = progresoLab2(m);
      pintarEsquema(p.nivel);
      // Paso 5: si algo de la medición está mal, la pista lo dice
      let pistaMedir = 'Selector en Ω, punta roja (VΩ) en el borne libre de R₁ y punta negra (COM) en el nodo B, abajo de R₂ y R₄.';
      const errores = puntas(m).filter(function (c) { return !c.ok && c.error; });
      if (errores.length) pistaMedir = errores[0].texto + '.';
      return [
        { ok: p.valores, texto: 'Paso 1: R₂ = 2,2 kΩ y R₄ = 3,3 kΩ (R₁ y R₃ quedan en 1 kΩ)',
          pista: 'Toca la perilla de una resistencia y elige 2,2 kΩ (será R₂); luego la de otra y elige 3,3 kΩ (será R₄). Por ejemplo, R2 del banco 1 y R1 del banco 2.' },
        { ok: p.nivel >= 2, texto: 'Paso 2: R₃ y R₄ en serie',
          pista: 'Une con un cable el borne de abajo de una de 1 kΩ (R₃) con el de arriba de la de 3,3 kΩ (R₄). En ese punto no debe haber nada más conectado.' },
        { ok: p.nivel >= 3, texto: 'Paso 3: R₂ en paralelo con R₃ + R₄',
          pista: 'Conecta la de 2,2 kΩ entre los dos extremos libres de la serie: arriba de R₂ con arriba de R₃ (nodo A) y abajo de R₂ con abajo de R₄ (nodo B).' },
        { ok: p.nivel >= 4, texto: 'Paso 4: R₁ en serie con el grupo',
          pista: 'Toma otra de 1 kΩ (R₁) y une su borne de abajo con el nodo A, donde se juntan R₂ y R₃.' },
        { ok: p.nivel >= 5, texto: p.nivel >= 5 ? 'Paso 5: el Fluke marca ' + textoLectura(m) + ', cerca de 2,46 kΩ'
                                                : 'Paso 5: mide entre los extremos con el Fluke en Ω',
          pista: pistaMedir }
      ];
    },
    exito: function () { return 'Es el circuito del Lab 2 visto desde la fuente: 1 kΩ + (2,2 kΩ · 4,3 kΩ) / (6,5 kΩ) ≈ 2,46 kΩ. ' +
                                'En el laboratorio, mide así la resistencia equivalente antes de encender la fuente.'; }
  };

  // Esquemas pequeños de los 12 circuitos (generados con el mismo dibujo de las maquetas)
  const MINI = {
    'lab1-1': "<svg class=\"mini-esq\" viewBox=\"0 0 220 130\" role=\"img\"><g class=\"trazo\"><path d=\"M26 65 H80\"/><path d=\"M80 65 l5 -7 l10 14 l10 -14 l10 14 l10 -14 l10 14 l5 -7\"/><path d=\"M140 65 H194\"/></g><circle cx=\"20\" cy=\"65\" r=\"6\" class=\"roja\"/><circle cx=\"200\" cy=\"65\" r=\"6\" class=\"negra\"/><text x=\"110\" y=\"45\" text-anchor=\"middle\" class=\"\">1 kΩ</text></svg>",
    'lab1-2': "<svg class=\"mini-esq\" viewBox=\"0 0 220 130\" role=\"img\"><g class=\"trazo\"><path d=\"M50 35 l-7 5 l14 10 l-14 10 l14 10 l-14 10 l14 10 l-7 5\"/><path d=\"M110 35 l-7 5 l14 10 l-14 10 l14 10 l-14 10 l14 10 l-7 5\"/><path d=\"M170 35 l-7 5 l14 10 l-14 10 l14 10 l-14 10 l14 10 l-7 5\"/></g><text x=\"50\" y=\"115\" text-anchor=\"middle\" class=\"\">100 Ω</text><text x=\"110\" y=\"115\" text-anchor=\"middle\" class=\"\">1 kΩ</text><text x=\"170\" y=\"115\" text-anchor=\"middle\" class=\"\">10 kΩ</text><text x=\"110\" y=\"22\" text-anchor=\"middle\" class=\"suave\">una a la vez</text></svg>",
    'lab1-3': "<svg class=\"mini-esq\" viewBox=\"0 0 220 130\" role=\"img\"><g class=\"trazo\"><path d=\"M26 65 H40\"/><path d=\"M40 65 l5 -7 l10 14 l10 -14 l10 14 l10 -14 l10 14 l5 -7\"/><path d=\"M100 65 H120\"/><path d=\"M120 65 l5 -7 l10 14 l10 -14 l10 14 l10 -14 l10 14 l5 -7\"/><path d=\"M180 65 H194\"/></g><circle cx=\"20\" cy=\"65\" r=\"6\" class=\"roja\"/><circle cx=\"200\" cy=\"65\" r=\"6\" class=\"negra\"/><text x=\"70\" y=\"45\" text-anchor=\"middle\" class=\"\">1 kΩ</text><text x=\"150\" y=\"45\" text-anchor=\"middle\" class=\"\">2,2 kΩ</text></svg>",
    'lab1-4': "<svg class=\"mini-esq\" viewBox=\"0 0 220 130\" role=\"img\"><g class=\"trazo\"><path d=\"M26 25 H170 V35\"/><path d=\"M90 25 V35\"/><path d=\"M90 35 l-7 5 l14 10 l-14 10 l14 10 l-14 10 l14 10 l-7 5\"/><path d=\"M170 35 l-7 5 l14 10 l-14 10 l14 10 l-14 10 l14 10 l-7 5\"/><path d=\"M90 95 V105 H170 V95\"/><path d=\"M26 105 H90\"/></g><circle cx=\"20\" cy=\"25\" r=\"6\" class=\"roja\"/><circle cx=\"20\" cy=\"105\" r=\"6\" class=\"negra\"/><text x=\"110\" y=\"70\" text-anchor=\"start\" class=\"\">1 kΩ</text><text x=\"190\" y=\"70\" text-anchor=\"start\" class=\"\">1 kΩ</text></svg>",
    'lab1-5': "<svg class=\"mini-esq\" viewBox=\"0 0 220 130\" role=\"img\"><g class=\"trazo\"><path d=\"M26 25 H40\"/><path d=\"M40 25 l5 -7 l10 14 l10 -14 l10 14 l10 -14 l10 14 l5 -7\"/><path d=\"M100 25 H180 V35\"/><path d=\"M130 25 V35\"/><path d=\"M130 35 l-7 5 l14 10 l-14 10 l14 10 l-14 10 l14 10 l-7 5\"/><path d=\"M180 35 l-7 5 l14 10 l-14 10 l14 10 l-14 10 l14 10 l-7 5\"/><path d=\"M130 95 V105 H180 V95\"/><path d=\"M26 105 H130\"/></g><circle cx=\"20\" cy=\"25\" r=\"6\" class=\"roja\"/><circle cx=\"20\" cy=\"105\" r=\"6\" class=\"negra\"/><text x=\"70\" y=\"15\" text-anchor=\"middle\" class=\"\">1 kΩ</text><text x=\"140\" y=\"70\" text-anchor=\"start\" class=\"\">2,2k</text><text x=\"190\" y=\"70\" text-anchor=\"start\" class=\"\">3,3k</text></svg>",
    'lab1-6': "<svg class=\"mini-esq\" viewBox=\"0 0 220 130\" role=\"img\"><g class=\"trazo\"><path d=\"M26 65 H70\"/><rect x=\"70\" y=\"40\" width=\"80\" height=\"50\" rx=\"8\" class=\"caja-pregunta\"/><path d=\"M150 65 H194\"/></g><circle cx=\"20\" cy=\"65\" r=\"6\" class=\"roja\"/><circle cx=\"200\" cy=\"65\" r=\"6\" class=\"negra\"/><text x=\"110\" y=\"74\" text-anchor=\"middle\" class=\"pregunta\">?</text><text x=\"110\" y=\"115\" text-anchor=\"middle\" class=\"suave\">solo resistencias de 1 kΩ</text></svg>",
    'lab2-1': "<svg class=\"mini-esq\" viewBox=\"0 0 220 130\" role=\"img\"><g class=\"trazo\"><path d=\"M40 35 l-7 5 l14 10 l-14 10 l14 10 l-14 10 l14 10 l-7 5\"/><path d=\"M87 35 l-7 5 l14 10 l-14 10 l14 10 l-14 10 l14 10 l-7 5\"/><path d=\"M134 35 l-7 5 l14 10 l-14 10 l14 10 l-14 10 l14 10 l-7 5\"/><path d=\"M181 35 l-7 5 l14 10 l-14 10 l14 10 l-14 10 l14 10 l-7 5\"/></g><text x=\"40\" y=\"115\" text-anchor=\"middle\" class=\"\">R₁</text><text x=\"87\" y=\"115\" text-anchor=\"middle\" class=\"\">R₂</text><text x=\"134\" y=\"115\" text-anchor=\"middle\" class=\"\">R₃</text><text x=\"181\" y=\"115\" text-anchor=\"middle\" class=\"\">R₄</text><text x=\"110\" y=\"22\" text-anchor=\"middle\" class=\"suave\">una a la vez</text></svg>",
    'lab2-2': "<svg class=\"mini-esq\" viewBox=\"0 0 220 130\" role=\"img\"><g class=\"trazo\"><path d=\"M26 65 H40\"/><path d=\"M40 65 l5 -7 l10 14 l10 -14 l10 14 l10 -14 l10 14 l5 -7\"/><path d=\"M100 65 H120\"/><path d=\"M120 65 l5 -7 l10 14 l10 -14 l10 14 l10 -14 l10 14 l5 -7\"/><path d=\"M180 65 H194\"/></g><circle cx=\"20\" cy=\"65\" r=\"6\" class=\"roja\"/><circle cx=\"200\" cy=\"65\" r=\"6\" class=\"negra\"/><text x=\"70\" y=\"45\" text-anchor=\"middle\" class=\"\">R₃ 1k</text><text x=\"150\" y=\"45\" text-anchor=\"middle\" class=\"\">R₄ 3,3k</text></svg>",
    'lab2-3': "<svg class=\"mini-esq\" viewBox=\"0 0 220 130\" role=\"img\"><g class=\"trazo\"><path d=\"M120 28 H180 V36\"/><path d=\"M120 28 V45\"/><path d=\"M120 45 l-7 5 l14 10 l-14 10 l14 10 l-14 10 l14 10 l-7 5\"/><path d=\"M180 36 l-7 5 l14 5 l-14 5 l14 5 l-14 5 l14 5 l-7 5\"/><path d=\"M180 71 V77\"/><path d=\"M180 77 l-7 5 l14 5 l-14 5 l14 5 l-14 5 l14 5 l-7 5\"/><path d=\"M120 105 V118 H180 V112\"/><path d=\"M26 118 H120\"/><path d=\"M26 28 H120\"/></g><circle cx=\"20\" cy=\"28\" r=\"6\" class=\"roja\"/><circle cx=\"20\" cy=\"118\" r=\"6\" class=\"negra\"/><text x=\"130\" y=\"78\" text-anchor=\"start\" class=\"\">R₂</text><text x=\"190\" y=\"56\" text-anchor=\"start\" class=\"\">R₃</text><text x=\"190\" y=\"98\" text-anchor=\"start\" class=\"\">R₄</text></svg>",
    'lab2-4': "<svg class=\"mini-esq\" viewBox=\"0 0 220 130\" role=\"img\"><g class=\"trazo\"><path d=\"M120 28 H180 V36\"/><path d=\"M120 28 V45\"/><path d=\"M120 45 l-7 5 l14 10 l-14 10 l14 10 l-14 10 l14 10 l-7 5\"/><path d=\"M180 36 l-7 5 l14 5 l-14 5 l14 5 l-14 5 l14 5 l-7 5\"/><path d=\"M180 71 V77\"/><path d=\"M180 77 l-7 5 l14 5 l-14 5 l14 5 l-14 5 l14 5 l-7 5\"/><path d=\"M120 105 V118 H180 V112\"/><path d=\"M26 118 H120\"/><path d=\"M26 28 H40\"/><path d=\"M40 28 l5 -7 l8 14 l8 -14 l8 14 l8 -14 l8 14 l5 -7\"/><path d=\"M90 28 H120\"/></g><circle cx=\"20\" cy=\"28\" r=\"6\" class=\"roja\"/><circle cx=\"20\" cy=\"118\" r=\"6\" class=\"negra\"/><text x=\"130\" y=\"78\" text-anchor=\"start\" class=\"\">R₂</text><text x=\"190\" y=\"56\" text-anchor=\"start\" class=\"\">R₃</text><text x=\"190\" y=\"98\" text-anchor=\"start\" class=\"\">R₄</text><text x=\"65\" y=\"14\" text-anchor=\"middle\" class=\"\">R₁</text></svg>",
    'lab2-5': "<svg class=\"mini-esq\" viewBox=\"0 0 220 130\" role=\"img\"><g class=\"trazo\"><path d=\"M120 28 H180 V36\"/><path d=\"M120 28 V45\"/><path d=\"M120 45 l-7 5 l14 10 l-14 10 l14 10 l-14 10 l14 10 l-7 5\"/><path d=\"M180 36 l-7 5 l14 5 l-14 5 l14 5 l-14 5 l14 5 l-7 5\"/><path d=\"M180 71 V77\"/><path d=\"M180 77 l-7 5 l14 5 l-14 5 l14 5 l-14 5 l14 5 l-7 5\"/><path d=\"M120 105 V118 H180 V112\"/><path d=\"M26 118 H120\"/><path d=\"M30 28 H40\"/><path d=\"M40 28 l5 -7 l8 14 l8 -14 l8 14 l8 -14 l8 14 l5 -7\"/><path d=\"M90 28 H120\"/></g><circle cx=\"120\" cy=\"38\" r=\"6\" class=\"roja\"/><circle cx=\"120\" cy=\"111\" r=\"6\" class=\"negra\"/><text x=\"130\" y=\"78\" text-anchor=\"start\" class=\"\">R₂</text><text x=\"190\" y=\"56\" text-anchor=\"start\" class=\"\">R₃</text><text x=\"190\" y=\"98\" text-anchor=\"start\" class=\"\">R₄</text><text x=\"65\" y=\"14\" text-anchor=\"middle\" class=\"\">R₁</text><text x=\"55\" y=\"72\" text-anchor=\"middle\" class=\"suave\">puntas</text><text x=\"55\" y=\"88\" text-anchor=\"middle\" class=\"suave\">en R₂</text></svg>",
    'lab2-6': "<svg class=\"mini-esq\" viewBox=\"0 0 220 130\" role=\"img\"><g class=\"trazo\"><path d=\"M120 28 H180 V36\"/><path d=\"M120 28 V45\"/><path d=\"M120 45 l-7 5 l14 10 l-14 10 l14 10 l-14 10 l14 10 l-7 5\"/><path d=\"M180 36 l-7 5 l14 5 l-14 5 l14 5 l-14 5 l14 5 l-7 5\"/><path d=\"M180 71 V77\"/><path d=\"M180 77 l-7 5 l14 5 l-14 5 l14 5 l-14 5 l14 5 l-7 5\"/><path d=\"M120 105 V118 H180 V112\"/><path d=\"M26 118 H120\"/><path d=\"M26 28 H40\"/><path d=\"M40 28 l5 -7 l8 14 l8 -14 l8 14 l8 -14 l8 14 l5 -7\"/><path d=\"M90 28 H120\"/></g><circle cx=\"20\" cy=\"28\" r=\"6\" class=\"roja\"/><circle cx=\"20\" cy=\"118\" r=\"6\" class=\"negra\"/><circle cx=\"62\" cy=\"74\" r=\"12\" class=\"alerta\"/><text x=\"62\" y=\"80\" text-anchor=\"middle\" class=\"alerta-txt\">!</text><text x=\"62\" y=\"102\" text-anchor=\"middle\" class=\"suave\">una está mal</text><text x=\"130\" y=\"78\" text-anchor=\"start\" class=\"\">R₂</text><text x=\"190\" y=\"56\" text-anchor=\"start\" class=\"\">R₃</text><text x=\"190\" y=\"98\" text-anchor=\"start\" class=\"\">R₄</text><text x=\"65\" y=\"14\" text-anchor=\"middle\" class=\"\">R₁</text></svg>"
  };

  // ---------- Práctica libre: 8 retos ----------
  const RETOS_LIBRE = [
    {
      titulo: 'Gira el selector a Ω',
      texto: 'El Fluke 75 mide varias cosas. Para medir resistencia, el selector va en Ω. Toca la posición Ω del selector (o toca la perilla hasta llegar ahí).',
      pista: 'La posición Ω está arriba, entre mV y ·))).',
      revisar: function (m) { return [selectorEnOhm(m)]; },
      exito: function () { return 'En Ω, el multímetro manda una corriente muy pequeña por sus puntas y mide el voltaje: así calcula la resistencia, R = V / I.'; }
    },
    {
      titulo: 'Conecta las puntas',
      texto: 'Las puntas se conectan con cables. Toca el borne COM del multímetro y luego un borne de cualquier resistencia. Haz lo mismo con el borne VΩ.',
      pista: 'COM es el borne negro. VΩ es el último a la derecha. Los bornes A y mA son solo para medir corriente.',
      revisar: puntas,
      exito: function () { return 'La punta negra siempre va en COM. La roja cambia según lo que mides: VΩ para voltaje y resistencia, A o mA para corriente.'; }
    },
    {
      titulo: 'Mide una resistencia sola',
      texto: 'Deja una resistencia en 1 kΩ y conecta las puntas a sus dos bornes (el de arriba y el de abajo), sin que esté unida a nada más. Luego escribe lo que marca la pantalla.',
      pista: 'Si la resistencia está unida a otras con cables, quítalos: medida en el circuito, el multímetro ve también a las demás.',
      pregunta: true,
      revisar: function (m) {
        const l = lecturaDe(m), lista = puntas(m);
        const id = midiendo(m) ? resistenciaEntre(l, ultimoResultado.red) : null;
        const sola = id && cercaDe(l.valor, valorReal(id), 0.002);
        if (sola) {
          lista.push({ ok: true, texto: 'Las puntas están en los extremos de ' + nombreResistencia(id) + ', y está sola' });
        } else if (id) {
          lista.push({ ok: false, error: true, texto: nombreResistencia(id) + ' está unida a otras resistencias: quita esos cables para medirla sola' });
        } else {
          lista.push({ ok: false, texto: 'Pon una punta en el borne de arriba y la otra en el de abajo de la misma resistencia' });
        }
        lista.push(sola && estado.valores[id] === 1000 ? { ok: true, texto: 'La resistencia está en 1 kΩ' }
                   : { ok: false, texto: 'Toca la perilla de la resistencia y elige 1 kΩ' });
        // Lo que escribió el estudiante, comparado con la pantalla (en kΩ)
        const r = pantalla(m);
        const factor = r.unidad === 'Ω' ? 0.001 : (r.unidad === 'MΩ' ? 1000 : 1);
        const enPantalla = Number(r.digitos) * factor;
        const escrito = Number(String(guiado.respuesta).replace(',', '.'));
        if (guiado.respuesta === '' || isNaN(escrito)) {
          lista.push({ ok: false, texto: 'Escribe en la casilla lo que marca la pantalla, en kΩ' });
        } else if (sola && Math.abs(escrito - enPantalla) < 0.0011) {
          lista.push({ ok: true, texto: 'Leíste bien la pantalla' });
        } else {
          lista.push({ ok: false, error: true, texto: 'Lo que escribiste no coincide con la pantalla: revisa los decimales y que esté en kΩ' });
        }
        return lista;
      },
      exito: textoTolerancia
    },
    {
      titulo: '¿Qué significa OL?',
      texto: 'Con el selector en Ω, pon cada punta en una resistencia distinta, sin unirlas entre sí. Así no hay un camino cerrado entre las puntas: es un circuito abierto.',
      pista: 'Por ejemplo: la punta roja arriba de R1 del banco 1 y la negra arriba de R2 del banco 2.',
      revisar: function (m) {
        const l = lecturaDe(m), lista = puntas(m);
        const conectado = tieneCable(m + '.V') && tieneCable(m + '.COM');
        lista.push(conectado && l.abierto ? { ok: true, texto: 'La pantalla marca OL' }
                   : { ok: false, texto: 'La pantalla todavía no marca OL: entre las puntas sigue habiendo un camino' });
        return lista;
      },
      exito: function () { return 'OL (overload) quiere decir que la resistencia es tan grande que no se puede medir: entre las puntas no hay un camino. ' +
                                  'Si en el laboratorio ves OL donde esperabas un valor, busca un cable suelto o un componente mal puesto.'; }
    },
    {
      titulo: 'Dos resistencias en serie',
      texto: 'Une dos resistencias con un cable, una detrás de la otra, y mide entre los dos extremos libres. Debe dar la suma: R = R₁ + R₂.',
      pista: 'Cable del borne de abajo de R1 al borne de arriba de R2. Luego, punta roja arriba de R1 y punta negra abajo de R2.',
      revisar: function (m) {
        const l = lecturaDe(m), lista = puntas(m);
        if (!midiendo(m)) {
          lista.push({ ok: false, texto: l.abierto ? 'Marca OL: revisa que el cable una las dos resistencias' : 'Mide entre los dos extremos libres de las resistencias' });
          return lista;
        }
        const par = parejas(l);
        if (par.serie) lista.push({ ok: true, texto: 'Las dos resistencias quedaron en serie: marca ' + textoLectura(m) });
        else if (par.paralelo) lista.push({ ok: false, error: true, texto: 'Quedaron en paralelo (las dos entre los mismos puntos). En serie, el cable va del final de una al comienzo de la otra' });
        else if (l.resistencias.length < 2) lista.push({ ok: false, texto: 'Entre las puntas solo hay una resistencia: une otra con un cable' });
        else lista.push({ ok: false, texto: 'El valor no es la suma de dos resistencias: revisa las conexiones' });
        return lista;
      },
      exito: function (m) {
        const par = parejas(lecturaDe(m)).serie;
        const suma = par ? formatoNominal(estado.valores[par[0]]) + ' + ' + formatoNominal(estado.valores[par[1]]) : 'R₁ + R₂';
        return 'En serie la corriente pasa por una y después por la otra, por eso se suman: ' + suma + '. Lo medido difiere un poco por la tolerancia.';
      }
    },
    {
      titulo: 'Dos resistencias en paralelo',
      texto: 'Ahora conecta dos resistencias entre los mismos dos puntos: arriba con arriba y abajo con abajo. Mide entre esos dos puntos.',
      pista: 'Un cable une los bornes de arriba de R1 y R2, y otro une los de abajo. La punta roja va arriba y la negra abajo.',
      revisar: function (m) {
        const l = lecturaDe(m), lista = puntas(m);
        if (!midiendo(m)) {
          lista.push({ ok: false, texto: l.abierto ? 'Marca OL: las puntas no están unidas por las resistencias' : 'Mide entre los dos puntos donde se unen las resistencias' });
          return lista;
        }
        const par = parejas(l);
        if (par.paralelo) lista.push({ ok: true, texto: 'Las dos resistencias quedaron en paralelo: marca ' + textoLectura(m) });
        else if (par.serie) lista.push({ ok: false, error: true, texto: 'Quedaron en serie. En paralelo se unen arriba con arriba y abajo con abajo' });
        else if (l.resistencias.length < 2) lista.push({ ok: false, texto: 'Entre las puntas solo hay una resistencia: conecta otra entre los mismos dos puntos' });
        else lista.push({ ok: false, texto: 'El valor no corresponde a dos resistencias en paralelo: revisa las conexiones' });
        return lista;
      },
      exito: function () { return 'En paralelo la corriente se reparte entre las dos, por eso la equivalente es menor que la más pequeña: ' +
                                  'R = R₁·R₂ / (R₁ + R₂). Con dos de 1 kΩ da 500 Ω.'; }
    },
    CIRCUITO_LAB2,
    {
      titulo: 'Encuentra los errores',
      texto: 'Toca “Preparar el circuito”: aparecerá el multímetro conectado a R1 y R2 en serie del banco 1, pero con dos errores. Corrígelos hasta que mida la serie.',
      pista: 'Revisa la posición del selector. Luego toca el cable rojo para elegirlo, quítalo y conéctalo en el borne correcto del multímetro.',
      preparar: { texto: 'Preparar el circuito', accion: prepararErrores },
      revisar: function (m) {
        const lista = [guiado.preparado ? { ok: true, texto: 'Circuito preparado' }
                                        : { ok: false, texto: 'Toca “Preparar el circuito” (se quitan los cables que tengas)' }];
        lista.push.apply(lista, puntas(m));
        const l = lecturaDe(m);
        lista.push(guiado.preparado && midiendo(m) && parejas(l).serie
                   ? { ok: true, texto: 'Mide la serie: ' + textoLectura(m) }
                   : { ok: false, texto: 'Todavía no mide la serie de R1 y R2' });
        return lista;
      },
      exito: function () { return 'Son dos errores comunes: el selector en la magnitud equivocada y la punta roja en el borne de corriente. ' +
                                  'Con la punta en A, el multímetro es casi un cortocircuito: con una fuente encendida quemaría el fusible.'; }
    }
  ];

  // "No marca exactamente 1 kΩ…" (se usa en dos retos)
  function textoTolerancia(m) {
    const l = lecturaDe(m), id = resistenciaEntre(l, ultimoResultado.red);
    const dif = id ? (l.valor - estado.valores[id]) / estado.valores[id] * 100 : 0;
    return 'No marca exactamente 1 kΩ: las resistencias reales tienen una tolerancia de ±5 %, así que una de 1 kΩ puede estar ' +
           'entre 950 y 1050 Ω. La tuya está ' + conComa(Math.abs(dif).toFixed(1)) + ' % ' + (dif >= 0 ? 'por encima' : 'por debajo') + '.';
  }

  // ---------- Lab 1: 6 circuitos de la Ley de Ohm ----------
  const CIRCUITOS_LAB1 = [
    {
      titulo: 'Una resistencia', nivel: 'Fácil', meta: '≈ 1 kΩ', mini: MINI['lab1-1'],
      texto: 'Es la resistencia del Lab 1. Déjala en 1 kΩ, conecta las puntas a sus dos bornes sin que esté unida a nada más y mira cuánto marca.',
      pista: 'La punta roja en el borne de arriba y la negra en el de abajo de la misma resistencia.',
      revisar: function (m) {
        const lista = puntas(m), id = medidaSola(m);
        const enCircuito = midiendo(m) && !id && resistenciaEntre(lecturaDe(m), ultimoResultado.red);
        if (id) lista.push({ ok: true, texto: 'Mides ' + nombreResistencia(id) + ' sola: ' + textoLectura(m) });
        else if (enCircuito) lista.push({ ok: false, error: true, texto: 'Esa resistencia está unida a otras: quita esos cables para medirla sola' });
        else lista.push({ ok: false, texto: 'Pon las puntas en los dos bornes de una sola resistencia', pista: 'La punta roja (VΩ) en el borne de arriba y la negra (COM) en el de abajo.' });
        lista.push(id && estado.valores[id] === 1000 ? { ok: true, texto: 'Está en 1 kΩ' }
                   : { ok: false, texto: 'Déjala en 1 kΩ', pista: 'Toca la perilla de esa resistencia y elige 1 kΩ.' });
        return lista;
      },
      exito: textoTolerancia
    },
    {
      titulo: 'Tres valores, tres rangos', nivel: 'Fácil', meta: 'Ω · kΩ', mini: MINI['lab1-2'],
      texto: 'Mide una resistencia de 100 Ω, una de 1 kΩ y una de 10 kΩ, una a la vez, y fíjate en la unidad y los decimales de la pantalla.',
      pista: 'Puedes usar la misma resistencia: mídela sola, cambia su valor con la perilla y vuelve a mirar la pantalla.',
      revisar: function (m) {
        const mem = memo(), id = medidaSola(m);
        mem.medidas = mem.medidas || {};
        if (id && [100, 1000, 10000].indexOf(estado.valores[id]) >= 0 && mem.medidas[estado.valores[id]] !== textoLectura(m)) {
          mem.medidas[estado.valores[id]] = textoLectura(m);
          guardarGuiado();
        }
        return [100, 1000, 10000].map(function (v) {
          return mem.medidas[v] ? { ok: true, texto: 'Mediste ' + formatoNominal(v) + ': marcó ' + mem.medidas[v] }
                                : { ok: false, texto: 'Mide una de ' + formatoNominal(v) + ' sola',
                                    pista: 'Toca la perilla de una resistencia, elige ' + formatoNominal(v) + ' y pon las puntas en sus dos bornes (selector en Ω).' };
        });
      },
      exito: function () { return 'Mira la pantalla: 100 Ω sale en Ω con un decimal, 1 kΩ en kΩ con tres decimales y 10 kΩ en kΩ con dos. ' +
                                  'El Fluke escoge solo el rango (AUTO) para mostrar cada valor con la mejor precisión.'; }
    },
    {
      titulo: 'Dos en serie', nivel: 'Medio', meta: '≈ 3,2 kΩ', mini: MINI['lab1-3'],
      texto: 'Une una de 1 kΩ y una de 2,2 kΩ en serie, una detrás de la otra, y comprueba que se suman.',
      pista: 'Cable del borne de abajo de la de 1 kΩ al borne de arriba de la de 2,2 kΩ. Punta roja arriba de la primera y negra abajo de la segunda.',
      revisar: function (m) {
        const lista = [valoresListos([1000, 2200], 'Hay una de 1 kΩ y una de 2,2 kΩ', 'Ajusta una resistencia en 2,2 kΩ (la otra queda en 1 kΩ)', 'Toca la perilla de R2 del banco 1 y elige 2,2 kΩ. La otra queda en 1 kΩ.')];
        lista.push.apply(lista, puntas(m));
        if (combinacion(m, [1000, 2200], serie)) lista.push({ ok: true, texto: 'Están en serie: marca ' + textoLectura(m) });
        else if (combinacion(m, [1000, 2200], paralelo)) lista.push({ ok: false, error: true, texto: 'Quedaron en paralelo. En serie, el cable va del final de una al comienzo de la otra' });
        else lista.push({ ok: false, texto: 'Únelas una detrás de la otra y mide entre los extremos libres',
                          pista: 'Cable del borne de abajo de la de 1 kΩ al de arriba de la de 2,2 kΩ; las puntas en los dos extremos que quedan libres.' });
        return lista;
      },
      exito: function () { return 'En serie la corriente pasa por una y después por la otra: R = 1 kΩ + 2,2 kΩ = 3,2 kΩ. Lo medido difiere un poco por la tolerancia de cada una.'; }
    },
    {
      titulo: 'Dos en paralelo', nivel: 'Medio', meta: '≈ 500 Ω', mini: MINI['lab1-4'],
      texto: 'Conecta dos de 1 kΩ entre los mismos dos puntos: arriba con arriba y abajo con abajo. La equivalente es menor que cada una.',
      pista: 'Un cable une los bornes de arriba y otro los de abajo. Las puntas van en esos dos puntos.',
      revisar: function (m) {
        const lista = puntas(m);
        if (combinacion(m, [1000, 1000], paralelo)) lista.push({ ok: true, texto: 'Están en paralelo: marca ' + textoLectura(m) });
        else if (combinacion(m, [1000, 1000], serie)) lista.push({ ok: false, error: true, texto: 'Quedaron en serie. En paralelo se unen arriba con arriba y abajo con abajo' });
        else lista.push({ ok: false, texto: 'Conecta dos de 1 kΩ entre los mismos dos puntos y mide ahí',
                          pista: 'Cable entre los bornes de arriba de las dos y otro entre los de abajo. Punta roja arriba y negra abajo.' });
        return lista;
      },
      exito: function () { return 'En paralelo la corriente se reparte: R = (1 kΩ · 1 kΩ) / (1 kΩ + 1 kΩ) = 500 Ω. Dos iguales en paralelo dan la mitad.'; }
    },
    {
      titulo: 'Serie y paralelo', nivel: 'Difícil', meta: '≈ 2,32 kΩ', mini: MINI['lab1-5'],
      texto: 'Arma 1 kΩ en serie con (2,2 kΩ ∥ 3,3 kΩ). Antes de medir, calcula en papel cuánto debería dar.',
      pista: 'Primero las de 2,2 kΩ y 3,3 kΩ en paralelo; después la de 1 kΩ en serie con ese grupo. 2,2 ∥ 3,3 = 1,32 kΩ; más 1 kΩ ≈ 2,32 kΩ.',
      revisar: function (m) {
        const lista = [valoresListos([1000, 2200, 3300], 'Hay una de 1 kΩ, una de 2,2 kΩ y una de 3,3 kΩ', 'Ajusta una resistencia en 2,2 kΩ y otra en 3,3 kΩ (la tercera queda en 1 kΩ)', 'Usa las perillas: una en 2,2 kΩ y otra en 3,3 kΩ. La tercera queda en 1 kΩ.')];
        // Paso: 2,2 kΩ y 3,3 kΩ en paralelo; después 1 kΩ en serie con ese grupo
        let grupo = null;
        conValor(2200).forEach(function (z) {
          conValor(3300).forEach(function (y) {
            const za = nodo(z, 'a'), zb = nodo(z, 'b'), ya = nodo(y, 'a'), yb = nodo(y, 'b');
            if (za !== zb && ((za === ya && zb === yb) || (za === yb && zb === ya))) grupo = [za, zb];
          });
        });
        lista.push(grupo ? { ok: true, texto: '2,2 kΩ y 3,3 kΩ en paralelo' }
                         : { ok: false, texto: 'Pon la de 2,2 kΩ y la de 3,3 kΩ en paralelo', pista: 'Un cable une sus bornes de arriba y otro los de abajo.' });
        const enSerie = grupo && conValor(1000).some(function (w) {
          const a = nodo(w, 'a'), b = nodo(w, 'b');
          return (grupo.indexOf(a) >= 0) !== (grupo.indexOf(b) >= 0);
        });
        lista.push(enSerie ? { ok: true, texto: '1 kΩ en serie con el grupo' }
                           : { ok: false, texto: 'Agrega la de 1 kΩ en serie con el grupo', pista: 'Une un borne de la de 1 kΩ con uno de los dos puntos del paralelo; su otro borne queda libre.' });
        lista.push.apply(lista, puntas(m));
        lista.push(combinacion(m, [1000, 2200, 3300], function (a, b, c) { return a + paralelo(b, c); })
          ? { ok: true, texto: 'Marca ' + textoLectura(m) + ': cerca de 2,32 kΩ' }
          : { ok: false, texto: 'Mide entre el borne libre de la de 1 kΩ y el otro punto del paralelo', pista: 'Punta roja en el borne libre de la de 1 kΩ; punta negra en el punto del paralelo que no toca la de 1 kΩ.' });
        return lista;
      },
      exito: function () { return '1 kΩ + (2,2 kΩ · 3,3 kΩ) / (5,5 kΩ) = 1 kΩ + 1,32 kΩ ≈ 2,32 kΩ. Primero se resuelve el paralelo y después se suma la serie.'; }
    },
    {
      titulo: 'Diseña 1,5 kΩ', nivel: 'Reto final', meta: '≈ 1,5 kΩ', mini: MINI['lab1-6'],
      texto: 'Solo con resistencias de 1 kΩ, arma un circuito que mida cerca de 1,5 kΩ. Nadie te dice cómo: piénsalo con lo que aprendiste de serie y paralelo.',
      pista: 'Dos de 1 kΩ en paralelo dan 500 Ω. ¿Qué le falta a 500 Ω para llegar a 1,5 kΩ?',
      revisar: function (m) {
        const lista = puntas(m), l = lecturaDe(m);
        const otras = midiendo(m) ? l.resistencias.filter(function (id) { return estado.valores[id] !== 1000; }) : [];
        if (otras.length) lista.push({ ok: false, error: true, texto: nombreResistencia(otras[0]) + ' está en ' + formatoNominal(estado.valores[otras[0]]) + ': usa solo resistencias de 1 kΩ' });
        else lista.push(midiendo(m) && l.resistencias.length >= 2 ? { ok: true, texto: 'Solo resistencias de 1 kΩ' }
                                                                  : { ok: false, texto: 'Arma tu circuito con varias de 1 kΩ y mide entre sus extremos' });
        lista.push(midiendo(m) && !otras.length && cercaDe(l.valor, 1500, 0.06)
                   ? { ok: true, texto: 'Marca ' + textoLectura(m) + ': cerca de 1,5 kΩ' }
                   : { ok: false, texto: midiendo(m) ? 'Marca ' + textoLectura(m) + ': todavía no da 1,5 kΩ' : 'Mide tu circuito', pista: 'Si marca 500 Ω, te falta 1 kΩ en serie. Si marca 2 kΩ, dos de ellas deberían ir en paralelo.' });
        return lista;
      },
      exito: function () { return 'Una solución: 1 kΩ en serie con dos de 1 kΩ en paralelo: 1 kΩ + 500 Ω = 1,5 kΩ. ' +
                                  'Así se consiguen valores que no vienen en una sola resistencia.'; }
    }
  ];

  // ---------- Lab 2: 6 circuitos para entender el circuito de Kirchhoff ----------
  const CIRCUITOS_LAB2 = [
    {
      titulo: 'Las 4 resistencias', nivel: 'Fácil', meta: '1k · 2,2k · 1k · 3,3k', mini: MINI['lab2-1'],
      texto: 'Antes de armar el circuito del Lab 2, mide cada resistencia sola: R₁ = 1 kΩ, R₂ = 2,2 kΩ, R₃ = 1 kΩ y R₄ = 3,3 kΩ. Usa una resistencia distinta para cada una.',
      pista: 'Ajusta cuatro resistencias con las perillas y mídelas una por una, con las puntas en sus dos bornes.',
      revisar: function (m) {
        const mem = memo(), id = medidaSola(m);
        mem.solas = mem.solas || {};
        if (id && (!mem.solas[id] || mem.solas[id].v !== estado.valores[id])) {
          mem.solas[id] = { v: estado.valores[id], r: valorReal(id) };
          guardarGuiado();
        }
        Object.keys(mem.solas).forEach(function (k) { if (mem.solas[k].v !== estado.valores[k]) delete mem.solas[k]; });
        const de = function (v) { return Object.keys(mem.solas).filter(function (k) { return mem.solas[k].v === v; }); };
        const unos = de(1000), dos = de(2200), tres = de(3300);
        const fila = function (lista, k, nombre, valor) {
          return lista[k] ? { ok: true, texto: nombre + ' (' + valor + ') medida: ' + enKilo(mem.solas[lista[k]].r) }
                          : { ok: false, texto: 'Mide ' + nombre + ' (' + valor + ') sola',
                              pista: 'Toca la perilla de una resistencia, elige ' + valor + ' y pon las puntas en sus dos bornes.' };
        };
        return [fila(unos, 0, 'R₁', '1 kΩ'), fila(dos, 0, 'R₂', '2,2 kΩ'), fila(unos, 1, 'R₃', '1 kΩ'), fila(tres, 0, 'R₄', '3,3 kΩ')];
      },
      exito: function () {
        const mem = memo(), de = function (v) { return Object.keys(mem.solas).filter(function (k) { return mem.solas[k].v === v; }); };
        const r = function (lista, k) { return enKilo(mem.solas[lista[k]].r); };
        return 'Estos son sus valores reales: R₁ = ' + r(de(1000), 0) + ', R₂ = ' + r(de(2200), 0) + ', R₃ = ' + r(de(1000), 1) +
               ' y R₄ = ' + r(de(3300), 0) + '. En el laboratorio, mide así tus resistencias y usa esos valores en la pre-verificación.';
      }
    },
    {
      titulo: 'La rama derecha', nivel: 'Fácil', meta: 'R₃ + R₄ ≈ 4,3 kΩ', mini: MINI['lab2-2'],
      texto: 'Arma R₃ + R₄ en serie: es la rama derecha del circuito del Lab 2.',
      pista: 'Cable del borne de abajo de R₃ (1 kΩ) al de arriba de R₄ (3,3 kΩ). Las puntas en los extremos que quedan libres.',
      revisar: function (m) {
        const lista = [valoresListos([1000, 3300], 'Hay una de 1 kΩ (R₃) y una de 3,3 kΩ (R₄)', 'Ajusta una resistencia en 3,3 kΩ (R₄); R₃ queda en 1 kΩ', 'Toca la perilla de R1 del banco 2 y elige 3,3 kΩ.')];
        lista.push.apply(lista, puntas(m));
        if (combinacion(m, [1000, 3300], serie)) lista.push({ ok: true, texto: 'R₃ + R₄ en serie: marca ' + textoLectura(m) });
        else if (combinacion(m, [1000, 3300], paralelo)) lista.push({ ok: false, error: true, texto: 'Quedaron en paralelo. En serie, el cable va del final de una al comienzo de la otra' });
        else lista.push({ ok: false, texto: 'Une R₃ y R₄ una detrás de la otra y mide entre los extremos libres',
                          pista: 'Cable del borne de abajo de la de 1 kΩ al de arriba de la de 3,3 kΩ.' });
        return lista;
      },
      exito: function () { return 'R₃ + R₄ = 1 kΩ + 3,3 kΩ = 4,3 kΩ. Por esta rama circula la corriente I₃ del Lab 2.'; }
    },
    {
      titulo: 'R₂ con la rama', nivel: 'Medio', meta: '≈ 1,46 kΩ', mini: MINI['lab2-3'],
      texto: 'Pon R₂ (2,2 kΩ) en paralelo con R₃ + R₄. Es lo que hay entre los nodos A y B del circuito del Lab 2.',
      pista: 'Primero arma R₃ + R₄ en serie. Luego conecta R₂ entre los dos extremos libres de esa serie y mide ahí.',
      revisar: function (m) {
        const p = progresoLab2(m);
        const lista = [{ ok: p.valores, texto: 'Valores: R₂ = 2,2 kΩ, R₃ = 1 kΩ y R₄ = 3,3 kΩ', pista: 'Ajusta una resistencia en 2,2 kΩ y otra en 3,3 kΩ.' },
                       { ok: p.nivel >= 2, texto: 'R₃ y R₄ en serie', pista: 'Une el borne de abajo de una de 1 kΩ con el de arriba de la de 3,3 kΩ; ahí no debe haber nada más.' },
                       { ok: p.nivel >= 3, texto: 'R₂ en paralelo con R₃ + R₄', pista: 'Conecta la de 2,2 kΩ entre los dos extremos libres de la serie (nodos A y B).' }];
        lista.push.apply(lista, puntas(m));
        lista.push(combinacion(m, [2200, 1000, 3300], function (z, x, y) { return paralelo(z, x + y); })
          ? { ok: true, texto: 'Marca ' + textoLectura(m) + ': cerca de 1,46 kΩ' }
          : { ok: false, texto: 'Mide entre los nodos A y B', pista: 'Punta roja arriba de R₂ (nodo A) y negra abajo (nodo B).' });
        return lista;
      },
      exito: function () { return 'R₂ ∥ (R₃ + R₄) = (2,2 kΩ · 4,3 kΩ) / 6,5 kΩ ≈ 1,46 kΩ. Es menor que R₂ sola: en paralelo la corriente tiene dos caminos.'; }
    },
    Object.assign({}, CIRCUITO_LAB2, {
      titulo: 'El circuito completo', nivel: 'Medio', meta: '≈ 2,46 kΩ', mini: MINI['lab2-4'],
      texto: 'Agrega R₁ en serie: así ve el circuito la fuente del Lab 2. Cada parte del esquema se pone verde cuando la armas bien.'
    }),
    {
      titulo: '¿Por qué R₂ no da 2,2 kΩ?', nivel: 'Difícil', meta: '≈ 1,46 kΩ', mini: MINI['lab2-5'],
      texto: 'Con el circuito del Lab 2 armado, mide R₂ sin desconectarla. ¿Por qué no marca 2,2 kΩ?',
      pista: 'Piensa en qué más está conectado entre los mismos dos puntos que R₂.',
      opciones: [['A', 'R₂ está dañada'], ['B', 'El Fluke mide R₂ en paralelo con R₃ + R₄'], ['C', 'Falta la fuente de 10 V']],
      revisar: function (m) {
        const mem = memo(), p = progresoLab2(m);
        const p1 = ultimoResultado.red[m + '.V'], q1 = ultimoResultado.red[m + '.COM'];
        const enR2 = p.nivel >= 4 && midiendo(m) && ((p1 === p.A && q1 === p.B) || (p1 === p.B && q1 === p.A)) &&
                     cercaDe(lecturaDe(m).valor, paralelo(valorReal(p.r2), valorReal(p.r3) + valorReal(p.r4)), 0.002);
        if (enR2 && mem.lectura !== textoLectura(m)) { mem.lectura = textoLectura(m); guardarGuiado(); }
        const sola = medidaSola(m);
        if (mem.respuesta === 'B' && sola && estado.valores[sola] === 2200 && !mem.sola) { mem.sola = textoLectura(m); guardarGuiado(); }
        const respuesta = mem.respuesta;
        return [
          { fijo: 'armado', ok: p.nivel >= 4, texto: 'El circuito del Lab 2 está armado', pista: 'Arma R₁ en serie con R₂ ∥ (R₃ + R₄), como en el circuito 4.' },
          { fijo: 'medido', ok: enR2, texto: mem.lectura ? 'Las puntas en los extremos de R₂: marca ' + mem.lectura : 'Pon las puntas en los dos bornes de R₂ sin desconectarla',
            pista: 'Punta roja arriba de R₂ (nodo A) y negra abajo (nodo B).' },
          !respuesta ? { ok: false, texto: (mem.lectura ? 'Marca ' + mem.lectura : 'Marca otro valor') + ', no 2,2 kΩ. ¿Por qué? Elige una respuesta abajo' }
            : respuesta === 'B' ? { ok: true, texto: '¡Exacto! El Fluke mide R₂ en paralelo con R₃ + R₄' }
            : { ok: false, error: true, texto: respuesta === 'A' ? 'No: R₂ está bien (compruébalo midiéndola sola). Fíjate qué más está conectado entre los mismos puntos'
                                                                 : 'No: el óhmetro no necesita la fuente, él mismo pone su corriente. Fíjate qué más está conectado entre sus puntas' },
          mem.sola ? { ok: true, texto: 'R₂ sola marca ' + mem.sola + ': ahora sí, cerca de 2,2 kΩ' }
                   : { ok: false, texto: 'Desconecta un extremo de R₂ y mídela sola para comprobarlo', pista: 'Quita el cable que une el borne de arriba de R₂ con el nodo A y deja las puntas solo en R₂.' }
        ];
      },
      exito: function () { return 'Medida dentro del circuito, el Fluke ve todo lo conectado entre sus puntas: R₂ ∥ (R₃ + R₄) ≈ 1,46 kΩ. ' +
                                  'Por eso, para medir una resistencia, hay que desconectarla al menos de un lado.'; }
    },
    {
      titulo: 'Encuentra la falla', nivel: 'Reto final', meta: '¿cuál está mal?', mini: MINI['lab2-6'],
      texto: 'Toca “Preparar el circuito”: el simulador arma el circuito del Lab 2 con R₁ = R1 del banco 1, R₂ = R2 del banco 1, R₃ = R3 del banco 1 y R₄ = R1 del banco 2. Una de ellas está mala aunque su perilla diga el valor correcto. Encuéntrala midiendo.',
      pista: 'Mide el circuito completo: no dará 2,46 kΩ. Después desconecta y mide cada resistencia sola hasta encontrar la que se sale de su ±5 %.',
      preparar: { texto: 'Preparar el circuito', accion: prepararFalla },
      opciones: [['R₁', 'R₁'], ['R₂', 'R₂'], ['R₃', 'R₃'], ['R₄', 'R₄']],
      revisar: function (m) {
        const mem = memo(), sola = medidaSola(m);
        if (mem.falla && sola === mem.falla.id && !mem.vista) { mem.vista = textoLectura(m); guardarGuiado(); }
        const respuesta = mem.respuesta;
        return [
          mem.falla ? { ok: true, texto: 'Circuito preparado' } : { ok: false, texto: 'Toca “Preparar el circuito” (se quitan los cables que tengas)' },
          mem.vista ? { ok: true, texto: 'Encontraste una que no cumple su valor: marca ' + mem.vista }
                    : { ok: false, texto: 'Mide las resistencias solas hasta encontrar la que no cumple su valor',
                        pista: 'Desconecta un extremo de cada resistencia y mídela sola. Compara con lo que dice su perilla.' },
          !respuesta ? { ok: false, texto: '¿Cuál está mala? Elige abajo' }
            : (mem.falla && respuesta === mem.falla.nombre) ? { ok: true, texto: 'Sí: la falla es ' + respuesta }
            : { ok: false, error: true, texto: 'No es ' + respuesta + ': mídela sola y compárala con su valor nominal' }
        ];
      },
      exito: function () {
        const f = memo().falla;
        return 'Era ' + f.nombre + ': su perilla dice ' + formatoNominal(f.v) + ', pero mide ' + memo().vista + '. En el laboratorio también pasa ' +
               '(una resistencia equivocada o dañada): medir por partes es la forma de encontrarla.';
      }
    }
  ];

  const LISTA = MODO === 'libre' ? RETOS_LIBRE : (labOrigen === '1' ? CIRCUITOS_LAB1 : CIRCUITOS_LAB2);
  const TOTAL = LISTA.length;

  // ---------- Dibujar la tarjeta y el mapa ----------
  function primeroSinHacer() {
    for (let i = 0; i < TOTAL; i++) if (guiado.hechos.indexOf(i) < 0) return i;
    return TOTAL;
  }
  function desbloqueado(i) { return guiado.hechos.indexOf(i) >= 0 || i <= primeroSinHacer(); }

  function mostrarPuntos() {
    let html = '';
    for (let i = 0; i < TOTAL; i++) {
      const hecho = guiado.hechos.indexOf(i) >= 0;
      const clase = i === guiado.actual ? 'ahora' : (hecho ? 'hecho' : '');
      html += '<button class="' + clase + '" data-reto="' + i + '"' + (desbloqueado(i) ? '' : ' disabled') +
              ' aria-label="' + PALABRA + ' ' + (i + 1) + '">' + (hecho && i !== guiado.actual ? '✓' : (i + 1)) + '</button>';
    }
    $('reto-puntos').innerHTML = html;
    if (MODO !== 'libre') mostrarMapa();
  }

  // Mapa "Tus 6 circuitos" (solo desde los labs)
  function mostrarMapa() {
    $('mapa-progreso').textContent = guiado.hechos.length + ' de ' + TOTAL + ' hechos · cada uno se desbloquea al terminar el anterior';
    $('mapa').innerHTML = LISTA.map(function (c, i) {
      const hecho = guiado.hechos.indexOf(i) >= 0;
      const estadoC = i === guiado.actual ? 'ahora' : (hecho ? 'hecho' : (desbloqueado(i) ? 'libre' : 'bloqueado'));
      const etiqueta = { ahora: 'Ahora', hecho: '✓ Hecho', libre: 'Disponible', bloqueado: 'Bloqueado' }[estadoC];
      let barras = '';
      for (let k = 0; k < TOTAL; k++) barras += '<i class="' + (k <= i ? 'lleno' : '') + '"></i>';
      return '<button class="circuito ' + estadoC + '" data-reto="' + i + '"' + (estadoC === 'bloqueado' ? ' disabled' : '') + '>' +
             '<span class="cab"><span>' + PALABRA + ' ' + (i + 1) + '</span><span class="estado ' + estadoC + '">' + etiqueta + '</span></span>' +
             c.mini + '<span class="nombre">' + c.titulo + '</span><span class="meta">' + c.meta + '</span>' +
             '<span class="dificultad">' + barras + '</span><span class="dificultad-txt">' + c.nivel + '</span></button>';
    }).join('');
  }

  // Recuadro para el esquema (se crea una vez, justo antes de la lista de pasos)
  function figura() {
    let caja = $('reto-figura');
    if (!caja) {
      caja = document.createElement('div');
      caja.id = 'reto-figura';
      caja.className = 'reto-figura';
      $('reto-check').parentNode.insertBefore(caja, $('reto-check'));
    }
    return caja;
  }

  // Se llama al cambiar de reto
  function mostrarReto() {
    $('reto-pista').hidden = true;
    $('btn-pista').textContent = 'Ver pista';
    $('reto-exito').hidden = true;
    mostrarPuntos();
    if (guiado.actual >= TOTAL) {
      const final = {
        libre: ['¡Completaste los 8 retos!', 'Ya sabes poner el Fluke 75 en Ω, conectar las puntas, leer la pantalla, reconocer un circuito abierto ' +
                'y medir resistencias en serie, en paralelo y en un circuito mixto. Puedes seguir practicando libremente en la mesa.'],
        lab1: ['¡Completaste los 6 circuitos del Lab 1!', 'Ya sabes medir una resistencia, leer los rangos del Fluke y calcular serie, paralelo y mixtos. ' +
               'Ahora sí: vuelve a la guía del Lab 1.'],
        lab2: ['¡Completaste los 6 circuitos del Lab 2!', 'Ya conoces el circuito del Lab 2 por partes, sabes por qué una resistencia no se mide dentro del circuito ' +
               'y cómo encontrar una falla midiendo. ¡Listo para el laboratorio!']
      }[MODO];
      $('reto-num').textContent = TOTAL + ' de ' + TOTAL + (MODO === 'libre' ? ' retos' : ' circuitos');
      $('reto-titulo').textContent = final[0];
      $('reto-texto').textContent = final[1];
      $('reto-check').innerHTML = '';
      $('reto-extra').innerHTML = '';
      figura().hidden = true;
      $('btn-pista').hidden = true;
      $('btn-siguiente').disabled = false;
      $('btn-siguiente').textContent = MODO === 'libre' ? 'Repetir los retos' : 'Repetir los circuitos';
      return;
    }
    const reto = LISTA[guiado.actual];
    $('reto-num').textContent = PALABRA + ' ' + (guiado.actual + 1) + ' de ' + TOTAL + (reto.nivel ? ' · ' + reto.nivel : '');
    $('reto-titulo').textContent = reto.titulo;
    $('reto-texto').textContent = reto.texto;
    const dibujo = reto.esquema || (reto.mini ? '<div class="esquema-grande">' + reto.mini + '</div>' : '');
    figura().innerHTML = dibujo;
    figura().hidden = !dibujo;
    $('reto-pista').innerHTML = '<strong>Pista:</strong> ' + reto.pista;
    $('btn-pista').hidden = false;
    $('btn-siguiente').textContent = guiado.actual === TOTAL - 1 ? 'Terminar →' : 'Siguiente ' + PALABRA.toLowerCase() + ' →';
    let extra = '';
    if (reto.pregunta) {
      extra += '<label class="campo reto-pregunta"><span>¿Cuánto marca la pantalla? (en kΩ)</span>' +
               '<input type="text" inputmode="decimal" id="reto-respuesta" placeholder="Ej: 0,987" autocomplete="off"></label>';
    }
    if (reto.preparar) extra += '<button class="boton claro" id="btn-preparar">' + reto.preparar.texto + '</button>';
    if (reto.opciones) {
      extra += '<div class="opciones-reto" role="group" aria-label="Respuestas">' + reto.opciones.map(function (o) {
        return '<button data-opcion="' + o[0] + '">' + (o[0] === o[1] ? o[1] : o[0] + '. ' + o[1]) + '</button>';
      }).join('') + '</div>';
    }
    $('reto-extra').innerHTML = extra;
    if (reto.pregunta) {
      const campo = $('reto-respuesta');
      campo.value = guiado.respuesta;
      campo.addEventListener('input', function () { guiado.respuesta = campo.value.trim(); guardarGuiado(); revisarGuiado(); });
    }
    if (reto.preparar) $('btn-preparar').addEventListener('click', reto.preparar.accion);
    if (reto.opciones) {
      $('reto-extra').querySelector('.opciones-reto').addEventListener('click', function (evento) {
        const boton = evento.target.closest('[data-opcion]');
        if (!boton) return;
        memo().respuesta = boton.dataset.opcion;
        guardarGuiado();
        revisarGuiado();
      });
    }
    revisarGuiado();
  }

  // Se llama después de cada cambio en la mesa: marca ✓ o ✗ y habilita "Siguiente"
  function revisarGuiado() {
    const m = medidor();
    $('reto-lectura-nombre').textContent = m + ' · Fluke 75 en ' +
      POSICIONES.filter(function (x) { return x.id === estado.multimetros[m].modo; })[0].texto;
    $('reto-lectura').textContent = estado.multimetros[m].modo === 'off' ? 'apagado' : textoLectura(m);
    if (guiado.actual >= TOTAL) return;
    const reto = LISTA[guiado.actual];
    const lista = reto.revisar(m);
    // Pasos "fijos": una vez logrados, quedan logrados
    const mem = memo();
    lista.forEach(function (c) {
      if (!c.fijo) return;
      mem.hitos = mem.hitos || {};
      if (c.ok && !mem.hitos[c.fijo]) { mem.hitos[c.fijo] = true; guardarGuiado(); }
      if (mem.hitos[c.fijo]) c.ok = true;
    });
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
    // Respuesta elegida, resaltada
    const opciones = $('reto-extra').querySelectorAll('[data-opcion]');
    opciones.forEach(function (b) { b.classList.toggle('elegida', b.dataset.opcion === mem.respuesta); });
    const cumplido = lista.every(function (c) { return c.ok; });
    if (cumplido && guiado.hechos.indexOf(guiado.actual) < 0) {
      guiado.hechos.push(guiado.actual);
      guardarGuiado();
      mostrarPuntos();
    }
    const hecho = guiado.hechos.indexOf(guiado.actual) >= 0;
    if (cumplido) {
      $('reto-exito').innerHTML = '<strong>¡Lo lograste!</strong> ' + reto.exito(m);
      $('reto-exito').hidden = false;
    } else {
      $('reto-exito').hidden = true;
    }
    $('btn-siguiente').disabled = !hecho;
  }

  // Deja la mesa limpia, con un solo multímetro en el modo indicado
  function mesaNueva(modo) {
    delete estado.multimetros.M2;
    estado.multimetros.M1 = nuevoMultimetro();
    estado.multimetros.M1.modo = modo;
    cableElegido = null;
    bornePendiente = null;
  }

  // Práctica libre, reto 8: el multímetro con dos errores
  function prepararErrores() {
    mesaNueva('vdc');
    estado.valores['B1.R1'] = 1000;
    estado.valores['B1.R2'] = 1000;
    estado.cables = [
      { a: 'M1.A', b: 'B1.R1.a', color: 'rojo' },
      { a: 'B1.R1.b', b: 'B1.R2.a', color: 'amarillo' },
      { a: 'B1.R2.b', b: 'M1.COM', color: 'negro' }
    ];
    guiado.preparado = true;
    guardarGuiado();
    mensaje('Circuito preparado: tiene dos errores. ¡Encuéntralos!');
    actualizar();
  }

  // Lab 2, circuito 6: el circuito del Lab 2 con una resistencia mala (su perilla dice el valor correcto)
  function prepararFalla() {
    const mem = memo();
    devolverFalla();
    mesaNueva('ohm');
    const papeles = [['R₁', 'B1.R1', 1000], ['R₂', 'B1.R2', 2200], ['R₃', 'B1.R3', 1000], ['R₄', 'B2.R1', 3300]];
    papeles.forEach(function (p) { estado.valores[p[1]] = p[2]; });
    estado.cables = [
      { a: 'M1.V', b: 'B1.R1.a', color: 'rojo' },
      { a: 'B1.R1.b', b: 'B1.R2.a', color: 'amarillo' },
      { a: 'B1.R1.b', b: 'B1.R3.a', color: 'azul' },
      { a: 'B1.R3.b', b: 'B2.R1.a', color: 'verde' },
      { a: 'B1.R2.b', b: 'B2.R1.b', color: 'blanco' },
      { a: 'B2.R1.b', b: 'M1.COM', color: 'negro' }
    ];
    const elegida = papeles[Math.floor(Math.random() * papeles.length)];
    const factor = Math.random() < 0.5 ? 0.47 : 1.5;   // muy fuera del ±5 %
    mem.falla = { nombre: elegida[0], id: elegida[1], v: elegida[2], original: estado.factores[elegida[1]] };
    estado.factores[elegida[1]] = factor;
    mem.vista = null;
    mem.respuesta = null;
    guardarGuiado();
    mensaje('Circuito preparado: una resistencia está mala. ¡Encuéntrala!');
    actualizar();
  }
  // Al salir del circuito 6, la resistencia mala vuelve a la normalidad
  function devolverFalla() {
    Object.keys(guiado.memo).forEach(function (k) {
      const f = guiado.memo[k].falla;
      if (f && f.original && estado.factores[f.id] !== f.original) estado.factores[f.id] = f.original;
    });
  }

  function esFalla(i) { return !!(LISTA[i] && LISTA[i].preparar && LISTA[i].preparar.accion === prepararFalla); }

  // ---------- Botones de la tarjeta y del mapa ----------
  function irA(i) {
    if (esFalla(guiado.actual)) { devolverFalla(); actualizarMesa(); }
    guiado.actual = i;
    guardarGuiado();
    mostrarReto();
  }
  $('btn-pista').addEventListener('click', function () {
    const pista = $('reto-pista');
    pista.hidden = !pista.hidden;
    this.textContent = pista.hidden ? 'Ver pista' : 'Ocultar pista';
  });
  $('btn-siguiente').addEventListener('click', function () {
    if (guiado.actual >= TOTAL) {
      guiado = progresoInicial();   // "Repetir"
      guardarGuiado();
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
  if ($('mapa')) $('mapa').addEventListener('click', elegirDesde);

  // ---------- Cada vez que la mesa cambia, también se revisa el reto ----------
  const actualizarMesa = actualizar;
  actualizar = function () {
    actualizarMesa();
    revisarGuiado();
  };

  // Atajo para revisar: simulador.html?reto=7 (o ?lab=2&reto=5) abre directo en ese reto
  // (sirve para mostrarlo sin hacer los anteriores; marca los anteriores como hechos)
  const retoPedido = Number(parametros.get('reto'));
  if (retoPedido >= 1 && retoPedido <= TOTAL) {
    guiado.actual = retoPedido - 1;
    for (let i = 0; i < guiado.actual; i++) if (guiado.hechos.indexOf(i) < 0) guiado.hechos.push(i);
    guardarGuiado();
  }

  if (guiado.actual > TOTAL) guiado.actual = 0;
  // Si quedó una resistencia mala de una sesión anterior y no se está en ese circuito, se arregla
  if (!esFalla(guiado.actual)) { devolverFalla(); actualizarMesa(); }
  mostrarReto();
})();