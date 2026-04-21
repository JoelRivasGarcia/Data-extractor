import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, query, where, onSnapshot, getDocFromServer, limit, getDocs, writeBatch, arrayUnion, arrayRemove, deleteDoc, deleteField } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
}
// Removed module-level testConnection for better startup performance
// testConnection();

export { signInWithPopup, signOut, onAuthStateChanged, collection, query, where, onSnapshot, doc, setDoc, getDoc, updateDoc, limit, getDocs, writeBatch, arrayUnion, arrayRemove, deleteDoc, deleteField };
export type { User };
