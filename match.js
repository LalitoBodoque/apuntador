// Lógica de seguimiento: compara lo que se oye contra el texto y dice hasta dónde vas.
// Funciona en el navegador (window.Apuntador) y en Node (module.exports) para pruebas.
(function (root) {
  'use strict';

  // Normaliza una palabra: minúsculas, sin acentos, sin signos
  function norm(s) {
    return String(s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  // Distancia de edición (cuántas letras hay que cambiar)
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 3;
    let prev = [];
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(
          prev[j] + 1,
          cur[j - 1] + 1,
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      prev = cur;
    }
    return prev[b.length];
  }

  // ¿Dos palabras normalizadas se parecen lo suficiente?
  function similar(a, b) {
    if (a === b) return true;
    const short = Math.min(a.length, b.length);
    const long = Math.max(a.length, b.length);
    if (short >= 4 && (a.startsWith(b) || b.startsWith(a)) && short / long >= 0.6) return true;
    if (short >= 5) return lev(a, b) <= (short >= 8 ? 2 : 1);
    return false;
  }

  // Revisa si la palabra siguiente que se oyó aparece justo después de j
  function confirmAhead(tokens, j, next) {
    let seen = 0;
    for (let k = j + 1; k < tokens.length && seen < 3; k++) {
      if (!tokens[k].n) continue;
      seen++;
      if (similar(tokens[k].n, next)) return true;
    }
    return false;
  }

  // Busca 3 palabras seguidas en el texto (para cuando te saltas un pedazo)
  function findSeq(tokens, tail, from, maxReal) {
    const largas = tail.filter(w => w.length >= 4).length;
    if (tail.length < 3 || largas < 2) return -1;
    const idx = [];
    for (let k = from; k < tokens.length && idx.length < maxReal + 3; k++) {
      if (tokens[k].n) idx.push(k);
    }
    for (let s = 0; s + 2 < idx.length; s++) {
      if (
        similar(tokens[idx[s]].n, tail[0]) &&
        similar(tokens[idx[s + 1]].n, tail[1]) &&
        similar(tokens[idx[s + 2]].n, tail[2])
      ) {
        return idx[s + 2] + 1;
      }
    }
    return -1;
  }

  // Recorre lo que se oyó desde "start" y regresa la nueva posición del cursor
  function align(tokens, spoken, start) {
    let pos = start;
    let lastHit = -1;
    for (let i = 0; i < spoken.length; i++) {
      const w = spoken[i];
      const look = w.length <= 3 ? 3 : 12; // palabras cortas: solo buscar muy cerca
      let seen = 0;
      for (let j = pos; j < tokens.length && seen < look; j++) {
        const tn = tokens[j].n;
        if (!tn) continue;
        seen++;
        if (!similar(tn, w)) continue;
        if (seen > 3) {
          // Salto largo: solo se acepta si la siguiente palabra también cuadra
          const nx = spoken[i + 1];
          if (!nx || !confirmAhead(tokens, j, nx)) continue;
        }
        pos = j + 1;
        lastHit = i;
        break;
      }
    }
    // Si las últimas 4 palabras no cuadraron, intentar resincronizar más adelante
    if (spoken.length - 1 - lastHit >= 4) {
      const r = findSeq(tokens, spoken.slice(-3), pos, 400);
      if (r >= 0) pos = r;
    }
    return pos;
  }

  const api = { norm, similar, align };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Apuntador = api;
})(typeof self !== 'undefined' ? self : this);
