import { careJsonFromError, careJsonOk } from "@/lib/care/api-response";
import {
  requireCarePersistence,
  type CreateRoutineInput,
} from "@/lib/care/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const persistence = await requireCarePersistence();
    const body = (await request.json()) as CreateRoutineInput;
    const routine = await persistence.createRoutine(body);
    return careJsonOk({ routine }, 201);
  } catch (error) {
    return careJsonFromError(error);
  }
}
