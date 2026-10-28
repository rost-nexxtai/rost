import type { Metadata } from 'next';
import { AdminApp } from '@/components/admin/AdminApp';

// For the team, not for users: kept out of search engines and out of the tab bar.
export const metadata: Metadata = { title: 'Admin · Rost', robots: { index: false, follow: false } };

export default function AdminPage() {
  return <AdminApp />;
}
