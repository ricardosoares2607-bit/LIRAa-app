import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    html2canvas?: any;
    jspdf?: any;
    jsPDF?: any;
  }
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);

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

    (window as any).limparSelecoes = function () {
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

      timeoutSalvar = setTimeout(() => {
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
      }, 250);
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

    (window as any).exportarBackup = function () {
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

    (window as any).importarBackup = function (evento: any) {
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

    (window as any).limparTudo = function () {
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

    (window as any).gerarPDF = async function () {
      const btn = document.getElementById('btn-pdf-acao') as HTMLButtonElement;
      if (!btn) return;
      const textoOriginal = btn.innerHTML;
      btn.innerHTML = '⏳ Processando...';
      btn.disabled = true;

      if (document.activeElement && (document.activeElement as HTMLElement).blur) {
        (document.activeElement as HTMLElement).blur();
      }
      limparSelecaoBloco();
      fecharMenuContexto();
      fecharCaixaColar();

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
            backgroundColor: '#ffffff'
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

  return (
    <div ref={containerRef}>
      <div className="topo">
        <h1>Quarteirões para o LIRAa</h1>
        <p>Imóveis bases</p>
        <div className="status-salvamento" id="status-storage">
          ● Salvo no navegador
        </div>
      </div>

      <div className="barra-acoes">
        <button className="btn btn-pdf" id="btn-pdf-acao" onClick={() => (window as any).gerarPDF()}>
          📄 Baixar PDF
        </button>
        <button className="btn btn-print" onClick={() => window.print()}>
          🖨️ Imprimir (Ctrl+P)
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
        <strong>Salvamento Automático Ativo:</strong> Seus dados ficam salvos neste navegador. Você pode fechar a página ou desligar o computador com segurança. Utilize <strong>Exportar Backup</strong> para salvar uma cópia definitiva em seu computador.
        <br />
        <strong>Dica (computador):</strong> clique e arraste o mouse sobre várias células para selecioná-las em bloco; use <strong>Ctrl+C</strong>, <strong>Ctrl+X</strong>, <strong>Ctrl+V</strong> e <strong>Delete</strong>. Clique com o <strong>botão direito</strong> numa seleção para abrir o menu.
        <br />
        <strong>Dica (tablet/celular):</strong> arraste o dedo sobre as células para selecionar em bloco e faça <strong>toque longo</strong> (~0,5 s) sobre a seleção para abrir o menu.
      </div>

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

            <div className="dica-rolagem">← Deslize a tabela para os lados para ver todas as colunas →</div>

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
              <thead>
                <tr>
                  <th colSpan={2}>Resumo Geral de Imóveis</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="label-resumo">R (Residencial)</td>
                  <td className="valor-resumo" id="resumo-r">
                    0
                  </td>
                </tr>
                <tr>
                  <td className="label-resumo">C (Comércio)</td>
                  <td className="valor-resumo" id="resumo-c">
                    0
                  </td>
                </tr>
                <tr>
                  <td className="label-resumo">TB (Terreno Baldio)</td>
                  <td className="valor-resumo" id="resumo-tb">
                    0
                  </td>
                </tr>
                <tr>
                  <td className="label-resumo">PE (Ponto Estratégico)</td>
                  <td className="valor-resumo" id="resumo-pe">
                    0
                  </td>
                </tr>
                <tr>
                  <td className="label-resumo">O (Outros)</td>
                  <td className="valor-resumo" id="resumo-o">
                    0
                  </td>
                </tr>
                <tr className="total-geral">
                  <td className="label-resumo" style={{ background: '#0f172a', color: '#fff' }}>
                    TOTAL GERAL
                  </td>
                  <td className="valor-resumo" id="resumo-total" style={{ background: '#0f172a', color: '#fff' }}>
                    0
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="bloco-assinatura">
              <strong>Controle e Validação dos Imóveis Bases</strong>
              <br />
              <span>Declaro que os dados dos estratos e contagem dos quarteirões conferem com o cadastro de campo atualizado.</span>
              <div className="linha-campo-ass">Assinatura do Supervisor / Coordenador</div>
            </div>
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

            <div className="dica-rolagem">← Deslize a tabela para os lados para ver todas as colunas →</div>

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

          <div className="rodape-pagina2">
            <strong>Observações e Ocorrências de Campo:</strong>
            <br />
            <div style={{ height: '34px', borderBottom: '1px dotted #94a3b8', marginTop: '4px' }}></div>
            <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', flexWrap: 'wrap', gap: '6px' }}>
              <span>Data de Levantamento: ____/____/________</span>
              <span>Município/Estrato: _________________________</span>
              <span>Equipe Responsável: _________________________</span>
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

            <div className="dica-rolagem">← Deslize a tabela para os lados para ver todas as colunas →</div>

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
  );
}
