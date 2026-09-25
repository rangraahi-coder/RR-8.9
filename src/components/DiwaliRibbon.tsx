'use client';
import styles from './DiwaliRibbon.module.css';
function Diya({small=false}:{small?:boolean}){return <span className={`${styles.diya} ${small?styles.small:''}`}><span className={styles.halo}/><span className={styles.flame}/><span className={styles.bowl}/><span className={styles.base}/></span>;}
export default function DiwaliRibbon({lang}:{lang:'en'|'hi'}){
 return <section className={styles.ribbon} aria-label={lang==='hi'?'शुभ दीपावली':'Happy Diwali'}>
  <svg className={styles.rangoli} viewBox="0 0 240 240" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth=".8">{Array.from({length:16},(_,i)=><ellipse key={i} cx="120" cy="79" rx="24" ry="61" transform={`rotate(${i*22.5} 120 120)`}/>)}<circle cx="120" cy="120" r="88"/><circle cx="120" cy="120" r="104" strokeDasharray="2 7"/><circle cx="120" cy="120" r="113"/></g></svg>
  <div className={styles.greeting}><span className={styles.eyebrow}>RANGRAAHI · {lang==='hi'?'रोशनी का उत्सव':'THE FESTIVAL OF LIGHT'}</span><h2>{lang==='hi'?'हर रंग में रोशनी।':'Light in every colour.'}</h2><p>{lang==='hi'?'नई उमंग, नई शुरुआत। शुभ दीपावली।':'New beginnings. Brighter possibilities. Happy Diwali.'}</p></div>
  <div className={styles.art} aria-hidden="true"><div className={styles.arch}/><div className={styles.lamps}><Diya small/><Diya/><Diya small/></div>{Array.from({length:9},(_,i)=><i className={styles.spark} key={i} style={{left:`${12+i*9}%`,top:`${16+(i*23)%65}%`,animationDelay:`${i*.4}s`}}/>)}</div>
 </section>;
}
