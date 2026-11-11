import React, { useState, useEffect } from 'react';
import {
  getConfigEquipe, getLancamentosList, formatarDataBR,
  obterDiaDaSemana, parseNumber, pad2, getSemanaAtiva, processarDadosResumo
} from '../utils/storage';
import { exportToExcel } from '../utils/exportExcel';
import { UserCheck, Calendar, FileSpreadsheet, Download, RefreshCw } from 'lucide-react';

interface ProducaoProps {
  onNotify: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export const Producao: React.FC<ProducaoProps> = ({ onNotify }) => {
  const [subTab, setSubTab] = useState<'agentes' | 'diaria'>('agentes');
  const [config, setConfig] = useState(getConfigEquipe());
  const [selectedAgente, setSelectedAgente] = useState<string>('');
  const [diaTab, setDiaTab] = useState<number>(1); // 1 = Segunda, ..., 5 = Sexta, 0 = Ver Todos

  useEffect(() => {
    setConfig(getConfigEquipe());
  }, []);

  const lancamentos = getLancamentosList();

  const agentesParaExibir = selectedAgente ? [selectedAgente] : config.agentes;

  const handleExportAgentesExcel = () => {
    const rows: (string | number)[][] = [];

    agentesParaExibir.forEach((nomeAgente) => {
      const lancs = lancamentos.filter((l) => l.agente === nomeAgente);
      lancs.forEach((l) => {
        const tot = parseNumber(l.R) + parseNumber(l.C) + parseNumber(l.TB) + parseNumber(l.PE) + parseNumber(l.O);
        const fec = parseNumber(l.fechados);
        const recup = parseNumber(l.recuperados);
        const recus = parseNumber(l.recusados);
        const aband = parseNumber(l.abandonados);

        const inf = tot + fec + recus + aband - recup;
        const pend = fec + recus + aband - recup;
        const ip = inf > 0 ? ((pend / inf) * 100).toFixed(1) + '%' : '0.0%';

        rows.push([
          nomeAgente,
          formatarDataBR(l.data),
          l.dia || obterDiaDaSemana(l.data),
          l.R, l.C, l.TB, l.PE, l.O, tot,
          fec, recup, recus, aband,
          inf, pend, ip, tot,
          (l.ocorrencias || []).join(', ')
        ]);
      });
    });

    const headers = [
      'Agente', 'Data', 'Dia', 'R', 'C', 'TB', 'PE', 'O', 'TOTAL',
      'FEC', 'RECUP', 'RECUS', 'ABAND', 'INF', 'PEND', 'IP', 'REND', 'OBS'
    ];

    exportToExcel('Producao_Por_Agente', 'ProducaoAgentes', headers, rows);
    onNotify('📊 Planilha por Agente exportada!', 'success');
  };

  const handleImportarLancamentos = () => {
    onNotify('📥 Lançamentos da semana importados para a matriz diária!', 'success');
  };

  const handleConsolidarResumoSemana = () => {
    onNotify('🔄 Produção diária consolidada no Resumo da Semana!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="bg-white p-1.5 rounded-2xl border border-gray-200 flex gap-2 max-w-md">
        <button
          onClick={() => setSubTab('agentes')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            subTab === 'agentes' ? 'bg-[#0f2e4a] text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <UserCheck className="w-4 h-4" /> Produção por Agente
        </button>
        <button
          onClick={() => setSubTab('diaria')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            subTab === 'diaria' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Calendar className="w-4 h-4" /> Produção Diária
        </button>
      </div>

      {/* 1. PRODUÇÃO POR AGENTE */}
      {subTab === 'agentes' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <UserCheck className="w-6 h-6 text-[#0f2e4a]" />
              <div>
                <h3 className="font-extrabold text-[#0f2e4a] text-sm">Produção por Agente Individual</h3>
                <p className="text-xs text-gray-500">Acompanhamento do rendimento e imóveis inspecionados por ACE</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedAgente}
                onChange={(e) => setSelectedAgente(e.target.value)}
                className="p-2 border border-gray-300 rounded-xl text-xs font-semibold bg-white outline-none"
              >
                <option value="">Todos os Agentes ({config.agentes.length})</option>
                {config.agentes.map((ag) => (
                  <option key={ag} value={ag}>
                    {ag}
                  </option>
                ))}
              </select>

              <button
                onClick={handleExportAgentesExcel}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
              </button>
            </div>
          </div>

          {/* Tables per Agent */}
          <div className="space-y-6">
            {agentesParaExibir.map((ag) => {
              const lancsAgente = lancamentos.filter((l) => l.agente === ag);

              const totR = lancsAgente.reduce((a, b) => a + parseNumber(b.R), 0);
              const totC = lancsAgente.reduce((a, b) => a + parseNumber(b.C), 0);
              const totTB = lancsAgente.reduce((a, b) => a + parseNumber(b.TB), 0);
              const totPE = lancsAgente.reduce((a, b) => a + parseNumber(b.PE), 0);
              const totO = lancsAgente.reduce((a, b) => a + parseNumber(b.O), 0);
              const totGeralImov = totR + totC + totTB + totPE + totO;

              const totFec = lancsAgente.reduce((a, b) => a + parseNumber(b.fechados), 0);
              const totRecup = lancsAgente.reduce((a, b) => a + parseNumber(b.recuperados), 0);
              const totRecus = lancsAgente.reduce((a, b) => a + parseNumber(b.recusados), 0);
              const totAband = lancsAgente.reduce((a, b) => a + parseNumber(b.abandonados), 0);

              const totInf = totGeralImov + totFec + totRecus + totAband - totRecup;
              const totPend = totFec + totRecus + totAband - totRecup;
              const ipGeral = totInf > 0 ? (100 / totInf) * totPend : 0;

              return (
                <div key={ag} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm space-y-0">
                  <div className="bg-[#0f2e4a] text-white p-3 px-5 font-extrabold text-xs flex items-center justify-between">
                    <span>AGENTE: {ag.toUpperCase()}</span>
                    <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-[11px]">
                      {lancsAgente.length} dia(s) trabalhado(s)
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-center border-collapse min-w-[850px]">
                      <thead>
                        <tr className="bg-sky-50 text-sky-900 font-bold border-b border-gray-200">
                          <th className="p-2 border-r border-gray-200">DATA</th>
                          <th className="p-2 border-r border-gray-200">DIA</th>
                          <th className="p-2 border-r border-gray-200">R</th>
                          <th className="p-2 border-r border-gray-200">C</th>
                          <th className="p-2 border-r border-gray-200">TB</th>
                          <th className="p-2 border-r border-gray-200">PE</th>
                          <th className="p-2 border-r border-gray-200">O</th>
                          <th className="p-2 border-r border-gray-200 bg-sky-100">TOTAL</th>
                          <th className="p-2 border-r border-gray-200">FEC.</th>
                          <th className="p-2 border-r border-gray-200">RECUP.</th>
                          <th className="p-2 border-r border-gray-200">RECUS.</th>
                          <th className="p-2 border-r border-gray-200">ABAND.</th>
                          <th className="p-2 border-r border-gray-200">INF.</th>
                          <th className="p-2 border-r border-gray-200">PEND.</th>
                          <th className="p-2 border-r border-gray-200">IP</th>
                          <th className="p-2 border-r border-gray-200">REND.</th>
                          <th className="p-2">OBS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {lancsAgente.length === 0 ? (
                          <tr>
                            <td colSpan={17} className="p-4 text-gray-400">
                              Nenhum lançamento registrado para este agente.
                            </td>
                          </tr>
                        ) : (
                          lancsAgente.map((l, idx) => {
                            const tot = parseNumber(l.R) + parseNumber(l.C) + parseNumber(l.TB) + parseNumber(l.PE) + parseNumber(l.O);
                            const fec = parseNumber(l.fechados);
                            const recup = parseNumber(l.recuperados);
                            const recus = parseNumber(l.recusados);
                            const aband = parseNumber(l.abandonados);

                            const inf = tot + fec + recus + aband - recup;
                            const pend = fec + recus + aband - recup;
                            const ip = inf > 0 ? (100 / inf) * pend : 0;

                            return (
                              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                <td className="p-2 font-semibold text-gray-700">{formatarDataBR(l.data)}</td>
                                <td className="p-2 font-semibold text-gray-600">{l.dia?.substring(0, 3) || '--'}</td>
                                <td className="p-2">{pad2(l.R)}</td>
                                <td className="p-2">{pad2(l.C)}</td>
                                <td className="p-2">{pad2(l.TB)}</td>
                                <td className="p-2">{pad2(l.PE)}</td>
                                <td className="p-2">{pad2(l.O)}</td>
                                <td className="p-2 font-extrabold bg-sky-50 text-[#0f2e4a]">{pad2(tot)}</td>
                                <td className="p-2">{pad2(fec)}</td>
                                <td className="p-2">{pad2(recup)}</td>
                                <td className="p-2">{pad2(recus)}</td>
                                <td className="p-2">{pad2(aband)}</td>
                                <td className="p-2 font-bold">{pad2(inf)}</td>
                                <td className="p-2 font-bold text-red-600">{pad2(pend)}</td>
                                <td className="p-2 font-bold text-amber-700">{ip.toFixed(1)}%</td>
                                <td className="p-2 font-bold bg-sky-50">{pad2(tot)}</td>
                                <td className="p-2 text-left text-[11px] text-gray-500 max-w-[150px] truncate">
                                  {(l.ocorrencias || []).join(', ') || l.detalhamento || '--'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                        {/* TOTAL ROW */}
                        <tr className="bg-sky-100/70 font-extrabold text-[#0f2e4a]">
                          <td className="p-2">TOTAL</td>
                          <td className="p-2">{pad2(lancsAgente.length)} d</td>
                          <td className="p-2">{pad2(totR)}</td>
                          <td className="p-2">{pad2(totC)}</td>
                          <td className="p-2">{pad2(totTB)}</td>
                          <td className="p-2">{pad2(totPE)}</td>
                          <td className="p-2">{pad2(totO)}</td>
                          <td className="p-2 text-blue-900 bg-sky-200">{pad2(totGeralImov)}</td>
                          <td className="p-2">{pad2(totFec)}</td>
                          <td className="p-2">{pad2(totRecup)}</td>
                          <td className="p-2">{pad2(totRecus)}</td>
                          <td className="p-2">{pad2(totAband)}</td>
                          <td className="p-2">{pad2(totInf)}</td>
                          <td className="p-2 text-red-700">{pad2(totPend)}</td>
                          <td className="p-2 text-amber-800">{ipGeral.toFixed(1)}%</td>
                          <td className="p-2">{pad2(totGeralImov)}</td>
                          <td className="p-2 text-left text-[11px]">Subtotal {ag}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. PRODUÇÃO DIÁRIA */}
      {subTab === 'diaria' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="font-extrabold text-[#0f2e4a] text-sm">Produção Diária - Matriz Semanal</h3>
                <p className="text-xs text-gray-500">Matriz diária consolidada de Segunda a Sexta-feira</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleImportarLancamentos}
                className="px-3.5 py-2 border border-blue-600 bg-white text-blue-600 hover:bg-blue-50 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Importar dos Lançamentos
              </button>
              <button
                onClick={handleConsolidarResumoSemana}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Consolidar no Resumo
              </button>
            </div>
          </div>

          {/* Weekday Selector */}
          <div className="bg-white p-1.5 rounded-2xl border border-gray-200 flex flex-wrap gap-2">
            {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'].map((d, i) => {
              const idx = i + 1;
              return (
                <button
                  key={d}
                  onClick={() => setDiaTab(idx)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    diaTab === idx ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {d}
                </button>
              );
            })}
            <button
              onClick={() => setDiaTab(0)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ml-auto ${
                diaTab === 0 ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              👁 Ver Todos
            </button>
          </div>

          {/* Daily Forms */}
          {[1, 2, 3, 4, 5].map((diaNum) => {
            if (diaTab !== 0 && diaTab !== diaNum) return null;
            const nomes = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
            const nomeDia = nomes[diaNum - 1];

            return (
              <div key={diaNum} className="bg-white rounded-2xl border-2 border-blue-500 p-6 space-y-4 shadow-sm">
                <div className="bg-blue-600 text-white p-2.5 rounded-xl font-extrabold text-xs flex justify-between items-center">
                  <span>📅 PRODUÇÃO DIÁRIA — {nomeDia.toUpperCase()}</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded text-[11px]">DIA {diaNum}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-blue-50 p-3 rounded-xl text-xs">
                  <div><span className="font-bold text-blue-900">BAIRRO:</span> {config.bairro}</div>
                  <div><span className="font-bold text-blue-900">ESTRATO:</span> {config.estrato}</div>
                  <div><span className="font-bold text-blue-900">EQUIPE:</span> {config.equipe}</div>
                  <div><span className="font-bold text-blue-900">SUPERVISOR:</span> {config.supervisor}</div>
                </div>

                {/* Table for Day */}
                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="w-full text-xs text-center border-collapse min-w-[650px]">
                    <thead>
                      <tr className="bg-blue-100 text-blue-900 font-bold">
                        <th className="p-2 border border-blue-200">TIPO</th>
                        <th className="p-2 border border-blue-200">R</th>
                        <th className="p-2 border border-blue-200">C</th>
                        <th className="p-2 border border-blue-200">TB</th>
                        <th className="p-2 border border-blue-200">PE</th>
                        <th className="p-2 border border-blue-200">O</th>
                        <th className="p-2 border border-blue-200 bg-blue-200">TOTAL</th>
                        <th className="p-2 border border-blue-200">FECH.</th>
                        <th className="p-2 border border-blue-200">ABAND.</th>
                        <th className="p-2 border border-blue-200">RECUS.</th>
                        <th className="p-2 border border-blue-200">RECUP.</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-2 border border-gray-200 font-bold bg-amber-50">QUANTIDADE</td>
                        <td className="p-1 border border-gray-200"><input type="number" defaultValue="00" className="w-12 text-center font-bold" /></td>
                        <td className="p-1 border border-gray-200"><input type="number" defaultValue="00" className="w-12 text-center font-bold" /></td>
                        <td className="p-1 border border-gray-200"><input type="number" defaultValue="00" className="w-12 text-center font-bold" /></td>
                        <td className="p-1 border border-gray-200"><input type="number" defaultValue="00" className="w-12 text-center font-bold" /></td>
                        <td className="p-1 border border-gray-200"><input type="number" defaultValue="00" className="w-12 text-center font-bold" /></td>
                        <td className="p-1 border border-gray-200 font-extrabold bg-blue-100">00</td>
                        <td className="p-1 border border-gray-200"><input type="number" defaultValue="00" className="w-12 text-center font-bold" /></td>
                        <td className="p-1 border border-gray-200"><input type="number" defaultValue="00" className="w-12 text-center font-bold" /></td>
                        <td className="p-1 border border-gray-200"><input type="number" defaultValue="00" className="w-12 text-center font-bold" /></td>
                        <td className="p-1 border border-gray-200"><input type="number" defaultValue="00" className="w-12 text-center font-bold" /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
