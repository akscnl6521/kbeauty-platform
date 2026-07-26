import { runCheckinPolicySelftests } from "../src/lib/retention/checkinPolicy";

const result = runCheckinPolicySelftests();
console.log(`[checkin-policy] ${result.checks} checks passed`);
