import { useParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";

export function EditorPage() {
  const { uuid } = useParams<{ uuid: string }>();

  return (
    <div className="flex h-full items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Editor</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Draft <code className="text-xs">{uuid}</code>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Canvas editor coming in step 19.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
