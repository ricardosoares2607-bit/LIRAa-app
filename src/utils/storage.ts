import { Ciclo, SemanaAtiva, ConfigEquipe, Quarteirao, LancamentoForm, ProcessedResumo, UsuarioLogado } from '../types';

export const STORAGE_KEYS = {
  CICLOS: 'ace_ciclos',
  CICLO_ATIVO: 'ace_ciclo_ativo',
  SEMANA_ATIVA: 'ace_semana_ativa',
  ANO_PLANEJAMENTO: 'ace_planejamento_ano',
  ATIVIDADE_PLANEJAMENTO: 'ace_planejamento_atividade',
  IMOVEIS_PROGRAMADOS: 'ace_imoveis_programados',
  CONFIG: 'ace_config',
  QUARTEIROES: 'ace_quarteiroes',
  DADOS_LANCAMENTOS: 'ace_dados_lancamentos',
  STATUS_AGENTES: 'ace_status_agentes',
  DIA_CONFIG: 'ace_dia_config',
  SEMANA_ATUAL: 'ace_semana_atual',
  SEMANA_INICIO: 'ace_semana_inicio',
  SEMANA_TERMINO: 'ace_semana_termino',
  SEMANA_FIXADA: 'ace_semana_fixada',
  SEMANA_FECHADA: 'ace_semana_fechada',
  USUARIO_LOGADO: 'ace_usuario_logado',
};

// Default initial seed data
export function initDefaultStorage() {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();

  if (!localStorage.getItem(STORAGE_KEYS.CONFIG)) {
    const configPadrao: ConfigEquipe = {
      agentes: ['Augusta', 'Carlos', 'Mariana', 'João', 'Fernanda'],
      bairro: 'Centro',
      estrato: 'Estrato 1',
      equipe: 'Equipe A',
      supervisor: 'Ricardo',
      apoioAdmin: 'Maria'
    };
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(configPadrao));
  }

  if (!localStorage.getItem(STORAGE_KEYS.CICLOS)) {
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - 30);
    const fim = new Date(hoje);
    fim.setDate(hoje.getDate() + 30);

    const cicloInicial: Ciclo = {
      id: Date.now(),
      numero: 1,
      ano: anoAtual,
      status: 'ativo',
      dataInicio: inicio.toISOString(),
      dataFim: fim.toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.CICLOS, JSON.stringify([cicloInicial]));
    localStorage.setItem(STORAGE_KEYS.CICLO_ATIVO, cicloInicial.id.toString());
  }

  if (!localStorage.getItem(STORAGE_KEYS.ANO_PLANEJAMENTO)) {
    localStorage.setItem(STORAGE_KEYS.ANO_PLANEJAMENTO, anoAtual.toString());
  }

  if (!localStorage.getItem(STORAGE_KEYS.ATIVIDADE_PLANEJAMENTO)) {
    localStorage.setItem(STORAGE_KEYS.ATIVIDADE_PLANEJAMENTO, 'Levantamento + Tratamento');
  }

  if (!localStorage.getItem(STORAGE_KEYS.QUARTEIROES)) {
    const defaultBlocks: Quarteirao[] = [
      { numero: '256', situacao: 'Normal' },
      { numero: '258', situacao: 'Normal' },
      { numero: '259', situacao: 'Normal' },
      { numero: '260', situacao: 'Normal' },
      { numero: '241', situacao: 'Parcialmente Conflagrado' },
      { numero: '242', situacao: 'Parcialmente Conflagrado' },
      { numero: '245', situacao: 'Conflagrado' },
      { numero: '246', situacao: 'Conflagrado' }
    ];
    localStorage.setItem(STORAGE_KEYS.QUARTEIROES, JSON.stringify(defaultBlocks));
  }

  if (!localStorage.getItem(STORAGE_KEYS.SEMANA_ATIVA)) {
    const inicio = getMonday(hoje);
    const termino = new Date(inicio);
    termino.setDate(inicio.getDate() + 4);

    const semanaPadrao: SemanaAtiva = {
      nome: '1ª Semana',
      numero: 1,
      inicio: inicio.toISOString().split('T')[0],
      termino: termino.toISOString().split('T')[0]
    };
    localStorage.setItem(STORAGE_KEYS.SEMANA_ATIVA, JSON.stringify(semanaPadrao));
  }
}

