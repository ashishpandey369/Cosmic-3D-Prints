import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA_i3OuD8zEnmsTjobg1yUt9zSHZAYb4ug",
  authDomain: "gifty-hamper.firebaseapp.com",
  projectId: "gifty-hamper",
  storageBucket: "gifty-hamper.firebasestorage.app",
  messagingSenderId: "941922060172",
  appId: "1:941922060172:web:23d85fd867bec63b7a78a9",
  measurementId: "G-F18T3N12CK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  app,
  auth,
  db,
  doc,
  getDoc,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
};
