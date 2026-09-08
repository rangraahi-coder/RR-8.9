 'use client';
import React,{Suspense} from 'react';
import AppLayout from '@/components/AppLayout';
import EmbroideryContent from '@/app/embroidery-accessory/components/EmbroideryContent';
export default function HandworkPage(){return <AppLayout pageTitle="Handwork" pageTitleHi="हैंडवर्क" render={()=><Suspense fallback={<div className="p-6">Loading…</div>}><EmbroideryContent handwork/></Suspense>}/>;}
