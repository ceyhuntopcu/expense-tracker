import Link from "next/link";
import { register } from "@/lib/auth-actions";
import { AuthForm, Field } from "@/components/auth-form";

export const metadata = { title: "Register" };

export default function RegisterPage() {
  if (process.env.ALLOW_SIGNUPS === "false") {
    return (
      <div className="text-center">
        <p className="italic text-ink-soft">
          Sign-ups are closed. This ledger already has its keeper.
        </p>
        <p className="mt-6 text-[15px]">
          <Link href="/login" className="underline hover:text-moss">
            Log in instead
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <AuthForm action={register} submitLabel="Start your ledger">
        <Field label="Name" name="name" autoComplete="name" />
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
        />
      </AuthForm>
      <p className="mt-8 text-center text-[15px] italic text-ink-faint">
        Already keeping one?{" "}
        <Link href="/login" className="underline hover:text-moss">
          Log in
        </Link>
      </p>
    </div>
  );
}
