// ===================================================
// Retos guiados de la práctica libre
// Solo actúan cuando el simulador se abre desde la portada (sin ?lab=).
// Usa lo que ya calcula js/simulador.js (estado, ultimoResultado, pantalla…)
// y revisa el reto actual cada vez que algo cambia en la mesa.
// ===================================================
(function () {
  if (desdeLab) return;   // desde los Labs 1 y 2 el simulador queda igual que siempre

  const CLAVE_GUIADO = 'simulador-retos-guiados';
  const ICONO = '<svg class="icono" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="3"/>' +
                '<rect x="8" y="5" width="8" height="4" rx="1"/><circle cx="12" cy="15.5" r="3"/></svg>';

  // ---------- Aspecto de la práctica libre: amarillo y negro, como el Fluke ----------
  document.body.classList.remove('lab-ohm');
  document.body.classList.add('lab-libre');
  document.getElementById('simbolo').innerHTML = ICONO;
  document.querySelector('.encabezado-lab p').textContent = 'Práctica libre: 8 retos para aprender a medir con el Fluke 75.';
  document.title = 'Práctica libre · Simulador de conexiones';
  document.getElementById('reto-guiado').hidden = false;
  document.getElementById('seccion-ejercicios').hidden = true;

  // ---------- Progreso guardado en el dispositivo ----------
  function progresoInicial() { return { actual: 0, hechos: [], respuesta: '', preparado: false }; }
  let guiado;
  try { guiado = JSON.parse(localStorage.getItem(CLAVE_GUIADO)); } catch (error) { guiado = null; }
  if (!guiado || !Array.isArray(guiado.hechos)) guiado = progresoInicial();
  function guardarGuiado() {
    try { localStorage.setItem(CLAVE_GUIADO, JSON.stringify(guiado)); } catch (error) {}
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
    return r.digitos === 'OL' ? 'OL' : conComa(r.digitos) + ' ' + r.unidad;
  }
  function cercaDe(valor, objetivo, margen) { return Math.abs(valor - objetivo) / objetivo < margen; }

  // Busca dos resistencias que, juntas, den lo que marca el óhmetro
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

  // Revisiones que se repiten en varios retos: { ok, texto, error, pista }
  //   error: true  → algo está mal conectado (sale en rojo)
  //   pista        → ayuda extra que aparece cuando ese es el paso que sigue
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

  // ---------- Reto 7: esquema del circuito del Lab 2 ----------
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
      const parte = document.getElementById(id);
      if (!parte) return;
      parte.classList.toggle('listo', nivel >= partes[id]);
      parte.classList.toggle('siguiente', nivel >= 1 && partes[id] === nivel + 1);
    });
  }

  // Revisa hasta dónde va armado el circuito del Lab 2 (nivel 0 a 5), sin importar qué bancos se usen
  function progresoLab2(m) {
    const red = ultimoResultado.red;
    const conValor = function (v) { return IDS_RES.filter(function (id) { return estado.valores[id] === v; }); };
    const de1k = conValor(1000), de22 = conValor(2200), de33 = conValor(3300);
    const valores = de1k.length >= 2 && de22.length >= 1 && de33.length >= 1;
    const nodo = function (id, lado) { return red[id + '.' + lado]; };
    const otro = function (lado) { return lado === 'a' ? 'b' : 'a'; };
    const cuantos = function (n) { return todosLosBornes().filter(function (b) { return red[b] === n; }).length; };
    let nivel = valores ? 1 : 0;
    if (!valores) return { nivel: 0, valores: false };
    de1k.forEach(function (x) {
      de33.forEach(function (y) {
        ['a', 'b'].forEach(function (lx) {
          ['a', 'b'].forEach(function (ly) {
            // Paso 2: R3 y R4 comparten un punto donde no hay nada más
            const union = nodo(x, lx);
            if (union !== nodo(y, ly) || cuantos(union) !== 2) return;
            const e1 = nodo(x, otro(lx)), e2 = nodo(y, otro(ly));
            if (e1 === e2) return;
            nivel = Math.max(nivel, 2);
            de22.forEach(function (z) {
              // Paso 3: R2 entre los dos extremos de la serie
              const za = nodo(z, 'a'), zb = nodo(z, 'b');
              if (!((za === e1 && zb === e2) || (za === e2 && zb === e1))) return;
              nivel = Math.max(nivel, 3);
              de1k.forEach(function (w) {
                if (w === x) return;
                ['a', 'b'].forEach(function (lw) {
                  // Paso 4: otra de 1 kΩ con un borne en el nodo A
                  const A = nodo(w, lw), libre = nodo(w, otro(lw));
                  if (A !== e1 && A !== e2) return;
                  const B = A === e1 ? e2 : e1;
                  if (libre === A || libre === B) return;
                  nivel = Math.max(nivel, 4);
                  // Paso 5: el Fluke mide entre el borne libre de R1 y el nodo B, y da lo esperado
                  const p = red[m + '.V'], q = red[m + '.COM'];
                  const puntasBien = (p === libre && q === B) || (p === B && q === libre);
                  const r3 = valorReal(x), r4 = valorReal(y), r2 = valorReal(z);
                  const esperado = valorReal(w) + r2 * (r3 + r4) / (r2 + r3 + r4);
                  if (puntasBien && midiendo(m) && cercaDe(lecturaDe(m).valor, esperado, 0.002)) nivel = 5;
                });
              });
            });
          });
        });
      });
    });
    return { nivel: nivel, valores: true };
  }

  // ---------- Los 8 retos ----------
  const RETOS_GUIADOS = [
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
      exito: function (m) {
        const l = lecturaDe(m), id = resistenciaEntre(l, ultimoResultado.red);
        const dif = id ? (l.valor - estado.valores[id]) / estado.valores[id] * 100 : 0;
        return 'No marca exactamente 1 kΩ: las resistencias reales tienen una tolerancia de ±5 %, así que una de 1 kΩ puede estar ' +
               'entre 950 y 1050 Ω. La tuya está ' + conComa(Math.abs(dif).toFixed(1)) + ' % ' + (dif >= 0 ? 'por encima' : 'por debajo') + '.';
      }
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
    {
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
    },
    {
      titulo: 'Encuentra los errores',
      texto: 'Toca “Preparar el circuito”: aparecerá el multímetro conectado a R1 y R2 en serie del banco 1, pero con dos errores. Corrígelos hasta que mida la serie.',
      pista: 'Revisa la posición del selector. Luego toca el cable rojo para elegirlo, quítalo y conéctalo en el borne correcto del multímetro.',
      preparar: true,
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
  const TOTAL = RETOS_GUIADOS.length;

  // ---------- Dibujar la tarjeta del reto ----------
  const $ = function (id) { return document.getElementById(id); };
  function primeroSinHacer() {
    for (let i = 0; i < TOTAL; i++) if (guiado.hechos.indexOf(i) < 0) return i;
    return TOTAL;
  }

  function mostrarPuntos() {
    const limite = primeroSinHacer();
    let html = '';
    for (let i = 0; i < TOTAL; i++) {
      const hecho = guiado.hechos.indexOf(i) >= 0;
      const clase = i === guiado.actual ? 'ahora' : (hecho ? 'hecho' : '');
      html += '<button class="' + clase + '" data-reto="' + i + '"' + (i > limite && !hecho ? ' disabled' : '') +
              ' aria-label="Reto ' + (i + 1) + '">' + (hecho && i !== guiado.actual ? '✓' : (i + 1)) + '</button>';
    }
    $('reto-puntos').innerHTML = html;
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
      $('reto-num').textContent = '8 de 8 retos';
      $('reto-titulo').textContent = '¡Completaste los 8 retos!';
      $('reto-texto').textContent = 'Ya sabes poner el Fluke 75 en Ω, conectar las puntas, leer la pantalla, reconocer un circuito abierto ' +
        'y medir resistencias en serie, en paralelo y en un circuito mixto. Puedes seguir practicando libremente en la mesa.';
      $('reto-check').innerHTML = '';
      $('reto-extra').innerHTML = '';
      figura().hidden = true;
      $('btn-pista').hidden = true;
      $('btn-siguiente').disabled = false;
      $('btn-siguiente').textContent = 'Repetir los retos';
      return;
    }
    const reto = RETOS_GUIADOS[guiado.actual];
    $('reto-num').textContent = 'Reto ' + (guiado.actual + 1) + ' de ' + TOTAL;
    $('reto-titulo').textContent = reto.titulo;
    $('reto-texto').textContent = reto.texto;
    figura().innerHTML = reto.esquema || '';
    figura().hidden = !reto.esquema;
    $('reto-pista').innerHTML = '<strong>Pista:</strong> ' + reto.pista;
    $('btn-pista').hidden = false;
    $('btn-siguiente').textContent = guiado.actual === TOTAL - 1 ? 'Terminar →' : 'Siguiente reto →';
    let extra = '';
    if (reto.pregunta) {
      extra = '<label class="campo reto-pregunta"><span>¿Cuánto marca la pantalla? (en kΩ)</span>' +
              '<input type="text" inputmode="decimal" id="reto-respuesta" placeholder="Ej: 0,987" autocomplete="off"></label>';
    }
    if (reto.preparar) extra = '<button class="boton claro" id="btn-preparar">Preparar el circuito</button>';
    $('reto-extra').innerHTML = extra;
    if (reto.pregunta) {
      const campo = $('reto-respuesta');
      campo.value = guiado.respuesta;
      campo.addEventListener('input', function () { guiado.respuesta = campo.value.trim(); guardarGuiado(); revisarGuiado(); });
    }
    if (reto.preparar) $('btn-preparar').addEventListener('click', prepararErrores);
    revisarGuiado();
  }

  // Se llama después de cada cambio en la mesa: marca ✓ o ✗ y habilita "Siguiente"
  function revisarGuiado() {
    const m = medidor();
    $('reto-lectura-nombre').textContent = m + ' · Fluke 75 en ' +
      POSICIONES.filter(function (x) { return x.id === estado.multimetros[m].modo; })[0].texto;
    $('reto-lectura').textContent = estado.multimetros[m].modo === 'off' ? 'apagado' : textoLectura(m);
    if (guiado.actual >= TOTAL) return;
    const reto = RETOS_GUIADOS[guiado.actual];
    const lista = reto.revisar(m);
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

  // Reto 8: deja la mesa con dos errores para que el estudiante los corrija
  function prepararErrores() {
    delete estado.multimetros.M2;
    estado.multimetros.M1 = nuevoMultimetro();
    estado.multimetros.M1.modo = 'vdc';
    estado.valores['B1.R1'] = 1000;
    estado.valores['B1.R2'] = 1000;
    estado.cables = [
      { a: 'M1.A', b: 'B1.R1.a', color: 'rojo' },
      { a: 'B1.R1.b', b: 'B1.R2.a', color: 'amarillo' },
      { a: 'B1.R2.b', b: 'M1.COM', color: 'negro' }
    ];
    cableElegido = null;
    bornePendiente = null;
    guiado.preparado = true;
    guardarGuiado();
    mensaje('Circuito preparado: tiene dos errores. ¡Encuéntralos!');
    actualizar();
  }

  // ---------- Botones de la tarjeta ----------
  $('btn-pista').addEventListener('click', function () {
    const pista = $('reto-pista');
    pista.hidden = !pista.hidden;
    this.textContent = pista.hidden ? 'Ver pista' : 'Ocultar pista';
  });
  $('btn-siguiente').addEventListener('click', function () {
    if (guiado.actual >= TOTAL) {
      guiado = progresoInicial();   // "Repetir los retos"
    } else {
      guiado.actual += 1;
    }
    guardarGuiado();
    mostrarReto();
    $('reto-guiado').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('reto-puntos').addEventListener('click', function (evento) {
    const boton = evento.target.closest('[data-reto]');
    if (!boton || boton.disabled) return;
    guiado.actual = Number(boton.dataset.reto);
    guardarGuiado();
    mostrarReto();
  });

  // ---------- Cada vez que la mesa cambia, también se revisa el reto ----------
  const actualizarMesa = actualizar;
  actualizar = function () {
    actualizarMesa();
    revisarGuiado();
  };

  if (guiado.actual > TOTAL) guiado.actual = 0;
  mostrarReto();
})();