import { careJsonFromError, careJsonOk } from "@/lib/care/api-response";
import {
  requireCarePersistence,
  type SaveAnalysisSessionInput,
} from "@/lib/care/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const persistence = await requireCarePersistence();
    const sessions = await persistence.getAnalysisSessions();
    return careJsonOk({ sessions });
  } catch (error) {
    return careJsonFromError(error);
  }
}

export async function POST(request: Request) {
  try {
    const persistence = await requireCarePersistence();
    const body = (await request.json()) as SaveAnalysisSessionInput;
    const result = await persistence.saveAnalysisSession(body);
    return careJsonOk(result, 201);
  } catch (error) {
    return careJsonFromError(error);
  }
}
