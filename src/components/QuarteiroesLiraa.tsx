import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LiraaCabecalho, LiraaLinha, LiraaBackupData } from '../types';
import { getConfigEquipe, getQuarteiroes } from '../utils/storage';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  FileText,
  Printer,
  Download,
  Upload,
  Trash2,
  RotateCcw,
  Sparkles,
  Dice5,
  CheckCircle,
  HelpCircle,
  Clipboard,
  Layers,
  Search,
  Eye,
  Sliders,
  AlertCircle
} from 'lucide-react';

const STORAGE_KEY = 'LIRAA_FORM_DATA_STORAGE';
const TOTAL_ROWS = 128;
const ROWS_PER_TABLE = 32;
const NUM_TABLES = 4;
// Columns: 0: Posição, 1: Quarteirão, 2: R, 3: C, 4: TB, 5: PE, 6: O, 7: TOTAL, 8: LIRAa
const COL_INDICES_SOMA = [1, 2, 3, 4, 5]; // R, C, TB, PE, O in celulas array (celulas has 6 items: [Quarteirão, R, C, TB, PE, O])

const CABECALHO_PADRAO: LiraaCabecalho = {
  uf: '',
  subdistrito: '',
  distrito: '',
  sublocal: '',
  municipio: '',
  categoria: '',
  localidade: '',
  total_quart: '0'
};

function criarLinhasIniciais(): LiraaLinha[] {
  const lista: LiraaLinha[] = [];
  for (let i = 1; i <= TOTAL_ROWS; i++) {
    lista.push({
      pos: i.toString(),
      celulas: ['', '', '', '', '', ''], // Quarteirão, R, C, TB, PE, O
      isSel: false
    });
  }
  return lista;
}

function calcularLiraaQuota(total: number): string {
  if (total <= 0) return '';
  return String(Math.ceil(total / 5)).padStart(2, '0');
}

function calcularTotalLinha(celulas: string[]): number {
  let soma = 0;
  for (let i = 1; i <= 5; i++) {
    const val = parseInt(celulas[i] || '', 10);
    if (!isNaN(val)) soma += val;
  }
  return soma;
}

interface QuarteiroesLiraaProps {
  onNotify?: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export const QuarteiroesLiraa: React.FC<QuarteiroesLiraaProps> = ({ onNotify }) => {
  const [cabecalho, setCabecalho] = useState<LiraaCabecalho>(CABECALHO_PADRAO);
  const [linhas, setLinhas] = useState<LiraaLinha[]>(criarLinhasIniciais);
  const [saveStatus, setSaveStatus] = useState<'salvo' | 'salvando' | 'erro'>('salvo');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSorteioOpen, setIsSorteioOpen] = useState(false);
  const [metodoSorteio, setMetodoSorteio] = useState<'intervalo' | 'quantidade'>('intervalo');
  const [intervaloSorteio, setIntervaloSorteio] = useState(5);
  const [quantidadeSorteio, setQuantidadeSorteio] = useState(10);
  const [modoVisualizacao, setModoVisualizacao] = useState<'folhas' | 'tabelaUnica' | 'selecionados'>('folhas');

  // Bloco de seleção
  const [blocoSelecao, setBlocoSelecao] = useState<{
    tabelaId: number | null;
    startL: number;
    startC: number;
    endL: number;
    endC: number;
  } | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const dragAnchorRef = useRef<{ tabelaId: number; l: number; c: number } | null>(null);

  // Menu de Contexto
  const [menuCtx, setMenuCtx] = useState<{
    aberto: boolean;
    x: number;
    y: number;
  }>({ aberto: false, x: 0, y: 0 });

  // Modal Colar Flutuante (touch / fallback)
  const [isCaixaColarAberta, setIsCaixaColarAberta] = useState(false);
  const [textoColar, setTextoColar] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const touchTimerRef = useRef<any>(null);

  // Inicialização e Carregamento do localStorage
  useEffect(() => {
    try {
      const dadosSalvos = localStorage.getItem(STORAGE_KEY);
      if (dadosSalvos) {
        const parsed: LiraaBackupData = JSON.parse(dadosSalvos);
        if (parsed.cabecalho) {
          setCabecalho((prev) => ({ ...prev, ...parsed.cabecalho }));
        }
        if (parsed.linhas && Array.isArray(parsed.linhas)) {
          const mapaLinhas: Record<string, LiraaLinha> = {};
          parsed.linhas.forEach((l) => {
            mapaLinhas[l.pos] = l;
          });

          setLinhas(
            Array.from({ length: TOTAL_ROWS }, (_, idx) => {
              const posStr = (idx + 1).toString();
              const existente = mapaLinhas[posStr];
              if (existente) {
                return {
                  pos: posStr,
                  celulas: [
                    existente.celulas?.[0] || '',
                    existente.celulas?.[1] || '',
                    existente.celulas?.[2] || '',
                    existente.celulas?.[3] || '',
                    existente.celulas?.[4] || '',
                    existente.celulas?.[5] || ''
                  ],
                  isSel: !!existente.isSel
                };
              }
              return {
                pos: posStr,
                celulas: ['', '', '', '', '', ''],
                isSel: false
              };
            })
          );
        }
      }
    } catch (e) {
      console.warn('Erro ao restaurar dados do LIRAa:', e);
    }
  }, []);

