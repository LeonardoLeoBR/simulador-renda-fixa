/*
 * Controle Financeiro — auxiliares de tela comuns (F11, limpeza medida na decisão 57).
 * Antes repetidos em app.js, comparador.js, carteira.js e rendimentos.js. Sem dado, sem rede, sem armazenamento.
 */
(function (root) {
  'use strict';

  /* Cria um elemento só com textContent (nunca HTML por texto; a CSP com Trusted Types barraria).
     Atributo false ou null é omitido; true vira atributo vazio (hidden, disabled). */
  function el(tag, attrs, texto) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (attrs[k] === false || attrs[k] == null) return;
      if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    if (texto != null) e.textContent = texto;
    return e;
  }

  /* AAAA-MM-DD (ou data e hora ISO) → DD/MM/AAAA; vazio vira travessão. */
  function dataBR(iso) { if (!iso) return '—'; var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }

  /* Data e hora ISO → DD/MM/AAAA HH:MM no fuso do navegador. */
  function dataHoraBR(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  Object.defineProperty(root, 'Util', { enumerable: true, writable: false, configurable: false,
    value: Object.freeze({ el: el, dataBR: dataBR, dataHoraBR: dataHoraBR }) });
})(window);
