import { careJsonFromError, careJsonOk } from "@/lib/care/api-response";
import { requireCarePersistence } from "@/lib/care/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const persistence = await requireCarePersistence();
    const routine = await persistence.getActiveRoutine();
    return careJsonOk({ routine });
  } catch (error) {
    return careJsonFromError(error);
  }
}