export function formatarDataBR(dataStr?: string | null): string {
  if (!dataStr) return '--/--/----';
  const partes = dataStr.split('T')[0].split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return dataStr;
}

export function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

export function obterDiaDaSemana(dataString: string): string {
  if (!dataString) return '--';
  const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const data = new Date(dataString + 'T00:00:00');
  return isNaN(data.getTime()) ? '--' : dias[data.getDay()];
}

export function parseNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  const num = typeof val === 'number' ? val : parseFloat(val.toString().replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

export function pad2(val: number | string): string {
  const n = typeof val === 'number' ? val : parseInt(val) || 0;
  return String(n).padStart(2, '0');
}

export function getCiclos(): Ciclo[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.CICLOS) || '[]');
  } catch {
    return [];
  }
}

export function setCiclos(ciclos: Ciclo[]) {
  localStorage.setItem(STORAGE_KEYS.CICLOS, JSON.stringify(ciclos));
}

export function getCicloAtivoId(): string | null {
  return localStorage.getItem(STORAGE_KEYS.CICLO_ATIVO) || null;
}

export function setCicloAtivoId(id: string | number) {
  localStorage.setItem(STORAGE_KEYS.CICLO_ATIVO, id.toString());
}

export function getCicloAtivoCompleto(): Ciclo | null {
  const ciclos = getCiclos();
  const id = getCicloAtivoId();
  if (!id) return ciclos[0] || null;
  return ciclos.find(c => c.id.toString() === id.toString()) || ciclos[0] || null;
}

export function getCicloAtivoNome(): string {
  const ciclo = getCicloAtivoCompleto();
  if (!ciclo) return 'Nenhum ciclo ativo';
  return `${ciclo.numero}º Ciclo ${ciclo.ano || ''}`.trim();
}

export function getSemanaAtiva(): SemanaAtiva | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SEMANA_ATIVA);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getConfigEquipe(): ConfigEquipe {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    agentes: ['Augusta', 'Carlos', 'Mariana', 'João', 'Fernanda'],
    bairro: 'Centro',
    estrato: 'Estrato 1',
    equipe: 'Equipe A',
    supervisor: 'Ricardo',
    apoioAdmin: 'Maria'
  };
}

export function setConfigEquipe(cfg: ConfigEquipe) {
  localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(cfg));
}

export function getQuarteiroes(): Quarteirao[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.QUARTEIROES);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function setQuarteiroes(blocks: Quarteirao[]) {
  localStorage.setItem(STORAGE_KEYS.QUARTEIROES, JSON.stringify(blocks));
}

export function getLancamentosList(): LancamentoForm[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DADOS_LANCAMENTOS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Object.values(parsed);
  } catch {
    return [];
  }
}

export function getLancamentosDict(): Record<string, LancamentoForm> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DADOS_LANCAMENTOS);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function setLancamentosDict(dict: Record<string, LancamentoForm>) {
  localStorage.setItem(STORAGE_KEYS.DADOS_LANCAMENTOS, JSON.stringify(dict));
}

