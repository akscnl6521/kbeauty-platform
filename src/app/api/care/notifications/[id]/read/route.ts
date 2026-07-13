import { careJsonFromError, careJsonOk } from "@/lib/care/api-response";
import { requireCarePersistence } from "@/lib/care/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const persistence = await requireCarePersistence();
    const notification = await persistence.markNotificationRead(id);
    return careJsonOk({ notification });
  } catch (error) {
    return careJsonFromError(error);
  }
}
