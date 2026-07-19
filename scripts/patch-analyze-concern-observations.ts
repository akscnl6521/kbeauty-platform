import fs from "node:fs";
import path from "node:path";

const target = path.resolve("src/app/analyze/page.tsx");
const source = fs.readFileSync(target, "utf8");

const replacements: Array<[string, string, string]> = [
  [
    "component import",
    'import { RednessObservationFields } from "@/components/analyze/RednessObservationFields";',
    'import { RednessObservationFields } from "@/components/analyze/RednessObservationFields";\nimport { ConcernObservationPanel } from "@/components/analyze/ConcernObservationPanel";'
  ],
  [
    "payload import",
    'import {\n  parseRednessObservation,\n  type RednessObservation,\n} from "@/lib/ai/rednessObservation";',
    'import {\n  parseRednessObservation,\n  type RednessObservation,\n} from "@/lib/ai/rednessObservation";\nimport type { ConcernObservation } from "@/lib/ai/types";\nimport type { ConcernObservationMap } from "@/lib/ai/concernObservationFormState";\nimport { buildAnalyzeConcernObservationPayload } from "@/lib/ai/analyzeConcernObservationPayload";'
  ],
  [
    "request body type",
    '  rednessObservation?: RednessObservation;\n};',
    '  rednessObservation?: RednessObservation;\n  concernObservations?: Record<string, ConcernObservation>;\n};'
  ],
  [
    "state",
    '  const [rednessObservation, setRednessObservation] =\n    useState<RednessObservation>({});',
    '  const [rednessObservation, setRednessObservation] =\n    useState<RednessObservation>({});\n  const [concernObservationMap, setConcernObservationMap] =\n    useState<ConcernObservationMap>({});'
  ],
  [
    "derived payload",
    '  const rednessPayload = useMemo(() => {\n    if (!showRednessDetails) return undefined;\n    return parseRednessObservation(rednessObservation) ?? undefined;\n  }, [showRednessDetails, rednessObservation]);',
    '  const rednessPayload = useMemo(() => {\n    if (!showRednessDetails) return undefined;\n    return parseRednessObservation(rednessObservation) ?? undefined;\n  }, [showRednessDetails, rednessObservation]);\n  const concernObservationPayload = useMemo(\n    () =>\n      buildAnalyzeConcernObservationPayload(\n        manualConcerns.map(concernKoToParam),\n        concernObservationMap\n      ),\n    [manualConcerns, concernObservationMap]\n  );'
  ],
];

let next = source;
for (const [label, before, after] of replacements) {
  const count = next.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${count}`);
  }
  next = next.replace(before, after);
}

if (next === source) throw new Error("No changes generated");
fs.writeFileSync(target, next, "utf8");
console.log("Analyze concern observation patch applied safely.");
