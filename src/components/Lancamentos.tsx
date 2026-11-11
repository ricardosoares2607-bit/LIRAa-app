import React, { useState, useEffect } from 'react';
import { LancamentoForm, DepositosGrupo, QuarteiraoConcluido } from '../types';
import {
  getCicloAtivoCompleto, getCicloAtivoNome, getSemanaAtiva,
  getConfigEquipe, getQuarteiroes, getLancamentosDict, setLancamentosDict,
  formatarDataBR, obterDiaDaSemana, parseNumber, pad2
} from '../utils/storage';
import {
  PlusCircle, History, CheckCircle2, ArrowLeft,
  Calendar, Layers, Save, Check, UserCheck, ShieldCheck,
  Search, Bug, RotateCcw
} from 'lucide-react';

interface LancamentosProps {
  onNotify: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  onRefreshData: () => void;
}

export const Lancamentos: React.FC<LancamentosProps> = ({ onNotify, onRefreshData }) => {
  const [viewMode, setViewMode] = useState<'escolha' | 'historico' | 'cabecalho' | 'cockpit' | 'formulario' | 'finalizacao'>('escolha');

  // Active Context
  const [cicloNome, setCicloNome] = useState<string>('');
  const [semanaNome, setSemanaNome] = useState<string>('');
  const [dataTrabalho, setDataTrabalho] = useState<string>(new Date().toISOString().split('T')[0]);
  const [atividade, setAtividade] = useState<string>('Levantamento + Tratamento');

  // Cabecalho Agents Selection
  const [agentesProgramados, setAgentesProgramados] = useState<string[]>([]);
  const [agentesTrabalhados, setAgentesTrabalhados] = useState<string[]>([]);

  // Cockpit
  const [agenteAtual, setAgenteAtual] = useState<string>('');
  const [formAtual, setFormAtual] = useState<number>(1);
  const [totalForms, setTotalForms] = useState<number>(1);
  const [modoEdicao, setModoEdicao] = useState<boolean>(true);

  // Form State
  const [quarteiroesForm, setQuarteiroesForm] = useState<QuarteiraoConcluido[]>([]);
  const [supervisaoSimNao, setSupervisaoSimNao] = useState<'SIM' | 'NAO'>('NAO');
  const [supervisaoDireta, setSupervisaoDireta] = useState<number>(0);
  const [supervisaoIndireta, setSupervisaoIndireta] = useState<number>(0);

  // Imóveis
  const [R, setR] = useState<string>('00');
  const [C, setC] = useState<string>('00');
  const [TB, setTB] = useState<string>('00');
  const [PE, setPE] = useState<string>('00');
  const [O, setO] = useState<string>('00');

  const [R_Trat, setR_Trat] = useState<string>('00');
  const [C_Trat, setC_Trat] = useState<string>('00');
  const [TB_Trat, setTB_Trat] = useState<string>('00');
  const [PE_Trat, setPE_Trat] = useState<string>('00');
  const [O_Trat, setO_Trat] = useState<string>('00');

  const [R_Foc, setR_Foc] = useState<string>('00');
  const [C_Foc, setC_Foc] = useState<string>('00');
  const [TB_Foc, setTB_Foc] = useState<string>('00');
  const [PE_Foc, setPE_Foc] = useState<string>('00');
  const [O_Foc, setO_Foc] = useState<string>('00');

  const [fechados, setFechados] = useState<string>('00');
  const [abandonados, setAbandonados] = useState<string>('00');
  const [recusados, setRecusados] = useState<string>('00');
  const [recuperados, setRecuperados] = useState<string>('00');

  // Depósitos
  const [depositos, setDepositos] = useState<DepositosGrupo>({
    A1: { encontrados: '00', naoInspecionados: '00', tratados: '00', foco: '00' },
    A2: { encontrados: '00', naoInspecionados: '00', tratados: '00', foco: '00' },
    B: { encontrados: '00', naoInspecionados: '00', tratados: '00', foco: '00' },
    C: { encontrados: '00', naoInspecionados: '00', tratados: '00', foco: '00' },
    D1: { encontrados: '00', naoInspecionados: '00', tratados: '00', foco: '00' },
    D2: { encontrados: '00', naoInspecionados: '00', tratados: '00', foco: '00' },
    E: { encontrados: '00', naoInspecionados: '00', tratados: '00', foco: '00' },
  });

  const [depositosEliminados, setDepositosEliminados] = useState<string>('00');
  const [litrosTratados, setLitrosTratados] = useState<string>('00');
  const [gramasLarvicida, setGramasLarvicida] = useState<string>('0.0');

  // Amostras LIRAa
  const [amostrasColetadas, setAmostrasColetadas] = useState<'SIM' | 'NAO'>('NAO');
  const [amostraInicial, setAmostraInicial] = useState<number>(0);
  const [amostraFinal, setAmostraFinal] = useState<number>(0);

  // Ocorrências & Detalhamento
  const [ocorrencias, setOcorrencias] = useState<string[]>([]);
  const [detalhamento, setDetalhamento] = useState<string>('');

  // Search/Filter for History
  const [filterData, setFilterData] = useState<string>('');
  const [filterSemana, setFilterSemana] = useState<string>('');
  const [filterAgente, setFilterAgente] = useState<string>('');

  useEffect(() => {
    carregarCicloESemana();
  }, []);

  const carregarCicloESemana = () => {
    setCicloNome(getCicloAtivoNome());
    const sem = getSemanaAtiva();
    setSemanaNome(sem ? sem.nome : 'Não configurada');
    const cfg = getConfigEquipe();
    setAgentesProgramados(cfg.agentes);
    setAgentesTrabalhados(cfg.agentes);
  };

  const handleDepositoChange = (tipo: keyof DepositosGrupo, campo: 'encontrados' | 'naoInspecionados' | 'tratados' | 'foco', val: string) => {
    setDepositos((prev) => ({
      ...prev,
      [tipo]: {
        ...prev[tipo],
        [campo]: val
      }
    }));
  };

  const toggleOcorrencia = (item: string) => {
    setOcorrencias((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]));
  };

  const adicionarBlocoQuarteirao = () => {
    const todosBlocos = getQuarteiroes();
    const disponivel = todosBlocos.find((q) => !quarteiroesForm.some((item) => item.numero === q.numero));
    const num = disponivel ? disponivel.numero : (quarteiroesForm.length + 1).toString();
    setQuarteiroesForm((prev) => [...prev, { numero: num, concluido: false }]);
  };

  const removerBlocoQuarteirao = (index: number) => {
    setQuarteiroesForm((prev) => prev.filter((_, i) => i !== index));
  };

  const updateQuarteiraoForm = (index: number, campo: 'numero' | 'concluido', val: any) => {
    setQuarteiroesForm((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [campo]: val } : item))
    );
  };

  // Calculations
  const totalInspecionados = parseNumber(R) + parseNumber(C) + parseNumber(TB) + parseNumber(PE) + parseNumber(O);
  const totalTratados = parseNumber(R_Trat) + parseNumber(C_Trat) + parseNumber(TB_Trat) + parseNumber(PE_Trat) + parseNumber(O_Trat);
  const totalFocados = parseNumber(R_Foc) + parseNumber(C_Foc) + parseNumber(TB_Foc) + parseNumber(PE_Foc) + parseNumber(O_Foc);

  const numFechados = parseNumber(fechados);
  const numAbandonados = parseNumber(abandonados);
  const numRecusados = parseNumber(recusados);
  const numRecuperados = parseNumber(recuperados);

  const totalPendencia = numFechados + numRecusados + numAbandonados - numRecuperados;
  const totalInformados = totalInspecionados + numFechados + numRecusados + numAbandonados - numRecuperados;
  const indicePendencia = totalInformados > 0 ? (100 / totalInformados) * totalPendencia : 0;

  // Depositos Totals
  const tiposDep = ['A1', 'A2', 'B', 'C', 'D1', 'D2', 'E'] as const;
  const totalDepEncontrados = tiposDep.reduce((acc, t) => acc + parseNumber(depositos[t].encontrados), 0);
  const totalDepNaoInspec = tiposDep.reduce((acc, t) => acc + parseNumber(depositos[t].naoInspecionados), 0);
  const totalDepInspec = tiposDep.reduce((acc, t) => acc + Math.max(0, parseNumber(depositos[t].encontrados) - parseNumber(depositos[t].naoInspecionados)), 0);
  const totalDepTratados = tiposDep.reduce((acc, t) => acc + parseNumber(depositos[t].tratados), 0);
  const totalDepFocados = tiposDep.reduce((acc, t) => acc + parseNumber(depositos[t].foco), 0);

  // Larvicida Auto
  useEffect(() => {
    const lit = parseNumber(litrosTratados);
    setGramasLarvicida((lit * 0.5).toFixed(1));
  }, [litrosTratados]);

  // Actions
  const confirmarConfigDia = () => {
    if (!dataTrabalho) {
      onNotify('⚠️ Selecione a data do trabalho.', 'warning');
      return;
    }
    if (agentesTrabalhados.length === 0) {
      onNotify('⚠️ Selecione ao menos 1 agente trabalhado.', 'warning');
      return;
    }
    setViewMode('cockpit');
    onNotify('🚀 Painel do Dia aberto com sucesso!', 'success');
  };

  const abrirAgenteForm = (agente: string) => {
    setAgenteAtual(agente);
    const dict = getLancamentosDict();
    const chave = `${agente}_${dataTrabalho}_1`;
    const formExistente = dict[chave];

    if (formExistente) {
      carregarFormNoEstado(formExistente);
      setModoEdicao(false);
      onNotify(`👁 Visualizando lançamentos de ${agente}`, 'info');
    } else {
      limparEstadoForm();
      setAgenteAtual(agente);
      setFormAtual(1);
      setTotalForms(1);
      setModoEdicao(true);
      onNotify(`📝 Iniciando formulário de ${agente}`, 'info');
    }
    setViewMode('formulario');
  };

  const carregarFormNoEstado = (f: LancamentoForm) => {
    setAgenteAtual(f.agente);
    setFormAtual(f.formIndex || 1);
    setTotalForms(f.totalForms || 1);
    setR(f.R?.toString() || '00');
    setC(f.C?.toString() || '00');
    setTB(f.TB?.toString() || '00');
    setPE(f.PE?.toString() || '00');
    setO(f.O?.toString() || '00');

    setR_Trat(f.R_Trat?.toString() || '00');
    setC_Trat(f.C_Trat?.toString() || '00');
    setTB_Trat(f.TB_Trat?.toString() || '00');
    setPE_Trat(f.PE_Trat?.toString() || '00');
    setO_Trat(f.O_Trat?.toString() || '00');

    setR_Foc(f.R_Foc?.toString() || '00');
    setC_Foc(f.C_Foc?.toString() || '00');
    setTB_Foc(f.TB_Foc?.toString() || '00');
    setPE_Foc(f.PE_Foc?.toString() || '00');
    setO_Foc(f.O_Foc?.toString() || '00');

    setFechados(f.fechados?.toString() || '00');
    setAbandonados(f.abandonados?.toString() || '00');
    setRecusados(f.recusados?.toString() || '00');
    setRecuperados(f.recuperados?.toString() || '00');

    if (f.depositos) setDepositos(f.depositos);
    setDepositosEliminados(f.depositosEliminados?.toString() || '00');
    setLitrosTratados(f.litrosTratados?.toString() || '00');
    setGramasLarvicida(f.gramasLarvicida?.toString() || '0.0');

    setSupervisaoSimNao((f.supervisao as any) || 'NAO');
    setSupervisaoDireta(f.supervisaoDireta || 0);
    setSupervisaoIndireta(f.supervisaoIndireta || 0);

    setOcorrencias(f.ocorrencias || []);
    setDetalhamento(f.detalhamento || '');
    setQuarteiroesForm(f.quarteiroes || []);
  };

  const limparEstadoForm = () => {
    setR('00'); setC('00'); setTB('00'); setPE('00'); setO('00');
    setR_Trat('00'); setC_Trat('00'); setTB_Trat('00'); setPE_Trat('00'); setO_Trat('00');
    setR_Foc('00'); setC_Foc('00'); setTB_Foc('00'); setPE_Foc('00'); setO_Foc('00');
    setFechados('00'); setAbandonados('00'); setRecusados('00'); setRecuperados('00');

    setDepositos({
      A1: { encontrados: '00', naoInspecionados: '00', tratados: '00', foco: '00' },
      A2: { encontrados: '00', naoInspecionados: '00', tratados: '00', foco: '00' },
      B: { encontrados: '00', naoInspecionados: '00', tratados: '00', foco: '00' },
      C: { encontrados: '00', naoInspecionados: '00', tratados: '00', foco: '00' },
      D1: { encontrados: '00', naoInspecionados: '00', tratados: '00', foco: '00' },
      D2: { encontrados: '00', naoInspecionados: '00', tratados: '00', foco: '00' },
      E: { encontrados: '00', naoInspecionados: '00', tratados: '00', foco: '00' },
    });

    setDepositosEliminados('00');
    setLitrosTratados('00');
    setGramasLarvicida('0.0');
    setSupervisaoSimNao('NAO');
    setSupervisaoDireta(0);
    setSupervisaoIndireta(0);
    setOcorrencias([]);
    setDetalhamento('');
    setQuarteiroesForm([]);
  };

  const salvarFormularioAtual = () => {
    if (!agenteAtual) return;

    const dict = getLancamentosDict();
    const chave = `${agenteAtual}_${dataTrabalho}_${formAtual}`;

    const novoForm: LancamentoForm = {
      data: dataTrabalho,
      agente: agenteAtual,
      totalForms: totalForms,
      formIndex: formAtual,
      R, C, TB, PE, O,
      R_Trat, C_Trat, TB_Trat, PE_Trat, O_Trat,
      R_Foc, C_Foc, TB_Foc, PE_Foc, O_Foc,
      fechados, abandonados, recusados, recuperados,
      depositosEliminados, litrosTratados, gramasLarvicida,
      supervisao: supervisaoSimNao,
      supervisaoDireta, supervisaoIndireta,
      ocorrencias, detalhamento,
      quarteiroes: quarteiroesForm,
      semana: semanaNome,
      ciclo: cicloNome,
      dia: obterDiaDaSemana(dataTrabalho),
      atividade,
      depositos,
      amostrasColetadas,
      amostraInicial,
      amostraFinal,
      quantidadeTubitos: Math.max(0, amostraFinal - amostraInicial)
    };

    dict[chave] = novoForm;
    setLancamentosDict(dict);

    onNotify(`✅ Formulário ${formAtual} de ${agenteAtual} salvo!`, 'success');
    onRefreshData();

    if (formAtual < totalForms) {
      const proximaChave = `${agenteAtual}_${dataTrabalho}_${formAtual + 1}`;
      if (dict[proximaChave]) {
        carregarFormNoEstado(dict[proximaChave]);
      } else {
        limparEstadoForm();
        setFormAtual(formAtual + 1);
      }
    }
  };

  const finalizarAgente = () => {
    salvarFormularioAtual();
    onNotify(`🟢 Agente ${agenteAtual} concluído!`, 'success');

    // Verify if all worked agents have concluded
    const dict = getLancamentosDict();
    const todosFinalizados = agentesTrabalhados.every((ag) => {
      return Object.keys(dict).some((k) => k.startsWith(`${ag}_${dataTrabalho}_`));
    });

    if (todosFinalizados) {
      setViewMode('finalizacao');
    } else {
      setViewMode('cockpit');
    }
  };

  // Grouped history
  const dict = getLancamentosDict();
  const lancamentosArray = Object.values(dict);
  const gruposPorData = lancamentosArray.reduce((acc, f) => {
    if (!f.data) return acc;
    if (!acc[f.data]) {
      acc[f.data] = {
        data: f.data,
        dia: f.dia || obterDiaDaSemana(f.data),
        semana: f.semana || '--',
        ciclo: f.ciclo || '--',
        agentesSet: new Set<string>(),
        forms: [] as LancamentoForm[]
      };
    }
    acc[f.data].agentesSet.add(f.agente);
    acc[f.data].forms.push(f);
    return acc;
  }, {} as Record<string, { data: string; dia: string; semana: string; ciclo: string; agentesSet: Set<string>; forms: LancamentoForm[] }>);

  const listaHistorico = Object.values(gruposPorData)
    .filter((g) => {
      if (filterData && !g.data.includes(filterData)) return false;
      if (filterSemana && !g.semana.toLowerCase().includes(filterSemana.toLowerCase())) return false;
      if (filterAgente && !Array.from(g.agentesSet).some((a) => a.toLowerCase().includes(filterAgente.toLowerCase()))) return false;
      return true;
    })
    .sort((a, b) => b.data.localeCompare(a.data));

  return (
    <div className="space-y-6">
      {/* CICLO TOP INFO BAR */}
      <div className="bg-[#0f2e4a] text-white rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-4 text-xs font-semibold">
        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" /> {cicloNome}
        </span>
        <span className="bg-sky-500/20 text-sky-300 border border-sky-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" /> {semanaNome}
        </span>
        <span className="bg-emerald-500 text-white px-2.5 py-0.5 rounded-full ml-auto font-bold">🟢 ATIVO</span>
      </div>

      {/* SCREEN SWITCHER */}

      {/* 1. TELA ESCOLHA */}
      {viewMode === 'escolha' && (
        <div className="max-w-3xl mx-auto space-y-8 py-4">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-extrabold text-[#0f2e4a]">📝 Lançamentos Diários</h2>
            <p className="text-sm text-gray-500">Escolha a ação desejada para gerenciar os dados de campo</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              onClick={() => setViewMode('cabecalho')}
              className="bg-white rounded-2xl p-8 border-2 border-gray-200 hover:border-blue-600 hover:shadow-xl transition-all cursor-pointer group text-center space-y-4"
            >
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                <PlusCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#0f2e4a] mb-1">Novo Lançamento</h3>
                <p className="text-xs text-gray-500 leading-relaxed">Iniciar e registrar dados de uma nova data de trabalho</p>
              </div>
              <span className="inline-block bg-blue-100 text-blue-700 font-bold text-xs px-4 py-1.5 rounded-full">Começar agora →</span>
            </div>

            <div
              onClick={() => setViewMode('historico')}
              className="bg-white rounded-2xl p-8 border-2 border-gray-200 hover:border-purple-600 hover:shadow-xl transition-all cursor-pointer group text-center space-y-4"
            >
              <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                <History className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#0f2e4a] mb-1">Histórico de Lançamentos</h3>
                <p className="text-xs text-gray-500 leading-relaxed">Consultar, filtrar ou corrigir lançamentos anteriores</p>
              </div>
              <span className="inline-block bg-purple-100 text-purple-700 font-bold text-xs px-4 py-1.5 rounded-full">Ver histórico →</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. TELA HISTÓRICO */}
      {viewMode === 'historico' && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setViewMode('escolha')}
              className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 font-semibold text-xs rounded-xl flex items-center gap-1.5 text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <h2 className="text-lg font-bold text-[#0f2e4a]">📅 Histórico de Lançamentos</h2>
            <div className="w-20"></div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Filtrar Data</label>
              <input
                type="date"
                value={filterData}
                onChange={(e) => setFilterData(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Filtrar Semana</label>
              <input
                type="text"
                placeholder="Ex: 1ª Semana"
                value={filterSemana}
                onChange={(e) => setFilterSemana(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Filtrar Agente</label>
              <input
                type="text"
                placeholder="Nome do agente"
                value={filterAgente}
                onChange={(e) => setFilterAgente(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="space-y-3">
            {listaHistorico.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-dashed border-gray-300">
                📭 Nenhum lançamento encontrado no histórico.
              </div>
            ) : (
              listaHistorico.map((g) => (
                <div
                  key={g.data}
                  onClick={() => {
                    setDataTrabalho(g.data);
                    setAgentesTrabalhados(Array.from(g.agentesSet));
                    setViewMode('cockpit');
                    onNotify(`📂 Carregando histórico da data ${formatarDataBR(g.data)}`, 'info');
                  }}
                  className="bg-white p-5 rounded-2xl border border-gray-200 hover:border-purple-600 hover:shadow-md transition-all cursor-pointer flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="font-extrabold text-[#0f2e4a] text-base">
                      {g.dia} — {formatarDataBR(g.data)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span className="bg-gray-100 px-2.5 py-0.5 rounded-full font-semibold">📅 {g.semana}</span>
                      <span className="bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full font-semibold">🔄 {g.ciclo}</span>
                      <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-semibold">
                        👤 {Array.from(g.agentesSet).join(', ')}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="bg-purple-600 text-white font-extrabold text-xs px-3 py-1 rounded-full">
                      {g.forms.length} formulários
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3. CABEÇALHO DO DIA */}
      {viewMode === 'cabecalho' && (
        <div className="bg-gradient-to-br from-sky-50 to-blue-50 border-2 border-sky-300 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-sky-200 pb-3">
            <h3 className="font-extrabold text-lg text-[#0f2e4a] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-sky-700" /> Configuração Geral do Dia de Trabalho
            </h3>
            <span className="text-xs text-red-600 font-bold">* campos obrigatórios</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-sky-900 mb-1">🔄 Ciclo *</label>
              <input
                type="text"
                readOnly
                value={cicloNome}
                className="w-full p-2.5 bg-white/80 border border-sky-300 rounded-lg text-xs font-bold text-gray-700"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-sky-900 mb-1">📅 Semana *</label>
              <input
                type="text"
                readOnly
                value={semanaNome}
                className="w-full p-2.5 bg-white/80 border border-sky-300 rounded-lg text-xs font-bold text-gray-700"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-sky-900 mb-1">📅 Data do Trabalho *</label>
              <input
                type="date"
                value={dataTrabalho}
                onChange={(e) => setDataTrabalho(e.target.value)}
                className="w-full p-2.5 bg-white border border-sky-300 rounded-lg text-xs font-extrabold text-[#0f2e4a]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-sky-900 mb-1">📋 Atividade *</label>
              <select
                value={atividade}
                onChange={(e) => setAtividade(e.target.value)}
                className="w-full p-2.5 bg-white border border-sky-300 rounded-lg text-xs font-bold text-gray-800"
              >
                <option value="Tratamento">Tratamento</option>
                <option value="Levantamento">Levantamento</option>
                <option value="Levantamento + Tratamento">Levantamento + Tratamento</option>
                <option value="Ponto Estratégico">Ponto Estratégico</option>
                <option value="LIRAa">LIRAa</option>
              </select>
            </div>
          </div>

          {/* Agentes Checkboxes */}
          <div className="space-y-4 pt-2 border-t border-sky-200">
            <div>
              <label className="block text-xs font-bold text-sky-900 mb-2">👥 Agentes Trabalhados no Dia *</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {agentesProgramados.map((ag) => {
                  const checked = agentesTrabalhados.includes(ag);
                  return (
                    <label
                      key={ag}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all text-xs font-bold ${
                        checked ? 'bg-white border-blue-600 text-blue-900 shadow-sm' : 'bg-white/50 border-gray-200 text-gray-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setAgentesTrabalhados((prev) =>
                            prev.includes(ag) ? prev.filter((a) => a !== ag) : [...prev, ag]
                          );
                        }}
                        className="accent-[#0f2e4a] w-4 h-4"
                      />
                      <span>{ag}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            onClick={confirmarConfigDia}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-extrabold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
          >
            🚀 Confirmar Dia e Abrir Painel de Agentes
          </button>
        </div>
      )}

      {/* 4. COCKPIT (PANEL DE AGENTES) */}
      {viewMode === 'cockpit' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode('cabecalho')}
                className="px-3 py-1.5 border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-semibold text-gray-700"
              >
                ✏️ Editar Config
              </button>
              <div className="text-xs font-bold text-[#0f2e4a]">
                📅 {formatarDataBR(dataTrabalho)} | 📋 {atividade} | 📆 {obterDiaDaSemana(dataTrabalho)}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[#0f2e4a] flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" /> Painel de Lançamentos por Agente
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {agentesTrabalhados.map((ag) => {
                const dictKey = `${ag}_${dataTrabalho}_1`;
                const temLancamento = !!dict[dictKey];

                return (
                  <div
                    key={ag}
                    onClick={() => abrirAgenteForm(ag)}
                    className={`bg-white rounded-2xl p-5 border-2 transition-all cursor-pointer shadow-sm hover:shadow-md ${
                      temLancamento ? 'border-emerald-500 border-l-8' : 'border-amber-400 border-l-8'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-gray-900 text-base">{ag}</span>
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                          temLancamento ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {temLancamento ? '✅ Lançado' : '⏳ Pendente'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">
                      {temLancamento ? 'Formulários gravados no sistema' : 'Clique para lançar formulário'}
                    </p>
                    <button className="w-full py-2 bg-gray-50 border border-gray-200 font-semibold text-xs rounded-xl hover:bg-gray-100 text-gray-700">
                      {temLancamento ? '👁 Visualizar / Editar' : '📝 Iniciar Lançamento'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 5. FORMULÁRIO DO AGENTE */}
      {viewMode === 'formulario' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6 shadow-sm">
          {/* Top Return Bar */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <button
              onClick={() => setViewMode('cockpit')}
              className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar ao Painel
            </button>
            <div className="text-center">
              <span className="text-xs text-gray-400 block font-semibold">AGENTE EM ATENDIMENTO</span>
              <span className="text-base font-extrabold text-[#0f2e4a]">{agenteAtual}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">Qtd Forms:</span>
              <input
                type="number"
                min="1"
                max="10"
                value={totalForms}
                onChange={(e) => setTotalForms(parseInt(e.target.value) || 1)}
                className="w-14 p-1.5 border border-gray-300 rounded-lg text-center font-bold text-xs"
              />
            </div>
          </div>

          {/* QUARTEIRÕES BUILDER */}
          <div className="bg-sky-50/60 border border-sky-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0f2e4a] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-sky-700" /> Quarteirões Trabalhados pelo Agente
              </span>
              <button
                onClick={adicionarBlocoQuarteirao}
                className="px-3 py-1 bg-[#0f2e4a] text-white font-semibold text-xs rounded-lg hover:bg-[#1a4b73] transition-all flex items-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Adicionar Quarteirão
              </button>
            </div>

            <div className="space-y-2">
              {quarteiroesForm.map((q, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-sky-200 text-xs">
                  <span className="font-bold text-gray-600">Quarteirão nº</span>
                  <input
                    type="text"
                    value={q.numero}
                    onChange={(e) => updateQuarteiraoForm(idx, 'numero', e.target.value)}
                    className="w-24 p-1 border border-gray-300 rounded text-center font-extrabold"
                  />
                  <span className="font-bold text-gray-600 ml-2">Concluído?</span>
                  <select
                    value={q.concluido ? 'SIM' : 'NAO'}
                    onChange={(e) => updateQuarteiraoForm(idx, 'concluido', e.target.value === 'SIM')}
                    className="p-1 border border-gray-300 rounded font-semibold text-xs"
                  >
                    <option value="NAO">Não</option>
                    <option value="SIM">Sim</option>
                  </select>
                  <button
                    onClick={() => removerBlocoQuarteirao(idx)}
                    className="text-red-500 hover:text-red-700 ml-auto p-1 font-bold"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* TABELA DE IMÓVEIS */}
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-xs text-center border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-[#0f2e4a] text-white font-extrabold">
                  <th className="p-2 border border-gray-600" colSpan={11}>
                    IMÓVEIS
                  </th>
                </tr>
                <tr className="bg-sky-100 text-[#0f2e4a] font-bold">
                  <th className="p-2 border border-sky-200">TIPO</th>
                  <th className="p-2 border border-sky-200">R</th>
                  <th className="p-2 border border-sky-200">C</th>
                  <th className="p-2 border border-sky-200">TB</th>
                  <th className="p-2 border border-sky-200">PE</th>
                  <th className="p-2 border border-sky-200">O</th>
                  <th className="p-2 border border-sky-200 bg-sky-200">TOTAL</th>
                  <th className="p-2 border border-sky-200">FECHADOS</th>
                  <th className="p-2 border border-sky-200">ABAND.</th>
                  <th className="p-2 border border-sky-200">RECUS.</th>
                  <th className="p-2 border border-sky-200">RECUP.</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 border border-gray-200 font-bold bg-amber-50">QUANTIDADE</td>
                  <td className="p-1 border border-gray-200"><input type="number" value={R} onChange={(e) => setR(e.target.value)} className="w-12 text-center font-bold" /></td>
                  <td className="p-1 border border-gray-200"><input type="number" value={C} onChange={(e) => setC(e.target.value)} className="w-12 text-center font-bold" /></td>
                  <td className="p-1 border border-gray-200"><input type="number" value={TB} onChange={(e) => setTB(e.target.value)} className="w-12 text-center font-bold" /></td>
                  <td className="p-1 border border-gray-200"><input type="number" value={PE} onChange={(e) => setPE(e.target.value)} className="w-12 text-center font-bold" /></td>
                  <td className="p-1 border border-gray-200"><input type="number" value={O} onChange={(e) => setO(e.target.value)} className="w-12 text-center font-bold" /></td>
                  <td className="p-1 border border-gray-200 font-extrabold bg-sky-100">{pad2(totalInspecionados)}</td>
                  <td className="p-1 border border-gray-200"><input type="number" value={fechados} onChange={(e) => setFechados(e.target.value)} className="w-12 text-center font-bold" /></td>
                  <td className="p-1 border border-gray-200"><input type="number" value={abandonados} onChange={(e) => setAbandonados(e.target.value)} className="w-12 text-center font-bold" /></td>
                  <td className="p-1 border border-gray-200"><input type="number" value={recusados} onChange={(e) => setRecusados(e.target.value)} className="w-12 text-center font-bold" /></td>
                  <td className="p-1 border border-gray-200"><input type="number" value={recuperados} onChange={(e) => setRecuperados(e.target.value)} className="w-12 text-center font-bold" /></td>
                </tr>
                <tr>
                  <td className="p-2 border border-gray-200 font-bold bg-amber-50">TRATADOS</td>
                  <td className="p-1 border border-gray-200"><input type="number" value={R_Trat} onChange={(e) => setR_Trat(e.target.value)} className="w-12 text-center font-bold" /></td>
                  <td className="p-1 border border-gray-200"><input type="number" value={C_Trat} onChange={(e) => setC_Trat(e.target.value)} className="w-12 text-center font-bold" /></td>
                  <td className="p-1 border border-gray-200"><input type="number" value={TB_Trat} onChange={(e) => setTB_Trat(e.target.value)} className="w-12 text-center font-bold" /></td>
                  <td className="p-1 border border-gray-200"><input type="number" value={PE_Trat} onChange={(e) => setPE_Trat(e.target.value)} className="w-12 text-center font-bold" /></td>
                  <td className="p-1 border border-gray-200"><input type="number" value={O_Trat} onChange={(e) => setO_Trat(e.target.value)} className="w-12 text-center font-bold" /></td>
                  <td className="p-1 border border-gray-200 font-extrabold bg-sky-100">{pad2(totalTratados)}</td>
                  <td colSpan={2} className="p-2 border border-gray-200 font-bold bg-emerald-50 text-emerald-800">
                    INSPEC: {pad2(totalInspecionados)}
                  </td>
                  <td colSpan={2} className="p-2 border border-gray-200 font-bold bg-purple-50 text-purple-800">
                    INFORM: {pad2(totalInformados)}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border border-gray-200 font-bold bg-amber-50">FOCADOS</td>
                  <td className="p-1 border border-gray-200"><input type="number" value={R_Foc} onChange={(e) => setR_Foc(e.target.value)} className="w-12 text-center font-bold" /></td>
                  <td className="p-1 border border-gray-200"><input type="number" value={C_Foc} onChange={(e) => setC_Foc(e.target.value)} className="w-12 text-center font-bold" /></td>
                  <td className="p-1 border border-gray-200"><input type="number" value={TB_Foc} onChange={(e) => setTB_Foc(e.target.value)} className="w-12 text-center font-bold" /></td>
                  <td className="p-1 border border-gray-200"><input type="number" value={PE_Foc} onChange={(e) => setPE_Foc(e.target.value)} className="w-12 text-center font-bold" /></td>
                  <td className="p-1 border border-gray-200"><input type="number" value={O_Foc} onChange={(e) => setO_Foc(e.target.value)} className="w-12 text-center font-bold" /></td>
                  <td className="p-1 border border-gray-200 font-extrabold bg-sky-100">{pad2(totalFocados)}</td>
                  <td colSpan={2} className="p-2 border border-gray-200 font-bold bg-red-50 text-red-700">
                    PENDÊNCIA: {pad2(totalPendencia)}
                  </td>
                  <td colSpan={2} className="p-2 border border-gray-200 font-bold bg-amber-50 text-amber-800">
                    ÍNDICE: {indicePendencia.toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* TABELA DE DEPÓSITOS */}
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-xs text-center border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-[#0f2e4a] text-white font-extrabold">
                  <th className="p-2 border border-gray-600" colSpan={6}>
                    DEPÓSITOS (RECIPIENTES / FOCOS)
                  </th>
                </tr>
                <tr className="bg-sky-100 text-[#0f2e4a] font-bold">
                  <th className="p-2 border border-sky-200 w-1/6">TIPO</th>
                  <th className="p-2 border border-sky-200 w-1/6">ENCONTRADOS</th>
                  <th className="p-2 border border-sky-200 w-1/6">NÃO INSPEC.</th>
                  <th className="p-2 border border-sky-200 w-1/6 bg-sky-200">INSPECIONADOS</th>
                  <th className="p-2 border border-sky-200 w-1/6">TRATADOS</th>
                  <th className="p-2 border border-sky-200 w-1/6">FOCADOS</th>
                </tr>
              </thead>
              <tbody>
                {tiposDep.map((t, idx) => {
                  const enc = parseNumber(depositos[t].encontrados);
                  const ni = parseNumber(depositos[t].naoInspecionados);
                  const inspec = Math.max(0, enc - ni);

                  return (
                    <tr key={t} className={idx % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'}>
                      <td className="p-2 border border-gray-200 font-extrabold text-[#0f2e4a]">{t}</td>
                      <td className="p-1 border border-gray-200">
                        <input
                          type="number"
                          value={depositos[t].encontrados}
                          onChange={(e) => handleDepositoChange(t, 'encontrados', e.target.value)}
                          className="w-16 text-center font-bold"
                        />
                      </td>
                      <td className="p-1 border border-gray-200">
                        <input
                          type="number"
                          value={depositos[t].naoInspecionados}
                          onChange={(e) => handleDepositoChange(t, 'naoInspecionados', e.target.value)}
                          className="w-16 text-center font-bold text-red-600"
                        />
                      </td>
                      <td className="p-1 border border-gray-200 bg-sky-50 font-extrabold text-[#0f2e4a]">
                        {pad2(inspec)}
                      </td>
                      <td className="p-1 border border-gray-200">
                        <input
                          type="number"
                          value={depositos[t].tratados}
                          onChange={(e) => handleDepositoChange(t, 'tratados', e.target.value)}
                          className="w-16 text-center font-bold text-emerald-600"
                        />
                      </td>
                      <td className="p-1 border border-gray-200">
                        <input
                          type="number"
                          value={depositos[t].foco}
                          onChange={(e) => handleDepositoChange(t, 'foco', e.target.value)}
                          className="w-16 text-center font-bold text-amber-600"
                        />
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-sky-100 font-extrabold text-[#0f2e4a]">
                  <td className="p-2 border border-sky-200">TOTAL</td>
                  <td className="p-2 border border-sky-200">{pad2(totalDepEncontrados)}</td>
                  <td className="p-2 border border-sky-200">{pad2(totalDepNaoInspec)}</td>
                  <td className="p-2 border border-sky-200">{pad2(totalDepInspec)}</td>
                  <td className="p-2 border border-sky-200">{pad2(totalDepTratados)}</td>
                  <td className="p-2 border border-sky-200">{pad2(totalDepFocados)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* LARVICIDA & ELIMINADOS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-amber-50/60 p-4 border border-amber-200 rounded-xl">
            <div>
              <label className="block text-xs font-bold text-amber-900 mb-1">Depósitos Eliminados</label>
              <input
                type="number"
                value={depositosEliminados}
                onChange={(e) => setDepositosEliminados(e.target.value)}
                className="w-full p-2 bg-white border border-amber-300 rounded-lg text-center font-bold text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-amber-900 mb-1">Litros Tratados</label>
              <input
                type="number"
                value={litrosTratados}
                onChange={(e) => setLitrosTratados(e.target.value)}
                className="w-full p-2 bg-white border border-amber-300 rounded-lg text-center font-bold text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-amber-900 mb-1">VectoBac® WG (Gramas)</label>
              <input
                type="text"
                readOnly
                value={gramasLarvicida}
                className="w-full p-2 bg-amber-100 border border-amber-300 rounded-lg text-center font-extrabold text-amber-950 text-xs"
              />
            </div>
          </div>

          {/* OCORRÊNCIAS */}
          <div>
            <h4 className="text-xs font-bold text-[#0f2e4a] mb-2 uppercase tracking-wide">Ocorrências do Dia</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                'Chuva', 'Feriado', 'Ponto Facultativo', 'Assembleia da Categoria',
                'Mutirão', 'Ação Educativa', 'Bloqueio de Transmissão', 'Capacitação da Equipe',
                'Reunião Administrativa', 'Paralisação', 'Greve de Ônibus', 'Equipamento Indisponível'
              ].map((item) => (
                <label key={item} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ocorrencias.includes(item)}
                    onChange={() => toggleOcorrencia(item)}
                    className="accent-[#0f2e4a]"
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>

          {/* DETALHAMENTO */}
          <div>
            <h4 className="text-xs font-bold text-[#0f2e4a] mb-2 uppercase tracking-wide">Detalhamento (Opcional)</h4>
            <textarea
              rows={3}
              value={detalhamento}
              onChange={(e) => setDetalhamento(e.target.value)}
              placeholder="Digite observações adicionais sobre os trabalhos realizados..."
              className="w-full p-3 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#0f2e4a]"
            />
          </div>

          {/* BOTÕES DE AÇÃO */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={salvarFormularioAtual}
              className="flex-1 py-3 bg-[#0f2e4a] hover:bg-[#1a4b73] text-white font-extrabold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4" /> Salvar Formulário
            </button>
            <button
              onClick={finalizarAgente}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" /> Finalizar Agente
            </button>
          </div>
        </div>
      )}

      {/* 6. TELA FINALIZAÇÃO */}
      {viewMode === 'finalizacao' && (
        <div className="bg-white rounded-2xl p-12 text-center border-2 border-emerald-500 shadow-xl space-y-6 animate-in zoom-in-95">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-4xl">
            🎉
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-emerald-800">
              Todos os Lançamentos do Dia Concluídos!
            </h2>
            <p className="text-sm text-gray-500">
              Todos os agentes da equipe tiveram seus formulários devidamente registrados no sistema.
            </p>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 inline-block text-left text-xs font-bold text-gray-700 space-y-2 min-w-[260px]">
            <div>📅 Data: <span className="text-emerald-800">{formatarDataBR(dataTrabalho)}</span></div>
            <div>👥 Agentes Trabalhados: <span className="text-emerald-800">{agentesTrabalhados.length}</span></div>
            <div>📄 Semanas/Atividade: <span className="text-emerald-800">{atividade}</span></div>
          </div>

          <div>
            <button
              onClick={() => {
                setViewMode('cabecalho');
                setDataTrabalho(new Date().toISOString().split('T')[0]);
              }}
              className="px-8 py-3.5 bg-[#0f2e4a] hover:bg-[#1a4b73] text-white font-extrabold text-sm rounded-xl shadow-lg transition-all inline-flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" /> Registrar Novo Lançamento
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
