import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBGsuvsRXj5c8G0hjXrC7qOySMut9khrWo",
  authDomain: "schrijver-familiedag.firebaseapp.com",
  projectId: "schrijver-familiedag",
  storageBucket: "schrijver-familiedag.firebasestorage.app",
  messagingSenderId: "1046659423944",
  appId: "1:1046659423944:web:bdf04fdadc7ad27a72cffd"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
