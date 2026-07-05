"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

import { AccountDialog } from "@/components/account-dialog";
import HelpDialog from "@/components/help-dialog";
import { SettingsDialog } from "@/components/settings-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import type { AssignedCategory, Category, CategoryUseCase } from "@/lib/types";

export function MobileAccountSheet({
  categories,
  categoryUseCases,
  hasLclCredentials,
  isDemoMode,
}: {
  categories: Category[];
  categoryUseCases: Record<CategoryUseCase, AssignedCategory[]>;
  hasLclCredentials: boolean;
  isDemoMode: boolean;
}) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  if (!session?.user) {
    return null;
  }

  const initials = session.user.name?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        aria-label="Ouvrir le menu du compte"
        onClick={() => setOpen(true)}
      >
        <Avatar size="sm">
          <AvatarFallback className="border bg-primary text-primary-foreground">{initials}</AvatarFallback>
        </Avatar>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-72 gap-0 p-0">
          <SheetHeader className="border-b">
            <SheetTitle className="sr-only">Compte</SheetTitle>
            <div className="flex items-center gap-2">
              <Avatar>
                <AvatarFallback className="border bg-primary text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{session.user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{session.user.email}</span>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-3">
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <AccountDialog trigger={<SidebarMenuButton />} />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SettingsDialog
                  categories={categories}
                  categoryUseCases={categoryUseCases}
                  hasLclCredentials={hasLclCredentials}
                  isDemoMode={isDemoMode}
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <HelpDialog />
              </SidebarMenuItem>
            </SidebarMenu>
          </div>

          <div className="border-t p-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-destructive hover:text-destructive"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut className="size-4" />
              Se déconnecter
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
