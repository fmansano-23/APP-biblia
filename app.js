/**
 * app.js — Evangelhos Cronológicos
 * Versão 1.1 | Vanilla JS | Sem dependências externas
 *
 * Módulos internos:
 *   Estado      – store reativo mínimo
 *   Persistência – localStorage
 *   Dados       – carregamento de cronologia.json
 *   UI Lista    – tela principal
 *   UI Leitura  – tela de leitura
 *   UI Config   – painel de preferências
 *   Busca       – filtragem instantânea
 *   Favoritos   – lista de favoritos
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════════════════════
   ESTADO GLOBAL
═══════════════════════════════════════════════════════════════════════════════ */

const Estado = (() => {
  const _state = {
    cronologia:    [],      // array completo de eventos
    visivel:       [],      // eventos filtrados exibidos
    eventoAtual:   null,    // id do evento aberto na leitura
    abaNativa:     'lista', // 'lista' | 'favoritos'
    busca:         '',

    // Persistidos no localStorage
    progresso:          {},  // { [id]: 'nao-iniciado' | 'em-leitura' | 'concluido' }
    favoritos:          [],  // [id, id, ...]
    destaques:          {},  // { [id]: [{ inicio, fim, texto }] }
    anotacoes:          {},  // { [id]: string }
    ultimoItem:         null,
    leiturasConcluidas: 0,
    prefs: {
      tema:         'escuro',   // 'escuro' | 'claro'
      fonte:        'media',    // 'pequena' | 'media' | 'grande' | 'xgrande'
      espacamento:  'normal',   // 'compacto' | 'normal' | 'amplo'
      tipoFonte:    'sansserif',// 'sansserif' | 'serifada'
    },
  };

  return {
    get: k => _state[k],
    set: (k, v) => { _state[k] = v; },
    estado: _state,
  };
})();

/* ═══════════════════════════════════════════════════════════════════════════════
   PERSISTÊNCIA
═══════════════════════════════════════════════════════════════════════════════ */

const Persistencia = {
  _ler(chave, padrao) {
    try {
      const v = localStorage.getItem(chave);
      return v !== null ? JSON.parse(v) : padrao;
    } catch { return padrao; }
  },
  _salvar(chave, valor) {
    try { localStorage.setItem(chave, JSON.stringify(valor)); } catch {}
  },

  carregar() {
    Estado.set('progresso',          this._ler('progresso',          {}));
    Estado.set('favoritos',          this._ler('favoritos',          []));
    Estado.set('destaques',          this._ler('destaques',          {}));
    Estado.set('anotacoes',          this._ler('anotacoes',          {}));
    Estado.set('ultimoItem',         this._ler('ultimoItem',         null));
    Estado.set('leiturasConcluidas', this._ler('leiturasConcluidas', 0));
    Estado.set('prefs',              this._ler('preferencias', {
      tema: 'escuro', fonte: 'media', espacamento: 'normal', tipoFonte: 'sansserif'
    }));
  },

  salvarProgresso()          { this._salvar('progresso',          Estado.get('progresso')); },
  salvarFavoritos()          { this._salvar('favoritos',          Estado.get('favoritos')); },
  salvarDestaques()          { this._salvar('destaques',          Estado.get('destaques')); },
  salvarAnotacoes()          { this._salvar('anotacoes',          Estado.get('anotacoes')); },
  salvarUltimoItem()         { this._salvar('ultimoItem',         Estado.get('ultimoItem')); },
  salvarLeiturasConcluidas() { this._salvar('leiturasConcluidas', Estado.get('leiturasConcluidas')); },
  salvarPrefs()              { this._salvar('preferencias',       Estado.get('prefs')); },
};

/* ═══════════════════════════════════════════════════════════════════════════════
   DADOS
═══════════════════════════════════════════════════════════════════════════════ */

