import React, { useState, useEffect } from 'react';
import {
  getCicloAtivoCompleto, getCicloAtivoNome, getSemanaAtiva,
  getConfigEquipe, getLancamentosList, processarDadosResumo,
  formatarDataBR, pad2
} from '../utils/storage';
import { exportToExcel } from '../utils/exportExcel';
import {
  BarChart3, Printer, FileSpreadsheet, Layers, RefreshCw,
  Home, Droplets, Bug, AlertTriangle, ShieldAlert, CheckCircle2,
  Users, MapPin, Building2, Flame, Award, FileText, CheckSquare
} from 'lucide-react';

interface ResumosProps {
  onNotify: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export const Resumos: React.FC<ResumosProps> = ({ onNotify }) => {
  const [subTab, setSubTab] = useState<'semana' | 'ciclo'>('semana');

  // Shared Data
  const [semanaAtiva, setSemanaAtivaState] = useState(getSemanaAtiva());
  const [cicloAtivo, setCicloAtivoState] = useState(getCicloAtivoCompleto());
  const [config, setConfig] = useState(getConfigEquipe());
  
  // Custom Editable Observation Field for Report
  const [obsSemana, setObsSemana] = useState<string>(
    localStorage.getItem('ace_obs_semana') || 'Trabalho realizado conforme planejamento semanal de campo. Focos encontrados foram tratados e eliminados imediatamente.'
  );
  const [obsCiclo, setObsCiclo] = useState<string>(
    localStorage.getItem('ace_obs_ciclo') || 'Ciclo de controle antivetorial com acompanhamento estatístico e cobertura integral dos quarteirões programados.'
  );

  useEffect(() => {
    setSemanaAtivaState(getSemanaAtiva());
    setCicloAtivoState(getCicloAtivoCompleto());
    setConfig(getConfigEquipe());
  }, []);

  const handleSaveObs = (tipo: 'semana' | 'ciclo', text: string) => {
    if (tipo === 'semana') {
      setObsSemana(text);
      localStorage.setItem('ace_obs_semana', text);
    } else {
      setObsCiclo(text);
      localStorage.setItem('ace_obs_ciclo', text);
    }
  };

  const lancamentos = getLancamentosList();

  // Filter for Week
  const lancamentosSemana = lancamentos.filter((d) => {
    if (!semanaAtiva?.inicio || !semanaAtiva?.termino || !d.data) return false;
    return d.data >= semanaAtiva.inicio && d.data <= semanaAtiva.termino;
  });

  // Filter for Cycle
  const lancamentosCiclo = lancamentos.filter((d) => {
    if (!cicloAtivo?.dataInicio || !d.data) return false;
    const inicioStr = cicloAtivo.dataInicio.split('T')[0];
    const fimStr = cicloAtivo.dataFim ? cicloAtivo.dataFim.split('T')[0] : '9999-12-31';
    return d.data >= inicioStr && d.data <= fimStr;
  });

  const resSemana = processarDadosResumo(lancamentosSemana);
  const resCiclo = processarDadosResumo(lancamentosCiclo);

  // Quarteiroes Concluidos
  const quarteiroesSemana = Array.from(
    new Set(
      lancamentosSemana.flatMap((d) => (d.quarteiroes || []).filter((q) => q.concluido).map((q) => q.numero))
    )
  );

  const quarteiroesCiclo = Array.from(
    new Set(
      lancamentosCiclo.flatMap((d) => (d.quarteiroes || []).filter((q) => q.concluido).map((q) => q.numero))
    )
  );

  // Week-by-week list for Cycle
  const semanasNoCiclo = Array.from(new Set(lancamentosCiclo.map((d) => d.semana || 'Semana N/A')));

  // List of agents who worked
  const agentesTrabalharamSemana = Array.from(new Set(lancamentosSemana.map((l) => l.agente)));
  const agentesTrabalharamCiclo = Array.from(new Set(lancamentosCiclo.map((l) => l.agente)));

  // Production by Agent calculation
  const getAgentesProductionList = (list: typeof lancamentos) => {
    const dict: Record<string, {
      imoveis: number;
      focados: number;
      tratados: number;
      pendencias: number;
      larvicida: number;
      quarteiroes: Set<string>;
      dias: Set<string>;
    }> = {};

    config.agentes.forEach((ag) => {
      dict[ag] = { imoveis: 0, focados: 0, tratados: 0, pendencias: 0, larvicida: 0, quarteiroes: new Set(), dias: new Set() };
    });

    list.forEach((l) => {
      const nome = l.agente;
      if (!dict[nome]) {
        dict[nome] = { imoveis: 0, focados: 0, tratados: 0, pendencias: 0, larvicida: 0, quarteiroes: new Set(), dias: new Set() };
      }
      const totalImov = (Number(l.R) || 0) + (Number(l.C) || 0) + (Number(l.TB) || 0) + (Number(l.PE) || 0) + (Number(l.O) || 0);
      const totalFoc = (Number(l.R_Foc) || 0) + (Number(l.C_Foc) || 0) + (Number(l.TB_Foc) || 0) + (Number(l.PE_Foc) || 0) + (Number(l.O_Foc) || 0);
      const totalTrat = (Number(l.R_Trat) || 0) + (Number(l.C_Trat) || 0) + (Number(l.TB_Trat) || 0) + (Number(l.PE_Trat) || 0) + (Number(l.O_Trat) || 0);
      const pend = (Number(l.fechados) || 0) + (Number(l.recusados) || 0) + (Number(l.abandonados) || 0) - (Number(l.recuperados) || 0);
      const larv = Number(l.gramasLarvicida) || ((Number(l.litrosTratados) || 0) * 0.5);

      dict[nome].imoveis += totalImov;
      dict[nome].focados += totalFoc;
      dict[nome].tratados += totalTrat;
      dict[nome].pendencias += pend;
      dict[nome].larvicida += larv;
      if (l.data) dict[nome].dias.add(l.data);
      if (l.quarteiroes) {
        l.quarteiroes.forEach((q) => { if (q.numero) dict[nome].quarteiroes.add(q.numero); });
      }
    });

    return Object.entries(dict).map(([nome, d]) => ({
      nome,
      ...d,
      totalQuarteiroes: d.quarteiroes.size,
      diasCount: d.dias.size,
    })).sort((a, b) => b.imoveis - a.imoveis);
  };

  const prodAgentesSemana = getAgentesProductionList(lancamentosSemana);
  const prodAgentesCiclo = getAgentesProductionList(lancamentosCiclo);

  // Depósitos Descrição
  const depCategorias: Record<string, { sigla: string; rotulo: string; desc: string }> = {
    A1: { sigla: 'A1', rotulo: 'Reservatórios Elevados', desc: 'Caixas d\'água, cisternas, tanques elevados' },
    A2: { sigla: 'A2', rotulo: 'Reservatórios de Solo', desc: 'Poços, tambores, tonéis, cacimbas, cisternas de solo' },
    B: { sigla: 'B', rotulo: 'Depósitos Móveis', desc: 'Vasos de plantas, pratos, pingadeiras, garrafas, recipientes' },
    C: { sigla: 'C', rotulo: 'Depósitos Fixos', desc: 'Calhas, lajes, piscinas, sanitários em desuso, ralos' },
    D1: { sigla: 'D1', rotulo: 'Pneus e Rodantes', desc: 'Pneus e câmaras de ar' },
    D2: { sigla: 'D2', rotulo: 'Lixo e Sucata', desc: 'Entulho, latas, garrafas plásticas, ferro-velho, sucata' },
    E: { sigla: 'E', rotulo: 'Depósitos Naturais', desc: 'Ocos de árvores, bromélias, bambus, buracos em rochas' },
  };

  // IIP Calc
  const iipSemana = resSemana.totalImoveis > 0 ? (resSemana.totalFocados / resSemana.totalImoveis) * 100 : 0;
  const iipCiclo = resCiclo.totalImoveis > 0 ? (resCiclo.totalFocados / resCiclo.totalImoveis) * 100 : 0;

  const handleExportExcel = (tipo: 'semana' | 'ciclo') => {
    const isSemana = tipo === 'semana';
    const res = isSemana ? resSemana : resCiclo;
    const filename = isSemana ? `Resumo_Semanal_${config.bairro}` : `Resumo_Ciclo_${config.bairro}`;

    const headers1 = ['Métrica / Categoria', 'Residencial (R)', 'Comercial (C)', 'Terreno Baldio (TB)', 'Ponto Estratégico (PE)', 'Outros (O)', 'TOTAL'];
    const rows1 = [
      ['Imóveis Inspecionados', res.R, res.C, res.TB, res.PE, res.O, res.totalImoveis],
      ['Imóveis Tratados', res.R_Trat, res.C_Trat, res.TB_Trat, res.PE_Trat, res.O_Trat, res.totalTratados],
      ['Imóveis com Foco', res.R_Foc, res.C_Foc, res.TB_Foc, res.PE_Foc, res.O_Foc, res.totalFocados],
      ['Fechados', res.fechados, '-', '-', '-', '-', res.fechados],
      ['Abandonados', res.abandonados, '-', '-', '-', '-', res.abandonados],
      ['Recusados', res.recusados, '-', '-', '-', '-', res.recusados],
      ['Recuperados', res.recuperados, '-', '-', '-', '-', res.recuperados],
      ['Total Pendências', '-', '-', '-', '-', '-', res.totalPendencia],
      ['Índice de Pendência (%)', '-', '-', '-', '-', '-', res.indicePendencia.toFixed(1) + '%'],
    ];

    // Deposit rows
    const headers2 = ['Grupo de Depósito', 'Descrição', 'Encontrados', 'Não Inspecionados', 'Inspecionados', 'Tratados', 'Com Foco'];
    const rows2 = Object.entries(depCategorias).map(([t, info]) => {
      const dep = res.depositos[t] || { encontrados: 0, naoInspecionados: 0, inspecionados: 0, tratados: 0, foco: 0 };
      return [t, info.rotulo, dep.encontrados, dep.naoInspecionados, dep.inspecionados, dep.tratados, dep.foco];
    });

    exportToExcel(filename, tipo.toUpperCase(), headers1, rows1);
    onNotify(`📊 Exportando ${filename}.xls`, 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Sub-tab Navigation */}
      <div className="bg-white p-1.5 rounded-2xl border border-gray-200 flex gap-2 max-w-md shadow-xs print:hidden">
        <button
          onClick={() => setSubTab('semana')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
            subTab === 'semana' ? 'bg-[#0f2e4a] text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-sky-300" /> Resumo da Semana
        </button>
        <button
          onClick={() => setSubTab('ciclo')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
            subTab === 'ciclo' ? 'bg-purple-700 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <RefreshCw className="w-4 h-4 text-purple-200" /> Resumo do Ciclo Completo
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. RESUMO DA SEMANA FORMULÁRIO COMPLETO                                  */}
      {/* ========================================================================= */}
      {subTab === 'semana' && (
        <div className="bg-white rounded-3xl border-2 border-[#0f2e4a] p-6 sm:p-8 space-y-6 shadow-xl print:border-none print:shadow-none print:p-0">
          
          {/* HEADER SECTOR */}
          <div className="space-y-2">
            <div className="bg-[#0f2e4a] text-white p-3.5 rounded-2xl font-black text-center text-base uppercase tracking-wider shadow-sm flex items-center justify-center gap-2">
              <Building2 className="w-5 h-5 text-sky-400" />
              <span>BOLETIM OFICIAL DE RESUMO DA SEMANA - CONTROLE ANTIVETORIAL</span>
            </div>

            <div className="bg-amber-500 text-white p-2 rounded-xl text-xs font-extrabold text-center uppercase tracking-wide">
              MINISTÉRIO DA SAÚDE / SUS • VIGILÂNCIA EM SAÚDE • ZONOSES E ENDEMIAS
            </div>
          </div>

          {/* HEADER METADATA GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs font-extrabold text-[#0f2e4a] bg-amber-50/80 p-4 rounded-2xl border border-amber-200">
            <div><span className="text-gray-500 block text-[10px] uppercase font-bold">Atividade:</span> <span className="text-gray-900 font-black">{localStorage.getItem('ace_planejamento_atividade') || 'Tratamento Focal / LI'}</span></div>
            <div><span className="text-gray-500 block text-[10px] uppercase font-bold">Ciclo / Ano:</span> <span className="text-gray-900 font-black">{getCicloAtivoNome()}</span></div>
            <div><span className="text-gray-500 block text-[10px] uppercase font-bold">Semana Epid.:</span> <span className="text-gray-900 font-black">{semanaAtiva ? semanaAtiva.nome : 'Semana 1'}</span></div>
            <div><span className="text-gray-500 block text-[10px] uppercase font-bold">Data Início:</span> <span className="text-gray-900 font-black">{semanaAtiva ? formatarDataBR(semanaAtiva.inicio) : '--'}</span></div>
            <div><span className="text-gray-500 block text-[10px] uppercase font-bold">Data Término:</span> <span className="text-gray-900 font-black">{semanaAtiva ? formatarDataBR(semanaAtiva.termino) : '--'}</span></div>
          </div>

          {/* LOCALITY AND TEAM CONTEXT */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs bg-sky-50/80 p-4 rounded-2xl border border-sky-200">
            <div><span className="font-extrabold text-sky-950 block text-[10px]">BAIRRO / LOCALIDADE:</span> <strong className="text-gray-900">{config.bairro}</strong></div>
            <div><span className="font-extrabold text-sky-950 block text-[10px]">ESTRATO:</span> <strong className="text-gray-900">{config.estrato}</strong></div>
            <div><span className="font-extrabold text-sky-950 block text-[10px]">EQUIPE:</span> <strong className="text-gray-900">{config.equipe}</strong></div>
            <div><span className="font-extrabold text-amber-950 block text-[10px]">SUPERVISOR:</span> <strong className="text-amber-900">{config.supervisor}</strong></div>
            <div><span className="font-extrabold text-purple-950 block text-[10px]">APOIO ADMIN:</span> <strong className="text-purple-900">{config.apoioAdmin}</strong></div>
            <div><span className="font-extrabold text-sky-950 block text-[10px]">AGENTES NA EQUIPE:</span> <strong className="text-blue-900">{config.agentes.length} Agentes</strong></div>
          </div>

          {/* METRIC HIGHLIGHT CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-2xl text-center">
              <span className="text-[10px] font-black text-blue-900 uppercase block mb-0.5">Agentes em Campo</span>
              <span className="text-2xl font-black text-blue-900">{pad2(agentesTrabalharamSemana.length)} / {pad2(config.agentes.length)}</span>
              <span className="text-[10px] font-bold text-blue-700 block mt-0.5">Agentes Trabalhados</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-center">
              <span className="text-[10px] font-black text-emerald-900 uppercase block mb-0.5">Imóveis Inspecionados</span>
              <span className="text-2xl font-black text-emerald-900">{pad2(resSemana.totalImoveis)}</span>
              <span className="text-[10px] font-bold text-emerald-700 block mt-0.5">Visitas Concluídas</span>
            </div>
            <div className="bg-red-50 border border-red-200 p-3.5 rounded-2xl text-center">
              <span className="text-[10px] font-black text-red-900 uppercase block mb-0.5">Imóveis com Foco (IIP)</span>
              <span className="text-2xl font-black text-red-700">{pad2(resSemana.totalFocados)}</span>
              <span className="text-[10px] font-extrabold text-red-800 block mt-0.5">{iipSemana.toFixed(2)}% Infestação Predial</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-center">
              <span className="text-[10px] font-black text-amber-900 uppercase block mb-0.5">Rendimento / Agente</span>
              <span className="text-2xl font-black text-amber-900">
                {agentesTrabalharamSemana.length > 0
                  ? (resSemana.totalImoveis / agentesTrabalharamSemana.length).toFixed(1)
                  : '0.0'}
              </span>
              <span className="text-[10px] font-bold text-amber-800 block mt-0.5">Imóveis / Agente / Semana</span>
            </div>
          </div>

          {/* QUARTEIRÕES CONCLUÍDOS NA SEMANA */}
          <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-sky-950">
              <span className="flex items-center gap-1.5"><CheckSquare className="w-4 h-4 text-emerald-600" /> QUARTEIRÕES CONCLUÍDOS NA SEMANA</span>
              <span className="bg-sky-200 text-sky-900 px-2.5 py-0.5 rounded-full font-bold">Total: {pad2(quarteiroesSemana.length)} Concluídos</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {quarteiroesSemana.length === 0 ? (
                <span className="text-xs text-gray-400 italic">Nenhum quarteirão concluído no período desta semana.</span>
              ) : (
                quarteiroesSemana.map((q) => (
                  <span key={q} className="bg-emerald-100 text-emerald-900 font-extrabold text-xs px-3 py-1 rounded-xl border border-emerald-300">
                    Qtr {q}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TABELA 1: IMÓVEIS VISITADOS, TRATADOS, FOCADOS E PENDÊNCIAS               */}
          {/* ========================================================================= */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-[#0f2e4a] uppercase tracking-wider flex items-center gap-1.5">
              <Home className="w-4 h-4 text-blue-600" /> QUADRO I - IMÓVEIS INSPECIONADOS, TRATADOS E PENDÊNCIAS
            </h4>

            <div className="overflow-x-auto border border-gray-300 rounded-2xl shadow-xs">
              <table className="w-full text-xs text-center border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-[#0f2e4a] text-white font-black">
                    <th className="p-2.5 border border-gray-600">ESPECIFICAÇÃO DE IMÓVEIS</th>
                    <th className="p-2.5 border border-gray-600">RESIDENCIAL (R)</th>
                    <th className="p-2.5 border border-gray-600">COMERCIAL (C)</th>
                    <th className="p-2.5 border border-gray-600">TERRENO BALDIO (TB)</th>
                    <th className="p-2.5 border border-gray-600">PONTO ESTRATÉGICO (PE)</th>
                    <th className="p-2.5 border border-gray-600">OUTROS (O)</th>
                    <th className="p-2.5 border border-gray-600 bg-sky-900 text-white font-black">TOTAL IMÓVEIS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-bold">
                  <tr>
                    <td className="p-2.5 border border-gray-300 font-extrabold text-left bg-gray-50 text-gray-800">1. IMÓVEIS INSPECIONADOS (TRABALHADOS)</td>
                    <td className="p-2.5 border border-gray-300">{pad2(resSemana.R)}</td>
                    <td className="p-2.5 border border-gray-300">{pad2(resSemana.C)}</td>
                    <td className="p-2.5 border border-gray-300">{pad2(resSemana.TB)}</td>
                    <td className="p-2.5 border border-gray-300">{pad2(resSemana.PE)}</td>
                    <td className="p-2.5 border border-gray-300">{pad2(resSemana.O)}</td>
                    <td className="p-2.5 border border-gray-300 font-black bg-blue-100 text-blue-950">{pad2(resSemana.totalImoveis)}</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 border border-gray-300 font-extrabold text-left bg-gray-50 text-blue-900">2. IMÓVEIS TRATADOS (COM LARVICIDA)</td>
                    <td className="p-2.5 border border-gray-300 text-blue-800">{pad2(resSemana.R_Trat)}</td>
                    <td className="p-2.5 border border-gray-300 text-blue-800">{pad2(resSemana.C_Trat)}</td>
                    <td className="p-2.5 border border-gray-300 text-blue-800">{pad2(resSemana.TB_Trat)}</td>
                    <td className="p-2.5 border border-gray-300 text-blue-800">{pad2(resSemana.PE_Trat)}</td>
                    <td className="p-2.5 border border-gray-300 text-blue-800">{pad2(resSemana.O_Trat)}</td>
                    <td className="p-2.5 border border-gray-300 font-black bg-blue-100 text-blue-950">{pad2(resSemana.totalTratados)}</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 border border-gray-300 font-extrabold text-left bg-red-50 text-red-900">3. IMÓVEIS COM FOCO DE LARVA (POSITIVOS)</td>
                    <td className="p-2.5 border border-gray-300 text-red-700">{pad2(resSemana.R_Foc)}</td>
                    <td className="p-2.5 border border-gray-300 text-red-700">{pad2(resSemana.C_Foc)}</td>
                    <td className="p-2.5 border border-gray-300 text-red-700">{pad2(resSemana.TB_Foc)}</td>
                    <td className="p-2.5 border border-gray-300 text-red-700">{pad2(resSemana.PE_Foc)}</td>
                    <td className="p-2.5 border border-gray-300 text-red-700">{pad2(resSemana.O_Foc)}</td>
                    <td className="p-2.5 border border-gray-300 font-black bg-red-100 text-red-950">{pad2(resSemana.totalFocados)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* SUB-TABLE PENDÊNCIAS */}
            <div className="overflow-x-auto border border-gray-300 rounded-2xl shadow-xs mt-2">
              <table className="w-full text-xs text-center border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-700 text-white font-extrabold">
                    <th className="p-2 border border-gray-600">IMÓVEIS FECHADOS</th>
                    <th className="p-2 border border-gray-600">IMÓVEIS ABANDONADOS</th>
                    <th className="p-2 border border-gray-600">RECUSAS DE INSPEÇÃO</th>
                    <th className="p-2 border border-gray-600">IMÓVEIS RECUPERADOS</th>
                    <th className="p-2 border border-gray-600 bg-amber-600 text-white font-black">TOTAL PENDÊNCIAS</th>
                    <th className="p-2 border border-gray-600 bg-amber-700 text-white font-black">ÍNDICE PENDÊNCIA (%)</th>
                  </tr>
                </thead>
                <tbody className="font-bold">
                  <tr>
                    <td className="p-2.5 border border-gray-300">{pad2(resSemana.fechados)}</td>
                    <td className="p-2.5 border border-gray-300">{pad2(resSemana.abandonados)}</td>
                    <td className="p-2.5 border border-gray-300 text-red-700 font-black">{pad2(resSemana.recusados)}</td>
                    <td className="p-2.5 border border-gray-300 text-emerald-800 font-black">{pad2(resSemana.recuperados)}</td>
                    <td className="p-2.5 border border-gray-300 font-black bg-amber-100 text-amber-950">{pad2(resSemana.totalPendencia)}</td>
                    <td className="p-2.5 border border-gray-300 font-black bg-amber-200 text-amber-950">{resSemana.indicePendencia.toFixed(1)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TABELA 2: QUADRO DE DEPÓSITOS / CRIADOUROS (A1 A E)                       */}
          {/* ========================================================================= */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-[#0f2e4a] uppercase tracking-wider flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-sky-600" /> QUADRO II - MAPA OFICIAL DE DEPÓSITOS E CRIADOUROS (A1 a E)
            </h4>

            <div className="overflow-x-auto border border-gray-300 rounded-2xl shadow-xs">
              <table className="w-full text-xs border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-[#0f2e4a] text-white font-black text-center">
                    <th className="p-2.5 border border-gray-600 w-16">GRUPO</th>
                    <th className="p-2.5 border border-gray-600 text-left">DESCRIÇÃO DO CRIADOURO / RECIPIENTE</th>
                    <th className="p-2.5 border border-gray-600">ENCONTRADOS</th>
                    <th className="p-2.5 border border-gray-600">NÃO INSPECIONADOS</th>
                    <th className="p-2.5 border border-gray-600">INSPECIONADOS</th>
                    <th className="p-2.5 border border-gray-600 bg-blue-900 text-white font-black">TRATADOS</th>
                    <th className="p-2.5 border border-gray-600 bg-red-900 text-white font-black">COM FOCO (POSITIVOS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-semibold text-center">
                  {Object.entries(depCategorias).map(([tipo, info]) => {
                    const dep = resSemana.depositos[tipo] || { encontrados: 0, naoInspecionados: 0, inspecionados: 0, tratados: 0, foco: 0 };
                    const temFoco = dep.foco > 0;

                    return (
                      <tr key={tipo} className={temFoco ? 'bg-red-50/60 font-bold' : 'hover:bg-gray-50'}>
                        <td className="p-2 border border-gray-300 font-black text-gray-900 bg-gray-100">{tipo}</td>
                        <td className="p-2 border border-gray-300 text-left font-bold text-gray-800">
                          <div>{info.rotulo}</div>
                          <div className="text-[10px] text-gray-500 font-normal">{info.desc}</div>
                        </td>
                        <td className="p-2 border border-gray-300">{dep.encontrados}</td>
                        <td className="p-2 border border-gray-300 text-gray-500">{dep.naoInspecionados}</td>
                        <td className="p-2 border border-gray-300 font-bold text-gray-900">{dep.inspecionados}</td>
                        <td className="p-2 border border-gray-300 text-blue-800 font-bold bg-blue-50/50">{dep.tratados}</td>
                        <td className={`p-2 border border-gray-300 font-black ${temFoco ? 'text-red-700 bg-red-100' : 'text-gray-400'}`}>
                          {dep.foco}
                        </td>
                      </tr>
                    );
                  })}
                  {/* TOTAL DEPÓSITOS ROW */}
                  <tr className="bg-sky-100/80 font-black text-sky-950 text-center">
                    <td colSpan={2} className="p-2.5 border border-gray-300 text-left uppercase">TOTAL DE DEPÓSITOS DA SEMANA</td>
                    <td className="p-2.5 border border-gray-300">{resSemana.totalDepositos.encontrados}</td>
                    <td className="p-2.5 border border-gray-300">{resSemana.totalDepositos.naoInspecionados}</td>
                    <td className="p-2.5 border border-gray-300">{resSemana.totalDepositos.inspecionados}</td>
                    <td className="p-2.5 border border-gray-300 text-blue-900 bg-blue-200">{resSemana.totalDepositos.tratados}</td>
                    <td className="p-2.5 border border-gray-300 text-red-900 bg-red-200">{resSemana.totalDepositos.foco}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TABELA 3: CONSUMO DE INSETICIDA / LARVICIDA & AÇÕES MECÂNICAS            */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="p-4 bg-gray-50 border border-gray-300 rounded-2xl space-y-2">
              <h5 className="text-xs font-black text-[#0f2e4a] uppercase tracking-wider flex items-center gap-1.5">
                <Droplets className="w-4 h-4 text-blue-600" /> CONSUMO DE LARVICIDA & ELIMINAÇÃO
              </h5>
              <div className="space-y-1.5 text-xs font-bold text-gray-800">
                <div className="flex justify-between p-2 bg-white rounded-xl border border-gray-200">
                  <span>Produto Larvicida Utilizado:</span>
                  <strong className="text-blue-900">Natular DT / Spinosad</strong>
                </div>
                <div className="flex justify-between p-2 bg-white rounded-xl border border-gray-200">
                  <span>Gramas / Litros Utilizados:</span>
                  <strong className="text-blue-900">{resSemana.gramasLarvicida.toFixed(1)}g ({resSemana.litrosTratados}L)</strong>
                </div>
                <div className="flex justify-between p-2 bg-white rounded-xl border border-gray-200">
                  <span>Depósitos Eliminados / Ação Mecânica:</span>
                  <strong className="text-emerald-700">{resSemana.depositosEliminados} eliminados</strong>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border border-gray-300 rounded-2xl space-y-2">
              <h5 className="text-xs font-black text-[#0f2e4a] uppercase tracking-wider flex items-center gap-1.5">
                <Bug className="w-4 h-4 text-red-600" /> AMOSTRAS ENTOMOLÓGICAS & EPIDEMIOLOGIA
              </h5>
              <div className="space-y-1.5 text-xs font-bold text-gray-800">
                <div className="flex justify-between p-2 bg-white rounded-xl border border-gray-200">
                  <span>Tubitos / Coletas de Larva En do Laboratório:</span>
                  <strong className="text-red-700">{resSemana.totalFocados} amostra(s)</strong>
                </div>
                <div className="flex justify-between p-2 bg-white rounded-xl border border-gray-200">
                  <span>Índice Infestação Predial (IIP):</span>
                  <strong className={`px-2 py-0.5 rounded text-white ${iipSemana >= 4 ? 'bg-red-600' : iipSemana >= 1 ? 'bg-amber-500' : 'bg-emerald-600'}`}>
                    {iipSemana.toFixed(2)}% ({iipSemana >= 4 ? 'Risco Alto' : iipSemana >= 1 ? 'Alerta' : 'Satisfatório'})
                  </strong>
                </div>
                <div className="flex justify-between p-2 bg-white rounded-xl border border-gray-200">
                  <span>Inspecionados por Agente / Dia:</span>
                  <strong className="text-gray-900">
                    {agentesTrabalharamSemana.length > 0 ? (resSemana.totalImoveis / (agentesTrabalharamSemana.length * 5)).toFixed(1) : '0.0'} imóv/dia
                  </strong>
                </div>
              </div>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* TABELA 4: DESEMPENHO INDIVIDUAL DA EQUIPE DE AGENTES                     */}
          {/* ========================================================================= */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-[#0f2e4a] uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-600" /> QUADRO III - PRODUÇÃO INDIVIDUAL DOS AGENTES NA SEMANA
            </h4>

            <div className="overflow-x-auto border border-gray-300 rounded-2xl shadow-xs">
              <table className="w-full text-xs text-center border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-[#0f2e4a] text-white font-black">
                    <th className="p-2.5 border border-gray-600 text-left">NOME DO AGENTE (ACE)</th>
                    <th className="p-2.5 border border-gray-600">DIAS TRABALHADOS</th>
                    <th className="p-2.5 border border-gray-600">IMÓVEIS VISITADOS</th>
                    <th className="p-2.5 border border-gray-600">TRATADOS</th>
                    <th className="p-2.5 border border-gray-600">FOCOS</th>
                    <th className="p-2.5 border border-gray-600">LARVICIDA (g)</th>
                    <th className="p-2.5 border border-gray-600">QUARTEIRÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-semibold">
                  {prodAgentesSemana.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-gray-400 italic">
                        Nenhum boletim individual registrado nesta semana.
                      </td>
                    </tr>
                  ) : (
                    prodAgentesSemana.map((ag) => (
                      <tr key={ag.nome} className="hover:bg-gray-50">
                        <td className="p-2.5 border border-gray-300 text-left font-extrabold text-gray-900">{ag.nome}</td>
                        <td className="p-2.5 border border-gray-300 text-gray-700">{ag.diasCount} dia(s)</td>
                        <td className="p-2.5 border border-gray-300 font-bold text-gray-900">{ag.imoveis}</td>
                        <td className="p-2.5 border border-gray-300 text-blue-800 font-bold">{ag.tratados}</td>
                        <td className={`p-2.5 border border-gray-300 font-black ${ag.focados > 0 ? 'text-red-700 bg-red-50' : 'text-gray-400'}`}>
                          {ag.focados}
                        </td>
                        <td className="p-2.5 border border-gray-300 text-gray-800">{ag.larvicida.toFixed(1)}g</td>
                        <td className="p-2.5 border border-gray-300 font-bold text-purple-800">{ag.totalQuarteiroes} Qtr</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* OBSERVAÇÕES E ASSINATURAS DE CAMPO                                       */}
          {/* ========================================================================= */}
          <div className="space-y-3 pt-2">
            <label className="block text-xs font-black text-[#0f2e4a] uppercase tracking-wider">
              📝 OBSERVAÇÕES DO SUPERVISOR DE CAMPO E OCORRÊNCIAS
            </label>
            <textarea
              rows={3}
              value={obsSemana}
              onChange={(e) => handleSaveObs('semana', e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-300 rounded-2xl text-xs font-medium text-gray-800 focus:ring-2 focus:ring-blue-600 outline-none print:border-none print:bg-transparent print:p-0"
              placeholder="Digite observações sobre o andamento das inspeções, recusas ou intercorrências..."
            />

            {/* SIGNATURE BLOCK */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-8 border-t border-gray-300 text-center text-xs font-bold text-gray-800">
              <div className="space-y-1">
                <div className="border-b border-gray-400 w-3/4 mx-auto pb-1 font-black text-gray-900">
                  {config.supervisor || 'Supervisor de Campo'}
                </div>
                <p className="text-[11px] text-gray-600 font-extrabold uppercase">SUPERVISOR RESPONSÁVEL DA EQUIPE</p>
                <p className="text-[10px] text-gray-400">ACE / Controle Antivetorial</p>
              </div>

              <div className="space-y-1">
                <div className="border-b border-gray-400 w-3/4 mx-auto pb-1 font-black text-gray-900">
                  {config.apoioAdmin || 'Apoio Administrativo'}
                </div>
                <p className="text-[11px] text-gray-600 font-extrabold uppercase">APOIO ADMINISTRATIVO / COORDENAÇÃO</p>
                <p className="text-[10px] text-gray-400">Vigilância em Saúde Zoonoses</p>
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 print:hidden">
            <button
              onClick={() => handleExportExcel('semana')}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" /> Exportar Planilha Excel (.xls)
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-3 bg-[#0f2e4a] hover:bg-[#1a4b73] text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <Printer className="w-4 h-4" /> Imprimir Boletim Semanal / PDF
            </button>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. RESUMO DO CICLO COMPLETO                                              */}
      {/* ========================================================================= */}
      {subTab === 'ciclo' && (
        <div className="bg-white rounded-3xl border-2 border-purple-600 p-6 sm:p-8 space-y-6 shadow-xl print:border-none print:shadow-none print:p-0">
          
          <div className="space-y-2">
            <div className="bg-purple-800 text-white p-3.5 rounded-2xl font-black text-center text-base uppercase tracking-wider shadow-sm flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 text-purple-300" />
              <span>BOLETIM OFICIAL CONSOLIDADO DO CICLO COMPLETO</span>
            </div>

            <div className="bg-amber-500 text-white p-2 rounded-xl text-xs font-extrabold text-center uppercase tracking-wide">
              MINISTÉRIO DA SAÚDE / SUS • AVALIAÇÃO E CONTRADITA ANTIVETORIAL
            </div>
          </div>

          {/* HEADER METADATA */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs font-extrabold text-purple-950 bg-purple-50 p-4 rounded-2xl border border-purple-200">
            <div><span className="text-gray-500 block text-[10px] uppercase font-bold">Atividade:</span> <span className="text-gray-900 font-black">{localStorage.getItem('ace_planejamento_atividade') || 'Tratamento Focal / LI'}</span></div>
            <div><span className="text-gray-500 block text-[10px] uppercase font-bold">Ciclo / Ano:</span> <span className="text-gray-900 font-black">{getCicloAtivoNome()}</span></div>
            <div><span className="text-gray-500 block text-[10px] uppercase font-bold">Semanas Registradas:</span> <span className="text-gray-900 font-black">{semanasNoCiclo.length} semana(s)</span></div>
            <div><span className="text-gray-500 block text-[10px] uppercase font-bold">Início Ciclo:</span> <span className="text-gray-900 font-black">{cicloAtivo ? formatarDataBR(cicloAtivo.dataInicio.split('T')[0]) : '--'}</span></div>
            <div><span className="text-gray-500 block text-[10px] uppercase font-bold">Término Ciclo:</span> <span className="text-gray-900 font-black">{cicloAtivo?.dataFim ? formatarDataBR(cicloAtivo.dataFim.split('T')[0]) : 'Em Andamento'}</span></div>
          </div>

          {/* LOCALITY AND TEAM CONTEXT */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs bg-purple-50/80 p-4 rounded-2xl border border-purple-200">
            <div><span className="font-extrabold text-purple-950 block text-[10px]">BAIRRO / LOCALIDADE:</span> <strong className="text-gray-900">{config.bairro}</strong></div>
            <div><span className="font-extrabold text-purple-950 block text-[10px]">ESTRATO:</span> <strong className="text-gray-900">{config.estrato}</strong></div>
            <div><span className="font-extrabold text-purple-950 block text-[10px]">EQUIPE:</span> <strong className="text-gray-900">{config.equipe}</strong></div>
            <div><span className="font-extrabold text-amber-950 block text-[10px]">SUPERVISOR:</span> <strong className="text-amber-900">{config.supervisor}</strong></div>
            <div><span className="font-extrabold text-purple-950 block text-[10px]">APOIO ADMIN:</span> <strong className="text-purple-900">{config.apoioAdmin}</strong></div>
            <div><span className="font-extrabold text-purple-950 block text-[10px]">AGENTES NA EQUIPE:</span> <strong className="text-purple-900">{config.agentes.length} Agentes</strong></div>
          </div>

          {/* METRIC CARDS CICLO */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-purple-50 border border-purple-200 p-3.5 rounded-2xl text-center">
              <span className="text-[10px] font-black text-purple-900 uppercase block mb-0.5">Total Imóveis Ciclo</span>
              <span className="text-2xl font-black text-purple-950">{pad2(resCiclo.totalImoveis)}</span>
              <span className="text-[10px] font-bold text-purple-700 block mt-0.5">Visitações Acumuladas</span>
            </div>
            <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-2xl text-center">
              <span className="text-[10px] font-black text-blue-900 uppercase block mb-0.5">Imóveis Tratados</span>
              <span className="text-2xl font-black text-blue-900">{pad2(resCiclo.totalTratados)}</span>
              <span className="text-[10px] font-bold text-blue-700 block mt-0.5">Com Larvicida</span>
            </div>
            <div className="bg-red-50 border border-red-200 p-3.5 rounded-2xl text-center">
              <span className="text-[10px] font-black text-red-900 uppercase block mb-0.5">Focos Acumulados</span>
              <span className="text-2xl font-black text-red-700">{pad2(resCiclo.totalFocados)}</span>
              <span className="text-[10px] font-extrabold text-red-800 block mt-0.5">{iipCiclo.toFixed(2)}% IIP Médio do Ciclo</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-center">
              <span className="text-[10px] font-black text-amber-900 uppercase block mb-0.5">Quarteirões Concluídos</span>
              <span className="text-2xl font-black text-amber-900">{pad2(quarteiroesCiclo.length)}</span>
              <span className="text-[10px] font-bold text-amber-800 block mt-0.5">Abrangência Territorial</span>
            </div>
          </div>

          {/* QUARTEIRÕES CONCLUÍDOS NO CICLO */}
          <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-purple-950">
              <span className="flex items-center gap-1.5"><CheckSquare className="w-4 h-4 text-purple-600" /> QUARTEIRÕES CONCLUÍDOS NO CICLO COMPLETO</span>
              <span className="bg-purple-200 text-purple-900 px-2.5 py-0.5 rounded-full font-bold">Total: {pad2(quarteiroesCiclo.length)} Concluídos</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {quarteiroesCiclo.length === 0 ? (
                <span className="text-xs text-gray-400 italic">Nenhum quarteirão concluído no período do ciclo.</span>
              ) : (
                quarteiroesCiclo.map((q) => (
                  <span key={q} className="bg-purple-100 text-purple-900 font-extrabold text-xs px-3 py-1 rounded-xl border border-purple-300">
                    Qtr {q}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* QUADRO I - IMÓVEIS INSPECIONADOS, TRATADOS E PENDÊNCIAS DO CICLO          */}
          {/* ========================================================================= */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
              <Home className="w-4 h-4 text-purple-700" /> QUADRO I - CONSOLIDADO DE IMÓVEIS E PENDÊNCIAS NO CICLO
            </h4>

            <div className="overflow-x-auto border border-gray-300 rounded-2xl shadow-xs">
              <table className="w-full text-xs text-center border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-purple-900 text-white font-black">
                    <th className="p-2.5 border border-gray-600">ESPECIFICAÇÃO DE IMÓVEIS</th>
                    <th className="p-2.5 border border-gray-600">RESIDENCIAL (R)</th>
                    <th className="p-2.5 border border-gray-600">COMERCIAL (C)</th>
                    <th className="p-2.5 border border-gray-600">TERRENO BALDIO (TB)</th>
                    <th className="p-2.5 border border-gray-600">PONTO ESTRATÉGICO (PE)</th>
                    <th className="p-2.5 border border-gray-600">OUTROS (O)</th>
                    <th className="p-2.5 border border-gray-600 bg-purple-950 text-white font-black">TOTAL IMÓVEIS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-bold">
                  <tr>
                    <td className="p-2.5 border border-gray-300 font-extrabold text-left bg-gray-50 text-gray-800">1. IMÓVEIS INSPECIONADOS (TRABALHADOS)</td>
                    <td className="p-2.5 border border-gray-300">{pad2(resCiclo.R)}</td>
                    <td className="p-2.5 border border-gray-300">{pad2(resCiclo.C)}</td>
                    <td className="p-2.5 border border-gray-300">{pad2(resCiclo.TB)}</td>
                    <td className="p-2.5 border border-gray-300">{pad2(resCiclo.PE)}</td>
                    <td className="p-2.5 border border-gray-300">{pad2(resCiclo.O)}</td>
                    <td className="p-2.5 border border-gray-300 font-black bg-purple-100 text-purple-950">{pad2(resCiclo.totalImoveis)}</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 border border-gray-300 font-extrabold text-left bg-gray-50 text-blue-900">2. IMÓVEIS TRATADOS (COM LARVICIDA)</td>
                    <td className="p-2.5 border border-gray-300 text-blue-800">{pad2(resCiclo.R_Trat)}</td>
                    <td className="p-2.5 border border-gray-300 text-blue-800">{pad2(resCiclo.C_Trat)}</td>
                    <td className="p-2.5 border border-gray-300 text-blue-800">{pad2(resCiclo.TB_Trat)}</td>
                    <td className="p-2.5 border border-gray-300 text-blue-800">{pad2(resCiclo.PE_Trat)}</td>
                    <td className="p-2.5 border border-gray-300 text-blue-800">{pad2(resCiclo.O_Trat)}</td>
                    <td className="p-2.5 border border-gray-300 font-black bg-blue-100 text-blue-950">{pad2(resCiclo.totalTratados)}</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 border border-gray-300 font-extrabold text-left bg-red-50 text-red-900">3. IMÓVEIS COM FOCO DE LARVA (POSITIVOS)</td>
                    <td className="p-2.5 border border-gray-300 text-red-700">{pad2(resCiclo.R_Foc)}</td>
                    <td className="p-2.5 border border-gray-300 text-red-700">{pad2(resCiclo.C_Foc)}</td>
                    <td className="p-2.5 border border-gray-300 text-red-700">{pad2(resCiclo.TB_Foc)}</td>
                    <td className="p-2.5 border border-gray-300 text-red-700">{pad2(resCiclo.PE_Foc)}</td>
                    <td className="p-2.5 border border-gray-300 text-red-700">{pad2(resCiclo.O_Foc)}</td>
                    <td className="p-2.5 border border-gray-300 font-black bg-red-100 text-red-950">{pad2(resCiclo.totalFocados)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* SUB-TABLE PENDÊNCIAS DO CICLO */}
            <div className="overflow-x-auto border border-gray-300 rounded-2xl shadow-xs mt-2">
              <table className="w-full text-xs text-center border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-700 text-white font-extrabold">
                    <th className="p-2 border border-gray-600">IMÓVEIS FECHADOS</th>
                    <th className="p-2 border border-gray-600">IMÓVEIS ABANDONADOS</th>
                    <th className="p-2 border border-gray-600">RECUSAS DE INSPEÇÃO</th>
                    <th className="p-2 border border-gray-600">IMÓVEIS RECUPERADOS</th>
                    <th className="p-2 border border-gray-600 bg-amber-600 text-white font-black">TOTAL PENDÊNCIAS</th>
                    <th className="p-2 border border-gray-600 bg-amber-700 text-white font-black">ÍNDICE PENDÊNCIA (%)</th>
                  </tr>
                </thead>
                <tbody className="font-bold">
                  <tr>
                    <td className="p-2.5 border border-gray-300">{pad2(resCiclo.fechados)}</td>
                    <td className="p-2.5 border border-gray-300">{pad2(resCiclo.abandonados)}</td>
                    <td className="p-2.5 border border-gray-300 text-red-700 font-black">{pad2(resCiclo.recusados)}</td>
                    <td className="p-2.5 border border-gray-300 text-emerald-800 font-black">{pad2(resCiclo.recuperados)}</td>
                    <td className="p-2.5 border border-gray-300 font-black bg-amber-100 text-amber-950">{pad2(resCiclo.totalPendencia)}</td>
                    <td className="p-2.5 border border-gray-300 font-black bg-amber-200 text-amber-950">{resCiclo.indicePendencia.toFixed(1)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* QUADRO II - MAPA OFICIAL DE DEPÓSITOS E CRIADOUROS (A1 A E) DO CICLO      */}
          {/* ========================================================================= */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-purple-700" /> QUADRO II - MAPA OFICIAL DE DEPÓSITOS E CRIADOUROS (A1 a E) NO CICLO
            </h4>

            <div className="overflow-x-auto border border-gray-300 rounded-2xl shadow-xs">
              <table className="w-full text-xs border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-purple-900 text-white font-black text-center">
                    <th className="p-2.5 border border-gray-600 w-16">GRUPO</th>
                    <th className="p-2.5 border border-gray-600 text-left">DESCRIÇÃO DO CRIADOURO / RECIPIENTE</th>
                    <th className="p-2.5 border border-gray-600">ENCONTRADOS</th>
                    <th className="p-2.5 border border-gray-600">NÃO INSPECIONADOS</th>
                    <th className="p-2.5 border border-gray-600">INSPECIONADOS</th>
                    <th className="p-2.5 border border-gray-600 bg-blue-900 text-white font-black">TRATADOS</th>
                    <th className="p-2.5 border border-gray-600 bg-red-900 text-white font-black">COM FOCO (POSITIVOS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-semibold text-center">
                  {Object.entries(depCategorias).map(([tipo, info]) => {
                    const dep = resCiclo.depositos[tipo] || { encontrados: 0, naoInspecionados: 0, inspecionados: 0, tratados: 0, foco: 0 };
                    const temFoco = dep.foco > 0;

                    return (
                      <tr key={tipo} className={temFoco ? 'bg-red-50/60 font-bold' : 'hover:bg-gray-50'}>
                        <td className="p-2 border border-gray-300 font-black text-gray-900 bg-gray-100">{tipo}</td>
                        <td className="p-2 border border-gray-300 text-left font-bold text-gray-800">
                          <div>{info.rotulo}</div>
                          <div className="text-[10px] text-gray-500 font-normal">{info.desc}</div>
                        </td>
                        <td className="p-2 border border-gray-300">{dep.encontrados}</td>
                        <td className="p-2 border border-gray-300 text-gray-500">{dep.naoInspecionados}</td>
                        <td className="p-2 border border-gray-300 font-bold text-gray-900">{dep.inspecionados}</td>
                        <td className="p-2 border border-gray-300 text-blue-800 font-bold bg-blue-50/50">{dep.tratados}</td>
                        <td className={`p-2 border border-gray-300 font-black ${temFoco ? 'text-red-700 bg-red-100' : 'text-gray-400'}`}>
                          {dep.foco}
                        </td>
                      </tr>
                    );
                  })}
                  {/* TOTAL DEPÓSITOS ROW */}
                  <tr className="bg-purple-100/80 font-black text-purple-950 text-center">
                    <td colSpan={2} className="p-2.5 border border-gray-300 text-left uppercase">TOTAL DE DEPÓSITOS NO CICLO</td>
                    <td className="p-2.5 border border-gray-300">{resCiclo.totalDepositos.encontrados}</td>
                    <td className="p-2.5 border border-gray-300">{resCiclo.totalDepositos.naoInspecionados}</td>
                    <td className="p-2.5 border border-gray-300">{resCiclo.totalDepositos.inspecionados}</td>
                    <td className="p-2.5 border border-gray-300 text-blue-900 bg-blue-200">{resCiclo.totalDepositos.tratados}</td>
                    <td className="p-2.5 border border-gray-300 text-red-900 bg-red-200">{resCiclo.totalDepositos.foco}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CONSUMO ACUMULADO DE LARVICIDA & AMOSTRAS NO CICLO                        */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-2xl space-y-2">
              <h5 className="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                <Droplets className="w-4 h-4 text-purple-700" /> CONSUMO ACUMULADO DE LARVICIDA NO CICLO
              </h5>
              <div className="space-y-1.5 text-xs font-bold text-gray-800">
                <div className="flex justify-between p-2 bg-white rounded-xl border border-purple-100">
                  <span>Larvicida Utilizado:</span>
                  <strong className="text-purple-900">Natular DT / Spinosad</strong>
                </div>
                <div className="flex justify-between p-2 bg-white rounded-xl border border-purple-100">
                  <span>Gramas / Litros Acumulados:</span>
                  <strong className="text-purple-900">{resCiclo.gramasLarvicida.toFixed(1)}g ({resCiclo.litrosTratados}L)</strong>
                </div>
                <div className="flex justify-between p-2 bg-white rounded-xl border border-purple-100">
                  <span>Depósitos Eliminados no Ciclo:</span>
                  <strong className="text-emerald-700">{resCiclo.depositosEliminados} eliminados</strong>
                </div>
              </div>
            </div>

            <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-2xl space-y-2">
              <h5 className="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                <Bug className="w-4 h-4 text-red-600" /> EPIDEMIOLOGIA E INFESTAÇÃO NO CICLO
              </h5>
              <div className="space-y-1.5 text-xs font-bold text-gray-800">
                <div className="flex justify-between p-2 bg-white rounded-xl border border-purple-100">
                  <span>Coletas de Amostras Entomológicas:</span>
                  <strong className="text-red-700">{resCiclo.totalFocados} amostra(s)</strong>
                </div>
                <div className="flex justify-between p-2 bg-white rounded-xl border border-purple-100">
                  <span>Média do Índice Infestação (IIP):</span>
                  <strong className={`px-2 py-0.5 rounded text-white ${iipCiclo >= 4 ? 'bg-red-600' : iipCiclo >= 1 ? 'bg-amber-500' : 'bg-emerald-600'}`}>
                    {iipCiclo.toFixed(2)}% ({iipCiclo >= 4 ? 'Risco Alto' : iipCiclo >= 1 ? 'Alerta' : 'Satisfatório'})
                  </strong>
                </div>
                <div className="flex justify-between p-2 bg-white rounded-xl border border-purple-100">
                  <span>Agentes Ativos no Ciclo:</span>
                  <strong className="text-gray-900">{agentesTrabalharamCiclo.length} ACEs em campo</strong>
                </div>
              </div>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* QUADRO III - PRODUÇÃO ACUMULADA DOS AGENTES NO CICLO                     */}
          {/* ========================================================================= */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-700" /> QUADRO III - PRODUÇÃO INDIVIDUAL ACUMULADA DOS AGENTES NO CICLO
            </h4>

            <div className="overflow-x-auto border border-gray-300 rounded-2xl shadow-xs">
              <table className="w-full text-xs text-center border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-purple-900 text-white font-black">
                    <th className="p-2.5 border border-gray-600 text-left">NOME DO AGENTE (ACE)</th>
                    <th className="p-2.5 border border-gray-600">DIAS EM CAMPO</th>
                    <th className="p-2.5 border border-gray-600">IMÓVEIS INSPECIONADOS</th>
                    <th className="p-2.5 border border-gray-600">TRATADOS</th>
                    <th className="p-2.5 border border-gray-600">FOCOS ENCONTRADOS</th>
                    <th className="p-2.5 border border-gray-600">LARVICIDA (g)</th>
                    <th className="p-2.5 border border-gray-600">QUARTEIRÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-semibold">
                  {prodAgentesCiclo.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-gray-400 italic">
                        Nenhum registro individual encontrado para este ciclo.
                      </td>
                    </tr>
                  ) : (
                    prodAgentesCiclo.map((ag) => (
                      <tr key={ag.nome} className="hover:bg-gray-50">
                        <td className="p-2.5 border border-gray-300 text-left font-extrabold text-gray-900">{ag.nome}</td>
                        <td className="p-2.5 border border-gray-300 text-gray-700">{ag.diasCount} dia(s)</td>
                        <td className="p-2.5 border border-gray-300 font-bold text-gray-900">{ag.imoveis}</td>
                        <td className="p-2.5 border border-gray-300 text-blue-800 font-bold">{ag.tratados}</td>
                        <td className={`p-2.5 border border-gray-300 font-black ${ag.focados > 0 ? 'text-red-700 bg-red-50' : 'text-gray-400'}`}>
                          {ag.focados}
                        </td>
                        <td className="p-2.5 border border-gray-300 text-gray-800">{ag.larvicida.toFixed(1)}g</td>
                        <td className="p-2.5 border border-gray-300 font-bold text-purple-800">{ag.totalQuarteiroes} Qtr</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* QUADRO IV - EVOLUÇÃO POR SEMANA EPIDEMIOLÓGICA NO CICLO                   */}
          {/* ========================================================================= */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-700" /> QUADRO IV - DESEMPENHO POR SEMANA EPIDEMIOLÓGICA
            </h4>

            <div className="overflow-x-auto border border-gray-300 rounded-2xl shadow-xs">
              <table className="w-full text-xs text-center border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-800 text-white font-black">
                    <th className="p-2.5 border border-gray-600 text-left">SEMANA EPIDEMIOLÓGICA</th>
                    <th className="p-2.5 border border-gray-600">LANÇAMENTOS</th>
                    <th className="p-2.5 border border-gray-600">INSPECIONADOS</th>
                    <th className="p-2.5 border border-gray-600">TRATADOS</th>
                    <th className="p-2.5 border border-gray-600">FOCOS</th>
                    <th className="p-2.5 border border-gray-600">LARVICIDA (g)</th>
                    <th className="p-2.5 border border-gray-600 bg-slate-900">IIP DA SEMANA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-semibold">
                  {semanasNoCiclo.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-gray-400 italic">Nenhum lançamento no ciclo.</td>
                    </tr>
                  ) : (
                    semanasNoCiclo.map((semNome) => {
                      const listSem = lancamentosCiclo.filter((d) => d.semana === semNome || (!d.semana && semNome === 'Semana N/A'));
                      const resSem = processarDadosResumo(listSem);
                      const iipSem = resSem.totalImoveis > 0 ? (resSem.totalFocados / resSem.totalImoveis) * 100 : 0;

                      return (
                        <tr key={semNome} className="hover:bg-gray-50">
                          <td className="p-2.5 border border-gray-300 text-left font-extrabold text-purple-950">{semNome}</td>
                          <td className="p-2.5 border border-gray-300 text-gray-600">{listSem.length} boletim(ns)</td>
                          <td className="p-2.5 border border-gray-300 font-bold text-gray-900">{resSem.totalImoveis}</td>
                          <td className="p-2.5 border border-gray-300 text-blue-800 font-bold">{resSem.totalTratados}</td>
                          <td className={`p-2.5 border border-gray-300 font-black ${resSem.totalFocados > 0 ? 'text-red-700 bg-red-50' : 'text-gray-400'}`}>
                            {resSem.totalFocados}
                          </td>
                          <td className="p-2.5 border border-gray-300 text-gray-800">{resSem.gramasLarvicida.toFixed(1)}g</td>
                          <td className={`p-2.5 border border-gray-300 font-black ${iipSem >= 4 ? 'text-red-700 bg-red-100' : iipSem >= 1 ? 'text-amber-800 bg-amber-50' : 'text-emerald-800 bg-emerald-50'}`}>
                            {iipSem.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* OBSERVAÇÕES E ASSINATURAS DO CICLO */}
          <div className="space-y-3 pt-2">
            <label className="block text-xs font-black text-purple-950 uppercase tracking-wider">
              📝 OBSERVAÇÕES E CONTRADITA DE FECHAMENTO DO CICLO
            </label>
            <textarea
              rows={3}
              value={obsCiclo}
              onChange={(e) => handleSaveObs('ciclo', e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-300 rounded-2xl text-xs font-medium text-gray-800 focus:ring-2 focus:ring-purple-600 outline-none print:border-none print:bg-transparent print:p-0"
              placeholder="Digite observações sobre o resultado consolidado do ciclo..."
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-8 border-t border-gray-300 text-center text-xs font-bold text-gray-800">
              <div className="space-y-1">
                <div className="border-b border-gray-400 w-3/4 mx-auto pb-1 font-black text-gray-900">
                  {config.supervisor || 'Supervisor de Campo'}
                </div>
                <p className="text-[11px] text-gray-600 font-extrabold uppercase">SUPERVISOR RESPONSÁVEL DO CICLO</p>
                <p className="text-[10px] text-gray-400">ACE / Controle Antivetorial</p>
              </div>

              <div className="space-y-1">
                <div className="border-b border-gray-400 w-3/4 mx-auto pb-1 font-black text-gray-900">
                  {config.apoioAdmin || 'Apoio Administrativo'}
                </div>
                <p className="text-[11px] text-gray-600 font-extrabold uppercase">APOIO ADMINISTRATIVO / COORDENAÇÃO DE ZOONOSES</p>
                <p className="text-[10px] text-gray-400">Vigilância em Saúde Zoonoses</p>
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 print:hidden">
            <button
              onClick={() => handleExportExcel('ciclo')}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" /> Exportar Planilha Excel (.xls)
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-3 bg-purple-900 hover:bg-purple-800 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <Printer className="w-4 h-4" /> Imprimir Consolidação do Ciclo / PDF
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
