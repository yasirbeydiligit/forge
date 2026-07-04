import Link from "next/link";

import { Brand } from "@/components/brand";
import { PaperGrain } from "@/components/paper-grain";

/**
 * Auth desk: the editorial backdrop the login/kayıt cards are laid on — cream
 * paper with grain, a masthead meta line up top and a colophon whisper below,
 * matching the landing's "Sayı 01" world.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip px-4 py-6">
      <PaperGrain />

      <div className="text-label mx-auto flex w-full max-w-md items-baseline justify-between text-muted-foreground">
        <span>Forge</span>
        <span>Kapalı topluluk</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-10">
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

      <p className="text-caption mx-auto max-w-md text-center font-mono text-muted-foreground/70">
        Sayı 01 · Krem kâğıda dijital baskı
      </p>
    </div>
  );
}
