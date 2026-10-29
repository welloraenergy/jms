import { startModules } from "./workspace.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
const loginCard=document.getElementById("loginCard"),workspace=document.getElementById("workspace"),errorMsg=document.getElementById("errorMsg");
const googleButton=document.getElementById("googleSignIn"),submitButton=document.getElementById("loginSubmit");
const showError=(s)=>{errorMsg.textContent=s||"";};
const setBusy=(v)=>{googleButton.disabled=v;submitButton.disabled=v;};
const labels={superadmin:"Superadmin",manager:"Manager",staff:"Staff"};
const descriptions={
  superadmin:"System administration, user management, and organization-wide job oversight will be available here.",
  manager:"Client/vendor registers, jobs, stage reviews, purchase orders and reports will be available here.",
  staff:"Your authorized jobs and stage updates will be available here."
};
let auth;
try{
  const {firebaseConfig}=await import("./firebase-config.js");
  if(!firebaseConfig?.apiKey||!firebaseConfig?.projectId||!firebaseConfig?.appId)throw new Error("Firebase is not configured.");
  const app=initializeApp(firebaseConfig);
  auth=getAuth(app);
  const db=getFirestore(app);
  async function authorize(user){
    if(!user){workspace.hidden=true;loginCard.hidden=false;return;}
    try{
      const profileSnap=await getDoc(doc(db,"users",user.uid));
      const profile=profileSnap.exists()?profileSnap.data():null;
      if(!profile||profile.status!=="active"||!Object.hasOwn(labels,profile.role)){
        await signOut(auth);
        showError("This account is not active or authorized for JMS. Contact your system administrator.");
        return;
      }
      loginCard.hidden=true;workspace.hidden=false;showError("");
      document.getElementById("roleLabel").textContent=labels[profile.role];
      document.getElementById("welcomeHeading").textContent="Welcome to JMS";
      document.getElementById("workspaceDescription").textContent=descriptions[profile.role];
      await startModules(db,user,profile.role);
    }catch(err){
      await signOut(auth);
      showError("Unable to verify your JMS access. Please try again or contact your administrator.");
      console.error("Authorization failed:",err);
    }
  }
  onAuthStateChanged(auth,authorize,(err)=>showError(err.message));
  document.getElementById("loginForm").addEventListener("submit",async(event)=>{
    event.preventDefault();showError("");setBusy(true);
    try{
      await setPersistence(auth,browserLocalPersistence);
      await signInWithEmailAndPassword(auth,document.getElementById("email").value.trim(),document.getElementById("password").value);
    }catch(err){showError("Sign-in unsuccessful. Check your credentials and try again.");console.error("JMS sign-in:",err);}
    finally{setBusy(false);}
  });
  googleButton.addEventListener("click",async()=>{
    showError("");setBusy(true);
    try{
      await setPersistence(auth,browserLocalPersistence);
      const provider=new GoogleAuthProvider();
      provider.setCustomParameters({prompt:"select_account"});
      await signInWithPopup(auth,provider);
    }catch(err){
      if(err.code!=="auth/popup-closed-by-user")showError("Google sign-in unsuccessful. Please try again.");
      console.error("JMS Google sign-in:",err);
    }finally{setBusy(false);}
  });
  document.getElementById("logoutBtn").addEventListener("click",()=>signOut(auth));
}catch(err){
  setBusy(true);
  showError("JMS Firebase configuration is pending. An administrator must configure this application before login is available.");
  console.warn("JMS configuration:",err.message);
}
