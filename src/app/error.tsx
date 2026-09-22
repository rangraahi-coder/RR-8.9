'use client';

export default function PageError({reset}:{reset:()=>void}){
 return <main translate="no" className="notranslate card-surface max-w-lg mx-auto mt-16 p-6 space-y-4">
  <h1 className="text-xl font-semibold">Screen could not load / स्क्रीन नहीं खुल पाई</h1>
  <p>Browser translation चालू हो तो Show original चुनें। भाषा के लिए app का EN/हि button इस्तेमाल करें।</p>
  <p className="text-sm">Retry या Reload करने पर बिना save की form entry हट सकती है।</p>
  <div className="flex gap-3"><button className="btn-primary" onClick={reset}>Retry / फिर कोशिश करें</button><button className="btn-secondary" onClick={()=>window.location.reload()}>Reload</button></div>
  <a className="underline block" href="/">Dashboard</a>
 </main>;
}
