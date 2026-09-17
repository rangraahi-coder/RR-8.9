'use client';

export default function GlobalError(){
 return (
  <html lang="en" translate="no" className="notranslate"><head><meta name="google" content="notranslate" /></head><body style={{margin:0,background:'#f8fafc',fontFamily:'sans-serif',color:'#1e293b'}}>
   <main style={{maxWidth:520,margin:'12vh auto',padding:24}}>
    <h1>Screen could not load / स्क्रीन नहीं खुल पाई</h1>
    <p>If browser translation is on, select Show original. Use the app’s EN/हि button to change language.</p>
    <p>Browser translation चालू हो तो Show original चुनें। भाषा के लिए app का EN/हि button इस्तेमाल करें।</p>
    <p>Reloading may clear unsaved form entries. / Reload करने पर बिना save की entry हट सकती है।</p>
    <button style={{padding:'12px 20px',cursor:'pointer'}} onClick={()=>window.location?.reload()}>Reload / दोबारा खोलें</button>
    <p><a href="/">Go to dashboard / डैशबोर्ड खोलें</a></p>
   </main>
  </body></html>
 );
}
