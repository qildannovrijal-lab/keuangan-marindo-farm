import { AuthForm } from "@/components/auth-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ confirmation?: string }> }) {
  const params = await searchParams;
  const confirmationNotice = params.confirmation === "confirmed" || params.confirmation === "link"
    ? params.confirmation
    : null;

  return <AuthForm mode="login" confirmationNotice={confirmationNotice} />;
}
