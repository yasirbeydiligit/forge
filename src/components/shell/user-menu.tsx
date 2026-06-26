"use client";

import Link from "next/link";
import { LogOut, User as UserIcon } from "lucide-react";

import { signOutAction } from "@/app/(auth)/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Profile } from "@/lib/auth";
import { getInitials } from "@/lib/format";

export function UserMenu({
  profile,
  align = "end",
}: {
  profile: Profile;
  align?: "start" | "end";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="outline-none">
        <Avatar className="size-9 border border-border">
          {profile.avatar_url ? (
            <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
          ) : null}
          <AvatarFallback className="bg-secondary text-xs font-semibold">
            {getInitials(profile.full_name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="truncate font-medium">{profile.full_name}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              {profile.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profil">
            <UserIcon className="size-4" />
            Profilim
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={(e) => {
            e.preventDefault();
            void signOutAction();
          }}
        >
          <LogOut className="size-4" />
          Çıkış yap
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