export function processarDadosResumo(dadosLista: LancamentoForm[]): ProcessedResumo {
  const res: ProcessedResumo = {
    R: 0,
    C: 0,
    TB: 0,
    PE: 0,
    O: 0,
    R_Trat: 0,
    C_Trat: 0,
    TB_Trat: 0,
    PE_Trat: 0,
    O_Trat: 0,
    R_Foc: 0,
    C_Foc: 0,
    TB_Foc: 0,
    PE_Foc: 0,
    O_Foc: 0,
    fechados: 0,
    abandonados: 0,
    recusados: 0,
    recuperados: 0,
    depositos: {
      A1: { encontrados: 0, naoInspecionados: 0, inspecionados: 0, tratados: 0, foco: 0 },
      A2: { encontrados: 0, naoInspecionados: 0, inspecionados: 0, tratados: 0, foco: 0 },
      B: { encontrados: 0, naoInspecionados: 0, inspecionados: 0, tratados: 0, foco: 0 },
      C: { encontrados: 0, naoInspecionados: 0, inspecionados: 0, tratados: 0, foco: 0 },
      D1: { encontrados: 0, naoInspecionados: 0, inspecionados: 0, tratados: 0, foco: 0 },
      D2: { encontrados: 0, naoInspecionados: 0, inspecionados: 0, tratados: 0, foco: 0 },
      E: { encontrados: 0, naoInspecionados: 0, inspecionados: 0, tratados: 0, foco: 0 },
    },
    depositosEliminados: 0,
    litrosTratados: 0,
    gramasLarvicida: 0,
    totalImoveis: 0,
    totalTratados: 0,
    totalFocados: 0,
    totalInformados: 0,
    totalPendencia: 0,
    indicePendencia: 0,
    totalDepositos: { encontrados: 0, naoInspecionados: 0, inspecionados: 0, tratados: 0, foco: 0 }
  };

  const tipos = ['A1', 'A2', 'B', 'C', 'D1', 'D2', 'E'] as const;

  dadosLista.forEach(d => {
    res.R += parseNumber(d.R);
    res.C += parseNumber(d.C);
    res.TB += parseNumber(d.TB);
    res.PE += parseNumber(d.PE);
    res.O += parseNumber(d.O);

    res.R_Trat += parseNumber(d.R_Trat);
    res.C_Trat += parseNumber(d.C_Trat);
    res.TB_Trat += parseNumber(d.TB_Trat);
    res.PE_Trat += parseNumber(d.PE_Trat);
    res.O_Trat += parseNumber(d.O_Trat);

    res.R_Foc += parseNumber(d.R_Foc);
    res.C_Foc += parseNumber(d.C_Foc);
    res.TB_Foc += parseNumber(d.TB_Foc);
    res.PE_Foc += parseNumber(d.PE_Foc);
    res.O_Foc += parseNumber(d.O_Foc);

    res.fechados += parseNumber(d.fechados);
    res.abandonados += parseNumber(d.abandonados);
    res.recusados += parseNumber(d.recusados);
    res.recuperados += parseNumber(d.recuperados);

    res.depositosEliminados += parseNumber(d.depositosEliminados);
    const litros = parseNumber(d.litrosTratados);
    res.litrosTratados += litros;
    res.gramasLarvicida += d.gramasLarvicida ? parseNumber(d.gramasLarvicida) : litros * 0.5;

    if (d.depositos) {
      tipos.forEach(t => {
        const dep = d.depositos[t];
        if (dep) {
          const enc = parseNumber(dep.encontrados);
          const ni = parseNumber(dep.naoInspecionados);
          const trat = parseNumber(dep.tratados);
          const foc = parseNumber(dep.foco);

          res.depositos[t].encontrados += enc;
          res.depositos[t].naoInspecionados += ni;
          res.depositos[t].tratados += trat;
          res.depositos[t].foco += foc;
        }
      });
    }
  });

  res.totalImoveis = res.R + res.C + res.TB + res.PE + res.O;
  res.totalTratados = res.R_Trat + res.C_Trat + res.TB_Trat + res.PE_Trat + res.O_Trat;
  res.totalFocados = res.R_Foc + res.C_Foc + res.TB_Foc + res.PE_Foc + res.O_Foc;

  res.totalPendencia = res.fechados + res.recusados + res.abandonados - res.recuperados;
  res.totalInformados = res.totalImoveis + res.fechados + res.recusados + res.abandonados - res.recuperados;
  res.indicePendencia = res.totalInformados > 0 ? (100 / res.totalInformados) * res.totalPendencia : 0;

  tipos.forEach(t => {
    const dep = res.depositos[t];
    dep.inspecionados = Math.max(0, dep.encontrados - dep.naoInspecionados);

    res.totalDepositos.encontrados += dep.encontrados;
    res.totalDepositos.naoInspecionados += dep.naoInspecionados;
    res.totalDepositos.inspecionados += dep.inspecionados;
    res.totalDepositos.tratados += dep.tratados;
    res.totalDepositos.foco += dep.foco;
  });

  return res;
}

export function getUsuarioLogado(): UsuarioLogado | null {
  const data = localStorage.getItem(STORAGE_KEYS.USUARIO_LOGADO);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

export function setUsuarioLogado(usuario: UsuarioLogado): void {
  localStorage.setItem(STORAGE_KEYS.USUARIO_LOGADO, JSON.stringify(usuario));
}

export function logoutUsuario(): void {
  localStorage.removeItem(STORAGE_KEYS.USUARIO_LOGADO);
}

