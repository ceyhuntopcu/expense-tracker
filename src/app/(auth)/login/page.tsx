import Link from "next/link";
import { login } from "@/lib/auth-actions";
import { AuthForm, Field } from "@/components/auth-form";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <div>
      <AuthForm action={login} submitLabel="Open the ledger">
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
        />
      </AuthForm>
      <p className="mt-8 text-center text-[15px] italic text-ink-faint">
        First time?{" "}
        <Link href="/register" className="underline hover:text-moss">
          Start your ledger
        </Link>
      </p>
    </div>
  );
}
