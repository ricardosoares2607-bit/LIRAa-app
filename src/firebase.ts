import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getDatabase, ref, set, get, onValue, off } from 'firebase/database';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Conexão secundária com o Firebase Realtime Database do PMCD (nó compartilhado andamento_quarteiroes)
const pmcdRtdbConfig = {
  apiKey: "AIzaSyA1YbZ9uGY3WW5fiMLVpTC2_fC2qKB6vos",
  authDomain: "tabela-de-lancamentos.firebaseapp.com",
  databaseURL: "https://tabela-de-lancamentos-default-rtdb.firebaseio.com",
  projectId: "tabela-de-lancamentos",
  storageBucket: "tabela-de-lancamentos.firebasestorage.app",
  messagingSenderId: "765398861975",
  appId: "1:765398861975:web:755041000a44ae269801d2"
};

const existingRtdbApp = getApps().find((a) => a.name === 'pmcd-rtdb');
const pmcdRtdbApp = existingRtdbApp || initializeApp(pmcdRtdbConfig, 'pmcd-rtdb');
export const pmcdRtdb = getDatabase(pmcdRtdbApp);

export interface ReconhecimentoLinha {
  quarteirao: string;
  r: string;
  c: string;
  tb: string;
  pe: string;
  o: string;
}

export interface ReconhecimentoPayload {
  cabecalho: {
    uf: string;
    distrito: string;
    municipio: string;
    localidade: string;
    subdistrito: string;
    sublocal: string;
    categoria: string;
  };
  tabela1: ReconhecimentoLinha[];
  tabela2: ReconhecimentoLinha[];
}

export async function pushReconhecimentoToRtdb(payload: ReconhecimentoPayload): Promise<boolean> {
  try {
    await set(ref(pmcdRtdb, 'andamento_quarteiroes/resumo_reconhecimento'), JSON.parse(JSON.stringify(payload)));
    return true;
  } catch (err) {
    console.warn('Aviso ao sincronizar com RTDB PMCD:', err);
    return false;
  }
}

export async function fetchReconhecimentoFromRtdb(): Promise<any | null> {
  try {
    const snapResumo = await get(ref(pmcdRtdb, 'andamento_quarteiroes/resumo_reconhecimento'));
    const valResumo = snapResumo.val();
    if (valResumo && typeof valResumo === 'object') return valResumo;

    const snapGeral = await get(ref(pmcdRtdb, 'andamento_quarteiroes'));
    const valGeral = snapGeral.val();
    if (valGeral && typeof valGeral === 'object') {
      return valGeral.resumo_reconhecimento || valGeral;
    }
    return null;
  } catch (err) {
    console.warn('Aviso ao buscar do RTDB PMCD:', err);
    return null;
  }
}

export function subscribeReconhecimentoRtdb(onData: (data: any) => void): () => void {
  const recRef = ref(pmcdRtdb, 'andamento_quarteiroes/resumo_reconhecimento');
  const handler = onValue(
    recRef,
    (snapshot) => {
      const val = snapshot.val();
      if (val && typeof val === 'object') {
        onData(val);
      }
    },
    (err) => {
      console.warn('Aviso listener RTDB PMCD:', err);
    }
  );
  return () => {
    try {
      off(recRef, 'value', handler);
    } catch {
      // ignore cleanup errors
    }
  };
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase Firestore client is offline or initializing.');
    }
  }
}

export async function signInWithGoogle() {
  return await signInWithPopup(auth, googleProvider);
}

export async function logoutFirebase() {
  return await signOut(auth);
}
