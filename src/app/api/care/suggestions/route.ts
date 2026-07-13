import { careJsonFromError, careJsonOk } from "@/lib/care/api-response";
import { requireCarePersistence } from "@/lib/care/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const persistence = await requireCarePersistence();
    const url = new URL(request.url);
    const checkInId = url.searchParams.get("checkInId") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const suggestions = await persistence.getSuggestions({ checkInId, status });
    return careJsonOk({ suggestions });
  } catch (error) {
    return careJsonFromError(error);
  }
}
