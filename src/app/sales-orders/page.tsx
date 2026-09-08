'use client';
import AppLayout from '@/components/AppLayout';
import SalesOrdersContent from './components/SalesOrdersContent';

export default function SalesOrdersPage() {
  return (
    <AppLayout pageTitle="Sales Orders" pageTitleHi="सेल्स ऑर्डर" render={(lang) => <SalesOrdersContent lang={lang} />} />
  );
}