  // Salvamento Automático com Debounce
  const debounceTimerRef = useRef<any>(null);
  const salvarDados = useCallback(
    (novoCabecalho: LiraaCabecalho, novasLinhas: LiraaLinha[]) => {
      setSaveStatus('salvando');
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(() => {
        try {
          const payload: LiraaBackupData = {
            cabecalho: novoCabecalho,
            linhas: novasLinhas,
            atualizadoEm: new Date().toISOString()
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
          setSaveStatus('salvo');
        } catch (err) {
          console.error('Erro ao salvar no localStorage:', err);
          setSaveStatus('erro');
        }
      }, 300);
    },
    []
  );

  // Atualizar contagem automática de quarteirões preenchidos
  useEffect(() => {
    let cont = 0;
    linhas.forEach((l) => {
      const q = l.celulas[0]?.trim();
      const tot = calcularTotalLinha(l.celulas);
      if (q || tot > 0) cont++;
    });
    setCabecalho((prev) => {
      if (prev.total_quart === cont.toString()) return prev;
      const updated = { ...prev, total_quart: cont.toString() };
      salvarDados(updated, linhas);
      return updated;
    });
  }, [linhas, salvarDados]);

  // Manipulação de Cabeçalho
  const handleCabecalhoChange = (campo: keyof LiraaCabecalho, valor: string) => {
    setCabecalho((prev) => {
      const updated = { ...prev, [campo]: valor };
      salvarDados(updated, linhas);
      return updated;
    });
  };

  // Preencher com dados da equipe do ACE
  const handleSincronizarConfigEquipe = () => {
    const config = getConfigEquipe();
    setCabecalho((prev) => {
      const updated = {
        ...prev,
        municipio: prev.municipio || 'Município Sede',
        localidade: config.bairro || prev.localidade,
        categoria: config.estrato || prev.categoria
      };
      salvarDados(updated, linhas);
      return updated;
    });
    if (onNotify) {
      onNotify('Dados da equipe e localidade sincronizados!', 'success');
    }
  };

  // Carregar quarteirões cadastrados do sistema
  const handleCarregarQuarteiroesSistema = () => {
    const blocks = getQuarteiroes();
    if (blocks.length === 0) {
      if (onNotify) onNotify('Nenhum quarteirão cadastrado na Gestão de Ciclo.', 'warning');
      return;
    }

    setLinhas((prev) => {
      const copia = [...prev];
      blocks.forEach((b, idx) => {
        if (idx < TOTAL_ROWS) {
          copia[idx] = {
            ...copia[idx],
            celulas: [b.numero, copia[idx].celulas[1], copia[idx].celulas[2], copia[idx].celulas[3], copia[idx].celulas[4], copia[idx].celulas[5]]
          };
        }
      });
      salvarDados(cabecalho, copia);
      return copia;
    });

    if (onNotify) {
      onNotify(`${blocks.length} quarteirões importados com sucesso!`, 'success');
    }
  };

  // Toggle seleção de quarteirão para LIRAa (click na posição)
  const toggleSelecaoLinha = (globalIndex: number) => {
    setLinhas((prev) => {
      const copia = [...prev];
      copia[globalIndex] = {
        ...copia[globalIndex],
        isSel: !copia[globalIndex].isSel
      };
      salvarDados(cabecalho, copia);
      return copia;
    });
  };

  // Edição de célula individual
  const handleCelulaChange = (globalIndex: number, colIndex: number, valor: string) => {
    setLinhas((prev) => {
      const copia = [...prev];
      const celulas = [...copia[globalIndex].celulas];
      celulas[colIndex] = valor;
      copia[globalIndex] = {
        ...copia[globalIndex],
        celulas
      };
      salvarDados(cabecalho, copia);
      return copia;
    });
  };

  // Colar direto de planilhas (Excel, Google Sheets) em células
  const handlePasteInCell = (e: React.ClipboardEvent, globalIndex: number, colIndex: number) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    if (text.includes('\t') || text.includes('\n')) {
      e.preventDefault();
      colarTextoMatriz(text, globalIndex, colIndex);
    }
  };

  const colarTextoMatriz = (texto: string, startGlobalIndex: number, startColIndex: number) => {
    const rawLinhas = texto.replace(/\r/g, '').split('\n').filter((l) => l.length > 0);
    if (rawLinhas.length === 0) return;

    setLinhas((prev) => {
      const copia = [...prev];
      rawLinhas.forEach((linhaStr, rowOffset) => {
        const targetRow = startGlobalIndex + rowOffset;
        if (targetRow >= TOTAL_ROWS) return;

        const cells = linhaStr.split('\t');
        const novaCelulas = [...copia[targetRow].celulas];

        cells.forEach((val, colOffset) => {
          const targetCol = startColIndex + colOffset;
          if (targetCol >= 0 && targetCol < 6) {
            novaCelulas[targetCol] = val.trim();
          }
        });

        copia[targetRow] = {
          ...copia[targetRow],
          celulas: novaCelulas
        };
      });

      salvarDados(cabecalho, copia);
      return copia;
    });

    if (onNotify) onNotify('Dados colados com sucesso!', 'success');
  };

  // ====== SELEÇÃO EM BLOCO ======
  const handleCellMouseDown = (tabelaId: number, l: number, c: number, shift: boolean) => {
    setIsDragging(true);
    if (shift && dragAnchorRef.current && dragAnchorRef.current.tabelaId === tabelaId) {
      setBlocoSelecao({
        tabelaId,
        startL: Math.min(dragAnchorRef.current.l, l),
        startC: Math.min(dragAnchorRef.current.c, c),
        endL: Math.max(dragAnchorRef.current.l, l),
        endC: Math.max(dragAnchorRef.current.c, c)
      });
    } else {
      dragAnchorRef.current = { tabelaId, l, c };
      setBlocoSelecao({
        tabelaId,
        startL: l,
        startC: c,
        endL: l,
        endC: c
      });
    }
    setMenuCtx({ aberto: false, x: 0, y: 0 });
  };

  const handleCellMouseEnter = (tabelaId: number, l: number, c: number) => {
    if (!isDragging || !dragAnchorRef.current || dragAnchorRef.current.tabelaId !== tabelaId) return;
    setBlocoSelecao({
      tabelaId,
      startL: Math.min(dragAnchorRef.current.l, l),
      startC: Math.min(dragAnchorRef.current.c, c),
      endL: Math.max(dragAnchorRef.current.l, l),
      endC: Math.max(dragAnchorRef.current.c, c)
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Verificar se uma célula está no bloco selecionado
  const isCellSelected = (tabelaId: number, l: number, c: number) => {
    if (!blocoSelecao || blocoSelecao.tabelaId !== tabelaId) return false;
    return (
      l >= blocoSelecao.startL &&
      l <= blocoSelecao.endL &&
      c >= blocoSelecao.startC &&
      c <= blocoSelecao.endC
    );
  };

  // Copiar bloco selecionado
  const copiarBloco = (cortar = false) => {
    if (!blocoSelecao || blocoSelecao.tabelaId === null) return;
    const { tabelaId, startL, startC, endL, endC } = blocoSelecao;
    const offset = tabelaId * ROWS_PER_TABLE;

    const linhasTexto: string[] = [];
    for (let r = startL; r <= endL; r++) {
      const gIndex = offset + r;
      const celulas = linhas[gIndex].celulas;
      const rowSlice: string[] = [];
      for (let c = startC; c <= endC; c++) {
        rowSlice.push(celulas[c] || '');
      }
      linhasTexto.push(rowSlice.join('\t'));
    }

    const tsv = linhasTexto.join('\n');
    navigator.clipboard.writeText(tsv).catch(() => {});

    if (cortar) {
      setLinhas((prev) => {
        const copia = [...prev];
        for (let r = startL; r <= endL; r++) {
          const gIndex = offset + r;
          const celulas = [...copia[gIndex].celulas];
          for (let c = startC; c <= endC; c++) {
            celulas[c] = '';
          }
          copia[gIndex] = { ...copia[gIndex], celulas };
        }
        salvarDados(cabecalho, copia);
        return copia;
      });
      if (onNotify) onNotify('Conteúdo recortado!', 'info');
    } else {
      if (onNotify) onNotify('Copiado para a área de transferência!', 'info');
    }
  };

  // Limpar bloco selecionado
  const limparBloco = () => {
    if (!blocoSelecao || blocoSelecao.tabelaId === null) return;
    const { tabelaId, startL, startC, endL, endC } = blocoSelecao;
    const offset = tabelaId * ROWS_PER_TABLE;

    setLinhas((prev) => {
      const copia = [...prev];
      for (let r = startL; r <= endL; r++) {
        const gIndex = offset + r;
        const celulas = [...copia[gIndex].celulas];
        for (let c = startC; c <= endC; c++) {
          celulas[c] = '';
        }
        copia[gIndex] = { ...copia[gIndex], celulas };
      }
      salvarDados(cabecalho, copia);
      return copia;
    });
  };

  // Teclado shortcuts no container (Ctrl+C, Ctrl+X, Delete, Esc)
  const handleKeyDownContainer = (e: React.KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    if (ctrl && key === 'c' && blocoSelecao) {
      e.preventDefault();
      copiarBloco(false);
    } else if (ctrl && key === 'x' && blocoSelecao) {
      e.preventDefault();
      copiarBloco(true);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && blocoSelecao) {
      if (blocoSelecao.startL !== blocoSelecao.endL || blocoSelecao.startC !== blocoSelecao.endC) {
        e.preventDefault();
        limparBloco();
      }
    } else if (e.key === 'Escape') {
      setBlocoSelecao(null);
      setMenuCtx({ aberto: false, x: 0, y: 0 });
      setIsCaixaColarAberta(false);
    }
  };

  // Menu de Contexto (botão direito)
  const handleContextMenu = (e: React.MouseEvent, tabelaId: number, l: number, c: number) => {
    e.preventDefault();
    if (!isCellSelected(tabelaId, l, c)) {
      dragAnchorRef.current = { tabelaId, l, c };
      setBlocoSelecao({ tabelaId, startL: l, startC: c, endL: l, endC: c });
    }
    setMenuCtx({
      aberto: true,
      x: Math.min(e.clientX, window.innerWidth - 200),
      y: Math.min(e.clientY, window.innerHeight - 180)
    });
  };

  // Touch Support para Mobile/Tablet (Toque longo)
  const handleTouchStartCell = (tabelaId: number, l: number, c: number, e: React.TouchEvent) => {
    dragAnchorRef.current = { tabelaId, l, c };
    setBlocoSelecao({ tabelaId, startL: l, startC: c, endL: l, endC: c });

    const touch = e.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;

    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      setMenuCtx({
        aberto: true,
        x: Math.min(clientX, window.innerWidth - 200),
        y: Math.min(clientY, window.innerHeight - 180)
      });
    }, 550);
  };

  const handleTouchEndCell = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
  };

