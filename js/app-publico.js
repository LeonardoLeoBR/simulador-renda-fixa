/*
 * Controle Financeiro — interface da saída PÚBLICA (simulador de renda fixa; F11, tela simples na F13.1).
 * Só o topo (Atualizar, horário e balão "De onde vêm as taxas"), a linha de privacidade, o aviso de mercado e o rodapé.
 * O comparador fica em js/comparador.js, igual ao da completa (na pública ele entra no modo simples).
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
    // Decisão 69: a página avisa que está em teste.
    r.appendChild(el('strong', { class: 'aviso-teste' }, 'Versão em teste: confira os valores com sua corretora antes de investir.'));
    r.appendChild(el('span', null, 'Dados de mercado: ' + (m && m.coletadoEm
      ? 'BCB (SGS 432, 1178, 4389, 433, 226 e Focus), coletado em ' + dataHoraBR(m.coletadoEm) + ' · ' + m.origem
      : 'ainda não carregados')));
    r.appendChild(el('span', null, 'Regras tributárias verificadas em ' + dataBR(D.REGRAS_VERIFICADAS)));
    r.appendChild(el('span', null, 'Motor renda fixa v' + (window.MotorRF ? window.MotorRF.versao : '—') + ' · feriados ANBIMA'));
    r.appendChild(el('span', null, 'Simulador v' + D.VERSAO_SITE + ' · nada é gravado neste navegador'));
    r.appendChild(el('span', null, 'Análise, não recomendação de investimento.'));
  }

  /* Decisão 66: "Atualizado dd/mm/aaaa, hh:mm" abaixo do botão. É o retorno visível de cada clique. */
  var tPisca;
  function carimbo(texto, piscar) {
    $('#carimbo-txt').textContent = texto;
    var c = $('#carimbo'); c.classList.remove('pisca');
    if (piscar) { void c.offsetWidth; c.classList.add('pisca'); clearTimeout(tPisca); tPisca = setTimeout(function () { c.classList.remove('pisca'); }, 1600); }
  }
  function textoCarimbo(iso) {
    var d = new Date(iso);
    return 'Atualizado ' + d.toLocaleDateString('pt-BR') + ', ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  async function atualizar() {
    var b = $('#btn-atualizar'); b.disabled = true; b.querySelector('span').textContent = 'Atualizando…';
    var achou = false;
    try {
      var m = await D.mercado.atualizar();
      if (Object.keys(m.series).length) { achou = true; mercadoAtual = m; document.dispatchEvent(new CustomEvent('cf:mercado', { detail: m })); }
      aviso((m.avisos || []).join(' · ') || (achou ? '' : 'Não consegui buscar os dados do Banco Central. Preencha CDI, Selic e IPCA nas premissas ou tente de novo em Atualizar.'));
    } catch (e) {
      aviso('Não consegui atualizar os dados de mercado (' + e.message + '). Preencha as premissas ou tente de novo em Atualizar.');
    }
    b.disabled = false; b.querySelector('span').textContent = 'Atualizar';
    document.dispatchEvent(new CustomEvent('cf:mercado-fim'));  // v0.14.1: o comparador para de esperar
    if (achou) carimbo(textoCarimbo(mercadoAtual.coletadoEm), true);
    else carimbo(mercadoAtual ? textoCarimbo(mercadoAtual.coletadoEm) + ' (falhou agora)' : 'Sem taxas do Banco Central', true);
    rodape();
  }

  /* Balão "De onde vêm as taxas": abre ao passar o mouse, ao focar pelo teclado e ao tocar; Esc fecha. */
  function dica() {
    var bt = $('#carimbo'), d = $('#dica-mercado'), fixo = false;
    function mostrar(v) { d.hidden = !v; bt.setAttribute('aria-expanded', v ? 'true' : 'false'); }
    bt.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') mostrar(true); });
    bt.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !fixo) mostrar(false); });
    // Foco pelo teclado (:focus-visible); o toque também foca o botão, mas aí quem abre é o clique.
    bt.addEventListener('focus', function () { if (bt.matches(':focus-visible')) mostrar(true); });
    bt.addEventListener('blur', function () { fixo = false; mostrar(false); });
    bt.addEventListener('click', function () { fixo = !fixo || d.hidden; mostrar(fixo); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !d.hidden) { fixo = false; mostrar(false); } });
    document.addEventListener('pointerdown', function (e) { if (!d.hidden && !bt.contains(e.target) && !d.contains(e.target)) { fixo = false; mostrar(false); } });
  }

  /* Linha de privacidade: "Saiba mais" abre o texto completo. */
  function privacidade() {
    var b = $('#priv-mais'), t = $('#nota-publico');
    b.addEventListener('click', function () {
      t.hidden = !t.hidden;
      b.setAttribute('aria-expanded', t.hidden ? 'false' : 'true');
      b.textContent = t.hidden ? 'Saiba mais' : 'Fechar';
    });
  }

  // Não abre dentro de outra página (clique disfarçado; a CSP por <meta> não cobre e o GitHub Pages não aceita cabeçalhos).
  // Conferido já ao carregar, antes do comparador: sem #comparador na página, ele nem começa.
  if (window.top !== window.self) {
    document.body.textContent = 'Por segurança, o simulador não abre dentro de outra página. Abra o endereço diretamente no navegador.';
    return;
  }

  function iniciar() {
    $('#btn-atualizar').addEventListener('click', atualizar);
    dica(); privacidade();
    rodape();
    atualizar();
  }
  // Depois de todos os scripts: o comparador já está ouvindo "cf:mercado" quando a resposta do BCB chegar.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
