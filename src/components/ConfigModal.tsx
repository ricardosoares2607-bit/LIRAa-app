import React, { useState } from 'react';
import { ConfigEquipe } from '../types';
import { getConfigEquipe, setConfigEquipe } from '../utils/storage';
import { Settings, Save, X, Plus, Trash2 } from 'lucide-react';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose, onSave }) => {
  if (!isOpen) return null;

  const [config, setConfig] = useState<ConfigEquipe>(getConfigEquipe());
  const [novoAgente, setNovoAgente] = useState('');

  const handleSave = () => {
    setConfigEquipe(config);
    onSave();
    onClose();
  };

  const addAgente = () => {
    if (!novoAgente.trim()) return;
    if (config.agentes.includes(novoAgente.trim())) return;
    setConfig({ ...config, agentes: [...config.agentes, novoAgente.trim()] });
    setNovoAgente('');
  };

  const removeAgente = (nome: string) => {
    setConfig({ ...config, agentes: config.agentes.filter((a) => a !== nome) });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="text-base font-extrabold text-[#0f2e4a] flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" /> Configuração da Equipe e Localidade
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block font-bold text-gray-700 mb-1">Bairro</label>
            <input
              type="text"
              value={config.bairro}
              onChange={(e) => setConfig({ ...config, bairro: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-lg font-semibold"
            />
          </div>
          <div>
            <label className="block font-bold text-gray-700 mb-1">Estrato</label>
            <input
              type="text"
              value={config.estrato}
              onChange={(e) => setConfig({ ...config, estrato: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-lg font-semibold"
            />
          </div>
          <div>
            <label className="block font-bold text-gray-700 mb-1">Equipe</label>
            <input
              type="text"
              value={config.equipe}
              onChange={(e) => setConfig({ ...config, equipe: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-lg font-semibold"
            />
          </div>
          <div>
            <label className="block font-bold text-gray-700 mb-1">Supervisor</label>
            <input
              type="text"
              value={config.supervisor}
              onChange={(e) => setConfig({ ...config, supervisor: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-lg font-semibold"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-bold text-gray-700 mb-1">Apoio Administrativo</label>
            <input
              type="text"
              value={config.apoioAdmin}
              onChange={(e) => setConfig({ ...config, apoioAdmin: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-lg font-semibold"
            />
          </div>
        </div>

        {/* Agentes list */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <label className="block text-xs font-bold text-gray-800">Agentes Cadastrados na Equipe</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nome do novo agente"
              value={novoAgente}
              onChange={(e) => setNovoAgente(e.target.value)}
              className="flex-1 p-2 border border-gray-300 rounded-lg text-xs"
            />
            <button
              onClick={addAgente}
              className="px-3 py-2 bg-[#0f2e4a] text-white font-bold text-xs rounded-lg flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1 max-h-36 overflow-y-auto">
            {config.agentes.map((ag) => (
              <span key={ag} className="bg-sky-50 text-sky-900 font-bold text-xs px-2.5 py-1 rounded-lg border border-sky-200 flex items-center gap-1.5">
                {ag}
                <button onClick={() => removeAgente(ag)} className="text-red-500 hover:text-red-700">
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 bg-[#0f2e4a] hover:bg-[#1a4b73] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5"
          >
            <Save className="w-4 h-4" /> Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
};