  // Abrir caixa colar
  const abrirCaixaColar = () => {
    setTextoColar('');
    setIsCaixaColarAberta(true);
    setMenuCtx({ aberto: false, x: 0, y: 0 });
  };

  const aplicarColarCaixa = () => {
    if (!textoColar.trim()) {
      setIsCaixaColarAberta(false);
      return;
    }
    if (!blocoSelecao || blocoSelecao.tabelaId === null) {
      if (onNotify) onNotify('Selecione primeiro a célula inicial de destino.', 'warning');
      return;
    }
    const offset = blocoSelecao.tabelaId * ROWS_PER_TABLE;
    const gIndex = offset + blocoSelecao.startL;
    colarTextoMatriz(textoColar, gIndex, blocoSelecao.startC);
    setIsCaixaColarAberta(false);
  };

  // Sorteio Amostral do LIRAa
  const executarSorteioLiraa = () => {
    // Quarteirões elegíveis: aqueles que possuem dados (nome ou total > 0)
    const indicesElegiveis: number[] = [];
    linhas.forEach((l, idx) => {
      const q = l.celulas[0]?.trim();
      const tot = calcularTotalLinha(l.celulas);
      if (q || tot > 0) {
        indicesElegiveis.push(idx);
      }
    });

    if (indicesElegiveis.length === 0) {
      if (onNotify) onNotify('Cadastre primeiro os quarteirões antes de sortear.', 'warning');
      return;
    }

    let selecionadosIndices = new Set<number>();

    if (metodoSorteio === 'intervalo') {
      // Amostragem sistemática (ex: 1 a cada 5, começando aleatoriamente entre 0 e k-1)
      const k = Math.max(1, intervaloSorteio);
      const pontoPartida = Math.floor(Math.random() * Math.min(k, indicesElegiveis.length));
      for (let i = pontoPartida; i < indicesElegiveis.length; i += k) {
        selecionadosIndices.add(indicesElegiveis[i]);
      }
    } else {
      // Amostragem aleatória simples
      const qtd = Math.min(quantidadeSorteio, indicesElegiveis.length);
      const embaralhado = [...indicesElegiveis].sort(() => 0.5 - Math.random());
      for (let i = 0; i < qtd; i++) {
        selecionadosIndices.add(embaralhado[i]);
      }
    }

    setLinhas((prev) => {
      const copia = prev.map((l, idx) => ({
        ...l,
        isSel: selecionadosIndices.has(idx)
      }));
      salvarDados(cabecalho, copia);
      return copia;
    });

    setIsSorteioOpen(false);
    if (onNotify) {
      onNotify(`${selecionadosIndices.size} quarteirões sorteados para a amostra do LIRAa!`, 'success');
    }
  };

  // Limpar todas as seleções
  const limparSelecoes = () => {
    setLinhas((prev) => {
      const copia = prev.map((l) => ({ ...l, isSel: false }));
      salvarDados(cabecalho, copia);
      return copia;
    });
    if (onNotify) onNotify('Seleções de quarteirões limpas.', 'info');
  };

  // Limpar tudo
  const limparTudo = () => {
    if (!window.confirm('Deseja realmente apagar todos os dados digitados e seleções feitas? Esta ação não pode ser desfeita.')) {
      return;
    }

    setCabecalho(CABECALHO_PADRAO);
    setLinhas(criarLinhasIniciais());
    setBlocoSelecao(null);
    localStorage.removeItem(STORAGE_KEY);
    if (onNotify) onNotify('Todos os dados foram resetados.', 'info');
  };

  // Exportar Backup JSON
  const exportarBackup = () => {
    const dados: LiraaBackupData = {
      cabecalho,
      linhas,
      atualizadoEm: new Date().toISOString()
    };
    const muni = (cabecalho.municipio || 'LIRAa').trim().replace(/\s+/g, '_');
    const dataStr = new Date().toISOString().slice(0, 10);
    const nomeArquivo = `Backup_${muni}_${dataStr}.json`;

    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    a.click();
    URL.revokeObjectURL(url);
    if (onNotify) onNotify('Backup exportado com sucesso!', 'success');
  };

