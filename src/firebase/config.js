import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCNzi2iwztSkT5II0XKdCsLHB2IRfUaLGc",
  authDomain: "fixflowos-pro.firebaseapp.com",
  projectId: "fixflowos-pro",
  storageBucket: "fixflowos-pro.firebasestorage.app",
  messagingSenderId: "231426364840",
  appId: "1:231426364840:web:0654c9946ed79c0578399d"
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Inicializa um aplicativo secundário em segundo plano para o RH
const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
export const secondaryAuth = getAuth(secondaryApp);
