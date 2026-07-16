import { careJsonFromError, careJsonOk } from "@/lib/care/api-response";
import { requireCarePersistence } from "@/lib/care/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const persistence = await requireCarePersistence();
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const checkIns = await persistence.getCheckins({ sessionId, status });
    return careJsonOk({ checkIns });
  } catch (error) {
    return careJsonFromError(error);
  }
}
