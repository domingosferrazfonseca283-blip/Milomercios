import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBwEcPZIAKJ8joGHjMqeNXMtf7bx3YxAvs",
  authDomain: "milomercios-12106.firebaseapp.com",
  projectId: "milomercios-12106",
  storageBucket: "milomercios-12106.firebasestorage.app",
  messagingSenderId: "293584624406",
  appId: "1:293584624406:web:96739386d21da307a8ce37",
  measurementId: "G-C49J85E493"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
