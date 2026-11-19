/*
 * Controle Financeiro — parte da camada de dados comum às duas saídas do build (F11, decisão 57):
 * a completa (js/dados.js, com porta, cofre e registro) e a pública (js/dados-publico.js, que não grava nada).
 *
 * Aqui ficam só funções puras: versão do site, séries do BCB, leitura e validação das respostas, premissas do
 * motor de renda fixa, datas e leitura dos arquivos estáticos. Este arquivo NUNCA fala com a rede nem com o
 * armazenamento por conta própria: quem busca recebe a função de busca da camada de dados (parâmetro "obter").
 * Assim a regra da porta única continua valendo: só js/dados.js (ou js/dados-publico.js) decide o que sai.
 */
(function (root) {
  'use strict';

  var VERSAO_SITE = '0.13.0';
  var REGRAS_VERIFICADAS = '2026-11-03';

  /* Séries de mercado. Unidade conferida na resposta da API em 29–30/10/2026. */
  var SERIES = [
    { id: 'selic', nome: 'Selic meta', fonte: 'BCB SGS 432', codigo: 432, unidade: '% a.a.' },
    { id: 'selicOver', nome: 'Selic over (base 252)', fonte: 'BCB SGS 1178', codigo: 1178, unidade: '% a.a.' },
    { id: 'cdi', nome: 'CDI anualizado (base 252)', fonte: 'BCB SGS 4389', codigo: 4389, unidade: '% a.a.' },
    { id: 'ipca', nome: 'IPCA do mês', fonte: 'BCB SGS 433', codigo: 433, unidade: '% a.m.' },
    { id: 'tr', nome: 'TR (período mensal iniciado na data)', fonte: 'BCB SGS 226', codigo: 226, unidade: '% a.m.' }
  ];
  /* Focus: ano corrente (+0) e seguinte (+1); IPCA 12 meses à frente (série suavizada). */
  var FOCUS = [
    { id: 'focusIpca12m', nome: 'IPCA esperado 12 meses à frente (Focus, mediana)', indicador: 'IPCA', recurso: '12m', unidade: '% a.a.' },
    { id: 'focusIpca', nome: 'IPCA esperado (Focus, mediana)', indicador: 'IPCA', ano: 0, unidade: '% a.a.' },
    { id: 'focusIpcaProx', nome: 'IPCA esperado (Focus, mediana)', indicador: 'IPCA', ano: 1, unidade: '% a.a.' },
    { id: 'focusSelic', nome: 'Selic esperada fim de ano (Focus, mediana)', indicador: 'Selic', ano: 0, unidade: '% a.a.' },
    { id: 'focusSelicProx', nome: 'Selic esperada fim de ano (Focus, mediana)', indicador: 'Selic', ano: 1, unidade: '% a.a.' }
  ];
  SERIES.forEach(Object.freeze); FOCUS.forEach(Object.freeze); Object.freeze(SERIES); Object.freeze(FOCUS);

  function copia(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }

  function brParaIso(d) { var p = d.split('/'); return p[2] + '-' + p[1] + '-' + p[0]; }

  /* Data de hoje no fuso do navegador (Brasília), não em UTC. */
  function hojeLocal() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  var OLINDA = 'https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/';

  /* F11.1 (revisão independente): resposta que não é JSON vira "resposta inválida" (o texto de quem respondeu
     nunca chega à tela) e o valor do SGS precisa ser número estrito ("39.9xyz" não vira 39,9). */
  async function jsonOuInvalido(r) { try { return await r.json(); } catch (e) { throw new Error('resposta inválida'); } }
  function numeroEstrito(x) {
    var t = typeof x === 'number' ? String(x) : typeof x === 'string' ? x.trim() : '';
    if (!/^-?\d+(\.\d+)?$/.test(t)) throw new Error('resposta inválida');
    return Number(t);
  }

  /* Coleta as séries no BCB. "obter" é a função de busca entregue pela camada de dados (a porta). */
  async function coletarBCB(obter) {
    var hoje = hojeLocal();
    var saida = { series: {}, coletadoEm: new Date().toISOString(), origem: 'chamada direta às APIs do BCB', avisos: [] };
    await Promise.all(SERIES.map(async function (s) {
      try {
        var r = await obter('https://api.bcb.gov.br/dados/serie/bcdata.sgs.' + s.codigo + '/dados/ultimos/20?formato=json', { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        // A API não garante ordem cronológica (4389 veio decrescente) e a 432 traz datas de vigência futura:
        // ordena por data e usa o último registro com data <= hoje.
        var corpo = await jsonOuInvalido(r);
        if (!Array.isArray(corpo)) throw new Error('resposta inválida');
        var lista = corpo.map(function (x) {
          if (!x || typeof x.data !== 'string' || !/^\d{2}\/\d{2}\/\d{4}$/.test(x.data)) throw new Error('resposta inválida');
          return { data: brParaIso(x.data), valor: x.valor };
        })
          .sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
        var validos = lista.filter(function (x) { return x.data <= hoje; });
        if (!validos.length) throw new Error('nenhum registro até hoje nos últimos 20');
        var ult = validos[validos.length - 1];
        saida.series[s.id] = { nome: s.nome, valor: numeroEstrito(ult.valor), data: ult.data, unidade: s.unidade, fonte: s.fonte };
      } catch (e) { saida.avisos.push('falta ' + s.nome + ' (' + e.message + ')'); }
    }));
    var ano = Number(hoje.slice(0, 4));
    await Promise.all(FOCUS.map(async function (f) {
      try {
        var u;
        if (f.recurso === '12m') {
          u = OLINDA + 'ExpectativasMercadoInflacao12Meses?$top=1&$filter=Indicador%20eq%20%27' + f.indicador +
            "%27%20and%20Suavizada%20eq%20%27S%27%20and%20baseCalculo%20eq%200&$orderby=Data%20desc&$select=Data,Mediana&$format=json";
        } else {
          u = OLINDA + 'ExpectativasMercadoAnuais?$top=1&$filter=Indicador%20eq%20%27' + f.indicador + '%27%20and%20DataReferencia%20eq%20%27' +
            (ano + f.ano) + "%27%20and%20baseCalculo%20eq%200&$orderby=Data%20desc&$select=Data,DataReferencia,Mediana&$format=json";
        }
        var r = await obter(u, { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        var corpo2 = await jsonOuInvalido(r);
        var v = corpo2 && Array.isArray(corpo2.value) ? corpo2.value[0] : null;
        if (!v) throw new Error('sem resposta do Focus');
        saida.series[f.id] = { nome: f.nome + (v.DataReferencia ? ' ' + v.DataReferencia : ''), valor: v.Mediana, data: v.Data, unidade: f.unidade, fonte: 'BCB Focus (Olinda)', projecao: true };
      } catch (e) { saida.avisos.push('falta ' + f.nome + ' (' + e.message + ')'); }
    }));
    return saida;
  }

  /* Confere cada série guardada: só séries conhecidas, valor numérico em faixa plausível e data válida.
     Nome, fonte e unidade vêm do código (não do valor guardado), para um dado plantado não se passar pelo BCB.
     "alerta" recebe o texto de cada série descartada (a completa anota no registro; a pública só mostra). */
  var FAIXAS = { selic: [0, 40], selicOver: [0, 40], cdi: [0, 40], ipca: [-3, 5], tr: [-1, 3],
    focusIpca12m: [-5, 40], focusIpca: [-5, 40], focusIpcaProx: [-5, 40], focusSelic: [0, 40], focusSelicProx: [0, 40] };
  function sanear(m, alerta) {
    if (!m || typeof m !== 'object' || !m.series || typeof m.series !== 'object') return null;
    var saida = { series: {}, coletadoEm: typeof m.coletadoEm === 'string' ? m.coletadoEm : null,
      origem: typeof m.origem === 'string' ? m.origem.slice(0, 200) : '', avisos: Array.isArray(m.avisos) ? m.avisos.filter(function (a) { return typeof a === 'string'; }).slice(0, 20) : [] };
    Object.keys(m.series).forEach(function (id) {
      var s = m.series[id], def = SERIES.concat(FOCUS).filter(function (x) { return x.id === id; })[0], f = FAIXAS[id];
      if (!def || !f || !s) return;
      if (typeof s.valor !== 'number' || !isFinite(s.valor) || s.valor < f[0] || s.valor > f[1] || typeof s.data !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(s.data)) {
        if (alerta) alerta('valor de mercado fora do esperado em "' + def.nome + '"; descartado');
        return;
      }
      var ano = def.ano != null && typeof s.nome === 'string' ? (s.nome.match(/(20\d\d)$/) || [])[1] : null;
      saida.series[id] = { nome: def.nome + (ano ? ' ' + ano : ''), valor: s.valor, data: s.data.slice(0, 10), unidade: def.unidade,
        fonte: def.fonte || 'BCB Focus (Olinda)', projecao: !def.codigo };
    });
    return saida;
  }

  /*
   * Converte um retrato de mercado nas premissas do motor de renda fixa (decimais),
   * com fonte e data de cada uma. Valor ausente fica null (a tela mostra "⚠ falta").
   */
  function premissasDe(m) {
    var s = (m && m.series) || {};
    function p(id, nome, divisor, extra) {
      var x = s[id];
      return Object.assign({ nome: nome, valor: x ? x.valor / divisor : null, data: x ? x.data : null,
        fonte: x ? x.fonte : null, unidade: x ? x.unidade : null, projecao: !!(x && x.projecao) }, extra || {});
    }
    return {
      cdiAA: p('cdi', 'CDI', 100, { usoEm: 'produtos atrelados ao CDI e fundos' }),
      selicAA: p('selicOver', 'Selic over', 100, { usoEm: 'Tesouro Selic' }),
      selicMetaAA: p('selic', 'Selic meta', 100, { usoEm: 'regra da poupança (acima ou abaixo de 8,5% a.a.)' }),
      trAM: p('tr', 'TR', 100, { usoEm: 'poupança' }),
      ipcaProjAA: p('focusIpca12m', 'IPCA projetado', 100, { usoEm: 'IPCA+ e retorno real' })
    };
  }

  /* Arquivos estáticos do site (mesma origem), com cache por caminho. "obter" vem da camada de dados. */
  function criarLeitorJson(obter) {
    var cacheArq = {};
    return function lerJson(caminho) {
      if (!cacheArq[caminho]) {
        cacheArq[caminho] = obter(caminho, { cache: 'no-cache' }).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status + ' em ' + caminho);
          return r.json();
        });
        cacheArq[caminho].catch(function () { delete cacheArq[caminho]; });
      }
      return cacheArq[caminho].then(copia);
    };
  }

  /* Dias úteis (segunda a sexta, sem feriados) desde uma data — usado para o selo "desatualizado". */
  function diasUteisDesde(iso) {
    var d = new Date(iso), h = new Date(), n = 0;
    d.setHours(0, 0, 0, 0); h.setHours(0, 0, 0, 0);
    if (isNaN(d) || d >= h) return 0;
    // Semanas inteiras de uma vez (7ª revisão, N7: data muito antiga fazia o laço andar dia a dia por décadas).
    var semanas = Math.floor(Math.round((h - d) / 86400000) / 7);
    n = semanas * 5; d.setDate(d.getDate() + semanas * 7);
    while (d < h) { d.setDate(d.getDate() + 1); var w = d.getDay(); if (w !== 0 && w !== 6) n++; }
    return n;
  }

  /* Propriedade fixa da janela: nenhum outro script troca estas funções depois de carregadas. */
  Object.defineProperty(root, 'DadosComum', { enumerable: true, writable: false, configurable: false, value: Object.freeze({
    VERSAO_SITE: VERSAO_SITE, REGRAS_VERIFICADAS: REGRAS_VERIFICADAS, SERIES: SERIES, FOCUS: FOCUS,
    copia: copia, hoje: hojeLocal, coletarBCB: coletarBCB, sanear: sanear, premissasDe: premissasDe,
    criarLeitorJson: criarLeitorJson, diasUteisDesde: diasUteisDesde
  }) });
})(window);
