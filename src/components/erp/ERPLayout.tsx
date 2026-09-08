'use client';
import AppLayout from '@/components/AppLayout';
import type {ReactNode} from 'react';
export default function ERPLayout({children}:{children:ReactNode}){return <AppLayout pageTitle="ERP" pageTitleHi="ERP" render={()=>children}/>;}
