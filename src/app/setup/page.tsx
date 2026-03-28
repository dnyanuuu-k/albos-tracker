import { redirect } from 'next/navigation';

export default function SetupPage(props: {
  searchParams?: { token?: string };
}) {
  const token = props.searchParams?.token ?? '';
  if (!token) redirect('/');
  redirect(`/accept-invite?token=${encodeURIComponent(token)}`);
}

