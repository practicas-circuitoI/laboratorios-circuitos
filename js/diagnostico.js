// ===================================================
// Diagnóstico de fallas
// Cuando una medición sale en rojo, sugiere la causa más probable
// según cómo es el error. Sirve para todos los laboratorios.
// ===================================================

// Saca el primer número de un texto, por ejemplo "teórico: 2,69" → 2.69
function numeroEnTexto(texto) {
  const encontrado = texto.match(/-?\d+(?:[.,]\d+)?/);
  return encontrado ? Number(encontrado[0].replace(',', '.')) : NaN;
}

// Elige la explicación según la relación entre lo medido y lo teórico
function diagnosticar(medida, teorica, unidad) {
  const esCorriente = unidad === 'mA';
  const relacion = medida / teorica;

  if (medida < 0) {
    return esCorriente
      ? 'La lectura es negativa: el amperímetro está al revés. La corriente debe entrar por la punta roja, la del lado del positivo de la fuente.'
      : 'La lectura es negativa: las puntas del voltímetro están invertidas. La roja va al lado de mayor potencial.';
  }
  if (relacion > 500 && relacion < 2000) {
    return 'El valor es unas 1000 veces mayor que el esperado: parece que lo escribiste en otra unidad. Escríbelo en ' + unidad + '.';
  }
  if (relacion > 0.0005 && relacion < 0.002) {
    return 'El valor es unas 1000 veces menor que el esperado: parece que lo escribiste en otra unidad. Escríbelo en ' + unidad + '.';
  }
  if (relacion < 0.05) {
    return esCorriente
      ? 'La lectura es casi cero: el circuito está abierto (un cable suelto o un componente mal puesto en la protoboard), la salida de la fuente está apagada o el fusible del amperímetro está quemado.'
      : 'La lectura es casi cero: las puntas no tocan el elemento correcto, el elemento está en corto o la fuente está apagada.';
  }
  if (relacion > 1) {
    return esCorriente
      ? 'La corriente es mayor que la esperada: revisa que el resistor sea el correcto (código de colores), que no haya un corto entre filas de la protoboard y que la fuente esté en el voltaje indicado.'
      : 'El voltaje es mayor que el esperado: puede que hayas medido sobre otro elemento o sobre dos resistores juntos. Revisa dónde pusiste las puntas y el valor de los resistores.';
  }
  return esCorriente
    ? 'La corriente es menor que la esperada: revisa el valor del resistor, que los cables hagan buen contacto en la protoboard y que la fuente entregue el voltaje indicado (mídelo con el voltímetro).'
    : 'El voltaje es menor que el esperado: revisa que las puntas toquen bien los extremos del resistor, el valor de los resistores y el voltaje real de la fuente.';
}

// Revisa las filas en rojo y escribe una sugerencia por cada una
function actualizarDiagnostico() {
  const lista = document.getElementById('diagnostico');
  if (!lista) return;
  let html = '';
  document.querySelectorAll('.tabla-mediciones tr.alerta').forEach(function (fila) {
    const campo = fila.querySelector('.medida');
    const celdaTeorica = fila.querySelector('.teorica, .teo');
    if (!campo || !celdaTeorica) return;

    const medida = Number(campo.value.trim().replace(',', '.'));
    const teorica = numeroEnTexto(celdaTeorica.textContent);
    if (isNaN(medida) || isNaN(teorica) || teorica === 0) return;

    // En el Lab 1 la fila se identifica por el voltaje; en el Lab 2, por la magnitud
    let nombre;
    let unidad;
    const mag = campo.dataset.mag;
    if (mag) {
      // "I1" → I<sub>1</sub>   ·   "VR1" → V<sub>R1</sub>
      nombre = mag.charAt(0) + '<sub>' + mag.slice(1) + '</sub>';
      unidad = mag.charAt(0) === 'I' ? 'mA' : 'V';
    } else {
      nombre = 'Con ' + campo.dataset.v + '&nbsp;V';
      unidad = 'mA';
    }
    html += '<li><strong>' + nombre + ':</strong> ' + diagnosticar(medida, teorica, unidad) + '</li>';
  });
  lista.innerHTML = html;
}

// Se actualiza después de cada cambio o clic (cuando la página ya revisó las filas)
document.addEventListener('change', function () { setTimeout(actualizarDiagnostico, 0); });
document.addEventListener('click', function (evento) {
  if (evento.target.closest('button')) setTimeout(actualizarDiagnostico, 50);
});

// Al abrir la página
actualizarDiagnostico();