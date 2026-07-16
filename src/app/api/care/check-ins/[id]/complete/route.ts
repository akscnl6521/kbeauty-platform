import { careJsonFail, careJsonFromError, careJsonOk } from "@/lib/care/api-response";
import { requireCarePersistence } from "@/lib/care/persistence";
import type { CareCheckInAnswers } from "@/lib/care/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const persistence = await requireCarePersistence();
    const body = (await request.json()) as { answers?: CareCheckInAnswers };

    if (!body.answers) {
      return careJsonFail(400, "INVALID_PAYLOAD", "answers가 필요합니다.");
    }

    const result = await persistence.completeCheckin(id, body.answers);
    return careJsonOk(result);
  } catch (error) {
    return careJsonFromError(error);
  }
}
