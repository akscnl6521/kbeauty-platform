import { careJsonFromError, careJsonOk } from "@/lib/care/api-response";
import { requireCarePersistence } from "@/lib/care/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const persistence = await requireCarePersistence();
    const notifications = await persistence.getNotifications();
    return careJsonOk({ notifications });
  } catch (error) {
    return careJsonFromError(error);
  }
}
