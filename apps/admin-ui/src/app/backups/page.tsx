import { redirect } from 'next/navigation';

export default function BackupsRedirectPage() {
  redirect('/backup-restore');
}
