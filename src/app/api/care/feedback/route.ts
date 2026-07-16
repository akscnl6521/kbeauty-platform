import { careJsonFromError, careJsonOk } from "@/lib/care/api-response";
import {
  requireCarePersistence,
  type SaveFeedbackInput,
} from "@/lib/care/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const persistence = await requireCarePersistence();
    const body = (await request.json()) as SaveFeedbackInput;
    const feedback = await persistence.saveFeedback(body);
    return careJsonOk({ feedback }, 201);
  } catch (error) {
    return careJsonFromError(error);
  }
}
