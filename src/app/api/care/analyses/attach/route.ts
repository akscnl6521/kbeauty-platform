import { careJsonFail, careJsonFromError, careJsonOk } from "@/lib/care/api-response";
import { isCareStoreSnapshot, requireCarePersistence } from "@/lib/care/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const persistence = await requireCarePersistence();
    const body = await request.json();

    if (!isCareStoreSnapshot(body)) {
      return careJsonFail(400, "INVALID_PAYLOAD", "유효하지 않은 로컬 저장소 형식입니다.");
    }

    const result = await persistence.attachAnonymousLocalStore(body);
    return careJsonOk(result);
  } catch (error) {
    return careJsonFromError(error);
  }
}
