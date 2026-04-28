import { redirect } from 'next/navigation';

// Redirect old AI Matching page to unified Recruitment page
export default function AIMatchingRedirect() {
  redirect('/cvision/recruitment');
}
