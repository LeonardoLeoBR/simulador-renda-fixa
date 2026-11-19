/*
 * Controle Financeiro — camada de dados da saída PÚBLICA (simulador de renda fixa; F11, decisões 57 e 59).
 *
 * Mesma interface que o comparador usa de js/dados.js, mas NADA é gravado: os cenários ficam só na memória
 * desta página e somem ao fechar ou recarregar. Não há cofre, registro, backup, importação nem área separada,
 * e nenhum arquivo da saída pública usa qualquer armazenamento do navegador (o build confere e para se achar um).
 *
 * Rede: só os arquivos do próprio site (data/*.json) e as APIs do BCB, como na completa (a CSP é a mesma).
 * A leitura e a validação das respostas são as mesmas da completa (js/dados-comum.js).
 */
(function (root) {
  'use strict';

  var C = root.DadosComum;
  var CHAVES_USUARIO = ['cenarios'];      // único dado de usuário do simulador
  var PREFS = ['cenarioAberto'];          // preferência de tela, também só na memória
  var memoria = {}, prefs = {}, mercado = null;

  /* A única função de busca da saída pública (porta única). */
  function obter(u, o) { return fetch(u, o); }
  var lerJson = C.criarLeitorJson(obter);

  function chave(k, lista) { if (lista.indexOf(k) < 0) throw new Error('chave não permitida'); return k; }

  var Mercado = Object.freeze({
    SERIES: C.SERIES, FOCUS: C.FOCUS,
    /* Sem nada guardado, o simulador busca o BCB ao abrir e no botão Atualizar. Série fora da faixa é descartada
       e vira aviso na tela (não há registro de atividade aqui). */
    atualizar: async function () {
      var descartes = [];
      var m = C.sanear(await C.coletarBCB(obter), function (t) { descartes.push(t); }) || { series: {}, avisos: [] };
      m.avisos = (m.avisos || []).concat(descartes);
      if (Object.keys(m.series).length) mercado = C.copia(m);
      return m;
    },
    ultimo: function () { return Promise.resolve(C.copia(mercado)); }
  });

  Object.defineProperty(root, 'Dados', { enumerable: true, writable: false, configurable: false, value: Object.freeze({
    VERSAO_SITE: C.VERSAO_SITE, AMBIENTE: 'publico', SO_MEMORIA: true, REGRAS_VERIFICADAS: C.REGRAS_VERIFICADAS,
    armazenamento: function () { return { nome: 'memória desta página (nada é gravado)' }; },
    ler: function (k) {
      try { chave(k, CHAVES_USUARIO); } catch (e) { return Promise.reject(e); }
      return Promise.resolve(C.copia(memoria[k] == null ? null : memoria[k]));
    },
    gravar: function (k, v) {
      try { chave(k, CHAVES_USUARIO); memoria[k] = C.copia(v); } catch (e) { return Promise.reject(e); }
      return Promise.resolve(true);
    },
    lerLocal: function (k) {
      try { chave(k, PREFS); } catch (e) { return Promise.reject(e); }
      return Promise.resolve(prefs[k] == null ? null : prefs[k]);
    },
    gravarLocal: function (k, v) {
      try { chave(k, PREFS); prefs[k] = v; } catch (e) { return Promise.reject(e); }
      return Promise.resolve(true);
    },
    mercado: Mercado, premissasDe: C.premissasDe, hoje: C.hoje, diasUteisDesde: C.diasUteisDesde,
    feriados: function () { return lerJson('data/feriados.json'); },
    referencia: function () { return lerJson('data/referencia.json'); },
    exemplos: function () { return lerJson('data/exemplos.json'); }
  }) });
})(window);
