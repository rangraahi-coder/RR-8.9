'use client';
import AppLayout from '@/components/AppLayout';
import ItemImportContent from '@/app/masters/items/import/components/ItemImportContent';
export default function Page(){return <AppLayout pageTitle="Item Import" pageTitleHi="आइटम इम्पोर्ट" render={()=> <ItemImportContent/>}/>;}
