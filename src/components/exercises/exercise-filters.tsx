"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Radix Select forbids an empty string value, so "all" uses this sentinel. */
export const ALL = "__all__";

/**
 * Shared category + region (+ optional name search) filter row. Stateless —
 * the consumer owns the values and resets region when the category changes.
 * Reused by the coach library and the program-builder exercise picker.
 */
export function ExerciseFilters({
  categories,
  regions,
  category,
  region,
  query,
  onCategory,
  onRegion,
  onQuery,
  className,
}: {
  categories: string[];
  regions: string[];
  category: string;
  region: string;
  query?: string;
  onCategory: (v: string) => void;
  onRegion: (v: string) => void;
  onQuery?: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {onQuery ? (
        <div className="relative min-w-[8rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query ?? ""}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Egzersiz ara…"
            className="pl-8"
          />
        </div>
      ) : null}

      <Select
        value={category || ALL}
        onValueChange={(v) => onCategory(v === ALL ? "" : v)}
      >
        <SelectTrigger className="w-auto min-w-[8rem]">
          <SelectValue placeholder="Kategori" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tüm kategoriler</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={region || ALL}
        onValueChange={(v) => onRegion(v === ALL ? "" : v)}
        disabled={regions.length === 0}
      >
        <SelectTrigger className="w-auto min-w-[8rem]">
          <SelectValue placeholder="Bölge" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tüm bölgeler</SelectItem>
          {regions.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
