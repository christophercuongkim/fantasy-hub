"use client";

import { Button, IconButton } from "@seakim/design-system";
import { signOutAction } from "@/app/actions";

export function SignOutButton({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed) {
    return (
      <form
        action={signOutAction}
        style={{ display: "flex", justifyContent: "center" }}
      >
        <IconButton type="submit" icon="sign-out" label="Sign out" size="sm" />
      </form>
    );
  }
  return (
    <form action={signOutAction}>
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        iconLeft="sign-out"
        fullWidth
      >
        Sign out
      </Button>
    </form>
  );
}