  // Importar Backup JSON
  const importarBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const dados: LiraaBackupData = JSON.parse(event.target?.result as string);
        if (dados.cabecalho) {
          setCabecalho((prev) => ({ ...prev, ...dados.cabecalho }));
        }
        if (dados.linhas && Array.isArray(dados.linhas)) {
          const mapaLinhas: Record<string, LiraaLinha> = {};
          dados.linhas.forEach((l) => {
            mapaLinhas[l.pos] = l;
          });
          const novas = Array.from({ length: TOTAL_ROWS }, (_, idx) => {
            const posStr = (idx + 1).toString();
            const ex = mapaLinhas[posStr];
            if (ex) {
              return {
                pos: posStr,
                celulas: [
                  ex.celulas?.[0] || '',
                  ex.celulas?.[1] || '',
                  ex.celulas?.[2] || '',
                  ex.celulas?.[3] || '',
                  ex.celulas?.[4] || '',
                  ex.celulas?.[5] || ''
                ],
                isSel: !!ex.isSel
              };
            }
            return { pos: posStr, celulas: ['', '', '', '', '', ''], isSel: false };
          });
          setLinhas(novas);
          salvarDados(dados.cabecalho ? { ...cabecalho, ...dados.cabecalho } : cabecalho, novas);
        }
        if (onNotify) onNotify('Backup importado com sucesso!', 'success');
      } catch (err) {
        if (onNotify) onNotify('Erro ao ler arquivo de backup. Formato JSON inválido.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Gerar PDF Multi-Páginas
  const gerarPDF = async () => {
    if (!pdfContainerRef.current) return;
    setIsGeneratingPdf(true);
    setBlocoSelecao(null);
    setMenuCtx({ aberto: false, x: 0, y: 0 });

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const folhas = pdfContainerRef.current.querySelectorAll<HTMLElement>('[data-pdf-folha]');
      const A4_LARGURA = 210;
      const MARGEM = 6;
      const LARGURA_UTIL = A4_LARGURA - MARGEM * 2;

      for (let i = 0; i < folhas.length; i++) {
        const folha = folhas[i];
        const canvas = await html2canvas(folha, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        const imgH = (canvas.height * LARGURA_UTIL) / canvas.width;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', MARGEM, MARGEM, LARGURA_UTIL, imgH);
      }

      const muni = (cabecalho.municipio || 'LIRAa').trim().replace(/\s+/g, '_');
      pdf.save(`Quarteiroes_LIRAa_Imoveis_Bases_${muni}.pdf`);
      if (onNotify) onNotify('PDF gerado e baixado com sucesso!', 'success');
    } catch (err) {
      console.error('Erro na exportação para PDF:', err);
      if (onNotify) onNotify('Erro ao gerar PDF. Experimente a opção "Imprimir".', 'error');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Totais das Tabelas
  const obterTotaisTabela = (tabelaIndex: number) => {
    const offset = tabelaIndex * ROWS_PER_TABLE;
    const somas = [0, 0, 0, 0, 0]; // R, C, TB, PE, O
    let somaTotal = 0;
    let somaLiraa = 0;

    for (let i = 0; i < ROWS_PER_TABLE; i++) {
      const gIndex = offset + i;
      const celulas = linhas[gIndex].celulas;
      for (let c = 1; c <= 5; c++) {
        const val = parseInt(celulas[c] || '', 10);
        if (!isNaN(val)) somas[c - 1] += val;
      }
      const tot = calcularTotalLinha(celulas);
      somaTotal += tot;
      if (tot > 0) {
        somaLiraa += Math.ceil(tot / 5);
      }
    }

    return { somas, somaTotal, somaLiraa };
  };

  // Totais Gerais
  const resumoGeral = {
    R: 0,
    C: 0,
    TB: 0,
    PE: 0,
    O: 0,
    totalGeral: 0,
    totalQuarteiroesSel: 0,
    totalImoveisLiraa: 0
  };

  linhas.forEach((l) => {
    const r = parseInt(l.celulas[1] || '', 10) || 0;
    const c = parseInt(l.celulas[2] || '', 10) || 0;
    const tb = parseInt(l.celulas[3] || '', 10) || 0;
    const pe = parseInt(l.celulas[4] || '', 10) || 0;
    const o = parseInt(l.celulas[5] || '', 10) || 0;

    resumoGeral.R += r;
    resumoGeral.C += c;
    resumoGeral.TB += tb;
    resumoGeral.PE += pe;
    resumoGeral.O += o;

    const tot = r + c + tb + pe + o;
    resumoGeral.totalGeral += tot;

    if (l.isSel) {
      resumoGeral.totalQuarteiroesSel++;
      if (tot > 0) {
        resumoGeral.totalImoveisLiraa += Math.ceil(tot / 5);
      }
    }
  });

  const quarteiroesSelecionados = linhas.filter((l) => l.isSel);

  // Renderizar tabela de 32 linhas
  const renderTabela32 = (tabelaId: number) => {
    const offset = tabelaId * ROWS_PER_TABLE;
    const totais = obterTotaisTabela(tabelaId);

    return (
      <div className="w-full overflow-x-auto bg-white border-[1.5px] border-black">
        <table className="w-full border-collapse text-[9.5px] tabular-nums font-sans">
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
            <tr className="bg-[#1e293b] text-white font-bold text-[8.8px]">
              <th className="border border-black p-1 text-center">Posição</th>
              <th className="border border-black p-1 text-center">Quarteirão</th>
              <th className="border border-black p-1 text-center">R</th>
              <th className="border border-black p-1 text-center">C</th>
              <th className="border border-black p-1 text-center">TB</th>
              <th className="border border-black p-1 text-center">PE</th>
              <th className="border border-black p-1 text-center">O</th>
              <th className="border border-black p-1 text-center">TOTAL</th>
              <th className="border border-black p-1 text-center bg-[#c2410c] text-white">LIRAa</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS_PER_TABLE }).map((_, rIdx) => {
              const globalIndex = offset + rIdx;
              const linha = linhas[globalIndex];
              const totLinha = calcularTotalLinha(linha.celulas);
              const liraaLinha = calcularLiraaQuota(totLinha);
              const isZebrado = rIdx % 2 === 1;

              return (
                <tr
                  key={linha.pos}
                  className={`transition-colors ${
                    linha.isSel
                      ? 'bg-[#ecfdf5] text-[#064e3b]'
                      : isZebrado
                      ? 'bg-[#f8fafc]'
                      : 'bg-white'
                  }`}
                >
                  {/* Coluna 0: Posição (Click para selecionar) */}
                  <td
                    onClick={() => toggleSelecaoLinha(globalIndex)}
                    title="Clique para selecionar este quarteirão para o LIRAa"
                    className={`border border-black p-1 text-center font-bold cursor-pointer select-none transition-colors ${
                      linha.isSel
                        ? 'bg-[#059669] text-white'
                        : 'bg-[#f1f5f9] text-gray-900 hover:bg-[#cbd5e1]'
                    }`}
                  >
                    {linha.pos}
                  </td>

                  {/* Colunas 1 a 6: Quarteirão, R, C, TB, PE, O (Editáveis) */}
                  {[0, 1, 2, 3, 4, 5].map((colIdx) => {
                    const sel = isCellSelected(tabelaId, rIdx, colIdx);
                    const isAncora =
                      dragAnchorRef.current?.tabelaId === tabelaId &&
                      dragAnchorRef.current?.l === rIdx &&
                      dragAnchorRef.current?.c === colIdx;

                    return (
                      <td
                        key={colIdx}
                        onMouseDown={(e) => handleCellMouseDown(tabelaId, rIdx, colIdx, e.shiftKey)}
                        onMouseEnter={() => handleCellMouseEnter(tabelaId, rIdx, colIdx)}
                        onContextMenu={(e) => handleContextMenu(e, tabelaId, rIdx, colIdx)}
                        onTouchStart={(e) => handleTouchStartCell(tabelaId, rIdx, colIdx, e)}
                        onTouchEnd={handleTouchEndCell}
                        className={`border border-black p-0 text-center relative ${
                          sel
                            ? isAncora
                              ? 'bg-[#93c5fd] ring-2 ring-blue-600'
                              : 'bg-[#dbeafe] ring-1 ring-blue-500'
                            : ''
                        }`}
                      >
                        <input
                          type="text"
                          value={linha.celulas[colIdx] || ''}
                          onChange={(e) => handleCelulaChange(globalIndex, colIdx, e.target.value)}
                          onPaste={(e) => handlePasteInCell(e, globalIndex, colIdx)}
                          className={`w-full h-full text-center py-0.5 px-0.5 bg-transparent border-0 outline-none text-[9.5px] font-medium ${
                            linha.isSel ? 'text-[#064e3b] font-semibold' : 'text-gray-900'
                          } focus:bg-white focus:ring-1 focus:ring-blue-600`}
                          placeholder={colIdx === 0 ? '' : ''}
                          spellCheck={false}
                        />
                      </td>
                    );
                  })}

                  {/* Coluna 7: TOTAL */}
                  <td
                    className={`border border-black p-1 text-center font-bold ${
                      linha.isSel ? 'bg-[#d1fae5] text-[#064e3b]' : 'bg-[#e2e8f0] text-gray-900'
                    }`}
                  >
                    {totLinha > 0 ? totLinha : ''}
                  </td>

                  {/* Coluna 8: LIRAa */}
                  <td
                    className={`border border-black p-1 text-center font-extrabold text-[10px] ${
                      linha.isSel
                        ? 'bg-[#fde68a] text-[#78350f]'
                        : 'bg-[#fef3c7] text-[#9a3412]'
                    }`}
                  >
                    {liraaLinha}
                  </td>
                </tr>
              );
            })}

            {/* Linha de Total da Tabela */}
            <tr className="bg-[#0f172a] text-white font-bold text-[9px]">
              <td colSpan={2} className="border border-black p-1 text-center tracking-wider">
                TOTAL
              </td>
              {totais.somas.map((soma, idx) => (
                <td key={idx} className="border border-black p-1 text-center">
                  {soma > 0 ? soma : ''}
                </td>
              ))}
              <td className="border border-black p-1 text-center bg-[#334155] font-extrabold text-white">
                {totais.somaTotal > 0 ? totais.somaTotal : ''}
              </td>
              <td className="border border-black p-1 text-center bg-[#c2410c] font-black text-white">
                {totais.somaLiraa > 0 ? String(totais.somaLiraa).padStart(2, '0') : ''}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // Renderizar Tabela de Identificação Compartilhada
  const renderTabelaIdentificacao = (isReadOnlyTotalSel = false) => (
    <table className="w-full border-collapse border-[1.5px] border-black text-[9px] mb-2 font-sans">
      <tbody>
        <tr>
          <td className="border border-black bg-[#f1f5f9] font-bold text-gray-900 p-1 w-[16%] uppercase">
            Unidade Federal:
          </td>
          <td className="border border-black bg-white p-0 w-[34%]">
            <input
              type="text"
              value={cabecalho.uf}
              onChange={(e) => handleCabecalhoChange('uf', e.target.value)}
              className="w-full p-1 bg-transparent border-0 outline-none font-semibold text-gray-900 focus:bg-blue-50/50"
              placeholder="Ex: MG"
            />
          </td>
          <td className="border border-black bg-[#f1f5f9] font-bold text-gray-900 p-1 w-[16%] uppercase">
            Subdistrito:
          </td>
          <td className="border border-black bg-white p-0 w-[34%]">
            <input
              type="text"
              value={cabecalho.subdistrito}
              onChange={(e) => handleCabecalhoChange('subdistrito', e.target.value)}
              className="w-full p-1 bg-transparent border-0 outline-none font-semibold text-gray-900 focus:bg-blue-50/50"
            />
          </td>
        </tr>
        <tr>
          <td className="border border-black bg-[#f1f5f9] font-bold text-gray-900 p-1 uppercase">
            Distrito:
          </td>
          <td className="border border-black bg-white p-0">
            <input
              type="text"
              value={cabecalho.distrito}
              onChange={(e) => handleCabecalhoChange('distrito', e.target.value)}
              className="w-full p-1 bg-transparent border-0 outline-none font-semibold text-gray-900 focus:bg-blue-50/50"
            />
          </td>
          <td className="border border-black bg-[#f1f5f9] font-bold text-gray-900 p-1 uppercase">
            Sublocal:
          </td>
          <td className="border border-black bg-white p-0">
            <input
              type="text"
              value={cabecalho.sublocal}
              onChange={(e) => handleCabecalhoChange('sublocal', e.target.value)}
              className="w-full p-1 bg-transparent border-0 outline-none font-semibold text-gray-900 focus:bg-blue-50/50"
            />
          </td>
        </tr>
        <tr>
          <td className="border border-black bg-[#f1f5f9] font-bold text-gray-900 p-1 uppercase">
            Município:
          </td>
          <td className="border border-black bg-white p-0">
            <input
              type="text"
              value={cabecalho.municipio}
              onChange={(e) => handleCabecalhoChange('municipio', e.target.value)}
              className="w-full p-1 bg-transparent border-0 outline-none font-semibold text-gray-900 focus:bg-blue-50/50"
              placeholder="Ex: Belo Horizonte"
            />
          </td>
          <td className="border border-black bg-[#f1f5f9] font-bold text-gray-900 p-1 uppercase">
            Categoria:
          </td>
          <td className="border border-black bg-white p-0">
            <input
              type="text"
              value={cabecalho.categoria}
              onChange={(e) => handleCabecalhoChange('categoria', e.target.value)}
              className="w-full p-1 bg-transparent border-0 outline-none font-semibold text-gray-900 focus:bg-blue-50/50"
              placeholder="Ex: Estrato 1"
            />
          </td>
        </tr>
        <tr>
          <td className="border border-black bg-[#f1f5f9] font-bold text-gray-900 p-1 uppercase">
            Localidade:
          </td>
          <td className="border border-black bg-white p-0">
            <input
              type="text"
              value={cabecalho.localidade}
              onChange={(e) => handleCabecalhoChange('localidade', e.target.value)}
              className="w-full p-1 bg-transparent border-0 outline-none font-semibold text-gray-900 focus:bg-blue-50/50"
              placeholder="Ex: Centro / Bairro"
            />
          </td>
          <td className="border border-black bg-[#f1f5f9] font-bold text-gray-900 p-1 uppercase">
            {isReadOnlyTotalSel ? 'Quarteirões Selecionados:' : 'Total de Quarteirões:'}
          </td>
          <td className="border border-black bg-white p-1 font-extrabold text-blue-900 text-sm">
            {isReadOnlyTotalSel ? resumoGeral.totalQuarteiroesSel : cabecalho.total_quart}
          </td>
        </tr>
      </tbody>
    </table>
  );

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDownContainer}
      tabIndex={0}
      className="space-y-5 focus:outline-none"
    >
      {/* BARRA SUPERIOR DE RESUMO E STATS */}
      <div className="bg-gradient-to-r from-[#0f2e4a] via-[#163f64] to-[#1e5282] text-white p-4 sm:p-5 rounded-2xl shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-amber-400 text-[#0f2e4a] rounded-xl font-black text-sm shadow">
                LIRAa
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Quarteirões para o LIRAa / LIA
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-sky-200">
              Controle de Imóveis Bases, Amostragem Estatística (1 a cada 5 imóveis) e Seleção de Quarteirões para Inspeção.
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto justify-between md:justify-end">
            <div className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-white/10 border border-white/15">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  saveStatus === 'salvo'
                    ? 'bg-emerald-400 animate-pulse'
                    : saveStatus === 'salvando'
                    ? 'bg-amber-400 animate-spin'
                    : 'bg-red-400'
                }`}
              />
              <span className="text-sky-100">
                {saveStatus === 'salvo'
                  ? 'Salvo no navegador'
                  : saveStatus === 'salvando'
                  ? 'Salvando alterações...'
                  : 'Erro ao salvar'}
              </span>
            </div>

            <button
              onClick={handleSincronizarConfigEquipe}
              className="px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-200 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              title="Preencher com Bairro e Estrato configurados"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">Sincronizar Equipe</span>
            </button>
          </div>
        </div>

        {/* CARDS RESUMO RÁPIDO */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/10 text-xs">
          <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
            <span className="text-sky-200 block text-[11px] font-semibold">Total Quarteirões</span>
            <span className="text-xl font-black text-white">{cabecalho.total_quart}</span>
            <span className="text-[10px] text-sky-300 block">com imóveis informados</span>
          </div>

          <div className="bg-emerald-500/20 p-2.5 rounded-xl border border-emerald-400/30">
            <span className="text-emerald-200 block text-[11px] font-semibold">Amostra LIRAa</span>
            <span className="text-xl font-black text-emerald-300">
              {resumoGeral.totalQuarteiroesSel}
            </span>
            <span className="text-[10px] text-emerald-200 block">quarteirões selecionados</span>
          </div>

          <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
            <span className="text-sky-200 block text-[11px] font-semibold">Total Imóveis Base</span>
            <span className="text-xl font-black text-white">{resumoGeral.totalGeral}</span>
            <span className="text-[10px] text-sky-300 block">
              R: {resumoGeral.R} • C: {resumoGeral.C} • TB: {resumoGeral.TB}
            </span>
          </div>

          <div className="bg-amber-500/20 p-2.5 rounded-xl border border-amber-400/30">
            <span className="text-amber-200 block text-[11px] font-semibold">Imóveis a Inspecionar</span>
            <span className="text-xl font-black text-amber-300">{resumoGeral.totalImoveisLiraa}</span>
            <span className="text-[10px] text-amber-200 block">quota calculada da amostra</span>
          </div>
        </div>
      </div>

      {/* BARRA DE AÇÕES */}
      <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={gerarPDF}
            disabled={isGeneratingPdf}
            className="px-3.5 py-2 bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-60"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>{isGeneratingPdf ? 'Gerando PDF...' : 'Baixar PDF'}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            title="Imprimir as 3 folhas A4 completas (Ctrl+P)"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>

          <button
            onClick={() => setIsSorteioOpen(true)}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            title="Sorteio sistemático ou aleatório para amostragem do LIRAa"
          >
            <Dice5 className="w-4 h-4" />
            <span>Sortear Amostra LIRAa</span>
          </button>

          <button
            onClick={handleCarregarQuarteiroesSistema}
            className="px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            title="Preencher coluna Quarteirão com quarteirões da Gestão de Ciclo"
          >
            <Layers className="w-4 h-4 text-sky-600" />
            <span className="hidden sm:inline">Puxar do Sistema</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={exportarBackup}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            title="Exportar arquivo .json definitivo"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Backup</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            title="Restaurar backup .json"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={importarBackup}
            className="hidden"
          />

          <button
            onClick={limparSelecoes}
            className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition-all"
            title="Desmarcar todos os quarteirões selecionados para inspeção"
          >
            Limpar Seleções
          </button>

          <button
            onClick={limparTudo}
            className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 rounded-xl text-xs font-bold transition-all"
            title="Apagar todos os dados"
          >
            Limpar Tudo
          </button>
        </div>
      </div>

      {/* SELETOR DE MODO DE VISUALIZAÇÃO */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-100 p-2 rounded-2xl border border-gray-200">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setModoVisualizacao('folhas')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              modoVisualizacao === 'folhas'
                ? 'bg-white text-[#0f2e4a] shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Páginas Oficiais A4 (1, 2 e 3)</span>
          </button>

          <button
            onClick={() => setModoVisualizacao('selecionados')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              modoVisualizacao === 'selecionados'
                ? 'bg-white text-[#0f2e4a] shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>Quarteirões Selecionados ({resumoGeral.totalQuarteiroesSel})</span>
          </button>

          <button
            onClick={() => setModoVisualizacao('tabelaUnica')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              modoVisualizacao === 'tabelaUnica'
                ? 'bg-white text-[#0f2e4a] shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-purple-600" />
            <span>Todas as 128 Posições Contínuas</span>
          </button>
        </div>

        <div className="text-[11px] text-gray-500 font-medium hidden md:flex items-center gap-2">
          <span>💡 Dica: Clique no número da <strong>Posição</strong> para selecionar/desmarcar para o LIRAa.</span>
          <span>•</span>
          <span>Cole do Excel com <strong>Ctrl+V</strong>.</span>
        </div>
      </div>

      {/* CONTAINER DAS FOLHAS (UTILIZADO TANTO PARA TELA QUANTO PARA GERAÇÃO DE PDF E PRINT) */}
      <div ref={pdfContainerRef} className="liraa-print-area space-y-8">
        {/* ===================== PÁGINA 1 ===================== */}
        {(modoVisualizacao === 'folhas' || modoVisualizacao === 'tabelaUnica') && (
          <div
            data-pdf-folha="1"
            className="folha-a4 max-w-[820px] w-full mx-auto bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-300 font-sans flex flex-col justify-between space-y-3"
          >
            <div>
              {/* Cabeçalho do Documento */}
              <div className="text-center border-b-2 border-black pb-1 mb-2">
                <h2 className="text-[14px] font-black uppercase tracking-wider text-black m-0">
                  Quarteirões para o LIRAa
                </h2>
                <span className="text-[10.5px] font-bold text-gray-700">
                  Imóveis bases • Página 1 (Posições 001 a 064)
                </span>
              </div>

              {/* Tabela de Identificação */}
              {renderTabelaIdentificacao(false)}

              {/* Grid Duplo de Tabelas (Tabela 1 e Tabela 2) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-[9px] font-bold text-gray-700 mb-0.5 text-center bg-gray-100 py-0.5 border border-black border-b-0">
                    Posições 001 a 032
                  </div>
                  {renderTabela32(0)}
                </div>

                <div>
                  <div className="text-[9px] font-bold text-gray-700 mb-0.5 text-center bg-gray-100 py-0.5 border border-black border-b-0">
                    Posições 033 a 064
                  </div>
                  {renderTabela32(1)}
                </div>
              </div>
            </div>

            {/* Rodapé Página 1: Resumo Geral e Bloco de Assinatura */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-4 mt-2">
              {/* Tabela Resumo */}
              <table className="w-full sm:w-[290px] border-collapse border-[1.5px] border-black text-[9px]">
                <thead>
                  <tr className="bg-[#0f172a] text-white">
                    <th colSpan={2} className="p-1 border border-black text-center uppercase">
                      Resumo Geral de Imóveis
                    </th>
                  </tr>
                </thead>
                <tbody className="font-bold">
                  <tr>
                    <td className="p-1 border border-black bg-[#f1f5f9] text-left">R (Residencial)</td>
                    <td className="p-1 border border-black bg-white text-right">{resumoGeral.R}</td>
                  </tr>
                  <tr>
                    <td className="p-1 border border-black bg-[#f1f5f9] text-left">C (Comércio)</td>
                    <td className="p-1 border border-black bg-white text-right">{resumoGeral.C}</td>
                  </tr>
                  <tr>
                    <td className="p-1 border border-black bg-[#f1f5f9] text-left">TB (Terreno Baldio)</td>
                    <td className="p-1 border border-black bg-white text-right">{resumoGeral.TB}</td>
                  </tr>
                  <tr>
                    <td className="p-1 border border-black bg-[#f1f5f9] text-left">PE (Ponto Estratégico)</td>
                    <td className="p-1 border border-black bg-white text-right">{resumoGeral.PE}</td>
                  </tr>
                  <tr>
                    <td className="p-1 border border-black bg-[#f1f5f9] text-left">O (Outros)</td>
                    <td className="p-1 border border-black bg-white text-right">{resumoGeral.O}</td>
                  </tr>
                  <tr className="bg-[#0f172a] text-white font-black">
                    <td className="p-1 border border-black bg-[#0f172a] text-white text-left">
                      TOTAL GERAL
                    </td>
                    <td className="p-1 border border-black bg-[#0f172a] text-white text-right">
                      {resumoGeral.totalGeral}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Bloco de Assinatura */}
              <div className="flex-1 sm:max-w-[380px] border-[1.5px] border-black p-2 bg-[#fafafa] text-[8.5px] leading-tight">
                <strong className="block text-gray-900 font-bold mb-1">
                  Controle e Validação dos Imóveis Bases
                </strong>
                <span className="text-gray-700 block">
                  Declaro que os dados dos estratos e contagem dos quarteirões conferem com o cadastro de campo atualizado.
                </span>
                <div className="border-b border-black mt-4 text-center font-bold pt-1 text-[8px]">
                  Assinatura do Supervisor / Coordenador de Endemias
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== PÁGINA 2 ===================== */}
        {(modoVisualizacao === 'folhas' || modoVisualizacao === 'tabelaUnica') && (
          <div
            data-pdf-folha="2"
            className="folha-a4 max-w-[820px] w-full mx-auto bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-300 font-sans flex flex-col justify-between space-y-3"
          >
            <div>
              {/* Cabeçalho do Documento */}
              <div className="text-center border-b-2 border-black pb-1 mb-2">
                <h2 className="text-[14px] font-black uppercase tracking-wider text-black m-0">
                  Quarteirões para o LIRAa
                </h2>
                <span className="text-[10.5px] font-bold text-gray-700">
                  Imóveis bases • Página 2 (Posições 065 a 128)
                </span>
              </div>

              {/* Tabela de Identificação */}
              {renderTabelaIdentificacao(false)}

              {/* Grid Duplo de Tabelas (Tabela 3 e Tabela 4) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-[9px] font-bold text-gray-700 mb-0.5 text-center bg-gray-100 py-0.5 border border-black border-b-0">
                    Posições 065 a 096
                  </div>
                  {renderTabela32(2)}
                </div>

                <div>
                  <div className="text-[9px] font-bold text-gray-700 mb-0.5 text-center bg-gray-100 py-0.5 border border-black border-b-0">
                    Posições 097 a 128
                  </div>
                  {renderTabela32(3)}
                </div>
              </div>
            </div>

            {/* Rodapé Página 2: Observações e Ocorrências */}
            <div className="border-[1.5px] border-black p-2 bg-[#fafafa] text-[9px] mt-2">
              <strong className="block text-gray-900 font-bold mb-1">
                Observações e Ocorrências de Campo:
              </strong>
              <div className="h-9 border-b border-dotted border-gray-400 mt-1"></div>
              <div className="mt-2 flex flex-wrap justify-between items-center text-[8.5px] text-gray-800 gap-2">
                <span>Data de Levantamento: ____/____/________</span>
                <span>Município/Estrato: {cabecalho.municipio || '_________________'} / {cabecalho.categoria || '_____'}</span>
                <span>Equipe Responsável: _________________________</span>
              </div>
            </div>
          </div>
        )}

        {/* ===================== PÁGINA 3: QUARTEIRÕES SELECIONADOS PARA O LIRAA ===================== */}
        {(modoVisualizacao === 'folhas' || modoVisualizacao === 'selecionados') && (
          <div
            data-pdf-folha="3"
            className="folha-a4 max-w-[820px] w-full mx-auto bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-300 font-sans flex flex-col justify-between space-y-3"
          >
            <div>
              {/* Cabeçalho */}
              <div className="text-center border-b-2 border-black pb-1 mb-2">
                <h2 className="text-[14px] font-black uppercase tracking-wider text-black m-0">
                  Quarteirões para o LIRAa
                </h2>
                <span className="text-[10.5px] font-bold text-amber-800">
                  Quarteirões Selecionados para Inspeção (Amostra do LIRAa)
                </span>
              </div>

              {/* Tabela de Identificação com Quarteirões Selecionados */}
              {renderTabelaIdentificacao(true)}

              {/* Tabela de Quarteirões Selecionados */}
              <div className="w-full overflow-x-auto bg-white border-[1.5px] border-black mt-2">
                <table className="w-full border-collapse text-[9.5px] tabular-nums font-sans">
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
                    <tr className="bg-[#1e293b] text-white font-bold text-[8.8px]">
                      <th className="border border-black p-1 text-center">Posição</th>
                      <th className="border border-black p-1 text-center">Quarteirão</th>
                      <th className="border border-black p-1 text-center">R</th>
                      <th className="border border-black p-1 text-center">C</th>
                      <th className="border border-black p-1 text-center">TB</th>
                      <th className="border border-black p-1 text-center">PE</th>
                      <th className="border border-black p-1 text-center">O</th>
                      <th className="border border-black p-1 text-center">TOTAL</th>
                      <th className="border border-black p-1 text-center bg-[#c2410c] text-white">LIRAa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quarteiroesSelecionados.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="p-6 text-center text-gray-500 italic bg-[#f8fafc] border border-black"
                        >
                          Nenhum quarteirão selecionado ainda. Clique no número da{' '}
                          <strong>Posição</strong> de qualquer quarteirão nas Páginas 1 e 2, ou use o{' '}
                          <strong>Sorteio Amostral</strong> acima para gerar a amostra estatística do LIRAa.
                        </td>
                      </tr>
                    ) : (
                      quarteiroesSelecionados.map((item, idx) => {
                        const tot = calcularTotalLinha(item.celulas);
                        const quota = calcularLiraaQuota(tot);
                        const isZebrado = idx % 2 === 1;

                        return (
                          <tr
                            key={item.pos}
                            className={isZebrado ? 'bg-[#fefce8]' : 'bg-[#fffbeb]'}
                          >
                            <td className="border border-black p-1 text-center font-extrabold bg-[#059669] text-white">
                              {item.pos}
                            </td>
                            <td className="border border-black p-1 text-center font-bold text-gray-900">
                              {item.celulas[0] || '--'}
                            </td>
                            <td className="border border-black p-1 text-center text-gray-800">
                              {item.celulas[1] || ''}
                            </td>
                            <td className="border border-black p-1 text-center text-gray-800">
                              {item.celulas[2] || ''}
                            </td>
                            <td className="border border-black p-1 text-center text-gray-800">
                              {item.celulas[3] || ''}
                            </td>
                            <td className="border border-black p-1 text-center text-gray-800">
                              {item.celulas[4] || ''}
                            </td>
                            <td className="border border-black p-1 text-center text-gray-800">
                              {item.celulas[5] || ''}
                            </td>
                            <td className="border border-black p-1 text-center font-bold bg-[#e2e8f0] text-gray-900">
                              {tot > 0 ? tot : ''}
                            </td>
                            <td className="border border-black p-1 text-center font-black text-[10px] bg-[#fde68a] text-[#78350f]">
                              {quota}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {quarteiroesSelecionados.length > 0 && (
                    <tfoot>
                      <tr className="bg-[#0f172a] text-white font-bold text-[9px]">
                        <td colSpan={2} className="border border-black p-1 text-center uppercase tracking-wider">
                          TOTAL DA AMOSTRA
                        </td>
                        <td className="border border-black p-1 text-center">
                          {quarteiroesSelecionados.reduce((acc, cur) => acc + (parseInt(cur.celulas[1], 10) || 0), 0) || ''}
                        </td>
                        <td className="border border-black p-1 text-center">
                          {quarteiroesSelecionados.reduce((acc, cur) => acc + (parseInt(cur.celulas[2], 10) || 0), 0) || ''}
                        </td>
                        <td className="border border-black p-1 text-center">
                          {quarteiroesSelecionados.reduce((acc, cur) => acc + (parseInt(cur.celulas[3], 10) || 0), 0) || ''}
                        </td>
                        <td className="border border-black p-1 text-center">
                          {quarteiroesSelecionados.reduce((acc, cur) => acc + (parseInt(cur.celulas[4], 10) || 0), 0) || ''}
                        </td>
                        <td className="border border-black p-1 text-center">
                          {quarteiroesSelecionados.reduce((acc, cur) => acc + (parseInt(cur.celulas[5], 10) || 0), 0) || ''}
                        </td>
                        <td className="border border-black p-1 text-center bg-[#334155] font-black text-white">
                          {quarteiroesSelecionados.reduce((acc, cur) => acc + calcularTotalLinha(cur.celulas), 0) || ''}
                        </td>
                        <td className="border border-black p-1 text-center bg-[#c2410c] font-black text-white">
                          {String(resumoGeral.totalImoveisLiraa).padStart(2, '0')}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Rodapé da Página 3 */}
            <div className="border-[1.5px] border-black p-2 bg-[#fafafa] text-[9px] mt-3">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                <span className="font-semibold text-gray-800">
                  Metodologia LIRAa: Inspeção de 1 a cada 5 imóveis (20%) em quarteirões sorteados.
                </span>
                <span className="font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                  Total de Imóveis Programados na Amostra: {resumoGeral.totalImoveisLiraa}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ====== MENU DE CONTEXTO ====== */}
      {menuCtx.aberto && (
        <div
          style={{ top: menuCtx.y, left: menuCtx.x }}
          className="fixed z-50 bg-white border border-gray-300 rounded-xl shadow-2xl p-1.5 min-w-[200px] text-xs font-semibold text-gray-800 space-y-1 animate-in fade-in zoom-in-95 duration-100"
        >
          <button
            onClick={() => {
              copiarBloco(false);
              setMenuCtx({ aberto: false, x: 0, y: 0 });
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-blue-50 text-left text-gray-700 hover:text-blue-700"
          >
            <span>📋 Copiar seleção</span>
            <span className="text-[10px] text-gray-400">Ctrl+C</span>
          </button>

          <button
            onClick={() => {
              copiarBloco(true);
              setMenuCtx({ aberto: false, x: 0, y: 0 });
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-blue-50 text-left text-gray-700 hover:text-blue-700"
          >
            <span>✂️ Recortar</span>
            <span className="text-[10px] text-gray-400">Ctrl+X</span>
          </button>

          <button
            onClick={abrirCaixaColar}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-blue-50 text-left text-gray-700 hover:text-blue-700"
          >
            <span>📥 Colar texto / tabela</span>
            <span className="text-[10px] text-gray-400">Ctrl+V</span>
          </button>

          <div className="border-t border-gray-200 my-1" />

          <button
            onClick={() => {
              limparBloco();
              setMenuCtx({ aberto: false, x: 0, y: 0 });
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-red-50 text-left text-red-600"
          >
            <span>🗑 Limpar células</span>
            <span className="text-[10px] text-red-400">Del</span>
          </button>
        </div>
      )}

      {/* ====== MODAL COLAR FLUTUANTE ====== */}
      {isCaixaColarAberta && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-blue-500 w-full max-w-md p-5 space-y-3 animate-in fade-in zoom-in-95">
            <div>
              <h3 className="font-extrabold text-base text-gray-900 flex items-center gap-2">
                <Clipboard className="w-5 h-5 text-blue-600" />
                <span>Colar Dados na Seleção</span>
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                Cole aqui dados copiados do Excel ou de outra planilha (separados por tabulação). Eles serão preenchidos nas células selecionadas.
              </p>
            </div>

            <textarea
              value={textoColar}
              onChange={(e) => setTextoColar(e.target.value)}
              placeholder="Cole aqui os dados (Ctrl+V)..."
              rows={5}
              autoFocus
              className="w-full p-3 border border-gray-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsCaixaColarAberta(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={aplicarColarCaixa}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
              >
                Aplicar e Preencher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== MODAL SORTEIO AMSTRAL LIRAA ====== */}
      {isSorteioOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-amber-400 w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <Dice5 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-gray-900 leading-tight">
                  Sorteio de Quarteirões (Amostra LIRAa)
                </h3>
                <p className="text-xs text-gray-500">
                  Gere a seleção aleatória ou sistemática dos quarteirões para inspeção.
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Método de Amostragem:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMetodoSorteio('intervalo')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      metodoSorteio === 'intervalo'
                        ? 'border-amber-500 bg-amber-50 font-bold text-amber-900 ring-1 ring-amber-400'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className="block font-bold">Sistemática (Intervalo k)</span>
                    <span className="text-[10px] text-gray-500 block">Ex: 1 a cada 5 quarteirões</span>
                  </button>

                  <button
                    onClick={() => setMetodoSorteio('quantidade')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      metodoSorteio === 'quantidade'
                        ? 'border-amber-500 bg-amber-50 font-bold text-amber-900 ring-1 ring-amber-400'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className="block font-bold">Aleatória Simples</span>
                    <span className="text-[10px] text-gray-500 block">Sortear N quarteirões</span>
                  </button>
                </div>
              </div>

              {metodoSorteio === 'intervalo' ? (
                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Intervalo de Amostragem (k):
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={intervaloSorteio}
                    onChange={(e) => setIntervaloSorteio(parseInt(e.target.value, 10) || 5)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    O Ministério da Saúde preconiza amostragem de 20% (intervalo de 1 a cada 5 quarteirões cadastrados com início aleatório).
                  </p>
                </div>
              ) : (
                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Quantidade de Quarteirões a Sortear:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={TOTAL_ROWS}
                    value={quantidadeSorteio}
                    onChange={(e) => setQuantidadeSorteio(parseInt(e.target.value, 10) || 10)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                onClick={() => setIsSorteioOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={executarSorteioLiraa}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Dice5 className="w-4 h-4" />
                <span>Sortear e Aplicar Seleção</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
