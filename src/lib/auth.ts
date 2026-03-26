import { cookies } from 'next/headers';

export function isAuthed(): boolean {
  const cookieStore = cookies();
  return cookieStore.get('admin_auth')?.value === 'true';
}
