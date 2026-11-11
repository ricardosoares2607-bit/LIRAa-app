export interface UsuarioLogado {
  id: string;
  nome: string;
  usuario: string;
  funcao: 'Supervisor' | 'Agente' | 'Administrador' | 'Apoio Administrativo';
  equipe?: string;
  bairro?: string;
  matricula?: string;
}

export interface Ciclo {
  id: number;
  numero: number;
  ano: number;
  status: 'ativo' | 'encerrado';
  dataInicio: string;
  dataFim: string | null;
}

export interface SemanaAtiva {
  nome: string;
  numero: number;
  inicio: string;
  termino: string;
}

export interface ConfigEquipe {
  bairro: string;
  estrato: string;
  equipe: string;
  supervisor: string;
  apoioAdmin: string;
  agentes: string[];
}

export interface Quarteirao {
  numero: string;
  situacao: 'Normal' | 'Parcialmente Conflagrado' | 'Conflagrado' | string;
}

export interface DepositoDados {
  encontrados: number | string;
  naoInspecionados: number | string;
  inspecionados?: number | string;
  tratados: number | string;
  foco: number | string;
}

export interface DepositosGrupo {
  A1: DepositoDados;
  A2: DepositoDados;
  B: DepositoDados;
  C: DepositoDados;
  D1: DepositoDados;
  D2: DepositoDados;
  E: DepositoDados;
}

export interface QuarteiraoConcluido {
  numero: string;
  concluido: boolean;
}

export interface LancamentoForm {
  data: string;
  agente: string;
  totalForms: number;
  formIndex?: number;
  R: number | string;
  C: number | string;
  TB: number | string;
  PE: number | string;
  O: number | string;
  R_Trat: number | string;
  C_Trat: number | string;
  TB_Trat: number | string;
  PE_Trat: number | string;
  O_Trat: number | string;
  R_Foc: number | string;
  C_Foc: number | string;
  TB_Foc: number | string;
  PE_Foc: number | string;
  O_Foc: number | string;
  fechados: number | string;
  abandonados: number | string;
  recusados: number | string;
  recuperados: number | string;
  depositosEliminados: number | string;
  litrosTratados: number | string;
  gramasLarvicida?: number | string;
  supervisao: 'SIM' | 'NAO' | string;
  supervisaoDireta?: number;
  supervisaoIndireta?: number;
  ocorrencias: string[];
  detalhamento: string;
  quarteiroes: QuarteiraoConcluido[];
  semana: string;
  ciclo: string;
  dia: string;
  atividade?: string;
  depositos: DepositosGrupo;
  amostrasColetadas?: 'SIM' | 'NAO';
  amostraInicial?: number;
  amostraFinal?: number;
  quantidadeTubitos?: number;
}

export interface DiaConfig {
  data: string;
  atividade: string;
  agentes: string[];
  timestamp: string;
  origem?: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  text: string;
}

export interface ProcessedResumo {
  R: number;
  C: number;
  TB: number;
  PE: number;
  O: number;
  R_Trat: number;
  C_Trat: number;
  TB_Trat: number;
  PE_Trat: number;
  O_Trat: number;
  R_Foc: number;
  C_Foc: number;
  TB_Foc: number;
  PE_Foc: number;
  O_Foc: number;
  fechados: number;
  abandonados: number;
  recusados: number;
  recuperados: number;
  depositos: Record<string, { encontrados: number; naoInspecionados: number; inspecionados: number; tratados: number; foco: number }>;
  depositosEliminados: number;
  litrosTratados: number;
  gramasLarvicida: number;
  totalImoveis: number;
  totalTratados: number;
  totalFocados: number;
  totalInformados: number;
  totalPendencia: number;
  indicePendencia: number;
  totalDepositos: {
    encontrados: number;
    naoInspecionados: number;
    inspecionados: number;
    tratados: number;
    foco: number;
  };
}

export interface LiraaCabecalho {
  uf: string;
  subdistrito: string;
  distrito: string;
  sublocal: string;
  municipio: string;
  categoria: string;
  localidade: string;
  total_quart: string;
}

export interface LiraaLinha {
  pos: string;
  celulas: string[]; // [Quarteirão, R, C, TB, PE, O]
  isSel: boolean;
}

export interface LiraaBackupData {
  cabecalho: Partial<LiraaCabecalho>;
  linhas: LiraaLinha[];
  atualizadoEm?: string;
}
