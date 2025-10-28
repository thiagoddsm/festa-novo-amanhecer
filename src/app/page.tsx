import { redirect } from 'next/navigation';

export default async function HomePage() {
  // The root page should always redirect to the login page.
  // The app layout will then handle redirecting to the dashboard if the user is already logged in.
  redirect('/login');
}
