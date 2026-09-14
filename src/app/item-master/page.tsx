'use client';
import AppLayout from '@/components/AppLayout';
import ItemMasterClient from '@/app/masters/items/components/ItemMasterClient';
export default function Page(){return <AppLayout pageTitle="Item Master" pageTitleHi="आइटम मास्टर" render={()=> <ItemMasterClient/>}/>;}
