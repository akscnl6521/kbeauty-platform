import { careJsonFail, careJsonFromError, careJsonOk } from "@/lib/care/api-response";
import {
  requireCarePersistence,
  type CreateRoutineVersionInput,
} from "@/lib/care/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const persistence = await requireCarePersistence();
    const body = (await request.json()) as Omit<CreateRoutineVersionInput, "routineId">;

    if (!body.items?.length) {
      return careJsonFail(400, "INVALID_PAYLOAD", "루틴 항목이 필요합니다.");
    }

    const routine = await persistence.createRoutineVersion({
      routineId: id,
      items: body.items,
      conflictNotes: body.conflictNotes,
    });
    return careJsonOk({ routine }, 201);
  } catch (error) {
    return careJsonFromError(error);
  }
}
