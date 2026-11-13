import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const app =
  getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Pass explicit provisioned databaseId when present in firebase-applet-config.json
const configuredDatabaseId = (
  firebaseConfig as { firestoreDatabaseId?: string }
).firestoreDatabaseId;

export const db = configuredDatabaseId
  ? getFirestore(app, configuredDatabaseId)
  : getFirestore(app);

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

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
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

// Validate live connection to provisioned Firestore on module boot
async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testFirestoreConnection();

export const signInWithGoogleAppUser = async (
  loginHint?: string
): Promise<User> => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters(
    loginHint
      ? { login_hint: loginHint, prompt: 'select_account' }
      : { prompt: 'select_account' }
  );
  const result = await signInWithPopup(auth, provider);
  return result.user;
};

export const signOutAppUser = async (): Promise<void> => {
  await signOut(auth);
};

export const subscribeFirebaseAuthUser = (
  callback: (user: User | null) => void
) => {
  return onAuthStateChanged(auth, callback);
};