const Dados = {
  async carregar() {
    // Modo standalone: dados embutidos diretamente no HTML
    if (window.__CRONOLOGIA__) {
      Estado.set('cronologia', window.__CRONOLOGIA__);
      Estado.set('visivel',    window.__CRONOLOGIA__);
      return;
    }
    // Modo servidor: carrega via fetch
    const resp = await fetch('./dados/cronologia.json');
    if (!resp.ok) throw new Error('Erro ao carregar cronologia.json');
    const data = await resp.json();
    Estado.set('cronologia', data);
    Estado.set('visivel',    data);
  },

  evento(id) {
    return Estado.get('cronologia').find(e => e.id === id) || null;
  },

  indiceEvento(id) {
    return Estado.get('cronologia').findIndex(e => e.id === id);
  },

  evangelhoPresentes(evento) {
    return ['mateus','marcos','lucas','joao'].filter(g => evento[g] !== null);
  },
};

/* ═══════════════════════════════════════════════════════════════════════════════
   UTILIDADES
═══════════════════════════════════════════════════════════════════════════════ */

const Utils = {
  /** Formata o texto do verso com quebra por versículo */
  formatarTexto(texto) {
    if (!texto) return '';
    let primeiro = true;
    return texto.replace(/(\d+)\s/g, (_, n) => {
      if (primeiro) {
        primeiro = false;
        return `<span class="verso-num">${n}</span>\u2009`;
      }
      return `<br class="verso-break"><span class="verso-num">${n}</span>\u2009`;
    });
  },

  /** Retorna ícone de status */
  iconeStatus(status) {
    if (status === 'concluido')  return '●';
    if (status === 'em-leitura') return '◐';
    return '○';
  },

  /** Retorna classe CSS do status */
  classeStatus(status) {
    if (status === 'concluido')  return 'concluido';
    if (status === 'em-leitura') return 'em-leitura';
    return '';
  },

  /** Label legível do status */
  labelStatus(status) {
    if (status === 'concluido')  return 'Concluído';
    if (status === 'em-leitura') return 'Em leitura';
    return 'Não iniciado';
  },

  /** Proxima status ciclicamente */
  proximoStatus(atual) {
    if (atual === 'nao-iniciado') return 'em-leitura';
    if (atual === 'em-leitura')   return 'concluido';
    return 'nao-iniciado';
  },

  /** Destaca ocorrências de query no texto */
  destacarBusca(texto, query) {
    if (!query) return texto;
    const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return texto.replace(re, '<mark>$1</mark>');
  },

  /** Mostra toast por N ms */
  toast(msg, ms = 1800) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('visivel');
    setTimeout(() => el.classList.remove('visivel'), ms);
  },

  /** Conta eventos concluídos */
  contarConcluidos() {
    const prog = Estado.get('progresso');
    return Estado.get('cronologia').filter(e => prog[e.id] === 'concluido').length;
  },
};

/* ═══════════════════════════════════════════════════════════════════════════════
   TEMA & PREFERÊNCIAS
═══════════════════════════════════════════════════════════════════════════════ */

const Tema = {
  aplicar() {
    const prefs = Estado.get('prefs');
    const html  = document.documentElement;
    const classes = html.className.split(' ').filter(c =>
      !c.startsWith('tema-') && !c.startsWith('fonte-') &&
      !c.startsWith('esp-') && c !== 'fonte-serifada'
    );
    classes.push(`tema-${prefs.tema}`);
    classes.push(`fonte-${prefs.fonte}`);
    classes.push(`esp-${prefs.espacamento}`);
    if (prefs.tipoFonte === 'serifada') classes.push('fonte-serifada');
    html.className = classes.join(' ').trim();
  },
};

/* ═══════════════════════════════════════════════════════════════════════════════
   INDICADOR DOS EVANGELHOS
═══════════════════════════════════════════════════════════════════════════════ */

