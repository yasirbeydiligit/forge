import Link from "next/link";

import { Brand } from "@/components/brand";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-primary/10 to-transparent" />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" aria-label="Ana sayfa">
            <Brand className="scale-110" />
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">
            Sporcular ve koç için tek platform
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
