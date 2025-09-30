import { getPdvs } from "@/lib/data";
import { LoginForm } from "./_components/login-form";
import Image from "next/image";
import { checkAuth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const { user } = await checkAuth();
  if (user) {
    const url = user.role === 'PDV' ? '/pos' : '/dashboard';
    redirect(url);
  }

  const pdvs = getPdvs();
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-md">
         <div className="flex justify-center mb-6">
            <Image src="/icon.svg" alt="FestaPay Logo" width={64} height={64} />
         </div>
        <LoginForm pdvs={pdvs} />
      </div>
    </div>
  );
}
