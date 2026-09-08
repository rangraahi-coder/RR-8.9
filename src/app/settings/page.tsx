'use client';
import AppLayout from '@/components/AppLayout';
import ConnectionDiagnosticTab from './components/ConnectionDiagnosticTab';
export default function Page(){return <AppLayout pageTitle="Settings" pageTitleHi="सेटिंग" render={()=> <div className="space-y-5"><h1 className="text-xl font-semibold">Settings</h1><ConnectionDiagnosticTab/></div>}/>;}
