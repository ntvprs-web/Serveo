// SERVEO — Firebase setup (plain HTML, no npm needed)
// Use from a page with:  <script type="module"> import { db } from './js/firebase.js'; ... </script>
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
 
const firebaseConfig = {
  apiKey: "AIzaSyBJmS0kT6E61B7suWR7PgQddpKk-25EXq0",
  authDomain: "serveo-d671a.firebaseapp.com",
  projectId: "serveo-d671a",
  storageBucket: "serveo-d671a.firebasestorage.app",
  messagingSenderId: "328655749888",
  appId: "1:328655749888:web:41fa614e53f133fce4e9e5"
};
 
export const app = initializeApp(firebaseConfig);
// Auto-detect long polling: fixes live updates not arriving in some browsers/networks (e.g. Safari)
export const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
 