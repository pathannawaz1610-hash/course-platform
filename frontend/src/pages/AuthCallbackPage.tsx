import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { resetSessionHeartbeat, writeStoredSession } from "@/utils/session";

const COURSE_PLAYER_DEFAULT_PATH = "/course/ai-native-fullstack-developer/learn/welcome-to-ai-journey";

function parseCallbackParams(): Record<string, string | null> {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  return {
    accessToken: params.get("accessToken"),
    accessTokenExpiresAt: params.get("accessTokenExpiresAt"),
    refreshToken: params.get("refreshToken"),
    refreshTokenExpiresAt: params.get("refreshTokenExpiresAt"),
    sessionId: params.get("sessionId"),
    userId: params.get("userId"),
    userEmail: params.get("userEmail"),
    userFullName: params.get("userFullName"),
    userPicture: params.get("userPicture"),
    userEmailVerified: params.get("userEmailVerified"),
    redirectPath: params.get("redirectPath"),
    error: params.get("error"),
  };
}

export default function AuthCallbackPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const {
      accessToken,
      accessTokenExpiresAt,
      refreshToken,
      refreshTokenExpiresAt,
      sessionId,
      userId,
      userEmail,
      userFullName,
      userPicture,
      userEmailVerified,
      redirectPath,
      error,
    } = parseCallbackParams();

    if (error) {
      console.error("OAuth callback error:", error);
      toast({
        variant: "destructive",
        title: "Google sign-in failed",
        description: "Please try again or use a different account.",
      });
      setLocation("/");
      return;
    }

    if (!accessToken || !refreshToken || !sessionId) {
      toast({
        variant: "destructive",
        title: "Sign-in incomplete",
        description: "Missing credential data from Google. Please retry.",
      });
      setLocation("/");
      return;
    }

    const session = {
      accessToken,
      accessTokenExpiresAt: accessTokenExpiresAt ?? "",
      refreshToken,
      refreshTokenExpiresAt: refreshTokenExpiresAt ?? "",
      sessionId,
      userId: userId ?? undefined,
      email: userEmail ?? undefined,
      fullName: userFullName ?? undefined,
    };

    const user = {
      id: userId ?? "",
      email: userEmail ?? "",
      fullName: userFullName ?? userEmail ?? "",
      picture: userPicture ?? undefined,
      emailVerified: userEmailVerified === "true",
    };

    writeStoredSession(session);
    resetSessionHeartbeat();
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("isAuthenticated", "true");

    const storedRedirect = sessionStorage.getItem("postLoginRedirect");
    sessionStorage.removeItem("postLoginRedirect");

    toast({
      title: "Welcome to LearnHub!",
      description: `Signed in as ${user.fullName}`,
    });

    const destination =
      (redirectPath && redirectPath.startsWith("/") ? redirectPath : undefined) ??
      (storedRedirect && storedRedirect.startsWith("/") ? storedRedirect : undefined) ??
      COURSE_PLAYER_DEFAULT_PATH;

    setLocation(destination);
  }, [setLocation, toast]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Signing you in with Google...</p>
    </div>
  );
}
