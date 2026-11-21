// Lógica de seguimiento: compara lo que se oye contra el texto y dice hasta dónde vas.
// Funciona en el navegador (window.Apuntador) y en Node (module.exports) para pruebas.
(function (root) {
  'use strict';

  // Lo más que puede brincar al resincronizar, en palabras tuyas (unos 2 o 3 renglones en el cel)
  const MAX_SALTO = 15;

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
  // (las partes de otra persona, marcadas con o, no cuentan para la distancia)
  function confirmAhead(tokens, j, next) {
    let seen = 0;
    for (let k = j + 1; k < tokens.length && seen < 3; k++) {
      if (!tokens[k].n) continue;
      if (!tokens[k].o) seen++;
      if (similar(tokens[k].n, next)) return true;
    }
    return false;
  }

  // Busca 4 palabras seguidas en el texto (para cuando te saltas un pedazo).
  // Solo busca cerca y solo en tus partes: con oraciones que se repiten (rosario),
  // buscar lejos encontraba la misma frase más adelante y daba brincos grandes.
  function findSeq(tokens, tail, from, maxReal) {
    const largas = tail.filter(w => w.length >= 4).length;
    if (tail.length < 4 || largas < 2) return -1;
    const idx = [];
    for (let k = from; k < tokens.length && idx.length < maxReal + 4; k++) {
      if (tokens[k].n && !tokens[k].o) idx.push(k);
    }
    for (let s = 0; s + 3 < idx.length; s++) {
      let ok = true;
      for (let q = 0; q < 4 && ok; q++) ok = similar(tokens[idx[s + q]].n, tail[q]);
      if (ok) return idx[s + 3] + 1;
    }
    return -1;
  }

  // Recorre lo que se oyó desde "start" y regresa la nueva posición del cursor
  // hits (opcional): se llena con pares [índice del texto, índice de lo oído]
  function align(tokens, spoken, start, hits) {
    let pos = start;
    let lastHit = -1;
    for (let i = 0; i < spoken.length; i++) {
      const w = spoken[i];
      const look = w.length <= 3 ? 3 : 12; // palabras cortas: solo buscar muy cerca
      let seen = 0;
      for (let j = pos; j < tokens.length && seen < look; j++) {
        const tn = tokens[j].n;
        if (!tn) continue;
        // Las palabras de otra persona se pueden reconocer si se oyen,
        // pero no cuentan para la distancia: así se brincan solas
        if (!tokens[j].o) seen++;
        // Lo de otra persona solo cuenta si está justo enfrente. Si antes hay palabras
        // tuyas sin decir, no se busca: así no brinca a la parte de ella de más adelante
        if (tokens[j].o && seen > 0) continue;
        if (!similar(tn, w)) continue;
        if (seen > 3) {
          // Salto largo: solo se acepta si la siguiente palabra también cuadra
          const nx = spoken[i + 1];
          if (!nx || !confirmAhead(tokens, j, nx)) continue;
        }
        if (hits) {
          hits.push([j, i]);
          // Tras un brinco, las palabras justo antes también pudieron decirse: se cuentan
          for (let k = 1; i - k > lastHit && j - k >= pos; k++) {
            const tk = tokens[j - k];
            if (!tk.n) continue;
            if (similar(tk.n, spoken[i - k])) hits.push([j - k, i - k]); else break;
          }
        }
        pos = j + 1;
        lastHit = i;
        break;
      }
    }
    // Si las últimas 4 palabras no cuadraron, intentar resincronizar un poco más adelante
    // (máximo MAX_SALTO palabras tuyas; antes eran 400)
    if (spoken.length - 1 - lastHit >= 4) {
      const r = findSeq(tokens, spoken.slice(-4), pos, MAX_SALTO);
      if (r >= 0) pos = r;
    }
    return pos;
  }

  const api = { norm, similar, align };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Apuntador = api;
})(typeof self !== 'undefined' ? self : this);
