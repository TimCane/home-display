import { useParams } from "react-router-dom";
import { trpc } from "../trpc";
import { EditorShell } from "../editor/EditorShell";
import type { DraftData } from "../editor/EditorShell";
import { redirectToLogin } from "../auth";

export function EditorPage() {
  const { uuid } = useParams<{ uuid: string }>();

  const draft = trpc.draft.get.useQuery(
    { id: uuid! },
    {
      enabled: !!uuid,
      retry: (count, error) => {
        // Don't retry auth or validation errors
        const code = (error as any)?.data?.code;
        if (code === "UNAUTHORIZED" || code === "NOT_FOUND" || code === "BAD_REQUEST") {
          return false;
        }
        return count < 2;
      },
    },
  );

  if (draft.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (draft.error) {
    const code = (draft.error as any)?.data?.code;

    // Non-guest draft without admin session → redirect to login
    if (code === "UNAUTHORIZED") {
      redirectToLogin();
      return (
        <div className="flex h-screen items-center justify-center bg-background">
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      );
    }

    // Expired, consumed, or not found
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold">Link no longer valid</h1>
          <p className="text-sm text-muted-foreground">
            This editor link has expired, already been used, or does not exist.
          </p>
        </div>
      </div>
    );
  }

  if (!draft.data) return null;

  return <EditorShell draft={draft.data as DraftData} />;
}
