import React, { useState, useEffect } from 'react';
import { Ciclo, SemanaAtiva, Quarteirao, ConfigEquipe } from '../types';
import {
  getCiclos, setCiclos, getCicloAtivoId, setCicloAtivoId,
  getSemanaAtiva, getQuarteiroes, setQuarteiroes,
  getConfigEquipe, setConfigEquipe, STORAGE_KEYS
} from '../utils/storage';
import {
  RotateCcw, Calendar, FileText, AlertTriangle, ShieldAlert,
  Save, Trash2, CheckCircle2, Lock, Plus, Users, Layers
} from 'lucide-react';

interface GestaoCicloProps {
  onNotify: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  onRefreshData: () => void;
}

export const GestaoCiclo: React.FC<GestaoCicloProps> = ({ onNotify, onRefreshData }) => {
  const [ano, setAno] = useState<string>('2026');
  const [atividade, setAtividade] = useState<string>('Levantamento + Tratamento');
  const [ciclos, setCiclosState] = useState<Ciclo[]>([]);
  const [cicloAtivoId, setCicloAtivoIdState] = useState<string | null>(null);
  const [cicloAtualNum, setCicloAtualNum] = useState<string>('1');
  const [cicloDataInicio, setCicloDataInicio] = useState<string>('');
  const [cicloDataTermino, setCicloDataTermino] = useState<string>('');
  const [imoveisProgramados, setImoveisProgramados] = useState<string>('0');

  // Semana
  const [semanaNum, setSemanaNum] = useState<string>('1');
  const [semanaInicio, setSemanaInicio] = useState<string>('');
  const [semanaTermino, setSemanaTermino] = useState<string>('');
  const [semanaStatus, setSemanaStatus] = useState<string>('Aberta');

  // Quarteirões & Config
  const [quarteiroes, setQuarteiroesState] = useState<Quarteirao[]>([]);
  const [novoQuarteiraoNum, setNovoQuarteiraoNum] = useState<string>('');
  const [novoQuarteiraoSit, setNovoQuarteiraoSit] = useState<string>('Normal');
  const [config, setConfigState] = useState<ConfigEquipe>(getConfigEquipe());

  // Modal controls
  const [showEncerrarModal, setShowEncerrarModal] = useState<boolean>(false);
  const [showClearStep1, setShowClearStep1] = useState<boolean>(false);
  const [showClearStep2, setShowClearStep2] = useState<boolean>(false);
  const [cicloParaExcluir, setCicloParaExcluir] = useState<string>('');

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = () => {
    const anoSalvo = localStorage.getItem(STORAGE_KEYS.ANO_PLANEJAMENTO) || '2026';
    const ativSalva = localStorage.getItem(STORAGE_KEYS.ATIVIDADE_PLANEJAMENTO) || 'Levantamento + Tratamento';
    const imovSalvo = localStorage.getItem(STORAGE_KEYS.IMOVEIS_PROGRAMADOS) || '0';

    setAno(anoSalvo);
    setAtividade(ativSalva);
    setImoveisProgramados(imovSalvo);

    const listCiclos = getCiclos();
    setCiclosState(listCiclos);
    const ativoId = getCicloAtivoId();
    setCicloAtivoIdState(ativoId);

    const cicloAtivo = listCiclos.find(c => c.id.toString() === ativoId);
    if (cicloAtivo) {
      setCicloAtualNum(cicloAtivo.numero.toString());
      setCicloDataInicio(cicloAtivo.dataInicio ? cicloAtivo.dataInicio.split('T')[0] : '');
      setCicloDataTermino(cicloAtivo.dataFim ? cicloAtivo.dataFim.split('T')[0] : '');
    }

    const semAtiva = getSemanaAtiva();
    if (semAtiva) {
      setSemanaNum(semAtiva.numero.toString());
      setSemanaInicio(semAtiva.inicio);
      setSemanaTermino(semAtiva.termino);
    }

    const fixada = localStorage.getItem(STORAGE_KEYS.SEMANA_FIXADA);
    const fechada = localStorage.getItem(STORAGE_KEYS.SEMANA_FECHADA);
    if (fixada) setSemanaStatus(`📌 Fixada (${fixada}ª)`);
    else if (fechada) setSemanaStatus(`🔒 Fechada (${fechada}ª)`);
    else setSemanaStatus('📅 Aberta');

    setQuarteiroesState(getQuarteiroes());
    setConfigState(getConfigEquipe());
  };

  const salvarAnoAtividade = () => {
    localStorage.setItem(STORAGE_KEYS.ANO_PLANEJAMENTO, ano);
    localStorage.setItem(STORAGE_KEYS.ATIVIDADE_PLANEJAMENTO, atividade);
    onNotify('💾 Planejamento de Ano e Atividade salvo!', 'success');
    onRefreshData();
  };

  const handleCicloNumChange = (numStr: string) => {
    setCicloAtualNum(numStr);
    const num = parseInt(numStr);
    const anoInt = parseInt(ano);
    const existente = ciclos.find(c => c.numero === num && c.ano === anoInt);
    if (existente) {
      setCicloAtivoId(existente.id);
      setCicloAtivoIdState(existente.id.toString());
      setCicloDataInicio(existente.dataInicio ? existente.dataInicio.split('T')[0] : '');
      setCicloDataTermino(existente.dataFim ? existente.dataFim.split('T')[0] : '');
      onNotify(`📌 ${num}º Ciclo ${ano} selecionado como ativo`, 'info');
      onRefreshData();
    }
  };

  const salvarDatasCiclo = () => {
    if (!cicloAtivoId) return;
    const novosciclos = ciclos.map(c => {
      if (c.id.toString() === cicloAtivoId) {
        return {
          ...c,
          dataInicio: cicloDataInicio ? new Date(cicloDataInicio).toISOString() : c.dataInicio,
          dataFim: cicloDataTermino ? new Date(cicloDataTermino).toISOString() : c.dataFim
        };
      }
      return c;
    });
    setCiclos(novosciclos);
    setCiclosState(novosciclos);
    onNotify('📅 Datas do ciclo atualizadas!', 'success');
    onRefreshData();
  };

  const iniciarCiclo = () => {
    const num = parseInt(cicloAtualNum);
    const anoInt = parseInt(ano);
    if (!num) {
      onNotify('⚠️ Selecione um número de ciclo.', 'warning');
      return;
    }
    const existente = ciclos.find(c => c.numero === num && c.ano === anoInt);
    if (existente) {
      onNotify(`❌ ${num}º Ciclo ${anoInt} já existe!`, 'error');
      return;
    }

    const novo: Ciclo = {
      id: Date.now(),
      numero: num,
      ano: anoInt,
      status: 'ativo',
      dataInicio: cicloDataInicio ? new Date(cicloDataInicio).toISOString() : new Date().toISOString(),
      dataFim: cicloDataTermino ? new Date(cicloDataTermino).toISOString() : null
    };

    const novos = [...ciclos, novo];
    setCiclos(novos);
    setCiclosState(novos);
    setCicloAtivoId(novo.id);
    setCicloAtivoIdState(novo.id.toString());
    onNotify(`✅ ${num}º Ciclo ${anoInt} iniciado com sucesso!`, 'success');
    onRefreshData();
  };

  const encerrarCicloAtivo = () => {
    if (!cicloAtivoId) return;
    const novos = ciclos.map(c => {
      if (c.id.toString() === cicloAtivoId) {
        return { ...c, status: 'encerrado' as const, dataFim: new Date().toISOString() };
      }
      return c;
    });
    setCiclos(novos);
    setCiclosState(novos);
    setShowEncerrarModal(false);
    onNotify('✅ Ciclo encerrado com sucesso!', 'success');
    onRefreshData();
  };

  const excluirCicloSelecionado = () => {
    if (!cicloParaExcluir) {
      onNotify('⚠️ Selecione um ciclo para excluir.', 'warning');
      return;
    }
    const target = ciclos.find(c => c.id.toString() === cicloParaExcluir);
    if (!target) return;

    if (confirm(`⚠️ ATENÇÃO: Isso apagará o ${target.numero}º Ciclo ${target.ano} e TODOS os lançamentos vinculados. Confirma?`)) {
      const novos = ciclos.filter(c => c.id.toString() !== cicloParaExcluir);
      setCiclos(novos);
      setCiclosState(novos);
      if (cicloAtivoId === cicloParaExcluir) {
        localStorage.removeItem(STORAGE_KEYS.CICLO_ATIVO);
        setCicloAtivoIdState(null);
      }
      setCicloParaExcluir('');
      onNotify(`🗑️ ${target.numero}º Ciclo ${target.ano} excluído!`, 'warning');
      onRefreshData();
    }
  };

  const executarLimpezaTotalCiclo = () => {
    setShowClearStep2(false);
    if (!cicloAtivoId) return;

    const raw = localStorage.getItem(STORAGE_KEYS.DADOS_LANCAMENTOS) || '{}';
    try {
      const dict = JSON.parse(raw);
      const cicloAtivoObj = ciclos.find(c => c.id.toString() === cicloAtivoId);
      const cicloNome = cicloAtivoObj ? `${cicloAtivoObj.numero}º Ciclo` : '';

      const filtrados: Record<string, any> = {};
      Object.keys(dict).forEach(k => {
        if (!dict[k].ciclo || !dict[k].ciclo.includes(cicloNome)) {
          filtrados[k] = dict[k];
        }
      });
      localStorage.setItem(STORAGE_KEYS.DADOS_LANCAMENTOS, JSON.stringify(filtrados));
      onNotify('🧹 Todos os lançamentos do ciclo ativo foram removidos!', 'warning');
      onRefreshData();
    } catch {
      onNotify('Erro ao limpar lançamentos.', 'error');
    }
  };

  const atualizarSemana = () => {
    if (!semanaNum || !semanaInicio || !semanaTermino) {
      onNotify('⚠️ Preencha o número e as datas de início/término da semana.', 'warning');
      return;
    }
    const semAtiva: SemanaAtiva = {
      nome: `${semanaNum}ª Semana`,
      numero: parseInt(semanaNum),
      inicio: semanaInicio,
      termino: semanaTermino
    };
    localStorage.setItem(STORAGE_KEYS.SEMANA_ATIVA, JSON.stringify(semAtiva));
    localStorage.setItem(STORAGE_KEYS.SEMANA_ATUAL, semanaNum);
    localStorage.setItem(STORAGE_KEYS.SEMANA_INICIO, semanaInicio);
    localStorage.setItem(STORAGE_KEYS.SEMANA_TERMINO, semanaTermino);
    onNotify(`📅 ${semanaNum}ª Semana atualizada com sucesso!`, 'success');
    onRefreshData();
  };

  const fixarSemana = () => {
    localStorage.setItem(STORAGE_KEYS.SEMANA_FIXADA, semanaNum);
    setSemanaStatus(`📌 Fixada (${semanaNum}ª)`);
    onNotify(`📌 Semana ${semanaNum}ª fixada!`, 'success');
  };

  const fecharSemana = () => {
    if (confirm(`Deseja fechar a ${semanaNum}ª semana?`)) {
      localStorage.setItem(STORAGE_KEYS.SEMANA_FECHADA, semanaNum);
      setSemanaStatus(`🔒 Fechada (${semanaNum}ª)`);
      onNotify(`🔒 Semana ${semanaNum}ª fechada!`, 'warning');
    }
  };

  const excluirSemana = () => {
    if (confirm(`Deseja excluir as configurações da ${semanaNum}ª semana?`)) {
      localStorage.removeItem(STORAGE_KEYS.SEMANA_ATIVA);
      localStorage.removeItem(STORAGE_KEYS.SEMANA_FIXADA);
      localStorage.removeItem(STORAGE_KEYS.SEMANA_FECHADA);
      setSemanaStatus('📅 Aberta');
      setSemanaInicio('');
      setSemanaTermino('');
      onNotify(`🗑️ Configurações da ${semanaNum}ª semana removidas!`, 'warning');
      onRefreshData();
    }
  };

  const adicionarQuarteirao = () => {
    if (!novoQuarteiraoNum.trim()) return;
    if (quarteiroes.some(q => q.numero === novoQuarteiraoNum.trim())) {
      onNotify('⚠️ Quarteirão já existente na lista.', 'warning');
      return;
    }
    const novos = [...quarteiroes, { numero: novoQuarteiraoNum.trim(), situacao: novoQuarteiraoSit }];
    setQuarteiroes(novos);
    setQuarteiroesState(novos);
    setNovoQuarteiraoNum('');
    onNotify(`➕ Quarteirão ${novoQuarteiraoNum.trim()} adicionado!`, 'success');
  };

  const removerQuarteirao = (num: string) => {
    const novos = quarteiroes.filter(q => q.numero !== num);
    setQuarteiroes(novos);
    setQuarteiroesState(novos);
    onNotify(`🗑️ Quarteirão ${num} removido!`, 'info');
  };

  const salvarConfigEquipe = () => {
    setConfigEquipe(config);
    onNotify('💾 Configurações de Equipe salvas!', 'success');
    onRefreshData();
  };

  const cicloAtivoObj = ciclos.find(c => c.id.toString() === cicloAtivoId);
  const quarteiroesProgramados = quarteiroes.filter(q => q.situacao === 'Normal' || q.situacao === 'Parcialmente Conflagrado').length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 text-lg font-bold text-[#0f2e4a] border-b border-gray-100 pb-4 mb-6">
          <RotateCcw className="w-6 h-6 text-[#0f2e4a]" />
          <span>Gestão de Ciclo</span>
          <span className="text-xs bg-sky-100 text-sky-800 font-semibold px-2.5 py-0.5 rounded-full ml-auto">Central do Sistema</span>
        </div>

        {/* ANO E ATIVIDADE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Box Ano */}
          <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-200">
            <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-600" /> Ano de Referência
            </h3>
            <select
              value={ano}
              onChange={(e) => setAno(e.target.value)}
              className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-[#0f2e4a] outline-none"
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
              <option value="2028">2028</option>
            </select>
            <button
              onClick={salvarAnoAtividade}
              className="mt-4 px-4 py-2 bg-[#0f2e4a] hover:bg-[#1a4b73] text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> Salvar Ano
            </button>
          </div>

          {/* Box Atividade */}
          <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-200">
            <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-600" /> Atividade
            </h3>
            <select
              value={atividade}
              onChange={(e) => setAtividade(e.target.value)}
              className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-[#0f2e4a] outline-none"
            >
              <option value="Tratamento">Tratamento</option>
              <option value="Levantamento">Levantamento</option>
              <option value="Levantamento + Tratamento">Levantamento + Tratamento</option>
              <option value="Ponto Estratégico">Ponto Estratégico</option>
              <option value="LIRAa">LIRAa</option>
            </select>
            <button
              onClick={salvarAnoAtividade}
              className="mt-4 px-4 py-2 bg-[#0f2e4a] hover:bg-[#1a4b73] text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> Salvar Atividade
            </button>
          </div>
        </div>

        {/* CICLOS */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 mb-6 space-y-4">
          <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-gray-600" /> Ciclos de Trabalho
          </h3>

          <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-bold text-gray-700">📍 Ciclo Atual:</span>
              <select
                value={cicloAtualNum}
                onChange={(e) => handleCicloNumChange(e.target.value)}
                className="flex-1 min-w-[180px] p-2 bg-white border border-sky-300 rounded-lg text-sm font-bold text-[#0f2e4a] outline-none"
              >
                {[1, 2, 3, 4, 5, 6].map((num) => {
                  const c = ciclos.find((item) => item.numero === num && item.ano === parseInt(ano));
                  const statusIcon = c ? (c.status === 'ativo' ? '🟢' : '🔴') : '(disponível)';
                  return (
                    <option key={num} value={num}>
                      {num}º Ciclo {ano} {statusIcon}
                    </option>
                  );
                })}
              </select>

              <span
                className={`text-xs px-3 py-1 rounded-full font-bold ${
                  cicloAtivoObj?.status === 'ativo'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-300'
                }`}
              >
                {cicloAtivoObj ? (cicloAtivoObj.status === 'ativo' ? '🟢 ATIVO' : '🔴 ENCERRADO') : 'Nenhum'}
              </span>
            </div>

            {/* Datas Inicio e Fim */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-sky-200">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">📅 Início</label>
                <input
                  type="date"
                  value={cicloDataInicio}
                  onChange={(e) => setCicloDataInicio(e.target.value)}
                  onBlur={salvarDatasCiclo}
                  className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">📅 Término</label>
                <input
                  type="date"
                  value={cicloDataTermino}
                  onChange={(e) => setCicloDataTermino(e.target.value)}
                  onBlur={salvarDatasCiclo}
                  className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-medium"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={iniciarCiclo}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Calendar className="w-3.5 h-3.5" /> Iniciar Ciclo
              </button>
              <button
                onClick={() => setShowEncerrarModal(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Lock className="w-3.5 h-3.5" /> Encerrar Ciclo
              </button>
            </div>

            {/* Exclusão de ciclos */}
            <div className="pt-3 border-t border-sky-200 flex items-center gap-2">
              <select
                value={cicloParaExcluir}
                onChange={(e) => setCicloParaExcluir(e.target.value)}
                className="p-2 bg-white border border-gray-300 rounded-lg text-xs font-medium flex-1"
              >
                <option value="">Selecione um ciclo para excluir</option>
                {ciclos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero}º Ciclo {c.ano} ({c.status === 'ativo' ? 'Ativo' : 'Encerrado'})
                  </option>
                ))}
              </select>
              <button
                onClick={excluirCicloSelecionado}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </button>
            </div>
          </div>
        </div>

        {/* PROGRAMAÇÃO DO CICLO */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 mb-6">
          <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-gray-600" /> Programação do Ciclo
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">🏘️ Quarteirões Programados</label>
              <p className="text-[11px] text-gray-500 mb-1">Calculado automaticamente (Normais + Parciais)</p>
              <input
                type="text"
                readOnly
                value={String(quarteiroesProgramados).padStart(2, '0')}
                className="w-full p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-center font-extrabold text-lg text-[#0f2e4a]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">🏠 Imóveis Programados</label>
              <p className="text-[11px] text-gray-500 mb-1">Total de imóveis previstos no ciclo</p>
              <input
                type="number"
                value={imoveisProgramados}
                onChange={(e) => {
                  setImoveisProgramados(e.target.value);
                  localStorage.setItem(STORAGE_KEYS.IMOVEIS_PROGRAMADOS, e.target.value);
                }}
                className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-center font-extrabold text-lg text-gray-800 focus:ring-2 focus:ring-[#0f2e4a] outline-none"
                placeholder="0"
                min="0"
              />
            </div>
          </div>
        </div>

        {/* SEMANA ATUAL */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 mb-6">
          <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-600" /> Semana Atual
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Semana</label>
              <select
                value={semanaNum}
                onChange={(e) => setSemanaNum(e.target.value)}
                className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-bold"
              >
                {Array.from({ length: 53 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}ª Semana
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Início</label>
              <input
                type="date"
                value={semanaInicio}
                onChange={(e) => setSemanaInicio(e.target.value)}
                className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Término</label>
              <input
                type="date"
                value={semanaTermino}
                onChange={(e) => setSemanaTermino(e.target.value)}
                className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
              <div className="p-2 bg-gray-100 border border-gray-200 rounded-lg text-xs font-bold text-[#0f2e4a] text-center">
                {semanaStatus}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={atualizarSemana}
              className="px-3 py-1.5 bg-[#0f2e4a] text-white font-semibold text-xs rounded-lg hover:bg-[#1a4b73] transition-all flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" /> Salvar Semana
            </button>
            <button
              onClick={fixarSemana}
              className="px-3 py-1.5 bg-emerald-600 text-white font-semibold text-xs rounded-lg hover:bg-emerald-700 transition-all flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Fixar Semana
            </button>
            <button
              onClick={fecharSemana}
              className="px-3 py-1.5 bg-amber-600 text-white font-semibold text-xs rounded-lg hover:bg-amber-700 transition-all flex items-center gap-1"
            >
              <Lock className="w-3.5 h-3.5" /> Fechar Semana
            </button>
            <button
              onClick={excluirSemana}
              className="px-3 py-1.5 bg-red-600 text-white font-semibold text-xs rounded-lg hover:bg-red-700 transition-all flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Limpar Configuração
            </button>
          </div>
        </div>

        {/* GERENCIAR QUARTEIRÕES */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 mb-6">
          <h3 className="font-bold text-gray-800 text-sm mb-1 flex items-center gap-2">
            <Layers className="w-4 h-4 text-gray-600" /> Gerenciar Quarteirões (Cadastro)
          </h3>
          <p className="text-xs text-gray-500 mb-4">Cadastro de quarteirões da localidade e suas situações</p>

          <div className="flex flex-wrap gap-2 mb-4">
            <input
              type="text"
              placeholder="Nº do Quarteirão (ex: 256)"
              value={novoQuarteiraoNum}
              onChange={(e) => setNovoQuarteiraoNum(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg text-xs font-medium w-40"
            />
            <select
              value={novoQuarteiraoSit}
              onChange={(e) => setNovoQuarteiraoSit(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg text-xs font-semibold"
            >
              <option value="Normal">Normal</option>
              <option value="Parcialmente Conflagrado">Parcialmente Conflagrado</option>
              <option value="Conflagrado">Conflagrado</option>
            </select>
            <button
              onClick={adicionarQuarteirao}
              className="px-3 py-2 bg-[#0f2e4a] text-white font-semibold text-xs rounded-lg hover:bg-[#1a4b73] transition-all flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Quarteirão
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
            {quarteiroes.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400">Nenhum quarteirão cadastrado.</div>
            ) : (
              quarteiroes.map((q) => (
                <div key={q.numero} className="p-2.5 px-4 flex items-center justify-between text-xs hover:bg-gray-50">
                  <span className="font-bold text-gray-800">Quarteirão {q.numero}</span>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded-full font-semibold ${
                        q.situacao === 'Normal'
                          ? 'bg-emerald-100 text-emerald-800'
                          : q.situacao === 'Parcialmente Conflagrado'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {q.situacao}
                    </span>
                    <button
                      onClick={() => removerQuarteirao(q.numero)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CONFIGURAÇÃO DA EQUIPE DE ACEs */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 mb-6">
          <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-600" /> Configuração da Equipe e Localidade
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Bairro</label>
              <input
                type="text"
                value={config.bairro}
                onChange={(e) => setConfigState({ ...config, bairro: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Estrato</label>
              <input
                type="text"
                value={config.estrato}
                onChange={(e) => setConfigState({ ...config, estrato: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Equipe</label>
              <input
                type="text"
                value={config.equipe}
                onChange={(e) => setConfigState({ ...config, equipe: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Supervisor</label>
              <input
                type="text"
                value={config.supervisor}
                onChange={(e) => setConfigState({ ...config, supervisor: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Apoio Administrativo</label>
              <input
                type="text"
                value={config.apoioAdmin}
                onChange={(e) => setConfigState({ ...config, apoioAdmin: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Agentes (separados por vírgula)</label>
              <input
                type="text"
                value={config.agentes.join(', ')}
                onChange={(e) =>
                  setConfigState({
                    ...config,
                    agentes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                  })
                }
                className="w-full p-2 border border-gray-300 rounded-lg text-xs font-semibold"
              />
            </div>
          </div>

          <button
            onClick={salvarConfigEquipe}
            className="px-4 py-2 bg-[#0f2e4a] text-white font-semibold text-xs rounded-lg hover:bg-[#1a4b73] transition-all flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> Salvar Configurações de Equipe
          </button>
        </div>

        {/* ZONA DE PERIGO */}
        <div className="bg-red-50/60 border-2 border-red-200 rounded-2xl p-5">
          <h3 className="font-bold text-red-700 text-sm mb-2 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" /> Zona de Perigo
          </h3>
          <p className="text-xs text-gray-600 mb-4 leading-relaxed">
            Remove <strong>todos os lançamentos</strong> do ciclo atual e reinicia do zero. Os cadastros e configurações são preservados.
          </p>
          <button
            onClick={() => setShowClearStep1(true)}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> 🧹 Limpar Todos os Lançamentos do Ciclo
          </button>
        </div>
      </div>

      {/* MODAL ENCERRAR CICLO */}
      {showEncerrarModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-600" /> Encerrar Ciclo
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Deseja realmente encerrar o ciclo ativo? Não será possível realizar novos lançamentos para ele após o encerramento.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowEncerrarModal(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={encerrarCicloAtivo}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl"
              >
                ✅ Sim, Encerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CLEAR STEP 1 */}
      {showClearStep1 && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border-2 border-red-500">
            <h3 className="text-lg font-bold text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Zona de Perigo
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              Isso vai remover <strong>TODOS os lançamentos</strong> do ciclo atual. Cadastros de agentes, quarteirões e configurações serão preservados.
            </p>
            <p className="text-sm font-extrabold text-red-600 text-center">Tem certeza ABSOLUTA?</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowClearStep1(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowClearStep1(false);
                  setShowClearStep2(true);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl"
              >
                🧹 SIM, APAGAR TUDO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CLEAR STEP 2 */}
      {showClearStep2 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border-2 border-red-600">
            <h3 className="text-lg font-extrabold text-red-600 text-center flex items-center justify-center gap-2">
              <ShieldAlert className="w-6 h-6" /> ÚLTIMA CONFIRMAÇÃO
            </h3>
            <p className="text-sm font-extrabold text-red-600 text-center">ESTA AÇÃO É IRREVERSÍVEL!</p>
            <p className="text-xs text-gray-600 text-center leading-relaxed">
              Todos os lançamentos do ciclo ativo serão apagados permanentemente.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowClearStep2(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={executarLimpezaTotalCiclo}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-lg"
              >
                🗑️ EXECUTAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
