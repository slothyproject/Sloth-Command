/**
 * Root Page
 * Redirects to login page
 */

import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/login');
}
