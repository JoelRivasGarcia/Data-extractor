import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, onAuthStateChanged, User, db, doc, getDoc, setDoc } from './firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  quotaExceeded: boolean;
  setQuotaExceeded: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true, 
  isAdmin: false, 
  quotaExceeded: false,
  setQuotaExceeded: () => {}
});

export const useAuth = () => useContext(AuthContext);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Check or create user profile
        const userDocRef = doc(db, 'users', user.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          const isMainAdmin = user.email === 'joelrivasgarciagy@gmail.com';
          
          if (!userDoc.exists()) {
            const newUser = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || '',
              role: isMainAdmin ? 'admin' : 'technician'
            };
            await setDoc(userDocRef, newUser);
            setIsAdmin(newUser.role === 'admin');
          } else {
            const data = userDoc.data();
            // If it's the main admin but the database says technician, update it
            if (isMainAdmin && data?.role !== 'admin') {
              await setDoc(userDocRef, { ...data, role: 'admin' }, { merge: true });
              setIsAdmin(true);
            } else {
              setIsAdmin(data?.role === 'admin' || isMainAdmin);
            }
          }
        } catch (error: any) {
          console.error("Error fetching user profile:", error);
          
          // Detect Quota Exceeded
          if (error.message?.includes('quota') || error.code === 'resource-exhausted') {
            setQuotaExceeded(true);
          }

          // Fallback for the main admin if database is unreachable
          if (user.email === 'joelrivasgarciagy@gmail.com') {
            setIsAdmin(true);
          }
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, quotaExceeded, setQuotaExceeded }}>
      {children}
    </AuthContext.Provider>
  );
};

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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
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
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
