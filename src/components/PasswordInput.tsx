"use client";
import {useState, type InputHTMLAttributes} from 'react';
import {Eye, EyeOff} from 'lucide-react';
export default function PasswordInput({className='', ...props}:Omit<InputHTMLAttributes<HTMLInputElement>,'type'>){
 const [visible,setVisible]=useState(false);
 return <span className="relative block w-full"><input {...props} className={className+' pr-12'} type={visible?'text':'password'}/><button type="button" disabled={props.disabled} aria-label={visible?'Hide password':'Show password'} aria-pressed={visible} title={visible?'Hide password':'Show password'} onClick={()=>setVisible(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2">{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></span>;
}
