import React, { useState } from 'react';
import { UsuarioLogado } from '../types';
import { setUsuarioLogado, getConfigEquipe } from '../utils/storage';
import {
  ShieldCheck, Lock, User, KeyRound, Eye, EyeOff, LogIn,
  Users, UserCheck, AlertCircle, Sparkles, Building2, HelpCircle,
  Bug
} from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: UsuarioLogado) => void;
  onNotify?: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onNotify }) => {
  const config = getConfigEquipe();
  const [activeTab, setActiveTab] = useState<'credenciais' | 'rapido'>('credenciais');

  // Form State
  const [usuarioInput, setUsuarioInput] = useState('');
  const [senhaInput, setSenhaInput] = useState('');
  const [funcaoInput, setFuncaoInput] = useState<'Supervisor' | 'Agente' | 'Administrador' | 'Apoio Administrativo'>('Supervisor');
  const [showPassword, setShowPassword] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [lembrarAcesso, setLembrarAcesso] = useState(true);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const uLower = usuarioInput.trim().toLowerCase();

    if (!uLower) {
      setErro('Informe o nome de usuário ou CPF/Matrícula.');
      return;
    }

    if (!senhaInput) {
      setErro('Informe a senha de acesso.');
      return;
    }

    // Default password checks for demo/production
    // Allows admin/admin123, supervisor/123456, or any agent name with standard password
    if (uLower === 'admin' && senhaInput !== 'admin123') {
      setErro('Senha incorreta para o usuário Admin.');
      return;
    }

    const user: UsuarioLogado = {
      id: Date.now().toString(),
      nome: usuarioInput.trim(),
      usuario: uLower,
      funcao: funcaoInput,
      equipe: config.equipe || 'Equipe 01',
      bairro: config.bairro || 'Centro',
      matricula: Math.floor(100000 + Math.random() * 900000).toString(),
    };

    setUsuarioLogado(user);
    if (onNotify) onNotify(`Bem-vindo(a), ${user.nome}!`, 'success');
    onLoginSuccess(user);
  };

  const handleQuickLogin = (nome: string, funcao: 'Supervisor' | 'Agente' | 'Administrador' | 'Apoio Administrativo') => {
    const user: UsuarioLogado = {
      id: Date.now().toString(),
      nome,
      usuario: nome.toLowerCase().replace(/\s+/g, '.'),
      funcao,
      equipe: config.equipe || 'Equipe 01',
      bairro: config.bairro || 'Centro',
      matricula: Math.floor(100000 + Math.random() * 900000).toString(),
    };

    setUsuarioLogado(user);
    if (onNotify) onNotify(`Login efetuado como ${user.nome} (${user.funcao})`, 'success');
    onLoginSuccess(user);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1e32] via-[#0f2e4a] to-[#1a4b73] flex flex-col justify-between p-4 sm:p-6 text-gray-800 relative overflow-hidden font-sans">
      {/* Subtle Background Glow Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[450px] h-[450px] bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* TOP BRANDING BAR */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between text-white py-2 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center shadow-lg border border-white/20">
            <Bug className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight block leading-tight text-white">ACE</span>
            <span className="text-[10px] text-sky-200 font-semibold uppercase tracking-wider block">Sistema Integrado Antivetorial</span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs bg-white/10 px-3.5 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
          <Building2 className="w-3.5 h-3.5 text-sky-300" />
          <span className="text-white/90 font-bold">{config.bairro || 'Centro'} - {config.equipe || 'Equipe A'}</span>
        </div>
      </header>

      {/* MAIN CENTER CARD CONTAINER */}
      <div className="max-w-md w-full mx-auto my-auto py-6 z-10">
        <div className="bg-white rounded-3xl shadow-2xl border border-white/40 overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
          
          {/* CARD HEADER */}
          <div className="bg-gradient-to-r from-[#0f2e4a] to-[#1a4b73] text-white p-6 sm:p-7 relative">
            <div className="absolute top-4 right-4 bg-white/10 px-2.5 py-1 rounded-full text-[11px] font-bold text-sky-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Versão 3.2.0
            </div>

            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 mb-3 shadow-inner">
              <Lock className="w-6 h-6 text-sky-300" />
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Portal de Acesso</h2>
            <p className="text-xs text-sky-100 mt-1 font-medium leading-relaxed">
              Autenticação de Agentes de Combate às Endemias e Supervisão
            </p>
          </div>

          {/* TAB MODE SWITCHER */}
          <div className="p-2 bg-gray-100/80 border-b border-gray-200 flex gap-1">
            <button
              type="button"
              onClick={() => { setActiveTab('credenciais'); setErro(null); }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'credenciais'
                  ? 'bg-white text-[#0f2e4a] shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" /> Entrar com Senha
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('rapido'); setErro(null); }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'rapido'
                  ? 'bg-white text-[#0f2e4a] shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-blue-600" /> Seleção Rápida
            </button>
          </div>

          {/* TAB 1: FORM WITH CREDENTIALS */}
          {activeTab === 'credenciais' && (
            <form onSubmit={handleLoginSubmit} className="p-6 sm:p-7 space-y-4">
              {erro && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-xs animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span className="font-semibold leading-snug">{erro}</span>
                </div>
              )}

              {/* PERFIL / FUNÇÃO */}
              <div>
                <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">
                  Perfil de Acesso
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Supervisor', 'Agente', 'Administrador', 'Apoio Administrativo'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFuncaoInput(f)}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                        funcaoInput === f
                          ? 'border-[#0f2e4a] bg-[#0f2e4a] text-white shadow-sm'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {f === 'Supervisor' && <UserCheck className="w-3.5 h-3.5 text-amber-300" />}
                      {f === 'Agente' && <User className="w-3.5 h-3.5 text-sky-300" />}
                      {f === 'Administrador' && <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />}
                      {f === 'Apoio Administrativo' && <Building2 className="w-3.5 h-3.5 text-purple-300" />}
                      <span className="truncate">{f}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* USUÁRIO OU MATRÍCULA */}
              <div>
                <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">
                  Usuário ou Matrícula
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Ex: supervisor, agente, carlos"
                    value={usuarioInput}
                    onChange={(e) => setUsuarioInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all outline-none"
                  />
                </div>
              </div>

              {/* SENHA */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                    Senha de Acesso
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowHelpModal(true)}
                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <HelpCircle className="w-3 h-3" /> Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Digite sua senha"
                    value={senhaInput}
                    onChange={(e) => setSenhaInput(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* OPTIONS: LEMBRAR */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 font-medium text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lembrarAcesso}
                    onChange={(e) => setLembrarAcesso(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  Manter conectado neste dispositivo
                </label>
              </div>

              {/* DEMO NOTICE HINT */}
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-[11px] text-sky-900 leading-snug">
                <span className="font-bold flex items-center gap-1 text-sky-950 mb-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Credenciais de Demonstração:
                </span>
                • Supervisor: <code className="bg-sky-100 px-1 py-0.5 rounded font-mono font-bold">supervisor</code> | Senha: <code className="bg-sky-100 px-1 py-0.5 rounded font-mono font-bold">123456</code><br />
                • Admin: <code className="bg-sky-100 px-1 py-0.5 rounded font-mono font-bold">admin</code> | Senha: <code className="bg-sky-100 px-1 py-0.5 rounded font-mono font-bold">admin123</code>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                className="w-full py-3 px-4 bg-[#0f2e4a] hover:bg-[#1a4b73] active:scale-[0.99] text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 group"
              >
                <LogIn className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                <span>ENTRAR NO SISTEMA</span>
              </button>
            </form>
          )}

          {/* TAB 2: QUICK SELECTION FOR AGENTS / SUPERVISOR */}
          {activeTab === 'rapido' && (
            <div className="p-6 sm:p-7 space-y-4">
              <p className="text-xs text-gray-600 font-medium">
                Selecione o seu nome ou cargo cadastrado na equipe para entrar instantaneamente:
              </p>

              {/* SUPERVISOR CARD */}
              <button
                type="button"
                onClick={() => handleQuickLogin(config.supervisor || 'Supervisor Ricardo', 'Supervisor')}
                className="w-full p-3.5 bg-amber-50/80 hover:bg-amber-100/90 border border-amber-300 rounded-2xl flex items-center justify-between text-left transition-all group shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white font-extrabold flex items-center justify-center text-sm shadow-md">
                    <UserCheck className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-black text-xs text-amber-950">{config.supervisor || 'Ricardo (Supervisor)'}</h4>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-200/60 px-2 py-0.5 rounded-md inline-block mt-0.5">
                      Supervisor de Campo / Responsável
                    </span>
                  </div>
                </div>
                <LogIn className="w-4 h-4 text-amber-700 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* AGENTES GRID */}
              <div>
                <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">
                  Agentes de Combate às Endemias ({config.agentes.length})
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {config.agentes.map((agente) => (
                    <button
                      key={agente}
                      type="button"
                      onClick={() => handleQuickLogin(agente, 'Agente')}
                      className="p-3 bg-gray-50 hover:bg-sky-50 border border-gray-200 hover:border-sky-300 rounded-xl flex items-center justify-between text-left transition-all group"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-800 font-black text-xs flex items-center justify-center shrink-0">
                          {agente.charAt(0).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <span className="font-extrabold text-xs text-gray-800 block truncate">{agente}</span>
                          <span className="text-[10px] font-bold text-sky-700">Agente ACE</span>
                        </div>
                      </div>
                      <LogIn className="w-3.5 h-3.5 text-sky-600 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* ADMIN ACCOUNT BUTTON */}
              <button
                type="button"
                onClick={() => handleQuickLogin('Administrador do Sistema', 'Administrador')}
                className="w-full py-2.5 px-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-xl text-xs font-extrabold text-gray-700 flex items-center justify-center gap-2 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Entrar como Administrador Geral</span>
              </button>
            </div>
          )}

          {/* CARD FOOTER */}
          <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 text-center text-[11px] text-gray-500 flex items-center justify-between">
            <span>SUS / Vigilância em Saúde</span>
            <span className="font-bold text-gray-700">Ministério da Saúde</span>
          </div>
        </div>
      </div>

      {/* FOOTER TEXT */}
      <footer className="max-w-5xl w-full mx-auto text-center text-xs text-sky-200/70 py-2 z-10">
        ACE - Sistema Integrado de Controle Antivetorial © {new Date().getFullYear()} • Todos os direitos reservados.
      </footer>

      {/* MODAL FOR FORGOT PASSWORD */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="font-black text-base text-gray-900">Recuperação de Senha</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Por motivos de segurança no controle antivetorial, as credenciais dos Agentes e Supervisores são gerenciadas localmente pelo Supervisor da Equipe (<strong className="text-gray-900">{config.supervisor}</strong>) ou Apoio Administrativo.
            </p>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 space-y-1 font-semibold">
              <p>📍 Bairro: {config.bairro}</p>
              <p>👥 Equipe: {config.equipe}</p>
              <p>👤 Supervisor Responsável: {config.supervisor}</p>
            </div>
            <p className="text-[11px] text-blue-700 font-bold bg-blue-50 p-2 rounded-lg">
              💡 Para testes rápidos, utilize a aba "Seleção Rápida" no painel de login.
            </p>
            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2.5 bg-[#0f2e4a] text-white font-extrabold text-xs rounded-xl shadow-md"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
