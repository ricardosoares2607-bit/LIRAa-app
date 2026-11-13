import React, { useEffect, useRef, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  auth,
  db,
  signInWithGoogle,
  logoutFirebase,
  testConnection,
  pushReconhecimentoToRtdb,
  fetchReconhecimentoFromRtdb,
  subscribeReconhecimentoRtdb,
  ReconhecimentoPayload,
  ReconhecimentoLinha
} from './firebase';

declare global {
  interface Window {
    html2canvas?: any;
    jspdf?: any;
    jsPDF?: any;
    gerarPDF?: () => void;
    exportarBackup?: () => void;
    importarBackup?: (evento: any) => void;
    limparSelecoes?: () => void;
    limparTudo?: () => void;
  }
}

function limparNumeroStr(val: any): string {
  if (val === undefined || val === null) return '';
  const s = String(val).trim();
  if (!s) return '';
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    return s.replace(/\./g, '');
  }
  return s;
}

function normalizarReconhecimentoParaBridge(raw: any): ReconhecimentoPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw.resumo_reconhecimento && typeof raw.resumo_reconhecimento === 'object' ? raw.resumo_reconhecimento : raw;
  const cab = src.cabecalho || src;

  const mapear = (item: any, idxPadrao: number): ReconhecimentoLinha => {
    if (!item || typeof item !== 'object') {
      return { quarteirao: String(idxPadrao), r: '', c: '', tb: '', pe: '', o: '' };
    }
    const q = String(item.quarteirao ?? item.Quarteirao ?? item.numero ?? item.num ?? idxPadrao).trim() || String(idxPadrao);
    return {
      quarteirao: q,
      r: limparNumeroStr(item.r ?? item.R ?? ''),
      c: limparNumeroStr(item.c ?? item.C ?? ''),
      tb: limparNumeroStr(item.tb ?? item.TB ?? ''),
      pe: limparNumeroStr(item.pe ?? item.PE ?? ''),
      o: limparNumeroStr(item.o ?? item.O ?? '')
    };
  };

  const toList = (col: any): any[] => {
    if (!col) return [];
    if (Array.isArray(col)) return col;
    if (typeof col === 'object') {
      return Object.keys(col)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => col[k]);
    }
    return [];
  };

  const l1 = toList(src.tabela1 || src.tabela_1 || src.tab1);
  const l2 = toList(src.tabela2 || src.tabela_2 || src.tab2);

  const tabela1: ReconhecimentoLinha[] = [];
  const tabela2: ReconhecimentoLinha[] = [];
  for (let i = 0; i < 32; i++) {
    tabela1.push(mapear(l1[i], i + 1));
    tabela2.push(mapear(l2[i], i + 33));
  }

  return {
    cabecalho: {
      uf: String(cab.uf || cab.UF || ''),
      distrito: String(cab.distrito || cab.Distrito || ''),
      municipio: String(cab.municipio || cab.Municipio || ''),
      localidade: String(cab.localidade || cab.Localidade || ''),
      subdistrito: String(cab.subdistrito || cab.Subdistrito || ''),
      sublocal: String(cab.sublocal || cab.Sublocal || ''),
      categoria: String(cab.categoria || cab.Categoria || '')
    },
    tabela1,
    tabela2
  };
}

