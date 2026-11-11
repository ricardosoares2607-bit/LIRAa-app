import React, { useState } from 'react';
import {
  getLancamentosList,
  processarDadosResumo,
  getConfigEquipe,
  getCicloAtivoNome,
  getSemanaAtiva,
  getQuarteiroes,
  formatarDataBR
} from '../utils/storage';
import { exportToExcel } from '../utils/exportExcel';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Bug,
  Home,
  Droplets,
  Users,
  ShieldAlert,
  Download,
  Filter,
  Flame,
  Clock,
  Layers,
  MapPin,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface DashboardProps {
  onNavigateTab: (tab: 'gestao' | 'lancamentos' | 'resumos' | 'producao' | 'liraa') => void;
  onNotify?: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateTab, onNotify }) => {
  const [filtroSemana, setFiltroSemana] = useState<'todas' | 'ativa'>('todas');
  
  const lancamentos = getLancamentosList();
  const config = getConfigEquipe();
  const cicloNome = getCicloAtivoNome();
  const semanaAtiva = getSemanaAtiva();
  const quarteiroes = getQuarteiroes();

  // Filtragem dos lançamentos com base na semana escolhida
  const lancamentosFiltrados = lancamentos.filter((l) => {
    if (filtroSemana === 'ativa' && semanaAtiva) {
      return l.semana === semanaAtiva.nome || l.semana === `Semana ${semanaAtiva.numero}`;
    }
    return true;
  });

  const resumo = processarDadosResumo(lancamentosFiltrados);

  // Cálculo do Índice de Infestação Predial (IIP)
  // IIP = (Imóveis com Foco / Total Imóveis Trabalhados) * 100
  const iip = resumo.totalImoveis > 0 ? (resumo.totalFocados / resumo.totalImoveis) * 100 : 0;

  // Classificação de Risco Epidemiológico
  let riscoIIP = { texto: 'Satisfatório', cor: 'text-emerald-600 bg-emerald-50 border-emerald-200', badge: 'bg-emerald-500' };
  if (iip >= 4.0) {
    riscoIIP = { texto: 'Risco Alto (Surto)', cor: 'text-red-700 bg-red-50 border-red-200', badge: 'bg-red-600' };
  } else if (iip >= 1.0) {
    riscoIIP = { texto: 'Alerta (Médio Risco)', cor: 'text-amber-700 bg-amber-50 border-amber-200', badge: 'bg-amber-500' };
  }

  // Agrupamento da produção por agente
  const agentesProdDict: Record<string, {
    imoveis: number;
    focados: number;
    tratados: number;
    pendencias: number;
    larvicida: number;
    quarteiroes: Set<string>;
    diasTrabalhados: Set<string>;
  }> = {};

  // Inicializa todos os agentes cadastrados na equipe
  config.agentes.forEach((ag) => {
    agentesProdDict[ag] = {
      imoveis: 0,
      focados: 0,
      tratados: 0,
      pendencias: 0,
      larvicida: 0,
      quarteiroes: new Set(),
      diasTrabalhados: new Set(),
    };
  });

  lancamentosFiltrados.forEach((l) => {
    const nome = l.agente;
    if (!agentesProdDict[nome]) {
      agentesProdDict[nome] = {
        imoveis: 0,
        focados: 0,
        tratados: 0,
        pendencias: 0,
        larvicida: 0,
        quarteiroes: new Set(),
        diasTrabalhados: new Set(),
      };
    }

    const totalImov = (Number(l.R) || 0) + (Number(l.C) || 0) + (Number(l.TB) || 0) + (Number(l.PE) || 0) + (Number(l.O) || 0);
    const totalFoc = (Number(l.R_Foc) || 0) + (Number(l.C_Foc) || 0) + (Number(l.TB_Foc) || 0) + (Number(l.PE_Foc) || 0) + (Number(l.O_Foc) || 0);
    const totalTrat = (Number(l.R_Trat) || 0) + (Number(l.C_Trat) || 0) + (Number(l.TB_Trat) || 0) + (Number(l.PE_Trat) || 0) + (Number(l.O_Trat) || 0);
    const pend = (Number(l.fechados) || 0) + (Number(l.recusados) || 0) + (Number(l.abandonados) || 0) - (Number(l.recuperados) || 0);
    const larv = Number(l.gramasLarvicida) || ((Number(l.litrosTratados) || 0) * 0.5);

    agentesProdDict[nome].imoveis += totalImov;
    agentesProdDict[nome].focados += totalFoc;
    agentesProdDict[nome].tratados += totalTrat;
    agentesProdDict[nome].pendencias += pend;
    agentesProdDict[nome].larvicida += larv;
    if (l.data) agentesProdDict[nome].diasTrabalhados.add(l.data);

    if (l.quarteiroes) {
      l.quarteiroes.forEach((q) => {
        if (q.numero) agentesProdDict[nome].quarteiroes.add(q.numero);
      });
    }
  });

  const agentesProdList = Object.entries(agentesProdDict).map(([nome, dados]) => ({
    nome,
    ...dados,
    totalQuarteiroes: dados.quarteiroes.size,
    diasCount: dados.diasTrabalhados.size,
  })).sort((a, b) => b.imoveis - a.imoveis);

  // Imóveis Categoria Max for bar scale
  const maxCatVal = Math.max(resumo.R, resumo.C, resumo.TB, resumo.PE, resumo.O, 1);

  // Depósitos Nomes
  const depNomes: Record<string, { rotulo: string; desc: string }> = {
    A1: { rotulo: 'A1 - Caixas d\'água elevadas', desc: 'Caixas d\'água, cisternas, reservatórios elevados' },
    A2: { rotulo: 'A2 - Depósitos no solo', desc: 'Poços, tambores, tonéis, cacimbas' },
    B: { rotulo: 'B - Depósitos móveis', desc: 'Vasos de plantas, frascos, garrafas, pingadeiras' },
    C: { rotulo: 'C - Depósitos fixos', desc: 'Calhas, lajes, piscinas, sanitários em desuso' },
    D1: { rotulo: 'D1 - Pneus e rodantes', desc: 'Pneus e câmaras de ar' },
    D2: { rotulo: 'D2 - Lixo e sucata', desc: 'Entulho de construção, latas, plásticos, ferro-velho' },
    E: { rotulo: 'E - Depósitos naturais', desc: 'Ocos de árvores, bromélias, buracos em rochas' },
  };

  const handleExportDashboard = () => {
    const headers = ['Agente', 'Imóveis Visitados', 'Focos Encontrados', 'Depósitos Tratados', 'Pendências', 'Larvicida (g)', 'Quarteiroes Trabalhados'];
    const rows = agentesProdList.map((a) => [
      a.nome,
      a.imoveis,
      a.focados,
      a.tratados,
      a.pendencias,
      a.larvicida.toFixed(1),
      a.totalQuarteiroes
    ]);

    exportToExcel(`Dashboard_ACE_${config.bairro}_${filtroSemana}`, 'Painel ACE', headers, rows);
    if (onNotify) onNotify('📊 Relatório do Dashboard exportado com sucesso!', 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-[#0f2e4a] via-[#163f63] to-[#1a4b73] text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-[-20px] top-[-20px] w-64 h-64 bg-sky-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/2 bottom-[-40px] w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold">
              <span className="bg-sky-400/20 text-sky-200 px-3 py-1 rounded-full border border-sky-400/30 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-sky-300" /> {config.bairro} ({config.estrato})
              </span>
              <span className="bg-white/10 text-white px-3 py-1 rounded-full border border-white/10">
                {config.equipe} • Supervisor: {config.supervisor}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-sky-400 shrink-0" />
              Painel Operacional e Epidemiológico
            </h2>

            <p className="text-xs sm:text-sm text-sky-100 max-w-2xl font-medium leading-relaxed">
              Monitoramento consolidado do combate ao vetor Aedes aegypti no <strong className="text-white">{cicloNome}</strong>.
              Acompanhe a cobertura de imóveis, índices de infestação predial, foco de depósitos e produtividade da equipe.
            </p>
          </div>

          {/* CONTROLS & QUICK ACTIONS */}
          <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-2.5 shrink-0">
            <div className="bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/15 flex items-center gap-1">
              <button
                onClick={() => setFiltroSemana('todas')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filtroSemana === 'todas'
                    ? 'bg-white text-[#0f2e4a] shadow-sm'
                    : 'text-sky-100 hover:text-white hover:bg-white/10'
                }`}
              >
                Todas as Semanas
              </button>
              <button
                onClick={() => setFiltroSemana('ativa')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filtroSemana === 'ativa'
                    ? 'bg-white text-[#0f2e4a] shadow-sm'
                    : 'text-sky-100 hover:text-white hover:bg-white/10'
                }`}
              >
                Semana Ativa ({semanaAtiva ? semanaAtiva.nome : '1ª Semana'})
              </button>
            </div>

            <button
              onClick={() => onNavigateTab('liraa')}
              className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-[#0f2e4a] font-black text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
              title="Acessar Imóveis Bases e Quarteirões para o LIRAa"
            >
              <MapPin className="w-4 h-4 text-[#0f2e4a]" /> Quarteirões LIRAa
            </button>

            <button
              onClick={handleExportDashboard}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Exportar Dados
            </button>
          </div>
        </div>
      </div>

      {/* TOP KPI CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* CARD 1: TOTAL IMÓVEIS TRABALHADOS */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Imóveis Trabalhados</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Home className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900">{resumo.totalImoveis.toLocaleString('pt-BR')}</span>
            <span className="text-xs font-bold text-gray-500">imóveis</span>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-600 font-semibold">
            <span>Residenciais (R): <strong className="text-gray-900">{resumo.R}</strong></span>
            <span>Terrenos (TB): <strong className="text-gray-900">{resumo.TB}</strong></span>
          </div>
        </div>

        {/* CARD 2: IMÓVEIS COM FOCO / IIP */}
        <div className={`rounded-2xl p-5 shadow-sm border transition-shadow relative overflow-hidden bg-white border-gray-200 hover:shadow-md`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Imóveis com Foco (IIP)</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${resumo.totalFocados > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <Bug className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-black ${resumo.totalFocados > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {resumo.totalFocados}
              </span>
              <span className="text-xs font-bold text-gray-500">focos</span>
            </div>
            <div className={`px-2.5 py-1 rounded-full border text-[11px] font-black flex items-center gap-1 ${riscoIIP.cor}`}>
              <span className={`w-2 h-2 rounded-full ${riscoIIP.badge}`} />
              {iip.toFixed(2)}% IIP
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px]">
            <span className="font-bold text-gray-600">Risco Epidemiológico:</span>
            <span className={`font-extrabold ${riscoIIP.cor.split(' ')[0]}`}>{riscoIIP.texto}</span>
          </div>
        </div>

        {/* CARD 3: DEPÓSITOS TRATADOS E ELIMINADOS */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Depósitos & Larvicida</span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Droplets className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900">{resumo.totalDepositos.tratados}</span>
            <span className="text-xs font-bold text-gray-500">tratados</span>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-600 font-semibold">
            <span>Eliminados: <strong className="text-emerald-700 font-black">{resumo.depositosEliminados}</strong></span>
            <span>Larvicida: <strong className="text-blue-900 font-black">{resumo.gramasLarvicida.toFixed(1)}g</strong></span>
          </div>
        </div>

        {/* CARD 4: PENDÊNCIAS E ÍNDICE DE COBERTURA */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Pendências (Rec/Fech)</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${resumo.indicePendencia > 10 ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-600'}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-gray-900">{resumo.totalPendencia}</span>
              <span className="text-xs font-bold text-gray-500">imóveis</span>
            </div>
            <span className={`text-xs font-extrabold px-2 py-0.5 rounded-lg ${resumo.indicePendencia > 10 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>
              {resumo.indicePendencia.toFixed(1)}% pend.
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-600 font-semibold">
            <span>Fechados: <strong className="text-gray-900">{resumo.fechados}</strong></span>
            <span>Recusados: <strong className="text-red-700 font-bold">{resumo.recusados}</strong></span>
            <span>Recuperados: <strong className="text-emerald-700 font-bold">{resumo.recuperados}</strong></span>
          </div>
        </div>

      </div>

      {/* SECTION 1: GRÁFICOS VISUAIS E COMPOSIÇÃO DOS IMÓVEIS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COL 1 & 2: CATEGORIA DE IMÓVEIS E STATUS OPERACIONAL */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-gray-200 space-y-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-base font-black text-[#0f2e4a] flex items-center gap-2">
                <Home className="w-5 h-5 text-blue-600" /> Distribuição de Imóveis Trabalhados por Categoria
              </h3>
              <p className="text-xs text-gray-500 font-medium">Comparativo de imóveis inspecionados, tratados com larvicida e focados.</p>
            </div>
            <button
              onClick={() => onNavigateTab('resumos')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline"
            >
              Ver Resumos <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {[
              { chave: 'R', rotulo: 'Residencial (R)', valor: resumo.R, trat: resumo.R_Trat, foc: resumo.R_Foc, cor: 'bg-blue-600' },
              { chave: 'C', rotulo: 'Comércio (C)', valor: resumo.C, trat: resumo.C_Trat, foc: resumo.C_Foc, cor: 'bg-sky-500' },
              { chave: 'TB', rotulo: 'Terreno Baldio (TB)', valor: resumo.TB, trat: resumo.TB_Trat, foc: resumo.TB_Foc, cor: 'bg-amber-500' },
              { chave: 'PE', rotulo: 'Ponto Estratégico (PE)', valor: resumo.PE, trat: resumo.PE_Trat, foc: resumo.PE_Foc, cor: 'bg-purple-600' },
              { chave: 'O', rotulo: 'Outros (O)', valor: resumo.O, trat: resumo.O_Trat, foc: resumo.O_Foc, cor: 'bg-emerald-500' },
            ].map((cat) => {
              const pct = maxCatVal > 0 ? (cat.valor / maxCatVal) * 100 : 0;
              return (
                <div key={cat.chave} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-gray-800">{cat.rotulo}</span>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="text-gray-900 font-black">{cat.valor} inspec.</span>
                      {cat.trat > 0 && <span className="text-blue-700 font-extrabold">{cat.trat} trat.</span>}
                      {cat.foc > 0 && <span className="text-red-600 font-black bg-red-50 px-1.5 py-0.5 rounded">{cat.foc} focos</span>}
                    </div>
                  </div>

                  {/* BAR PROGRESS */}
                  <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden flex shadow-inner">
                    <div
                      className={`${cat.cor} h-full rounded-full transition-all duration-500`}
                      style={{ width: `${Math.max(pct, cat.valor > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* TOTAL SUMMARY BADGE FOOTER */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-gray-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Total de Visitas Efetuadas: <strong className="text-gray-900">{resumo.totalImoveis}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-600" />
              <span>Imóveis Tratados: <strong className="text-blue-900">{resumo.totalTratados}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>Com Foco de Larva: <strong className="text-red-700">{resumo.totalFocados}</strong></span>
            </div>
          </div>
        </div>

        {/* COL 3: STATUS DOS QUARTEIRÕES E AÇÕES RÁPIDAS */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 space-y-4">
            <h3 className="text-base font-black text-[#0f2e4a] flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-600" /> Situação dos Quarteirões
            </h3>
            <p className="text-xs text-gray-500 font-medium">Mapeamento de área e nível de risco dos quarteirões da localidade.</p>

            <div className="space-y-2.5">
              {quarteiroes.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Nenhum quarteirão cadastrado nas configurações.</p>
              ) : (
                quarteiroes.map((q) => (
                  <div
                    key={q.numero}
                    className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between text-xs"
                  >
                    <span className="font-extrabold text-gray-900">Quarteirão {q.numero}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                        q.situacao === 'Conflagrado'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : q.situacao === 'Parcialmente Conflagrado'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {q.situacao}
                    </span>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => onNavigateTab('gestao')}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              Gerenciar Quarteirões & Ciclos
            </button>
          </div>

          {/* QUICK SHORTCUT CARD */}
          <div className="bg-gradient-to-br from-[#0f2e4a] to-[#1a4b73] text-white rounded-3xl p-5 shadow-md space-y-3">
            <div className="flex items-center gap-2 text-sky-300 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-300" /> Acesso Rápido
            </div>
            <h4 className="font-black text-sm text-white">Precisa lançar boletins diários de campo?</h4>
            <p className="text-xs text-sky-100 leading-relaxed font-medium">
              Acesse a tela de Lançamentos para registrar as atividades dos agentes com preenchimento automatizado de quarteirões e depósitos.
            </p>
            <button
              onClick={() => onNavigateTab('lancamentos')}
              className="w-full py-2.5 bg-white text-[#0f2e4a] hover:bg-sky-50 font-black text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2"
            >
              Ir para Lançamentos de Campo <ArrowRight className="w-4 h-4 text-blue-600" />
            </button>
          </div>
        </div>

      </div>

      {/* SECTION 2: ANÁLISE DETALHADA DE DEPÓSITOS (A1 A E) */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-base font-black text-[#0f2e4a] flex items-center gap-2">
              <Droplets className="w-5 h-5 text-sky-600" /> Mapeamento de Criadouros e Depósitos (A1 a E)
            </h3>
            <p className="text-xs text-gray-500 font-medium">Contagem de recipientes encontrados, inspecionados, tratados e com presença de foco.</p>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold text-gray-600">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-sky-500 inline-block" /> Encontrados: <strong>{resumo.totalDepositos.encontrados}</strong></span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-700 inline-block" /> Tratados: <strong>{resumo.totalDepositos.tratados}</strong></span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-600 inline-block" /> Com Foco: <strong>{resumo.totalDepositos.foco}</strong></span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {Object.entries(depNomes).map(([tipo, info]) => {
            const dep = resumo.depositos[tipo] || { encontrados: 0, naoInspecionados: 0, inspecionados: 0, tratados: 0, foco: 0 };
            const temFoco = dep.foco > 0;

            return (
              <div
                key={tipo}
                className={`p-4 rounded-2xl border transition-all ${
                  temFoco
                    ? 'bg-red-50/50 border-red-200 hover:border-red-300'
                    : 'bg-gray-50/70 border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="font-black text-xs text-gray-900 bg-white px-2 py-0.5 rounded-md border border-gray-200 shadow-xs">
                    Grupo {tipo}
                  </span>
                  {temFoco ? (
                    <span className="text-[10px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Flame className="w-3 h-3" /> {dep.foco} Foco(s)
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Sem Foco
                    </span>
                  )}
                </div>

                <h4 className="font-extrabold text-xs text-gray-800 leading-tight mb-1">{info.rotulo}</h4>
                <p className="text-[10px] text-gray-500 leading-tight mb-3 font-medium">{info.desc}</p>

                <div className="grid grid-cols-3 gap-1 pt-2 border-t border-gray-200/60 text-[11px] text-center font-bold">
                  <div className="bg-white p-1.5 rounded-lg border border-gray-100">
                    <span className="text-[9px] text-gray-400 block uppercase font-extrabold">Encont.</span>
                    <span className="text-gray-900">{dep.encontrados}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-gray-100">
                    <span className="text-[9px] text-blue-500 block uppercase font-extrabold">Tratad.</span>
                    <span className="text-blue-900">{dep.tratados}</span>
                  </div>
                  <div className={`p-1.5 rounded-lg border ${temFoco ? 'bg-red-100 border-red-200 text-red-900' : 'bg-white border-gray-100 text-gray-900'}`}>
                    <span className="text-[9px] text-red-600 block uppercase font-extrabold">Foco</span>
                    <span className="font-black">{dep.foco}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: DESEMPENHO E PRODUÇÃO DA EQUIPE DE AGENTES */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-base font-black text-[#0f2e4a] flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" /> Produtividade da Equipe de Agentes
            </h3>
            <p className="text-xs text-gray-500 font-medium">Acompanhamento do volume de imóveis, focos e cobertura espacial por agente.</p>
          </div>

          <button
            onClick={() => onNavigateTab('producao')}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline"
          >
            Ver Detalhes Individuais <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* AGENTS PRODUCTION TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100 text-gray-700 font-extrabold border-b border-gray-200">
                <th className="p-3 rounded-l-xl">Agente ACE</th>
                <th className="p-3 text-center">Dias Registrados</th>
                <th className="p-3 text-center">Imóveis Visitados</th>
                <th className="p-3 text-center">Depósitos Tratados</th>
                <th className="p-3 text-center">Focos Encontrados</th>
                <th className="p-3 text-center">Larvicida (g)</th>
                <th className="p-3 text-center rounded-r-xl">Quarteirões</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-semibold">
              {agentesProdList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-400 italic">
                    Nenhum lançamento efetuado nesta semana/ciclo.
                  </td>
                </tr>
              ) : (
                agentesProdList.map((ag) => (
                  <tr key={ag.nome} className="hover:bg-blue-50/40 transition-colors">
                    <td className="p-3 font-extrabold text-gray-900 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-800 font-black text-xs flex items-center justify-center shrink-0">
                        {ag.nome.charAt(0).toUpperCase()}
                      </div>
                      <span>{ag.nome}</span>
                    </td>
                    <td className="p-3 text-center text-gray-600">{ag.diasCount} dia(s)</td>
                    <td className="p-3 text-center font-bold text-gray-900">{ag.imoveis}</td>
                    <td className="p-3 text-center text-blue-700 font-bold">{ag.tratados}</td>
                    <td className="p-3 text-center">
                      {ag.focados > 0 ? (
                        <span className="bg-red-100 text-red-800 font-black px-2 py-0.5 rounded-full text-[11px]">
                          {ag.focados} foco(s)
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="p-3 text-center text-gray-700">{ag.larvicida.toFixed(1)}g</td>
                    <td className="p-3 text-center font-bold text-purple-700">{ag.totalQuarteiroes} Qtr</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
