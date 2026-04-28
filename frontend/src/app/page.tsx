import { redirect } from 'next/navigation';

export default function Home() {
  // Proxy handles all redirects based on auth state.
  // This page should never be reached directly.
  redirect('/chats');
}
