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
  apiKey: "AIzaSyD9m7pm5RC60Ll9h0RbK_WzHQGy5I4zYD0",
  authDomain: "cosmic-3d-bc4d3.firebaseapp.com",
  projectId: "cosmic-3d-bc4d3",
  storageBucket: "cosmic-3d-bc4d3.firebasestorage.app",
  messagingSenderId: "913884719719",
  appId: "1:913884719719:web:53474d677a8ba589b702c2",
  measurementId: "G-H0SG8BNJRZ"
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
