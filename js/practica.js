// ===================================================
// Banner "¡Hey! Practica acá" de los Labs 1, 2 y 4
// Marca los retos del simulador que el estudiante ya hizo en este
// dispositivo y cambia el texto del botón según su avance.
// El total sale de cuántos puntos tiene el banner (6 en los Labs 1 y 2, 7 en el Lab 4).
// ===================================================
(function () {
  const caja = document.querySelector('.practica-niveles');
  if (!caja) return;
  const clave = caja.dataset.clave;
  const boton = document.querySelector('.practica-boton');
  const total = caja.querySelectorAll('span').length;

  function pintar() {
    let hechos = [];
    try {
      const guardado = JSON.parse(localStorage.getItem(clave));
      if (guardado && Array.isArray(guardado.hechos)) hechos = guardado.hechos;
    } catch (error) {}
    // El Lab 4 antes tenía 6 retos: si el avance es de esa versión, se corre un puesto (el simulador hace lo mismo)
    if (clave === 'simulador-circuitos-lab4' && hechos.length) {
      try {
        if (JSON.parse(localStorage.getItem(clave)).v !== 2) hechos = hechos.map(function (i) { return i + 1; });
      } catch (error) {}
    }
    hechos = hechos.filter(function (i) { return i < total; });
    caja.querySelectorAll('span').forEach(function (punto, i) {
      const hecho = hechos.indexOf(i) >= 0;
      punto.classList.toggle('hecho', hecho);
      punto.textContent = hecho ? '✓' : String(i + 1);
    });
    caja.querySelector('small').textContent = hechos.length + ' de ' + total + ' hechos';
    if (boton) boton.textContent = hechos.length === 0 ? 'Practicar ahora ↗' : (hechos.length >= total ? 'Repasar ↗' : 'Seguir practicando ↗');
  }

  pintar();
  // Si el simulador está abierto en otra pestaña, los puntos se actualizan solos
  window.addEventListener('storage', function (evento) { if (evento.key === clave) pintar(); });
})();
