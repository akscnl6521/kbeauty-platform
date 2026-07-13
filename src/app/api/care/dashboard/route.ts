import { careJsonFromError, careJsonOk } from "@/lib/care/api-response";
import { requireCarePersistence } from "@/lib/care/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const persistence = await requireCarePersistence();
    const dashboard = await persistence.getCareDashboard();
    return careJsonOk(dashboard);
  } catch (error) {
    return careJsonFromError(error);
  }
}
