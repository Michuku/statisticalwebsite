// =====================================================================
// FIREBASE CONFIG — paste YOUR config object below, replacing the
// placeholder values. Get it from: Firebase Console → Project Settings
// → scroll to "Your apps" → the </> web app icon.
//
// Note: it's normal and safe for these values to be visible in your
// public GitHub repo — Firebase web apps are designed this way. Real
// security comes from the Firestore/Storage Rules (see chat for the
// rules to paste in), not from hiding this file.
// =====================================================================
const firebaseConfig = {
  apiKey: "AIzaSyCDgqdxsMdS6WViO09XDLvkIc3315bvBr0",
  authDomain: "statvision-consultancy.firebaseapp.com",
  projectId: "statvision-consultancy",
  storageBucket: "statvision-consultancy.firebasestorage.app",
  messagingSenderId: "1017621661170",
  appId: "1:1017621661170:web:00e7cf7481b4439f21976b"
};

// Initialise Firebase — don't touch anything below this line
firebase.initializeApp(firebaseConfig);
const fbAuth = firebase.auth();
const fbDB = firebase.firestore();
const fbStorage = firebase.storage();