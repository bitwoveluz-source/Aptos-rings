import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB7bcI3LImdnDSPG5bbxqjj02qH60Giiok",
  authDomain: "ringz-b40cd.firebaseapp.com",
  projectId: "ringz-b40cd",
  storageBucket: "ringz-b40cd.firebasestorage.app",
  messagingSenderId: "639644994307",
  appId: "1:639644994307:web:c9950cd6e135ec52577736"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);