function criarIndicador(evento, grande = false) {
  const evangelhos = ['mateus', 'marcos', 'lucas', 'joao'];
  const div = document.createElement('div');
  div.className = `indicador-evangelhos${grande ? ' grande' : ''}`;
  div.setAttribute('aria-label', evangelhos.map(g =>
    `${g[0].toUpperCase() + g.slice(1)}: ${evento[g] ? 'presente' : 'ausente'}`
  ).join(', '));
  evangelhos.forEach(g => {
    const dot = document.createElement('span');
    dot.className = `dot${evento[g] ? ' presente' : ''}`;
    div.appendChild(dot);
  });
  return div;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   BARRA DE PROGRESSO GLOBAL
═══════════════════════════════════════════════════════════════════════════════ */

function atualizarBarraProgresso() {
  const total      = Estado.get('cronologia').length;
  const concluidos = Utils.contarConcluidos();
  const pct        = total ? Math.round((concluidos / total) * 100) : 0;

  document.getElementById('progresso-texto').textContent  = `${concluidos} / ${total}`;
  document.getElementById('progresso-pct').textContent    = `${pct}%`;
  document.getElementById('barra-progresso-fill').style.width = `${pct}%`;

  // Badge do contador de leituras completas
  const leituras = Estado.get('leiturasConcluidas') || 0;
  const badge = document.getElementById('contador-leituras');
  if (badge) {
    if (leituras > 0) {
      badge.textContent = leituras === 1 ? '🏆 1 leitura completa' : `🏆 ${leituras} leituras completas`;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  // Banner de reiniciar leitura quando 100% concluído
  const bannerReset = document.getElementById('barra-reset-wrap');
  if (bannerReset) {
    if (total > 0 && concluidos === total) {
      bannerReset.classList.add('visivel');
    } else {
      bannerReset.classList.remove('visivel');
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   CICLOS DE LEITURA (REINICIAR / CONTADOR)
═══════════════════════════════════════════════════════════════════════════════ */

const LeituraCiclos = {
  abrirModalReset() {
    const totalConcluidas = Estado.get('leiturasConcluidas') || 0;
    const proxima = totalConcluidas + 2;
    const proximaEl = document.getElementById('modal-proxima-leitura');
    if (proximaEl) {
      proximaEl.textContent = `${proxima}ª leitura`;
    }
    const modal = document.getElementById('modal-reset');
    if (modal) {
      modal.classList.add('visivel');
      modal.setAttribute('aria-hidden', 'false');
    }
  },

  fecharModalReset() {
    const modal = document.getElementById('modal-reset');
    if (modal) {
      modal.classList.remove('visivel');
      modal.setAttribute('aria-hidden', 'true');
    }
  },

  reiniciar() {
    this.fecharModalReset();

    const leiturasAtual = Estado.get('leiturasConcluidas') || 0;
    const novoTotal = leiturasAtual + 1;
    Estado.set('leiturasConcluidas', novoTotal);
    Persistencia.salvarLeiturasConcluidas();

    // Zerar status de todos os acontecimentos para 'nao-iniciado'
    Estado.set('progresso', {});
    Persistencia.salvarProgresso();

    // Retornar leitura ao primeiro item
    const lista = Estado.get('cronologia');
    if (lista && lista.length > 0) {
      Estado.set('ultimoItem', lista[0].id);
      Persistencia.salvarUltimoItem();
    }

    // Se estiver com tela de leitura aberta, fechar
    if (Estado.get('eventoAtual')) {
      Leitura.fechar();
    }

    // Atualizar UI
    atualizarBarraProgresso();
    atualizarBannerContinuar();
    Lista.renderizar(Estado.get('visivel'), Estado.get('busca'));

    // Rolar para o topo da lista
    const conteudo = document.getElementById('conteudo');
    if (conteudo) conteudo.scrollTop = 0;

    Utils.toast(`🏆 Parabéns pela ${novoTotal}ª leitura completa! Progresso reiniciado.`);
  },
};

/* ═══════════════════════════════════════════════════════════════════════════════
   BANNER CONTINUAR LEITURA
═══════════════════════════════════════════════════════════════════════════════ */

function atualizarBannerContinuar() {
  const ultimo = Estado.get('ultimoItem');
  const banner = document.getElementById('banner-continuar');
  if (!ultimo) { banner.classList.remove('visivel'); return; }
  const ev = Dados.evento(ultimo);
  if (!ev)  { banner.classList.remove('visivel'); return; }
  document.getElementById('btn-continuar-titulo').textContent = ev.titulo;
  banner.classList.add('visivel');
}

/* ═══════════════════════════════════════════════════════════════════════════════
   LISTA PRINCIPAL
═══════════════════════════════════════════════════════════════════════════════ */

const Lista = {
  _ultimaSecao:    null,
  _ultimaSubsecao: null,

  renderizar(eventos, query = '') {
    const container = document.getElementById('lista-principal');
    container.innerHTML = '';
    this._ultimaSecao    = null;
    this._ultimaSubsecao = null;

    const semResultados = document.getElementById('sem-resultados');
    if (!eventos.length) {
      semResultados.style.display = 'block';
      return;
    }
    semResultados.style.display = 'none';

    const frag = document.createDocumentFragment();

    eventos.forEach((ev, idx) => {
      // Cabeçalho de seção
      if (!query && ev.secao !== this._ultimaSecao) {
        this._ultimaSecao    = ev.secao;
        this._ultimaSubsecao = null;
        const h = document.createElement('div');
        h.className = 'secao-header';
        h.textContent = ev.secao;
        frag.appendChild(h);
      }

      // Cabeçalho de subseção
      if (!query && ev.subsecao && ev.subsecao !== this._ultimaSubsecao) {
        this._ultimaSubsecao = ev.subsecao;
        const hs = document.createElement('div');
        hs.className = 'subsecao-header';
        hs.textContent = ev.subsecao;
        frag.appendChild(hs);
      }

      frag.appendChild(this._criarItem(ev, query, idx));
    });

    container.appendChild(frag);
  },

  _criarItem(ev, query, idx) {
    const prog  = Estado.get('progresso');
    const favs  = Estado.get('favoritos');
    const status = prog[ev.id] || 'nao-iniciado';
    const favoritado = favs.includes(ev.id);

    const li = document.createElement('div');
    li.className = 'item-lista';
    li.dataset.id = ev.id;
    li.style.animationDelay = `${Math.min(idx * 8, 200)}ms`;

    // Número
    const num = document.createElement('span');
    num.className = 'item-numero';
    num.textContent = ev.id;

    // Centro
    const centro = document.createElement('div');
    centro.className = 'item-centro';

    const titulo = document.createElement('div');
    titulo.className = 'item-titulo';
    titulo.innerHTML = query
      ? Utils.destacarBusca(ev.titulo, query)
      : ev.titulo;

    const meta = document.createElement('div');
    meta.className = 'item-meta';
    meta.appendChild(criarIndicador(ev));

    const statusEl = document.createElement('span');
    statusEl.className = `status-icone ${Utils.classeStatus(status)}`;
    statusEl.textContent = Utils.iconeStatus(status);
    statusEl.title = Utils.labelStatus(status);
    meta.appendChild(statusEl);

    centro.appendChild(titulo);
    centro.appendChild(meta);

    // Favorito
    const favEl = document.createElement('span');
    favEl.className = `item-fav${favoritado ? ' favoritado' : ''}`;
    favEl.textContent = favoritado ? '♥' : '';

    // Seta
    const seta = document.createElement('span');
    seta.className = 'item-seta';
    seta.textContent = '›';

    li.appendChild(num);
    li.appendChild(centro);
    li.appendChild(favEl);
    li.appendChild(seta);

    li.addEventListener('click', () => Leitura.abrir(ev.id));
    return li;
  },

  atualizarItem(id) {
    const li = document.querySelector(`.item-lista[data-id="${id}"]`);
    if (!li) return;
    const ev     = Dados.evento(id);
    const prog   = Estado.get('progresso');
    const favs   = Estado.get('favoritos');
    const status = prog[id] || 'nao-iniciado';
    const favoritado = favs.includes(id);

    li.querySelector('.item-titulo').textContent = ev.titulo;
    const meta   = li.querySelector('.item-meta');
    // Rebuild meta
    meta.innerHTML = '';
    meta.appendChild(criarIndicador(ev));
    const statusEl = document.createElement('span');
    statusEl.className = `status-icone ${Utils.classeStatus(status)}`;
    statusEl.textContent = Utils.iconeStatus(status);
    meta.appendChild(statusEl);

    const favEl = li.querySelector('.item-fav');
    favEl.className   = `item-fav${favoritado ? ' favoritado' : ''}`;
    favEl.textContent = favoritado ? '♥' : '';
  },
};

/* ═══════════════════════════════════════════════════════════════════════════════
   BUSCA
═══════════════════════════════════════════════════════════════════════════════ */

const Busca = {
  _timer: null,

  filtrar(query) {
    Estado.set('busca', query);
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._executar(query), 120);
  },

  _executar(query) {
    if (!query.trim()) {
      Estado.set('visivel', Estado.get('cronologia'));
      Lista.renderizar(Estado.get('cronologia'), '');
      document.getElementById('btn-limpar-busca').classList.remove('visivel');
      return;
    }

    document.getElementById('btn-limpar-busca').classList.add('visivel');
    const q   = query.toLowerCase();
    const res = Estado.get('cronologia').filter(ev => {
      if (ev.titulo.toLowerCase().includes(q)) return true;
      for (const g of ['mateus','marcos','lucas','joao']) {
        if (!ev[g]) continue;
        if (ev[g].referencia.toLowerCase().includes(q)) return true;
        if (ev[g].texto.toLowerCase().includes(q)) return true;
      }
      return false;
    });

    Estado.set('visivel', res);
    Lista.renderizar(res, query);
  },

  limpar() {
    document.getElementById('campo-busca').value = '';
    document.getElementById('btn-limpar-busca').classList.remove('visivel');
    Estado.set('busca', '');
    Estado.set('visivel', Estado.get('cronologia'));
    Lista.renderizar(Estado.get('cronologia'), '');
  },
};

/* ═══════════════════════════════════════════════════════════════════════════════
   TELA DE LEITURA
═══════════════════════════════════════════════════════════════════════════════ */

const Leitura = {
  _anotacaoTimer: null,

  abrir(id) {
    const ev = Dados.evento(id);
    if (!ev) return;

    Estado.set('eventoAtual', id);
    Estado.set('ultimoItem', id);
    Persistencia.salvarUltimoItem();
    atualizarBannerContinuar();

    this._renderizar(ev);

    // Marcar como em-leitura se ainda não iniciado
    const prog = Estado.get('progresso');
    if (!prog[id] || prog[id] === 'nao-iniciado') {
      prog[id] = 'em-leitura';
      Persistencia.salvarProgresso();
      Lista.atualizarItem(id);
      atualizarBarraProgresso();
    }

    document.getElementById('tela-leitura').classList.add('aberta');
    document.getElementById('leitura-nav').classList.add('visivel');
    document.getElementById('leitura-corpo').scrollTop = 0;
  },

  fechar() {
    document.getElementById('tela-leitura').classList.remove('aberta');
    document.getElementById('leitura-nav').classList.remove('visivel');
    Estado.set('eventoAtual', null);
  },

  _renderizar(ev) {
    const prog      = Estado.get('progresso');
    const favs      = Estado.get('favoritos');
    const anotacoes = Estado.get('anotacoes');
    const status    = prog[ev.id] || 'nao-iniciado';

    // Header
    document.getElementById('leitura-numero-header').textContent = `#${ev.id}`;
    // Indicador no header (limpa e recria)
    const hCentro = document.getElementById('leitura-header-centro');
    const oldInd = hCentro.querySelector('.indicador-evangelhos');
    if (oldInd) oldInd.remove();
    hCentro.appendChild(criarIndicador(ev));

    // Botão favorito
    const btnFav = document.getElementById('btn-fav-leitura');
    btnFav.textContent = favs.includes(ev.id) ? '♥' : '♡';
    btnFav.classList.toggle('ativo', favs.includes(ev.id));

    // Título
    document.getElementById('leitura-titulo').textContent = ev.titulo;

    // Indicador grande
    const indWrap = document.getElementById('leitura-indicador-wrap');
    const oldGrande = indWrap.querySelector('.indicador-evangelhos');
    if (oldGrande) oldGrande.remove();
    indWrap.prepend(criarIndicador(ev, true));

    // Status select e botão concluir
    const sel = document.getElementById('leitura-status-select');
    if (sel) sel.value = status;
    this.atualizarBotaoConcluir(status);

    // Evangelhos
    const corpoLeitura = document.getElementById('leitura-evangelhos');
    corpoLeitura.innerHTML = '';
    const nomes = { mateus:'Mateus', marcos:'Marcos', lucas:'Lucas', joao:'João' };
    const ordem = ['mateus','marcos','lucas','joao'];

    ordem.forEach(g => {
      if (!ev[g]) return;
      const bloco = document.createElement('div');
      bloco.className = 'evangelho-bloco';
      bloco.dataset.evangelho = g;

      const label = document.createElement('div');
      label.className = 'evangelho-label';
      label.textContent = nomes[g];

      const ref = document.createElement('div');
      ref.className = 'evangelho-ref';
      ref.textContent = ev[g].referencia;

      const texto = document.createElement('div');
      texto.className = 'evangelho-texto';
      texto.innerHTML = Utils.formatarTexto(ev[g].texto);

      bloco.appendChild(label);
      bloco.appendChild(ref);
      bloco.appendChild(texto);
      corpoLeitura.appendChild(bloco);
    });

    // Anotação
    const inputAnotacao = document.getElementById('anotacao-input');
    inputAnotacao.value = anotacoes[ev.id] || '';
    document.getElementById('anotacao-salvo').textContent = '';

    // Navegação
    const idx  = Dados.indiceEvento(ev.id);
    const cron = Estado.get('cronologia');
    const btnAnt  = document.getElementById('btn-ant');
    const btnProx = document.getElementById('btn-prox');
    btnAnt.disabled  = idx <= 0;
    btnProx.disabled = idx >= cron.length - 1;
    const navInfo = document.getElementById('leitura-nav-info');
    if (navInfo) navInfo.textContent = `${ev.id} / ${cron.length}`;
  },

  ir(delta) {
    const id  = Estado.get('eventoAtual');
    const idx = Dados.indiceEvento(id);
    const cron = Estado.get('cronologia');
    const prox = cron[idx + delta];
    if (prox) this.abrir(prox.id);
  },

  alternarFavorito() {
    const id   = Estado.get('eventoAtual');
    if (!id) return;
    const favs = Estado.get('favoritos');
    const idx  = favs.indexOf(id);
    if (idx === -1) favs.push(id);
    else            favs.splice(idx, 1);
    Persistencia.salvarFavoritos();

    const btnFav = document.getElementById('btn-fav-leitura');
    btnFav.textContent = favs.includes(id) ? '♥' : '♡';
    btnFav.classList.toggle('ativo', favs.includes(id));

    Lista.atualizarItem(id);
    Favoritos.renderizar();
    Utils.toast(favs.includes(id) ? 'Adicionado aos favoritos' : 'Removido dos favoritos');
  },

  salvarStatus(novoStatus) {
    const id   = Estado.get('eventoAtual');
    if (!id) return;
    const prog = Estado.get('progresso');
    prog[id] = novoStatus;
    Persistencia.salvarProgresso();
    Lista.atualizarItem(id);
    atualizarBarraProgresso();

    const sel = document.getElementById('leitura-status-select');
    if (sel && sel.value !== novoStatus) sel.value = novoStatus;
    this.atualizarBotaoConcluir(novoStatus);
  },

  atualizarBotaoConcluir(status) {
    const btn = document.getElementById('btn-concluir-leitura');
    if (!btn) return;
    const isConcluido = status === 'concluido';
    btn.classList.toggle('concluido', isConcluido);
    const icone = btn.querySelector('#btn-concluir-icone');
    const texto = btn.querySelector('#btn-concluir-texto');
    if (icone) icone.textContent = isConcluido ? '●' : '○';
    if (texto) texto.textContent = isConcluido ? 'Concluído' : 'Concluir';
    btn.setAttribute('aria-label', isConcluido ? 'Marcar como em leitura' : 'Marcar como concluído');
  },

  salvarAnotacao(texto) {
    const id = Estado.get('eventoAtual');
    if (!id) return;
    const anot = Estado.get('anotacoes');
    if (texto.trim()) anot[id] = texto;
    else              delete anot[id];
    Persistencia.salvarAnotacoes();
    document.getElementById('anotacao-salvo').textContent = 'Salvo';
    setTimeout(() => {
      if (document.getElementById('anotacao-salvo').textContent === 'Salvo')
        document.getElementById('anotacao-salvo').textContent = '';
    }, 2000);
  },
};

/* ═══════════════════════════════════════════════════════════════════════════════
   FAVORITOS
═══════════════════════════════════════════════════════════════════════════════ */

const Favoritos = {
  renderizar() {
    const container = document.getElementById('tela-favoritos');
    const vazio     = document.getElementById('favoritos-vazio');
    const favs      = Estado.get('favoritos');

    container.innerHTML = '';
    if (!favs.length) {
      container.appendChild(vazio);
      vazio.style.display = 'block';
      return;
    }
    vazio.style.display = 'none';

    const frag = document.createDocumentFragment();
    favs.forEach((id, idx) => {
      const ev = Dados.evento(id);
      if (!ev) return;
      frag.appendChild(Lista._criarItem(ev, '', idx));
    });
    container.appendChild(frag);
  },
};

/* ═══════════════════════════════════════════════════════════════════════════════
   CONFIGURAÇÕES
═══════════════════════════════════════════════════════════════════════════════ */

const Config = {
  abrir() {
    document.getElementById('tela-config').classList.add('aberta');
    document.getElementById('overlay').classList.add('visivel');
    this._sincronizarUI();
  },

  fechar() {
    document.getElementById('tela-config').classList.remove('aberta');
    document.getElementById('overlay').classList.remove('visivel');
  },

  _sincronizarUI() {
    const prefs = Estado.get('prefs');
    // Marca botões ativos
    document.querySelectorAll('.config-btn').forEach(btn => {
      btn.classList.toggle('ativo',
        btn.dataset.valor === prefs[btn.dataset.pref]
      );
    });
  },

  aplicar(pref, valor) {
    const prefs = Estado.get('prefs');
    prefs[pref] = valor;
    Persistencia.salvarPrefs();
    Tema.aplicar();
    this._sincronizarUI();
  },
};

/* ═══════════════════════════════════════════════════════════════════════════════
   NAVEGAÇÃO ENTRE ABAS
═══════════════════════════════════════════════════════════════════════════════ */

function irParaAba(aba) {
  Estado.set('abaNativa', aba);
  const lista   = document.getElementById('lista-principal');
  const favTela = document.getElementById('tela-favoritos');

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('ativo', el.dataset.aba === aba);
  });

  if (aba === 'lista') {
    lista.style.display   = '';
    favTela.classList.remove('ativo');
    document.getElementById('banner-continuar').style.display = '';
    document.getElementById('barra-progresso-wrap').style.display = '';
  } else if (aba === 'favoritos') {
    lista.style.display   = 'none';
    favTela.classList.add('ativo');
    document.getElementById('banner-continuar').style.display = 'none';
    document.getElementById('barra-progresso-wrap').style.display = 'none';
    Favoritos.renderizar();
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
═══════════════════════════════════════════════════════════════════════════════ */

async function inicializar() {
  // 1. Carregar preferências salvas e aplicar tema
  Persistencia.carregar();
  Tema.aplicar();

  // 2. Carregar dados
  try {
    await Dados.carregar();
  } catch (e) {
    document.getElementById('lista-principal').innerHTML =
      '<div style="padding:40px;text-align:center;color:var(--text-muted)">Erro ao carregar os dados.<br>Abra o app via servidor local.</div>';
    console.error(e);
    return;
  }

  // 3. Renderizar lista e barra de progresso
  Lista.renderizar(Estado.get('cronologia'));
  atualizarBarraProgresso();
  atualizarBannerContinuar();

  // 4. Vincular eventos de UI
  _vincularEventos();

  // 5. Registrar Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(console.warn);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   EVENTOS DE UI
═══════════════════════════════════════════════════════════════════════════════ */

function _vincularEventos() {

  // ── Busca ──────────────────────────────────────────────────────────────────
  const campoBusca = document.getElementById('campo-busca');
  campoBusca.addEventListener('input', e => Busca.filtrar(e.target.value));
  document.getElementById('btn-limpar-busca')
    .addEventListener('click', () => Busca.limpar());

  // ── Botão Configurações ────────────────────────────────────────────────────
  document.getElementById('btn-config')
    .addEventListener('click', () => Config.abrir());

  // ── Overlay (fecha config) ─────────────────────────────────────────────────
  document.getElementById('overlay')
    .addEventListener('click', () => Config.fechar());

  // ── Botões de configuração ─────────────────────────────────────────────────
  document.querySelectorAll('.config-btn').forEach(btn => {
    btn.addEventListener('click', () => Config.aplicar(btn.dataset.pref, btn.dataset.valor));
  });

  // ── Fechar config ──────────────────────────────────────────────────────────
  document.getElementById('btn-fechar-config')
    .addEventListener('click', () => Config.fechar());

  // ── Continuar leitura ──────────────────────────────────────────────────────
  document.getElementById('btn-continuar')
    .addEventListener('click', () => {
      const ultimo = Estado.get('ultimoItem');
      if (ultimo) Leitura.abrir(ultimo);
    });

  // ── Reiniciar leitura / Ciclos ─────────────────────────────────────────────
  const btnResetar = document.getElementById('btn-resetar-leitura');
  if (btnResetar) {
    btnResetar.addEventListener('click', () => LeituraCiclos.abrirModalReset());
  }

  const btnCancelarReset = document.getElementById('btn-cancelar-reset');
  if (btnCancelarReset) {
    btnCancelarReset.addEventListener('click', () => LeituraCiclos.fecharModalReset());
  }

  const btnConfirmarReset = document.getElementById('btn-confirmar-reset');
  if (btnConfirmarReset) {
    btnConfirmarReset.addEventListener('click', () => LeituraCiclos.reiniciar());
  }

  const modalReset = document.getElementById('modal-reset');
  if (modalReset) {
    modalReset.addEventListener('click', e => {
      if (e.target === modalReset) LeituraCiclos.fecharModalReset();
    });
  }

  // ── Voltar da leitura ──────────────────────────────────────────────────────
  document.getElementById('btn-voltar')
    .addEventListener('click', () => Leitura.fechar());

  // ── Favorito na leitura ────────────────────────────────────────────────────
  document.getElementById('btn-fav-leitura')
    .addEventListener('click', () => Leitura.alternarFavorito());

  // ── Status select ──────────────────────────────────────────────────────────
  document.getElementById('leitura-status-select')
    .addEventListener('change', e => Leitura.salvarStatus(e.target.value));

  // ── Botão Concluir no rodapé ───────────────────────────────────────────────
  const btnConcluirNav = document.getElementById('btn-concluir-leitura');
  if (btnConcluirNav) {
    btnConcluirNav.addEventListener('click', () => {
      const id = Estado.get('eventoAtual');
      if (!id) return;
      const prog = Estado.get('progresso');
      const statusAtual = prog[id] || 'nao-iniciado';
      const novoStatus = statusAtual === 'concluido' ? 'em-leitura' : 'concluido';
      Leitura.salvarStatus(novoStatus);
      if (novoStatus === 'concluido') {
        const total = Estado.get('cronologia').length;
        const concluidos = Utils.contarConcluidos();
        if (total > 0 && concluidos === total) {
          Utils.toast('🎉 Parabéns! Todos os Evangelhos foram concluídos!');
        } else {
          Utils.toast('Leitura concluída! ●');
        }
      } else {
        Utils.toast('Marcado como em leitura ◐');
      }
    });
  }

  // ── Anotação ───────────────────────────────────────────────────────────────
  const inputAnotacao = document.getElementById('anotacao-input');
  inputAnotacao.addEventListener('input', () => {
    clearTimeout(Leitura._anotacaoTimer);
    Leitura._anotacaoTimer = setTimeout(
      () => Leitura.salvarAnotacao(inputAnotacao.value), 800
    );
  });

  // ── Navegação anterior/próximo ─────────────────────────────────────────────
  document.getElementById('btn-ant')
    .addEventListener('click', () => Leitura.ir(-1));
  document.getElementById('btn-prox')
    .addEventListener('click', () => Leitura.ir(+1));

  // ── Navbar abas ───────────────────────────────────────────────────────────
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => irParaAba(el.dataset.aba));
  });

  // ── Swipe para fechar a tela de leitura ───────────────────────────────────
  let touchStartX = 0;
  const telaLeitura = document.getElementById('tela-leitura');
  telaLeitura.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  telaLeitura.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (dx > 80) Leitura.fechar();
  }, { passive: true });

  // ── Hardware back button (Android) ────────────────────────────────────────
  window.addEventListener('popstate', () => {
    if (Estado.get('eventoAtual')) Leitura.fechar();
  });
  history.pushState(null, '');
}

/* ─── Entry point ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', inicializar);
