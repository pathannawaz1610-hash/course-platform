import { useEffect, useMemo, useState } from "react";
import type { HTMLProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DASHBOARD_CARD_SHADOW, DASHBOARD_GRADIENT_BG, FONT_INTER_STACK } from "@/constants/theme";
import { SiteHeader, type SiteHeaderProps } from "./SiteHeader";

interface SiteLayoutProps {
  children: ReactNode;
  headerProps?: SiteHeaderProps;
  showHeader?: boolean;
  className?: string;
  contentClassName?: string;
  mainProps?: HTMLProps<HTMLElement>;
}

export function SiteLayout({
  children,
  headerProps,
  showHeader = true,
  className,
  contentClassName,
  mainProps,
}: SiteLayoutProps) {
  const [storedIsAuthenticated, setStoredIsAuthenticated] = useState(false);
  const [storedUser, setStoredUser] = useState<SiteHeaderProps["user"]>();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncAuthState = () => {
      try {
        const isAuthed = window.localStorage.getItem("isAuthenticated") === "true";
        setStoredIsAuthenticated(isAuthed);

        if (isAuthed) {
          const rawUser = window.localStorage.getItem("user");
          if (rawUser) {
            const parsed = JSON.parse(rawUser) as Partial<{ fullName?: string; name?: string; email?: string; picture?: string }>;
            const displayName = parsed.fullName?.trim() || parsed.name?.trim() || "Learner";

            setStoredUser({
              name: displayName,
              email: parsed.email ?? "",
              avatarUrl: parsed.picture,
              initials: displayName
                .split(" ")
                .filter(Boolean)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase(),
            });
            return;
          }
        }

        setStoredUser(undefined);
      } catch (error) {
        console.error("Failed to sync header auth state", error);
        setStoredUser(undefined);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === "user" || event.key === "isAuthenticated" || event.key === "session") {
        syncAuthState();
      }
    };

    syncAuthState();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const mergedHeaderProps = useMemo(() => {
    if (!showHeader) {
      return undefined;
    }

    return {
      ...headerProps,
      isAuthenticated: headerProps?.isAuthenticated ?? storedIsAuthenticated,
      user: headerProps?.user ?? storedUser,
    };
  }, [headerProps, showHeader, storedIsAuthenticated, storedUser]);

  const { className: mainClassName, style: mainStyle, ...restMainProps } = mainProps ?? {};

  return (
    <div
      className={cn(FONT_INTER_STACK, "min-h-screen w-full")}
      style={{ background: DASHBOARD_GRADIENT_BG }}
    >
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-4">
        <main
          {...restMainProps}
          className={cn(
            "relative overflow-hidden rounded-[22px] bg-white shadow-2xl",
            "px-4 py-6 sm:px-6 sm:py-8 lg:px-8",
            "transition-all duration-500",
            mainClassName,
            className,
          )}
          style={{ ...mainStyle, boxShadow: DASHBOARD_CARD_SHADOW }}
        >
          <div
            className={cn(
              "space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500",
              contentClassName,
            )}
          >
            {showHeader ? <SiteHeader {...mergedHeaderProps} /> : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

