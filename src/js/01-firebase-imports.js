import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";

import { getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signOut, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, collection, getDocs, writeBatch, setLogLevel, deleteDoc, getDoc, addDoc, serverTimestamp, query, orderBy, limit, getDocFromServer } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// MODIFIED: Removed refFromURL, which was causing the error.
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, listAll, getMetadata, updateMetadata, getBytes } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

