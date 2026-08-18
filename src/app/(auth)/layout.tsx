export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <header className="text-center mb-10">
          <p className="label-caps mb-3">est. {new Date().getFullYear()}</p>
          <h1
            className="font-[family-name:var(--font-display)] text-5xl tracking-tight"
            style={{ fontVariationSettings: '"SOFT" 40, "WONK" 1' }}
          >
            Ledger
          </h1>
          <p className="mt-3 italic text-ink-soft">
            a personal record of where the money went
          </p>
        </header>
        <div className="double-rule pt-8">{children}</div>
      </div>
    </main>
  );
}
