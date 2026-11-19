/*
 * Controle Financeiro — interface da saída PÚBLICA (simulador de renda fixa; F11).
 * Só o topo, o aviso de mercado e o rodapé de proveniência. O comparador fica em js/comparador.js, igual ao da completa.
 * Não grava nada: sem senha, sem backup, sem abas. Busca os dados do BCB ao abrir (não há valor guardado para mostrar).
 */
(function () {
  'use strict';
  var D = window.Dados, U = window.Util, el = U.el, dataBR = U.dataBR, dataHoraBR = U.dataHoraBR;
  var $ = function (s) { return document.querySelector(s); };
  var mercadoAtual = null;

  function aviso(texto) { var a = $('#aviso-mercado'); a.textContent = texto || ''; a.hidden = !texto; }

  function rodape() {
    var r = $('#rodape'); r.textContent = '';
    var m = mercadoAtual;
    r.appendChild(el('span', null, 'Dados de mercado: ' + (m && m.coletadoEm
      ? 'BCB (SGS 432, 1178, 4389, 433, 226 e Focus), coletado em ' + dataHoraBR(m.coletadoEm) + ' · ' + m.origem
      : 'ainda não carregados')));
    r.appendChild(el('span', null, 'Regras tributárias verificadas em ' + dataBR(D.REGRAS_VERIFICADAS)));
    r.appendChild(el('span', null, 'Motor renda fixa v' + (window.MotorRF ? window.MotorRF.versao : '—') + ' · feriados ANBIMA'));
    r.appendChild(el('span', null, 'Simulador v' + D.VERSAO_SITE + ' · nada é gravado neste navegador'));
    r.appendChild(el('span', null, 'Análise, não recomendação de investimento.'));
  }

  async function atualizar() {
    var b = $('#btn-atualizar'); b.disabled = true; b.querySelector('span').textContent = 'Atualizando…';
    try {
      var m = await D.mercado.atualizar();
      if (Object.keys(m.series).length) { mercadoAtual = m; document.dispatchEvent(new CustomEvent('cf:mercado', { detail: m })); }
      aviso((m.avisos || []).join(' · ') || (Object.keys(m.series).length ? '' : 'Não consegui buscar os dados do Banco Central. Preencha CDI, Selic e IPCA nas premissas do cenário ou tente de novo em Atualizar.'));
    } catch (e) {
      aviso('Não consegui atualizar os dados de mercado (' + e.message + '). Preencha as premissas do cenário ou tente de novo em Atualizar.');
    }
    b.disabled = false; b.querySelector('span').textContent = 'Atualizar';
    rodape();
  }

  // Não abre dentro de outra página (clique disfarçado; a CSP por <meta> não cobre e o GitHub Pages não aceita cabeçalhos).
  // Conferido já ao carregar, antes do comparador: sem #comparador na página, ele nem começa.
  if (window.top !== window.self) {
    document.body.textContent = 'Por segurança, o simulador não abre dentro de outra página. Abra o endereço diretamente no navegador.';
    return;
  }

  function iniciar() {
    // A seção do comparador vem de app.html; aqui "salvar" vale só enquanto a página estiver aberta.
    var sub = $('#cmp-sub-salvar');
    if (sub) sub.textContent = 'Cada comparação é um cenário com nome, que fica guardado enquanto esta página estiver aberta.';
    $('#btn-atualizar').addEventListener('click', atualizar);
    rodape();
    atualizar();
  }
  // Depois de todos os scripts: o comparador já está ouvindo "cf:mercado" quando a resposta do BCB chegar.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
