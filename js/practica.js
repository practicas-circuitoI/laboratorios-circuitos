// ===================================================
// Banner "¡Hey! Practica acá" de los Labs 1 y 2
// Marca los circuitos del simulador que el estudiante ya hizo en este
// dispositivo y cambia el texto del botón según su avance.
// ===================================================
(function () {
  const caja = document.querySelector('.practica-niveles');
  if (!caja) return;
  const clave = caja.dataset.clave;
  const boton = document.querySelector('.practica-boton');

  function pintar() {
    let hechos = [];
    try {
      const guardado = JSON.parse(localStorage.getItem(clave));
      if (guardado && Array.isArray(guardado.hechos)) hechos = guardado.hechos;
    } catch (error) {}
    caja.querySelectorAll('span').forEach(function (punto, i) {
      const hecho = hechos.indexOf(i) >= 0;
      punto.classList.toggle('hecho', hecho);
      punto.textContent = hecho ? '✓' : String(i + 1);
    });
    caja.querySelector('small').textContent = hechos.length + ' de 6 hechos';
    if (boton) boton.textContent = hechos.length === 0 ? 'Practicar ahora ↗' : (hechos.length >= 6 ? 'Repasar ↗' : 'Seguir practicando ↗');
  }

  pintar();
  // Si el simulador está abierto en otra pestaña, los puntos se actualizan solos
  window.addEventListener('storage', function (evento) { if (evento.key === clave) pintar(); });
})();