function contarPreenchidosBridge(rec: ReconhecimentoPayload | null): number {
  if (!rec) return 0;
  let total = 0;
  [...rec.tabela1, ...rec.tabela2].forEach((l) => {
    if (l.r !== '' || l.c !== '' || l.tb !== '' || l.pe !== '' || l.o !== '') total++;
  });
  return total;
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pmcdIframeRef = useRef<HTMLIFrameElement>(null);

  const [activeModule, setActiveModule] = useState<'pmcd' | 'liraa'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const m = params.get('modulo');
      if (m === 'liraa' || m === 'pmcd') return m;
      const saved = localStorage.getItem('sistema_integrado_modulo_ativo');
      if (saved === 'liraa' || saved === 'pmcd') return saved;
    } catch {
      // ignore
    }
    return 'pmcd';
  });

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cloudStatus, setCloudStatus] = useState<'sincronizado' | 'salvando' | 'offline' | 'desconectado'>('desconectado');
  const [pmcdSyncStatus, setPmcdSyncStatus] = useState<'conectado' | 'sincronizando' | 'local'>('local');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  const pmcdIframeSrc = React.useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const qs = params.toString();
    const metaEnv = (import.meta as unknown as { env?: { BASE_URL?: string } }).env;
    const baseUrl = metaEnv?.BASE_URL || './';
    const path = `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}pmcd-campo.html`;
    return qs ? `${path}?${qs}` : path;
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr));
    }, 3500);
  };

  // References for functions accessible across effect and handlers
  const coletarDadosRef = useRef<() => any>(() => null);
  const restaurarDadosRef = useRef<(dados: any) => void>(() => {});
  const aplicarReconhecimentoRef = useRef<(rec: any, silent?: boolean) => void>(() => {});
  const converterParaReconhecimentoRef = useRef<(dados: any) => ReconhecimentoPayload | null>(() => null);
  const ultimaAssinaturaSyncRef = useRef<string>('');
  const bloqueioSyncLoopRef = useRef<boolean>(false);

  const handleSelectModule = (mod: 'pmcd' | 'liraa', pmcdAba?: string) => {
    setActiveModule(mod);
    try {
      localStorage.setItem('sistema_integrado_modulo_ativo', mod);
    } catch {
      // ignore
    }
    if (mod === 'pmcd' && pmcdAba && pmcdIframeRef.current?.contentWindow) {
      try {
        pmcdIframeRef.current.contentWindow.postMessage(
          { type: 'PMCD_SWITCH_TAB', aba: pmcdAba },
          window.location.origin
        );
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    testConnection();

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
      if (user) {
        setCloudStatus('salvando');
        try {
          const docId = `liraa_${user.uid}`;
          const docSnap = await getDoc(doc(db, 'liraa_forms', docId));
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (restaurarDadosRef.current && data) {
              restaurarDadosRef.current(data);
            }
            setCloudStatus('sincronizado');
          } else {
            // Document doesn't exist yet in cloud: sync current local data to cloud
            const localData = coletarDadosRef.current();
            if (localData && localData.cabecalho) {
              await setDoc(doc(db, 'liraa_forms', docId), {
                id: docId,
                ownerId: user.uid,
                cabecalho: localData.cabecalho,
                linhas: localData.linhas,
                updatedAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
              });
            }
            setCloudStatus('sincronizado');
          }
        } catch (err) {
          console.warn('Erro ao carregar do Firestore:', err);
          setCloudStatus('offline');
        }
      } else {
        setCloudStatus('desconectado');
      }
    });

    // Bridge: escuta mensagens do módulo PMCD (iframe) e alterações em tempo real no RTDB compartilhado
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'PMCD_READY') {
        setPmcdSyncStatus('conectado');
        // Se LIRAa já tiver dados preenchidos e PMCD estiver vazio, envia LIRAa -> PMCD
        const liraaAtual = coletarDadosRef.current();
        const liraaRec = converterParaReconhecimentoRef.current(liraaAtual);
        const pmcdRec = normalizarReconhecimentoParaBridge(msg.payload);
        if (liraaRec && contarPreenchidosBridge(liraaRec) > 0 && contarPreenchidosBridge(pmcdRec) === 0) {
          try {
            pmcdIframeRef.current?.contentWindow?.postMessage(
              { type: 'LIRAA_SYNC_RECONHECIMENTO', payload: liraaRec },
              window.location.origin
            );
          } catch {
            // ignore
          }
        }
      } else if (msg.type === 'PMCD_RECONHECIMENTO_UPDATED' && msg.payload) {
        const norm = normalizarReconhecimentoParaBridge(msg.payload);
        if (!norm) return;
        const sig = JSON.stringify(norm);
        if (sig === ultimaAssinaturaSyncRef.current) return;
        ultimaAssinaturaSyncRef.current = sig;
        aplicarReconhecimentoRef.current(norm, true);
        setPmcdSyncStatus('conectado');
      }
    };

    window.addEventListener('message', handleMessage);

    let firstRtdbEmit = true;
    const unsubscribeRtdb = subscribeReconhecimentoRtdb((raw) => {
      const norm = normalizarReconhecimentoParaBridge(raw);
      if (!norm) return;
      setPmcdSyncStatus('conectado');
      const sig = JSON.stringify(norm);
      if (sig === ultimaAssinaturaSyncRef.current) {
        firstRtdbEmit = false;
        return;
      }

      // Na carga inicial, só preenche LIRAa automaticamente se LIRAa ainda estiver vazio nas linhas 1-64
      const atualLiraa = converterParaReconhecimentoRef.current(coletarDadosRef.current());
      const qAtual = contarPreenchidosBridge(atualLiraa);
      const qNuvem = contarPreenchidosBridge(norm);

      if (firstRtdbEmit) {
        firstRtdbEmit = false;
        if (qAtual === 0 && qNuvem > 0) {
          ultimaAssinaturaSyncRef.current = sig;
          aplicarReconhecimentoRef.current(norm, true);
        }
        return;
      }

      if (qNuvem > 0 || qAtual === 0) {
        ultimaAssinaturaSyncRef.current = sig;
        aplicarReconhecimentoRef.current(norm, true);
      }
    });

    return () => {
      unsubscribeAuth();
      window.removeEventListener('message', handleMessage);
      unsubscribeRtdb();
    };
  }, []);

  useEffect(() => {
    const STORAGE_KEY = 'LIRAA_FORM_DATA_STORAGE';
    const NUM_LINHAS = 32;
    const NUM_COLUNAS = 9;
    const COLUNAS_SOMA = [2, 3, 4, 5, 6];
    const COL_TOTAL_LINHA = 7;
    const COL_LIRAA = 8;
    const selecionadas = new Map<string, HTMLTableRowElement>();

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    function criarLinhas(tabelaId: string) {
      const tabela = document.querySelector<HTMLTableElement>(`#${tabelaId}`);
      if (!tabela) return;
      const tbody = tabela.querySelector('tbody');
      if (!tbody) return;
      const offset = parseInt(tabela.dataset.offset || '0', 10) || 0;
      tbody.innerHTML = '';

      for (let i = 1; i <= NUM_LINHAS; i++) {
        const numeroPosicao = offset + i;
        const tr = document.createElement('tr');
        tr.dataset.tabela = tabelaId;
        tr.dataset.linha = i.toString();
        tr.dataset.posicao = numeroPosicao.toString();

        for (let c = 0; c < NUM_COLUNAS; c++) {
          const td = document.createElement('td');
          if (c === 0) {
            td.textContent = numeroPosicao.toString();
            td.classList.add('posicao');
            td.addEventListener('click', () => toggleLinha(tr));
          } else if (c === COL_TOTAL_LINHA) {
            td.classList.add('total-linha');
          } else if (c === COL_LIRAA) {
            td.classList.add('liraa-calc');
          } else {
            td.classList.add('editavel');
            td.setAttribute('contenteditable', 'true');
            td.setAttribute('spellcheck', 'false');
          }
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }

      const trTotal = document.createElement('tr');
      trTotal.classList.add('total');
      trTotal.dataset.tabela = tabelaId;

      const tdTotalLabel = document.createElement('td');
      tdTotalLabel.colSpan = 2;
      tdTotalLabel.textContent = 'TOTAL';
      trTotal.appendChild(tdTotalLabel);

      for (let c = 2; c < NUM_COLUNAS; c++) {
        const td = document.createElement('td');
        td.dataset.col = c.toString();
        trTotal.appendChild(td);
      }
      tbody.appendChild(trTotal);
    }

    ['tabela-1', 'tabela-2', 'tabela-3', 'tabela-4'].forEach(criarLinhas);

    function calcularLiraa(total: number): string {
      if (total <= 0) return '';
      return String(Math.ceil(total / 5)).padStart(2, '0');
    }

    function recalcularTotalLinha(tr: HTMLTableRowElement) {
      if (tr.classList.contains('total')) return;
      const valores = COLUNAS_SOMA.map((c) => {
        const cel = tr.children[c] as HTMLElement;
        const v = parseInt(cel.textContent?.trim() || '', 10);
        return isNaN(v) ? 0 : v;
      });
      const soma = valores.reduce((a, b) => a + b, 0);
      (tr.children[COL_TOTAL_LINHA] as HTMLElement).textContent = soma > 0 ? soma.toString() : '';
      (tr.children[COL_LIRAA] as HTMLElement).textContent = calcularLiraa(soma);
    }

    function recalcularTotalTabela(tabelaId: string) {
      const tabela = document.querySelector<HTMLTableElement>(`#${tabelaId}`);
      if (!tabela) return;
      const tbody = tabela.querySelector('tbody');
      if (!tbody) return;
      const linhas = Array.from(tbody.querySelectorAll<HTMLTableRowElement>('tr:not(.total)'));
      const trTotal = tbody.querySelector<HTMLTableRowElement>('tr.total');
      if (!trTotal) return;

      const somas: Record<number, number> = {};
      COLUNAS_SOMA.forEach((c) => (somas[c] = 0));
      let somaTotalGeral = 0;
      let somaLiraa = 0;

      linhas.forEach((tr) => {
        COLUNAS_SOMA.forEach((c) => {
          const v = parseInt((tr.children[c] as HTMLElement).textContent?.trim() || '', 10);
          if (!isNaN(v)) somas[c] += v;
        });
        const t = parseInt((tr.children[COL_TOTAL_LINHA] as HTMLElement).textContent?.trim() || '', 10);
        if (!isNaN(t)) somaTotalGeral += t;
        const l = parseInt((tr.children[COL_LIRAA] as HTMLElement).textContent?.trim() || '', 10);
        if (!isNaN(l)) somaLiraa += l;
      });

      COLUNAS_SOMA.forEach((c) => {
        const td = trTotal.querySelector<HTMLElement>(`td[data-col="${c}"]`);
        if (td) td.textContent = somas[c] > 0 ? somas[c].toString() : '';
      });
      const tdTotal = trTotal.querySelector<HTMLElement>(`td[data-col="${COL_TOTAL_LINHA}"]`);
      if (tdTotal) tdTotal.textContent = somaTotalGeral > 0 ? somaTotalGeral.toString() : '';
      const tdLiraa = trTotal.querySelector<HTMLElement>(`td[data-col="${COL_LIRAA}"]`);
      if (tdLiraa) tdLiraa.textContent = somaLiraa > 0 ? String(somaLiraa).padStart(2, '0') : '';

      recalcularResumoGeral();
      atualizarContagemQuarteiroes();
    }

    function recalcularResumoGeral() {
      let totR = 0,
        totC = 0,
        totTB = 0,
        totPE = 0,
        totO = 0;

      ['tabela-1', 'tabela-2', 'tabela-3', 'tabela-4'].forEach((id) => {
        const tb = document.getElementById(id);
        if (!tb) return;
        const trTotal = tb.querySelector('tr.total');
        if (!trTotal) return;

        totR += parseInt(trTotal.querySelector('td[data-col="2"]')?.textContent || '0', 10) || 0;
        totC += parseInt(trTotal.querySelector('td[data-col="3"]')?.textContent || '0', 10) || 0;
        totTB += parseInt(trTotal.querySelector('td[data-col="4"]')?.textContent || '0', 10) || 0;
        totPE += parseInt(trTotal.querySelector('td[data-col="5"]')?.textContent || '0', 10) || 0;
        totO += parseInt(trTotal.querySelector('td[data-col="6"]')?.textContent || '0', 10) || 0;
      });

      const geral = totR + totC + totTB + totPE + totO;
      const elR = document.getElementById('resumo-r');
      const elC = document.getElementById('resumo-c');
      const elTB = document.getElementById('resumo-tb');
      const elPE = document.getElementById('resumo-pe');
      const elO = document.getElementById('resumo-o');
      const elTotal = document.getElementById('resumo-total');

      if (elR) elR.textContent = totR.toString();
      if (elC) elC.textContent = totC.toString();
      if (elTB) elTB.textContent = totTB.toString();
      if (elPE) elPE.textContent = totPE.toString();
      if (elO) elO.textContent = totO.toString();
      if (elTotal) elTotal.textContent = geral.toString();
    }

    function atualizarContagemQuarteiroes() {
      let contagem = 0;
      document.querySelectorAll<HTMLTableRowElement>('.tabela-dados tbody tr:not(.total)').forEach((tr) => {
        const quart = (tr.children[1] as HTMLElement).textContent?.trim() || '';
        const total = (tr.children[COL_TOTAL_LINHA] as HTMLElement).textContent?.trim() || '';
        if (quart !== '' || total !== '') contagem++;
      });
      document.querySelectorAll('.campo-total-quarteiroes').forEach((el) => {
        el.textContent = contagem.toString();
      });
    }

    function recalcularTodosOsTotais() {
      ['tabela-1', 'tabela-2', 'tabela-3', 'tabela-4'].forEach(recalcularTotalTabela);
    }

    const handleSyncInput = (e: Event) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-sync]');
      if (!target) return;
      const chave = target.dataset.sync;
      const texto = target.textContent || '';

      document.querySelectorAll<HTMLElement>(`[data-sync="${chave}"]`).forEach((campo) => {
        if (campo !== target) campo.textContent = texto;
      });
      salvarNoLocalStorage();
    };

    document.addEventListener('input', handleSyncInput);

    function colarDoExcel(evento: ClipboardEvent, tabela: HTMLTableElement) {
      const texto = (evento.clipboardData || (window as any).clipboardData)?.getData('text/plain');
      if (!texto) return;
      evento.preventDefault();

      const linhasTexto = texto.replace(/\r/g, '').split('\n').filter((l) => l.length > 0);
      const alvo = (evento.target as HTMLElement).closest('td');
      if (!alvo) return;

      const tbody = tabela.querySelector('tbody');
      if (!tbody) return;
      const trAlvo = alvo.parentElement as HTMLTableRowElement;
      const todasAsLinhas = Array.from(tbody.querySelectorAll<HTMLTableRowElement>('tr:not(.total)'));
      const idxLinhaIni = todasAsLinhas.indexOf(trAlvo);
      const idxColIni = Array.from(trAlvo.children).indexOf(alvo);
      if (idxLinhaIni < 0) return;

      linhasTexto.forEach((linhaStr, i) => {
        const idxLinha = idxLinhaIni + i;
        if (idxLinha >= todasAsLinhas.length) return;
        const celulas = linhaStr.split('\t');
        const tr = todasAsLinhas[idxLinha];

        celulas.forEach((valor, j) => {
          const idxCol = idxColIni + j;
          if (idxCol >= NUM_COLUNAS || idxCol === 0 || idxCol === COL_TOTAL_LINHA || idxCol === COL_LIRAA) return;
          (tr.children[idxCol] as HTMLElement).textContent = valor.trim();
        });
        recalcularTotalLinha(tr);
      });

      recalcularTotalTabela(tabela.id);
      atualizarTabelaLiraa();
      salvarNoLocalStorage();
    }

    function chaveLinha(tr: HTMLTableRowElement) {
      return tr.dataset.posicao || '';
    }

    function toggleLinha(tr: HTMLTableRowElement) {
      const chave = chaveLinha(tr);
      if (selecionadas.has(chave)) {
        tr.classList.remove('selecionada');
        selecionadas.delete(chave);
      } else {
        tr.classList.add('selecionada');
        selecionadas.set(chave, tr);
      }
      atualizarTabelaLiraa();
      salvarNoLocalStorage();
    }

    function atualizarTabelaLiraa() {
      const tbodyLiraa = document.querySelector('#tabela-liraa tbody');
      if (!tbodyLiraa) return;
      tbodyLiraa.innerHTML = '';

      const lista = Array.from(selecionadas.values()).sort(
        (a, b) => parseInt(a.dataset.posicao || '0', 10) - parseInt(b.dataset.posicao || '0', 10)
      );

      const campoTotalSel = document.getElementById('total-quarteiroes-selecionados');
      if (campoTotalSel) campoTotalSel.textContent = lista.length.toString();

      if (lista.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = NUM_COLUNAS;
        td.textContent = 'Nenhum quarteirão selecionado ainda.';
        td.classList.add('vazio');
        tr.appendChild(td);
        tbodyLiraa.appendChild(tr);
        return;
      }

      lista.forEach((origem) => {
        const tr = document.createElement('tr');
        for (let i = 0; i < NUM_COLUNAS; i++) {
          const td = document.createElement('td');
          td.textContent = origem.children[i].textContent;
          if (i === 0) td.classList.add('posicao');
          if (i === COL_TOTAL_LINHA) td.classList.add('total-linha');
          if (i === COL_LIRAA) td.classList.add('liraa-calc');
          tr.appendChild(td);
        }
        tbodyLiraa.appendChild(tr);
      });
    }

    window.limparSelecoes = function () {
      selecionadas.forEach((tr) => tr.classList.remove('selecionada'));
      selecionadas.clear();
      atualizarTabelaLiraa();
      salvarNoLocalStorage();
    };

    const selecaoBloco: {
      tabela: HTMLTableElement | null;
      ancora: HTMLTableCellElement | null;
      foco: HTMLTableCellElement | null;
    } = {
      tabela: null,
      ancora: null,
      foco: null
    };

    function indiceDaCelula(tabela: HTMLTableElement, td: HTMLTableCellElement) {
      const tr = td.parentElement as HTMLTableRowElement;
      const tbody = tr.parentElement as HTMLElement;
      const linhas = Array.from(tbody.querySelectorAll<HTMLTableRowElement>('tr:not(.total)'));
      const linhaIdx = linhas.indexOf(tr);
      const colIdx = Array.from(tr.children).indexOf(td);
      return { linhaIdx, colIdx };
    }

    function celulaPorIndice(tabela: HTMLTableElement, linhaIdx: number, colIdx: number): HTMLTableCellElement | null {
      const tbody = tabela.querySelector('tbody');
      if (!tbody) return null;
      const linhas = Array.from(tbody.querySelectorAll<HTMLTableRowElement>('tr:not(.total)'));
      const tr = linhas[linhaIdx];
      if (!tr) return null;
      return (tr.children[colIdx] as HTMLTableCellElement) || null;
    }

    function limparSelecaoBloco() {
      document
        .querySelectorAll('td.celula-selecionada, td.celula-ancora')
        .forEach((td) => td.classList.remove('celula-selecionada', 'celula-ancora'));
      selecaoBloco.tabela = null;
      selecaoBloco.ancora = null;
      selecaoBloco.foco = null;
    }

    function aplicarSelecaoBloco() {
      if (!selecaoBloco.tabela || !selecaoBloco.ancora || !selecaoBloco.foco) return;

      document
        .querySelectorAll('td.celula-selecionada, td.celula-ancora')
        .forEach((td) => td.classList.remove('celula-selecionada', 'celula-ancora'));

      const a = indiceDaCelula(selecaoBloco.tabela, selecaoBloco.ancora);
      const b = indiceDaCelula(selecaoBloco.tabela, selecaoBloco.foco);
      const lMin = Math.min(a.linhaIdx, b.linhaIdx);
      const lMax = Math.max(a.linhaIdx, b.linhaIdx);
      const cMin = Math.min(a.colIdx, b.colIdx);
      const cMax = Math.max(a.colIdx, b.colIdx);

      for (let l = lMin; l <= lMax; l++) {
        for (let c = cMin; c <= cMax; c++) {
          const td = celulaPorIndice(selecaoBloco.tabela, l, c);
          if (td && td.classList.contains('editavel')) {
            td.classList.add('celula-selecionada');
          }
        }
      }
      selecaoBloco.ancora.classList.add('celula-ancora');
    }

    function copiarSelecaoBloco(cortar: boolean) {
      if (!selecaoBloco.tabela || !selecaoBloco.ancora || !selecaoBloco.foco) return null;

      const a = indiceDaCelula(selecaoBloco.tabela, selecaoBloco.ancora);
      const b = indiceDaCelula(selecaoBloco.tabela, selecaoBloco.foco);
      const lMin = Math.min(a.linhaIdx, b.linhaIdx);
      const lMax = Math.max(a.linhaIdx, b.linhaIdx);
      const cMin = Math.min(a.colIdx, b.colIdx);
      const cMax = Math.max(a.colIdx, b.colIdx);

      const linhasArr: string[] = [];
      const celulasAfetadas: HTMLTableCellElement[] = [];
      for (let l = lMin; l <= lMax; l++) {
        const cols: string[] = [];
        for (let c = cMin; c <= cMax; c++) {
          const td = celulaPorIndice(selecaoBloco.tabela, l, c);
          cols.push(td ? td.textContent || '' : '');
          if (cortar && td && td.classList.contains('editavel')) {
            celulasAfetadas.push(td);
          }
        }
        linhasArr.push(cols.join('\t'));
      }
      return { texto: linhasArr.join('\n'), celulasAfetadas };
    }

    function copiarParaClipboard(texto: string) {
      if (!texto) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).catch(() => fallbackCopiar(texto));
      } else {
        fallbackCopiar(texto);
      }
    }

    function fallbackCopiar(texto: string) {
      const ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch (e) {}
      ta.remove();
    }

    function colarNaSelecaoBloco(texto: string): boolean {
      if (!selecaoBloco.tabela || !selecaoBloco.ancora) return false;

      const linhasArr = texto.replace(/\r/g, '').split('\n').filter((l) => l.length > 0);
      if (linhasArr.length === 0) return false;

      const a = indiceDaCelula(selecaoBloco.tabela, selecaoBloco.ancora);
      const linhasTabela = Array.from(
        selecaoBloco.tabela.querySelectorAll<HTMLTableRowElement>('tbody tr:not(.total)')
      );

      let alterou = false;
      linhasArr.forEach((linhaStr, i) => {
        const tr = linhasTabela[a.linhaIdx + i];
        if (!tr) return;
        const celulas = linhaStr.split('\t');
        celulas.forEach((valor, j) => {
          const td = tr.children[a.colIdx + j] as HTMLTableCellElement;
          if (!td || !td.classList.contains('editavel')) return;
          td.textContent = valor.trim();
          alterou = true;
        });
        recalcularTotalLinha(tr);
      });

      if (alterou) {
        recalcularTotalTabela(selecaoBloco.tabela.id);
        atualizarTabelaLiraa();
        salvarNoLocalStorage();
      }
      return alterou;
    }

    function apagarSelecaoBloco() {
      const dados = copiarSelecaoBloco(true);
      if (!dados) return;
      dados.celulasAfetadas.forEach((td) => {
        td.textContent = '';
        recalcularTotalLinha(td.parentElement as HTMLTableRowElement);
      });
      if (selecaoBloco.tabela) {
        recalcularTotalTabela(selecaoBloco.tabela.id);
      }
      atualizarTabelaLiraa();
      salvarNoLocalStorage();
    }

    function temSelecaoBloco(): boolean {
      return !!(selecaoBloco.tabela && selecaoBloco.ancora && selecaoBloco.foco);
    }

    const menuCtx = document.getElementById('menu-contexto') as HTMLElement;
    const caixaColar = document.getElementById('caixa-colar') as HTMLElement;
    const caixaColarTexto = document.getElementById('caixa-colar-texto') as HTMLTextAreaElement;

    function abrirMenuContexto(x: number, y: number) {
      if (!menuCtx) return;
      menuCtx.classList.add('aberto');
      const rect = menuCtx.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = x;
      let top = y;
      if (left + rect.width > vw - 6) left = vw - rect.width - 6;
      if (top + rect.height > vh - 6) top = vh - rect.height - 6;
      if (left < 6) left = 6;
      if (top < 6) top = 6;
      menuCtx.style.left = left + 'px';
      menuCtx.style.top = top + 'px';
    }

    function fecharMenuContexto() {
      if (menuCtx) menuCtx.classList.remove('aberto');
    }

    function abrirCaixaColar() {
      if (!caixaColar || !caixaColarTexto) return;
      caixaColar.classList.add('aberto');
      caixaColarTexto.value = '';
      let x = window.innerWidth / 2 - 170;
      let y = window.innerHeight / 2 - 110;
      if (temSelecaoBloco() && selecaoBloco.ancora) {
        const r = selecaoBloco.ancora.getBoundingClientRect();
        x = Math.min(Math.max(8, r.left), window.innerWidth - 350);
        y = Math.min(Math.max(8, r.bottom + 6), window.innerHeight - 260);
      }
      caixaColar.style.left = x + 'px';
      caixaColar.style.top = y + 'px';
      setTimeout(() => caixaColarTexto.focus(), 60);
    }

    function fecharCaixaColar() {
      if (caixaColar) caixaColar.classList.remove('aberto');
      if (caixaColarTexto) caixaColarTexto.value = '';
    }

    function aplicarColarDaCaixa() {
      if (!caixaColarTexto) return;
      const texto = caixaColarTexto.value;
      if (!texto) {
        fecharCaixaColar();
        return;
      }
      if (!temSelecaoBloco()) {
        alert('Selecione primeiro as células de destino (arraste com o dedo ou o mouse).');
        return;
      }
      colarNaSelecaoBloco(texto);
      fecharCaixaColar();
    }

    if (menuCtx) {
      menuCtx.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('button[data-acao]');
        if (!btn) return;
        const acao = btn.dataset.acao;

        if (acao === 'copiar') {
          const dados = copiarSelecaoBloco(false);
          if (dados) copiarParaClipboard(dados.texto);
        } else if (acao === 'recortar') {
          const dados = copiarSelecaoBloco(true);
          if (dados) {
            copiarParaClipboard(dados.texto);
            dados.celulasAfetadas.forEach((cel) => {
              cel.textContent = '';
              recalcularTotalLinha(cel.parentElement as HTMLTableRowElement);
            });
            if (selecaoBloco.tabela) {
              recalcularTotalTabela(selecaoBloco.tabela.id);
              atualizarTabelaLiraa();
              salvarNoLocalStorage();
            }
          }
        } else if (acao === 'colar') {
          abrirCaixaColar();
        } else if (acao === 'limpar') {
          apagarSelecaoBloco();
        }
        fecharMenuContexto();
      });
    }

    if (caixaColar) {
      caixaColar.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('button[data-acao]');
        if (!btn) return;
        if (btn.dataset.acao === 'aplicar') aplicarColarDaCaixa();
        else fecharCaixaColar();
      });
    }

    if (caixaColarTexto) {
      caixaColarTexto.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          aplicarColarDaCaixa();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          fecharCaixaColar();
        }
      });
    }

    const handleScroll = () => {
      fecharMenuContexto();
    };
    window.addEventListener('scroll', handleScroll, true);

    const handleDocumentKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        fecharMenuContexto();
        fecharCaixaColar();
      }
    };
    document.addEventListener('keydown', handleDocumentKeyDown);

    let arrastando = false;

    document.querySelectorAll<HTMLTableElement>('.tabela-dados').forEach((tabela) => {
      tabela.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const td = (e.target as HTMLElement).closest<HTMLTableCellElement>('td.editavel');
        if (!td) return;

        if (e.shiftKey && selecaoBloco.tabela === tabela && selecaoBloco.ancora) {
          e.preventDefault();
          selecaoBloco.foco = td;
          aplicarSelecaoBloco();
          return;
        }

        arrastando = true;
        selecaoBloco.tabela = tabela;
        selecaoBloco.ancora = td;
        selecaoBloco.foco = td;
        aplicarSelecaoBloco();
        td.focus({ preventScroll: true });
      });

      tabela.addEventListener('mouseover', (e) => {
        if (!arrastando || !selecaoBloco.tabela) return;
        const td = (e.target as HTMLElement).closest<HTMLTableCellElement>('td.editavel');
        if (!td || td === selecaoBloco.foco) return;
        selecaoBloco.foco = td;
        aplicarSelecaoBloco();
      });

      tabela.addEventListener('contextmenu', (e) => {
        const td = (e.target as HTMLElement).closest<HTMLTableCellElement>('td.editavel');
        if (!td) return;

        if (!isTouchDevice) {
          if (td.classList.contains('celula-selecionada') || td.classList.contains('celula-ancora')) {
            e.preventDefault();
            abrirMenuContexto(e.clientX, e.clientY);
            return;
          }
          limparSelecaoBloco();
        }
      });

      tabela.addEventListener('keydown', (e) => {
        const td = (e.target as HTMLElement).closest<HTMLTableCellElement>('td.editavel');
        if (!td) return;

        const ctrl = e.ctrlKey || e.metaKey;
        const tecla = e.key.toLowerCase();

        if (ctrl && tecla === 'c' && temSelecaoBloco()) {
          e.preventDefault();
          const dados = copiarSelecaoBloco(false);
          if (dados) copiarParaClipboard(dados.texto);
          return;
        }

        if (ctrl && tecla === 'x' && temSelecaoBloco()) {
          e.preventDefault();
          const dados = copiarSelecaoBloco(true);
          if (dados) {
            copiarParaClipboard(dados.texto);
            dados.celulasAfetadas.forEach((cel) => {
              cel.textContent = '';
              recalcularTotalLinha(cel.parentElement as HTMLTableRowElement);
            });
            recalcularTotalTabela(tabela.id);
            atualizarTabelaLiraa();
            salvarNoLocalStorage();
          }
          return;
        }

        if (ctrl && tecla === 'v' && temSelecaoBloco()) {
          return;
        }

        if ((e.key === 'Delete' || e.key === 'Backspace') && temSelecaoBloco()) {
          if (!selecaoBloco.tabela || !selecaoBloco.ancora || !selecaoBloco.foco) return;
          const a = indiceDaCelula(selecaoBloco.tabela, selecaoBloco.ancora);
          const b = indiceDaCelula(selecaoBloco.tabela, selecaoBloco.foco);
          const multi = a.linhaIdx !== b.linhaIdx || a.colIdx !== b.colIdx;
          if (multi) {
            e.preventDefault();
            apagarSelecaoBloco();
            return;
          }
        }

        if (e.key === 'Enter') {
          e.preventDefault();
          td.blur();
          return;
        }
        if (e.key === 'Escape') {
          limparSelecaoBloco();
          return;
        }
      });

      tabela.addEventListener('paste', (e) => {
        const td = (e.target as HTMLElement).closest<HTMLTableCellElement>('td.editavel');
        if (!td) return;

        const texto = (e.clipboardData || (window as any).clipboardData)?.getData('text/plain');
        if (!texto) return;

        if (temSelecaoBloco()) {
          e.preventDefault();
          colarNaSelecaoBloco(texto);
          return;
        }

        if (/[\t\n\r]/.test(texto)) {
          colarDoExcel(e, tabela);
          return;
        }
        e.preventDefault();
        document.execCommand('insertText', false, texto);
        salvarNoLocalStorage();
      });

      // ====== TOQUE (tablet/celular) ======
      let timerToqueLongo: any = null;
      let toqueInicialPos: { x: number; y: number } | null = null;
      let tocando = false;
      let moveuToque = false;

      tabela.addEventListener(
        'touchstart',
        (e) => {
          if (e.touches.length !== 1) return;
          const td = (e.target as HTMLElement).closest<HTMLTableCellElement>('td.editavel');
          if (!td) return;

          tocando = true;
          moveuToque = false;
          toqueInicialPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };

          selecaoBloco.tabela = tabela;
          selecaoBloco.ancora = td;
          selecaoBloco.foco = td;
          aplicarSelecaoBloco();

          clearTimeout(timerToqueLongo);
          timerToqueLongo = setTimeout(() => {
            if (!tocando || moveuToque) return;
            const rect = td.getBoundingClientRect();
            abrirMenuContexto(rect.left + rect.width / 2 - 90, rect.bottom + 6);
            tocando = false;
          }, 500);
        },
        { passive: true }
      );

      tabela.addEventListener(
        'touchmove',
        (e) => {
          if (!tocando || !toqueInicialPos) return;
          if (e.touches.length !== 1) return;

          const dx = e.touches[0].clientX - toqueInicialPos.x;
          const dy = e.touches[0].clientY - toqueInicialPos.y;
          if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
            moveuToque = true;
            clearTimeout(timerToqueLongo);
          }

          const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
          const td = el ? el.closest<HTMLTableCellElement>('td.editavel') : null;
          if (td && selecaoBloco.tabela === tabela) {
            if (td !== selecaoBloco.foco) {
              selecaoBloco.foco = td;
              aplicarSelecaoBloco();
            }
            e.preventDefault();
          }
        },
        { passive: false }
      );

      tabela.addEventListener(
        'touchend',
        () => {
          clearTimeout(timerToqueLongo);
          tocando = false;
        },
        { passive: true }
      );

      tabela.addEventListener(
        'touchcancel',
        () => {
          clearTimeout(timerToqueLongo);
          tocando = false;
        },
        { passive: true }
      );
    });

    const handleMouseUp = () => {
      if (arrastando) arrastando = false;
    };
    document.addEventListener('mouseup', handleMouseUp);

    const handleMouseDownGlobal = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (!target.closest('table.tabela-dados') && !target.closest('#menu-contexto') && !target.closest('#caixa-colar')) {
        limparSelecaoBloco();
        fecharMenuContexto();
      }
    };
    document.addEventListener('mousedown', handleMouseDownGlobal);

    const handleTouchStartGlobal = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('table.tabela-dados') && !target.closest('#menu-contexto') && !target.closest('#caixa-colar')) {
        fecharMenuContexto();
      }
    };
    document.addEventListener('touchstart', handleTouchStartGlobal, { passive: true });

    document.querySelectorAll<HTMLTableElement>('.tabela-dados').forEach((tabela) => {
      tabela.addEventListener('input', (e) => {
        const td = (e.target as HTMLElement).closest<HTMLTableCellElement>('td.editavel');
        if (!td) return;
        atualizarLinhaEEntorno(td);
        salvarNoLocalStorage();
      });
    });

    function atualizarLinhaEEntorno(td: HTMLTableCellElement) {
      const tr = td.parentElement as HTMLTableRowElement;
      if (!tr || tr.classList.contains('total')) return;
      recalcularTotalLinha(tr);
      const tabela = tr.closest<HTMLTableElement>('table');
      if (tabela) recalcularTotalTabela(tabela.id);
      if (selecionadas.has(chaveLinha(tr))) atualizarTabelaLiraa();
    }

    let timeoutSalvar: any = null;

    function salvarNoLocalStorage() {
      clearTimeout(timeoutSalvar);
      const statusEl = document.getElementById('status-storage');
      if (statusEl) {
        statusEl.textContent = '⏳ Salvando...';
        statusEl.style.color = '#d97706';
      }

      timeoutSalvar = setTimeout(async () => {
        const dados = coletarDadosCompletos();
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
          if (statusEl) {
            statusEl.textContent = '● Salvo no navegador';
            statusEl.style.color = '#059669';
          }
        } catch (e) {
          if (statusEl) {
            statusEl.textContent = '⚠️ Erro ao salvar';
            statusEl.style.color = '#b91c1c';
          }
        }

        // Sincronização em nuvem com o Firebase Firestore se autenticado
        if (auth.currentUser) {
          try {
            setCloudStatus('salvando');
            const docId = `liraa_${auth.currentUser.uid}`;
            await setDoc(doc(db, 'liraa_forms', docId), {
              id: docId,
              ownerId: auth.currentUser.uid,
              cabecalho: dados.cabecalho,
              linhas: dados.linhas,
              updatedAt: new Date().toISOString()
            }, { merge: true });
            setCloudStatus('sincronizado');
          } catch (cloudErr) {
            console.warn('Erro ao salvar no Firestore:', cloudErr);
            setCloudStatus('offline');
          }
        }

        // Sincronização automática LIRAa -> PMCD (Resumo de Reconhecimento) e RTDB
        if (!bloqueioSyncLoopRef.current) {
          const recPayload = converterLiraaParaReconhecimento(dados);
          if (recPayload) {
            const sig = JSON.stringify(recPayload);
            if (sig !== ultimaAssinaturaSyncRef.current) {
              ultimaAssinaturaSyncRef.current = sig;
              try {
                pmcdIframeRef.current?.contentWindow?.postMessage(
                  { type: 'LIRAA_SYNC_RECONHECIMENTO', payload: recPayload },
                  window.location.origin
                );
              } catch {
                // ignore
              }
              if (contarPreenchidosBridge(recPayload) > 0) {
                setPmcdSyncStatus('sincronizando');
                const ok = await pushReconhecimentoToRtdb(recPayload);
                setPmcdSyncStatus(ok ? 'conectado' : 'local');
              }
            }
          }
        }
      }, 350);
    }

    function coletarDadosCompletos() {
      const cabecalho: Record<string, string> = {};
      document.querySelectorAll<HTMLElement>('[data-sync]').forEach((campo) => {
        if (campo.dataset.sync) {
          cabecalho[campo.dataset.sync] = campo.textContent || '';
        }
      });

      const linhas: Array<{ pos: string; celulas: string[]; isSel: boolean }> = [];
      document.querySelectorAll<HTMLTableRowElement>('.tabela-dados tbody tr:not(.total)').forEach((tr) => {
        const pos = tr.dataset.posicao || '';
        const celulas: string[] = [];
        for (let c = 1; c <= 6; c++) {
          celulas.push(tr.children[c]?.textContent || '');
        }
        const isSel = tr.classList.contains('selecionada');
        linhas.push({ pos, celulas, isSel });
      });

      return { cabecalho, linhas, atualizadoEm: new Date().toISOString() };
    }

    function restaurarDadosCompletos(dados: any) {
      if (!dados) return;

      if (dados.cabecalho) {
        Object.keys(dados.cabecalho).forEach((chave) => {
          document.querySelectorAll<HTMLElement>(`[data-sync="${chave}"]`).forEach((campo) => {
            campo.textContent = dados.cabecalho[chave];
          });
        });
      }

      selecionadas.clear();
      if (dados.linhas && Array.isArray(dados.linhas)) {
        dados.linhas.forEach((item: any) => {
          const tr = document.querySelector<HTMLTableRowElement>(`.tabela-dados tbody tr[data-posicao="${item.pos}"]`);
          if (!tr) return;

          item.celulas.forEach((val: string, idx: number) => {
            if (tr.children[idx + 1]) {
              tr.children[idx + 1].textContent = val;
            }
          });

          recalcularTotalLinha(tr);

          if (item.isSel) {
            tr.classList.add('selecionada');
            selecionadas.set(chaveLinha(tr), tr);
          } else {
            tr.classList.remove('selecionada');
          }
        });
      }

      recalcularTodosOsTotais();
      atualizarTabelaLiraa();
    }

    function converterLiraaParaReconhecimento(dados: any): ReconhecimentoPayload | null {
      if (!dados || typeof dados !== 'object') return null;
      const cab = dados.cabecalho || {};
      const linhas = Array.isArray(dados.linhas) ? dados.linhas : [];

      const byPos = new Map<number, any>();
      linhas.forEach((l: any) => {
        const p = parseInt(String(l.pos || ''), 10);
        if (!isNaN(p) && p >= 1 && p <= 64) {
          byPos.set(p, l);
        }
      });

      const buildRow = (pos: number): ReconhecimentoLinha => {
        const item = byPos.get(pos);
        const cel = Array.isArray(item?.celulas) ? item.celulas : [];
        return {
          quarteirao: String(cel[0] || '').trim() || String(pos),
          r: String(cel[1] || '').trim(),
          c: String(cel[2] || '').trim(),
          tb: String(cel[3] || '').trim(),
          pe: String(cel[4] || '').trim(),
          o: String(cel[5] || '').trim()
        };
      };

      const tabela1: ReconhecimentoLinha[] = [];
      const tabela2: ReconhecimentoLinha[] = [];
      for (let i = 1; i <= 32; i++) tabela1.push(buildRow(i));
      for (let i = 33; i <= 64; i++) tabela2.push(buildRow(i));

      return {
        cabecalho: {
          uf: String(cab.uf || '').trim(),
          distrito: String(cab.distrito || '').trim(),
          municipio: String(cab.municipio || '').trim(),
          localidade: String(cab.localidade || '').trim(),
          subdistrito: String(cab.subdistrito || '').trim(),
          sublocal: String(cab.sublocal || '').trim(),
          categoria: String(cab.categoria || '').trim()
        },
        tabela1,
        tabela2
      };
    }

    function aplicarReconhecimentoNoDOM(recRaw: any, silent = false) {
      const rec = normalizarReconhecimentoParaBridge(recRaw);
      if (!rec) return;

      bloqueioSyncLoopRef.current = true;
      try {
        const cabMap: Record<string, string> = {
          uf: rec.cabecalho.uf,
          distrito: rec.cabecalho.distrito,
          municipio: rec.cabecalho.municipio,
          localidade: rec.cabecalho.localidade,
          subdistrito: rec.cabecalho.subdistrito,
          sublocal: rec.cabecalho.sublocal,
          categoria: rec.cabecalho.categoria
        };

        Object.keys(cabMap).forEach((chave) => {
          if (cabMap[chave] !== undefined) {
            document.querySelectorAll<HTMLElement>(`[data-sync="${chave}"]`).forEach((campo) => {
              if (campo.textContent !== cabMap[chave]) {
                campo.textContent = cabMap[chave];
              }
            });
          }
        });

        const aplicarGrupo = (lista: ReconhecimentoLinha[], offset: number) => {
          lista.forEach((linha, idx) => {
            const pos = offset + idx + 1;
            const tr = document.querySelector<HTMLTableRowElement>(`.tabela-dados tbody tr[data-posicao="${pos}"]`);
            if (!tr) return;
            const qVal = linha.quarteirao && linha.quarteirao !== String(pos) ? linha.quarteirao : '';
            const temImoveis = linha.r !== '' || linha.c !== '' || linha.tb !== '' || linha.pe !== '' || linha.o !== '';
            const valores = [
              temImoveis ? (linha.quarteirao || String(pos)) : qVal,
              linha.r || '',
              linha.c || '',
              linha.tb || '',
              linha.pe || '',
              linha.o || ''
            ];
            valores.forEach((v, cIdx) => {
              const cell = tr.children[cIdx + 1] as HTMLElement;
              if (cell && cell.textContent !== v) {
                cell.textContent = v;
              }
            });
            recalcularTotalLinha(tr);
          });
        };

        aplicarGrupo(rec.tabela1, 0);
        aplicarGrupo(rec.tabela2, 32);
        recalcularTodosOsTotais();
        atualizarTabelaLiraa();

        const dados = coletarDadosCompletos();
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
        } catch {
          // ignore
        }

        if (!silent) {
          showToast(`Dados recebidos do PMCD (${contarPreenchidosBridge(rec)} quarteirões)!`);
        }
      } finally {
        window.setTimeout(() => {
          bloqueioSyncLoopRef.current = false;
        }, 500);
      }
    }

    // Attach to refs so React handlers can use them
    coletarDadosRef.current = coletarDadosCompletos;
    restaurarDadosRef.current = restaurarDadosCompletos;
    aplicarReconhecimentoRef.current = aplicarReconhecimentoNoDOM;
    converterParaReconhecimentoRef.current = converterLiraaParaReconhecimento;

    window.exportarBackup = function () {
      const dados = coletarDadosCompletos();
      const nomeMuni = dados.cabecalho && dados.cabecalho.municipio ? dados.cabecalho.municipio.trim().replace(/\s+/g, '_') : 'LIRAa';
      const dataHora = new Date().toISOString().slice(0, 10);
      const nomeArquivo = `Backup_${nomeMuni}_${dataHora}.json`;

      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivo;
      a.click();
      URL.revokeObjectURL(url);
    };

    window.importarBackup = function (evento: any) {
      const arquivo = evento.target.files[0];
      if (!arquivo) return;

      const leitor = new FileReader();
      leitor.onload = function (e: any) {
        try {
          const dados = JSON.parse(e.target.result);
          restaurarDadosCompletos(dados);
          salvarNoLocalStorage();
          alert('Backup importado com sucesso!');
        } catch (err) {
          alert('Erro ao ler o arquivo de backup. Verifique se é um arquivo .json válido.');
        }
      };
      leitor.readAsText(arquivo);
      evento.target.value = '';
    };

    window.limparTudo = function () {
      if (!confirm('Deseja realmente apagar todos os dados digitados e seleções feitas? Esta ação não pode ser desfeita.')) return;

      document.querySelectorAll<HTMLElement>('[data-sync]').forEach((c) => (c.textContent = ''));
      document.querySelectorAll('.campo-total-quarteiroes').forEach((c) => (c.textContent = '0'));
      const campoSelPg3 = document.getElementById('total-quarteiroes-selecionados');
      if (campoSelPg3) campoSelPg3.textContent = '0';

      document.querySelectorAll<HTMLTableRowElement>('.tabela-dados tbody tr:not(.total)').forEach((tr) => {
        for (let c = 1; c <= 6; c++) (tr.children[c] as HTMLElement).textContent = '';
        (tr.children[COL_TOTAL_LINHA] as HTMLElement).textContent = '';
        (tr.children[COL_LIRAA] as HTMLElement).textContent = '';
        tr.classList.remove('selecionada');
      });

      selecionadas.clear();
      limparSelecaoBloco();
      recalcularTodosOsTotais();
      atualizarTabelaLiraa();
      localStorage.removeItem(STORAGE_KEY);
      const statusEl = document.getElementById('status-storage');
      if (statusEl) {
        statusEl.textContent = '● Dados limpos';
        statusEl.style.color = '#059669';
      }
    };

    window.gerarPDF = async function () {
      const btn = document.getElementById('btn-pdf-acao') as HTMLButtonElement;
      if (!btn) return;
      const textoOriginal = btn.innerHTML;
      btn.innerHTML = '⏳ Gerando PDF...';
      btn.disabled = true;

      if (document.activeElement && (document.activeElement as HTMLElement).blur) {
        (document.activeElement as HTMLElement).blur();
      }
      limparSelecaoBloco();
      fecharMenuContexto();
      fecharCaixaColar();

      const wrapper = document.querySelector<HTMLElement>('.area-documento-wrapper');
      const scrollAntigo = wrapper ? wrapper.scrollLeft : 0;
      if (wrapper) wrapper.scrollLeft = 0;

      try {
        const jsPDFCtor = (window as any).jspdf && (window as any).jspdf.jsPDF ? (window as any).jspdf.jsPDF : (window as any).jsPDF || null;

        const html2canvasFn = (window as any).html2canvas;

        if (!jsPDFCtor || typeof html2canvasFn !== 'function') {
          throw new Error('Bibliotecas de PDF não carregadas corretamente.');
        }

        const pdf = new jsPDFCtor({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        const folhas = document.querySelectorAll<HTMLElement>('[data-pdf-folha]');
        const A4_LARGURA = 210;
        const MARGEM_LATERAL = 6;
        const MARGEM_SUPERIOR = 6;
        const LARGURA_UTIL = A4_LARGURA - MARGEM_LATERAL * 2;

        for (let i = 0; i < folhas.length; i++) {
          const folha = folhas[i];

          const canvas = await html2canvasFn(folha, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: 1024,
            width: 820,
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.98);
          const imgH = (canvas.height * LARGURA_UTIL) / canvas.width;

          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'JPEG', MARGEM_LATERAL, MARGEM_SUPERIOR, LARGURA_UTIL, imgH);
        }

        pdf.save('Quarteiroes_LIRAa_Imoveis_Bases.pdf');
      } catch (err) {
        console.error('Erro na exportação:', err);
        alert('Ocorreu um erro ao gerar o PDF. Você também pode usar "Imprimir" e salvar em PDF.');
      } finally {
        if (wrapper) wrapper.scrollLeft = scrollAntigo;
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
      }
    };

    const dadosSalvos = localStorage.getItem(STORAGE_KEY);
    if (dadosSalvos) {
      try {
        restaurarDadosCompletos(JSON.parse(dadosSalvos));
      } catch (e) {
        console.warn('Erro ao carregar dados salvos:', e);
        atualizarTabelaLiraa();
        recalcularTodosOsTotais();
      }
    } else {
      atualizarTabelaLiraa();
      recalcularTodosOsTotais();
    }

    return () => {
      document.removeEventListener('input', handleSyncInput);
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleDocumentKeyDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDownGlobal);
      document.removeEventListener('touchstart', handleTouchStartGlobal);
    };
  }, []);

  const handleForcarSincronizacaoNuvem = async () => {
    if (!currentUser) {
      try {
        await signInWithGoogle();
      } catch (e) {
        console.error('Erro no login:', e);
      }
      return;
    }

    setCloudStatus('salvando');
    try {
      const dados = coletarDadosRef.current();
      const docId = `liraa_${currentUser.uid}`;
      await setDoc(doc(db, 'liraa_forms', docId), {
        id: docId,
        ownerId: currentUser.uid,
        cabecalho: dados.cabecalho,
        linhas: dados.linhas,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setCloudStatus('sincronizado');
      alert('Dados sincronizados com o Firebase Firestore com sucesso!');
    } catch (err) {
      console.error('Erro ao sincronizar:', err);
      setCloudStatus('offline');
      alert('Erro ao sincronizar com o Firebase. Verifique sua conexão.');
    }
  };

  const handleLoginGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Erro ao logar com Google:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutFirebase();
      setCloudStatus('desconectado');
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
  };

  const handleEnviarParaPmcd = async () => {
    const dados = coletarDadosRef.current();
    const rec = converterParaReconhecimentoRef.current(dados);
    if (!rec) return;
    ultimaAssinaturaSyncRef.current = JSON.stringify(rec);
    setPmcdSyncStatus('sincronizando');
    try {
      pmcdIframeRef.current?.contentWindow?.postMessage(
        { type: 'LIRAA_SYNC_RECONHECIMENTO', payload: rec },
        window.location.origin
      );
    } catch {
      // ignore
    }
    const ok = await pushReconhecimentoToRtdb(rec);
    setPmcdSyncStatus(ok ? 'conectado' : 'local');
    const q = contarPreenchidosBridge(rec);
    showToast(
      ok
        ? `Enviado para o PMCD e Nuvem Compartilhada (${q} quarteirões)!`
        : `Sincronizado com a aba PMCD local (${q} quarteirões).`
    );
  };

  const handlePuxarDoPmcd = async () => {
    setPmcdSyncStatus('sincronizando');
    const rtdbData = await fetchReconhecimentoFromRtdb();
    if (rtdbData) {
      const norm = normalizarReconhecimentoParaBridge(rtdbData);
      if (norm) {
        ultimaAssinaturaSyncRef.current = JSON.stringify(norm);
        aplicarReconhecimentoRef.current(norm, false);
        setPmcdSyncStatus('conectado');
        return;
      }
    }
    // Fallback: pedir ao iframe PMCD local
    try {
      pmcdIframeRef.current?.contentWindow?.postMessage(
        { type: 'PMCD_REQUEST_RECONHECIMENTO' },
        window.location.origin
      );
      setPmcdSyncStatus('conectado');
      showToast('Solicitação enviada ao módulo PMCD.');
    } catch {
      setPmcdSyncStatus('local');
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen flex flex-col">
      {/* ====== BARRA SUPERIOR DE NAVEGAÇÃO INTEGRADA ====== */}
      <nav className="barra-sistema-integrado sticky top-0 z-50 bg-emerald-950 text-white px-3 py-2 flex flex-wrap items-center justify-between gap-2 shadow-md border-b border-emerald-800">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 pr-2 border-r border-emerald-800">
            <span className="text-base">🦟</span>
            <span className="font-extrabold text-xs sm:text-sm tracking-tight text-emerald-100">
              Sistema Integrado PMCD • LIRAa
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSelectModule('pmcd')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeModule === 'pmcd'
                  ? 'bg-emerald-500 text-emerald-950 shadow-sm'
                  : 'bg-emerald-900/70 text-emerald-100 hover:bg-emerald-800 border border-emerald-700/60'
              }`}
            >
              <span>🌿</span>
              <span>PMCD - Lançamentos de Campo</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectModule('liraa')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeModule === 'liraa'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'bg-emerald-900/70 text-emerald-100 hover:bg-emerald-800 border border-emerald-700/60'
              }`}
            >
              <span>📋</span>
              <span>Quarteirões para o LIRAa</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeModule === 'liraa' ? (
            <button
              type="button"
              onClick={() => handleSelectModule('pmcd', 'resumo-reconhecimento')}
              className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-sky-600 hover:bg-sky-500 text-white transition-colors cursor-pointer"
              title="Abrir a aba Resumo de Reconhecimento dentro do PMCD"
            >
              🗺️ Ver Reconhecimento no PMCD
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSelectModule('pmcd', 'resumo-reconhecimento')}
              className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-800 hover:bg-emerald-700 text-emerald-100 border border-emerald-600 transition-colors cursor-pointer"
              title="Ir direto para o Resumo de Reconhecimento"
            >
              🗺️ Reconhecimento
            </button>
          )}

          <span
            className={`text-[11px] font-bold px-2 py-1 rounded-md border ${
              pmcdSyncStatus === 'conectado'
                ? 'bg-emerald-900/80 text-emerald-200 border-emerald-600'
                : pmcdSyncStatus === 'sincronizando'
                ? 'bg-amber-900/80 text-amber-200 border-amber-500 animate-pulse'
                : 'bg-slate-800 text-slate-200 border-slate-600'
            }`}
          >
            {pmcdSyncStatus === 'conectado' && '🔗 Ponte PMCD ↔ LIRAa Ativa'}
            {pmcdSyncStatus === 'sincronizando' && '🔄 Sincronizando...'}
            {pmcdSyncStatus === 'local' && '💾 Integração Local Ativa'}
          </span>
        </div>
      </nav>

      {toastMsg && (
        <div className="toast-sistema-integrado fixed bottom-4 right-4 z-[9999] bg-emerald-900 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-xl border border-emerald-500">
          {toastMsg}
        </div>
      )}

      {/* ====== MÓDULO 1: PMCD - LANÇAMENTOS DE CAMPO (index.html integrado) ====== */}
      <div className={`pmcd-module-container flex-1 min-h-0 w-full ${activeModule === 'pmcd' ? 'flex flex-col' : 'hidden'}`}>
        <iframe
          ref={pmcdIframeRef}
          src={pmcdIframeSrc}
          title="PMCD - Lançamentos de Campo"
          className="w-full flex-1 border-0 block bg-[#f4f6f5]"
        />
      </div>

      {/* ====== MÓDULO 2: QUARTEIRÕES PARA O LIRAa (IMÓVEIS BASES) ====== */}
      <div className={`liraa-module-container ${activeModule === 'liraa' ? 'block' : 'hidden'}`}>
      <div className="topo">
        <h1>Quarteirões para o LIRAa</h1>
        <p>Imóveis bases</p>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
          <div className="status-salvamento" id="status-storage">
            ● Salvo no navegador
          </div>

          {/* STATUS DO FIREBASE FIRESTORE */}
          <div
            className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border transition-all ${
              cloudStatus === 'sincronizado'
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : cloudStatus === 'salvando'
                ? 'bg-blue-50 text-blue-800 border-blue-300 animate-pulse'
                : cloudStatus === 'offline'
                ? 'bg-red-50 text-red-700 border-red-300'
                : 'bg-gray-100 text-gray-600 border-gray-300'
            }`}
          >
            <span>🔥 Firebase:</span>
            <span>
              {cloudStatus === 'sincronizado' && 'Nuvem Conectada e Sincronizada'}
              {cloudStatus === 'salvando' && 'Sincronizando com Firestore...'}
              {cloudStatus === 'offline' && 'Offline (Salvo localmente)'}
              {cloudStatus === 'desconectado' && 'Banco Provisionado (Não autenticado)'}
            </span>
          </div>

          {/* BOTÃO LOGIN/LOGOUT GOOGLE FIREBASE */}
          {!isAuthLoading && (
            <div className="inline-flex items-center gap-2">
              {currentUser ? (
                <div className="inline-flex items-center gap-2 bg-white px-2 py-0.5 rounded-full border border-gray-300 text-xs shadow-xs">
                  {currentUser.photoURL && (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || 'Usuário'}
                      className="w-5 h-5 rounded-full"
                    />
                  )}
                  <span className="font-bold text-gray-800 truncate max-w-[120px]">
                    {currentUser.displayName?.split(' ')[0] || currentUser.email}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="text-[11px] font-bold text-red-600 hover:text-red-800 hover:underline cursor-pointer ml-1"
                    title="Desconectar conta Google"
                  >
                    Sair
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLoginGoogle}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white hover:bg-gray-50 border border-gray-300 text-xs font-bold text-gray-800 shadow-xs cursor-pointer transition-colors"
                  title="Conectar com conta Google para backup automático no Firestore"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Entrar com Google</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="barra-acoes">
        <button className="btn btn-pdf" id="btn-pdf-acao" onClick={() => (window as any).gerarPDF()}>
          📄 Baixar PDF
        </button>
        <button className="btn btn-print" onClick={() => window.print()}>
          🖨️ Imprimir (Ctrl+P)
        </button>
        <button
          className="btn"
          style={{ background: '#0284c7', color: '#fff' }}
          onClick={handleEnviarParaPmcd}
          title="Enviar quarteirões 1 a 64 e cabeçalho para o Resumo de Reconhecimento do PMCD"
        >
          📤 Enviar p/ PMCD
        </button>
        <button
          className="btn"
          style={{ background: '#0f766e', color: '#fff' }}
          onClick={handlePuxarDoPmcd}
          title="Importar quarteirões 1 a 64 e cabeçalho do Resumo de Reconhecimento do PMCD"
        >
          📥 Puxar do PMCD
        </button>
        <button
          className="btn"
          style={{ background: '#d97706', color: '#fff' }}
          onClick={handleForcarSincronizacaoNuvem}
          title="Salvar no Firebase Firestore na nuvem"
        >
          ☁️ Salvar no Firebase
        </button>
        <button className="btn btn-backup" onClick={() => (window as any).exportarBackup()}>
          💾 Exportar Backup (.json)
        </button>
        <button className="btn btn-import" onClick={() => document.getElementById('input-import')?.click()}>
          📂 Importar Backup
        </button>
        <input
          type="file"
          id="input-import"
          accept=".json"
          style={{ display: 'none' }}
          onChange={(e) => (window as any).importarBackup(e)}
        />
        <button className="btn btn-limpar-sel" onClick={() => (window as any).limparSelecoes()}>
          🗑 Limpar Seleções
        </button>
        <button className="btn btn-limpar-tudo" onClick={() => (window as any).limparTudo()}>
          ⚠️ Limpar Tudo
        </button>
      </div>

      <div className="aviso">
        <strong>Salvamento Automático Ativo:</strong> Seus dados ficam salvos localmente no navegador e integrados com o <strong>Firebase Firestore</strong> na nuvem Google. Conecte sua conta Google no topo para manter os quarteirões sincronizados em tempo real entre computadores e celulares.
        <br />
        <strong>Dica (computador):</strong> clique e arraste o mouse sobre várias células para selecioná-las em bloco; use <strong>Ctrl+C</strong>, <strong>Ctrl+X</strong>, <strong>Ctrl+V</strong> e <strong>Delete</strong>. Clique com o <strong>botão direito</strong> numa seleção para abrir o menu.
        <br />
        <strong>Dica (tablet/celular):</strong> arraste o dedo sobre as células para selecionar em bloco e faça <strong>toque longo</strong> (~0,5 s) sobre a seleção para abrir o menu.
      </div>

      <div className="aviso-mobile-layout">
        <span>↔</span>
        <span>
          <strong>Visualização Padronizada (Padrão Desktop / A4):</strong> Deslize horizontalmente para visualizar e preencher as colunas lado a lado.
        </span>
      </div>

      <div className="area-documento-wrapper">
        <div id="conteudo-pdf">
          {/* ===================== PÁGINA 1 ===================== */}
          <div className="folha-a4" data-pdf-folha>
            <div>
              <div className="folha-cabecalho-titulo">
                <h2>Quarteirões para o LIRAa</h2>
                <span>Imóveis bases • Página 1</span>
              </div>

              <table className="tabela-identificacao">
                <tbody>
                  <tr>
                    <td className="campo-label">Unidade Federal:</td>
                    <td className="campo-valor" contentEditable="true" data-sync="uf" spellCheck={false}></td>
                    <td className="campo-label">Subdistrito:</td>
                    <td className="campo-valor" contentEditable="true" data-sync="subdistrito" spellCheck={false}></td>
                  </tr>
                  <tr>
                    <td className="campo-label">Distrito:</td>
                    <td className="campo-valor" contentEditable="true" data-sync="distrito" spellCheck={false}></td>
                    <td className="campo-label">Sublocal:</td>
                    <td className="campo-valor" contentEditable="true" data-sync="sublocal" spellCheck={false}></td>
                  </tr>
                  <tr>
                    <td className="campo-label">Município:</td>
                    <td className="campo-valor" contentEditable="true" data-sync="municipio" spellCheck={false}></td>
                    <td className="campo-label">Categoria:</td>
                    <td className="campo-valor" contentEditable="true" data-sync="categoria" spellCheck={false}></td>
                  </tr>
                  <tr>
                    <td className="campo-label">Localidade:</td>
                    <td className="campo-valor" contentEditable="true" data-sync="localidade" spellCheck={false}></td>
                    <td className="campo-label">Total de Quarteirões:</td>
                    <td className="campo-valor campo-total-quarteiroes" contentEditable="true" data-sync="total_quart" spellCheck={false}>
                      0
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="grid-duplo">
              <div className="coluna-tabela">
                <div className="wrapper-tabela">
                  <table id="tabela-1" className="tabela-dados" data-offset="0">
                    <colgroup>
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '12%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Posição</th>
                        <th>Quarteirão</th>
                        <th>R</th>
                        <th>C</th>
                        <th>TB</th>
                        <th>PE</th>
                        <th>O</th>
                        <th>TOTAL</th>
                        <th className="col-liraa">LIRAa</th>
                      </tr>
                    </thead>
                    <tbody></tbody>
                  </table>
                </div>
              </div>

              <div className="coluna-espaco"></div>

              <div className="coluna-tabela">
                <div className="wrapper-tabela">
                  <table id="tabela-2" className="tabela-dados" data-offset="32">
                    <colgroup>
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '12%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Posição</th>
                        <th>Quarteirão</th>
                        <th>R</th>
                        <th>C</th>
                        <th>TB</th>
                        <th>PE</th>
                        <th>O</th>
                        <th>TOTAL</th>
                        <th className="col-liraa">LIRAa</th>
                      </tr>
                    </thead>
                    <tbody></tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="rodape-pagina1">
            <table className="tabela-resumo">
              <colgroup>
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th colSpan={6} className="resumo-titulo">
                    Resumo Geral de Imóveis
                  </th>
                </tr>
                <tr>
                  <th className="resumo-tipo">R</th>
                  <th className="resumo-tipo">C</th>
                  <th className="resumo-tipo">TB</th>
                  <th className="resumo-tipo">PE</th>
                  <th className="resumo-tipo">O</th>
                  <th className="resumo-tipo resumo-tipo-total">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="valor-resumo" id="resumo-r">
                    0
                  </td>
                  <td className="valor-resumo" id="resumo-c">
                    0
                  </td>
                  <td className="valor-resumo" id="resumo-tb">
                    0
                  </td>
                  <td className="valor-resumo" id="resumo-pe">
                    0
                  </td>
                  <td className="valor-resumo" id="resumo-o">
                    0
                  </td>
                  <td className="valor-resumo valor-resumo-total" id="resumo-total">
                    0
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ===================== PÁGINA 2 ===================== */}
        <div className="folha-a4" data-pdf-folha>
          <div>
            <div className="folha-cabecalho-titulo">
              <h2>Quarteirões para o LIRAa</h2>
              <span>Imóveis bases • Página 2</span>
            </div>

            <table className="tabela-identificacao">
              <tbody>
                <tr>
                  <td className="campo-label">Unidade Federal:</td>
                  <td className="campo-valor" contentEditable="true" data-sync="uf" spellCheck={false}></td>
                  <td className="campo-label">Subdistrito:</td>
                  <td className="campo-valor" contentEditable="true" data-sync="subdistrito" spellCheck={false}></td>
                </tr>
                <tr>
                  <td className="campo-label">Distrito:</td>
                  <td className="campo-valor" contentEditable="true" data-sync="distrito" spellCheck={false}></td>
                  <td className="campo-label">Sublocal:</td>
                  <td className="campo-valor" contentEditable="true" data-sync="sublocal" spellCheck={false}></td>
                </tr>
                <tr>
                  <td className="campo-label">Município:</td>
                  <td className="campo-valor" contentEditable="true" data-sync="municipio" spellCheck={false}></td>
                  <td className="campo-label">Categoria:</td>
                  <td className="campo-valor" contentEditable="true" data-sync="categoria" spellCheck={false}></td>
                </tr>
                <tr>
                  <td className="campo-label">Localidade:</td>
                  <td className="campo-valor" contentEditable="true" data-sync="localidade" spellCheck={false}></td>
                  <td className="campo-label">Total de Quarteirões:</td>
                  <td className="campo-valor campo-total-quarteiroes" contentEditable="true" data-sync="total_quart" spellCheck={false}>
                    0
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="grid-duplo">
              <div className="coluna-tabela">
                <div className="wrapper-tabela">
                  <table id="tabela-3" className="tabela-dados" data-offset="64">
                    <colgroup>
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '12%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Posição</th>
                        <th>Quarteirão</th>
                        <th>R</th>
                        <th>C</th>
                        <th>TB</th>
                        <th>PE</th>
                        <th>O</th>
                        <th>TOTAL</th>
                        <th className="col-liraa">LIRAa</th>
                      </tr>
                    </thead>
                    <tbody></tbody>
                  </table>
                </div>
              </div>

              <div className="coluna-espaco"></div>

              <div className="coluna-tabela">
                <div className="wrapper-tabela">
                  <table id="tabela-4" className="tabela-dados" data-offset="96">
                    <colgroup>
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '12%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Posição</th>
                        <th>Quarteirão</th>
                        <th>R</th>
                        <th>C</th>
                        <th>TB</th>
                        <th>PE</th>
                        <th>O</th>
                        <th>TOTAL</th>
                        <th className="col-liraa">LIRAa</th>
                      </tr>
                    </thead>
                    <tbody></tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ===================== PÁGINA 3: TABELA LIRAa ===================== */}
        <div className="folha-a4" data-pdf-folha>
          <div>
            <div className="folha-cabecalho-titulo">
              <h2>Quarteirões para o LIRAa</h2>
              <span>Quarteirões Selecionados para Inspeção</span>
            </div>

            <table className="tabela-identificacao">
              <tbody>
                <tr>
                  <td className="campo-label">Unidade Federal:</td>
                  <td className="campo-valor" contentEditable="true" data-sync="uf" spellCheck={false}></td>
                  <td className="campo-label">Subdistrito:</td>
                  <td className="campo-valor" contentEditable="true" data-sync="subdistrito" spellCheck={false}></td>
                </tr>
                <tr>
                  <td className="campo-label">Distrito:</td>
                  <td className="campo-valor" contentEditable="true" data-sync="distrito" spellCheck={false}></td>
                  <td className="campo-label">Sublocal:</td>
                  <td className="campo-valor" contentEditable="true" data-sync="sublocal" spellCheck={false}></td>
                </tr>
                <tr>
                  <td className="campo-label">Município:</td>
                  <td className="campo-valor" contentEditable="true" data-sync="municipio" spellCheck={false}></td>
                  <td className="campo-label">Categoria:</td>
                  <td className="campo-valor" contentEditable="true" data-sync="categoria" spellCheck={false}></td>
                </tr>
                <tr>
                  <td className="campo-label">Localidade:</td>
                  <td className="campo-valor" contentEditable="true" data-sync="localidade" spellCheck={false}></td>
                  <td className="campo-label">Total de Quarteirões:</td>
                  <td
                    className="campo-valor"
                    id="total-quarteiroes-selecionados"
                    style={{ cursor: 'default', background: '#f1f5f9' }}
                    spellCheck={false}
                  >
                    0
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="wrapper-tabela">
              <table id="tabela-liraa">
                <colgroup>
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '12%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Posição</th>
                    <th>Quarteirão</th>
                    <th>R</th>
                    <th>C</th>
                    <th>TB</th>
                    <th>PE</th>
                    <th>O</th>
                    <th>TOTAL</th>
                    <th className="col-liraa">LIRAa</th>
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* ====== MENU DE CONTEXTO ====== */}
      <div className="menu-contexto" id="menu-contexto" role="menu">
        <button type="button" data-acao="copiar">
          📋 Copiar <span className="atalho">Ctrl+C</span>
        </button>
        <button type="button" data-acao="recortar">
          ✂️ Recortar <span className="atalho">Ctrl+X</span>
        </button>
        <button type="button" data-acao="colar">
          📥 Colar <span className="atalho">Ctrl+V</span>
        </button>
        <hr />
        <button type="button" data-acao="limpar">
          🗑 Limpar conteúdo <span className="atalho">Del</span>
        </button>
      </div>

      {/* ====== CAIXA FLUTUANTE DE COLAR ====== */}
      <div className="caixa-colar" id="caixa-colar">
        <strong>Colar na seleção</strong>
        <p>
          Toque na caixa abaixo e use o menu <b>Colar</b> do seu sistema (ou <b>Ctrl+V</b>, se tiver teclado). Depois toque em <b>Aplicar</b>.
        </p>
        <textarea id="caixa-colar-texto" spellCheck={false} placeholder="Cole aqui..."></textarea>
        <div className="botoes">
          <button type="button" className="btn-cancelar" data-acao="cancelar">
            Cancelar
          </button>
          <button type="button" className="btn-ok" data-acao="aplicar">
            Aplicar
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
