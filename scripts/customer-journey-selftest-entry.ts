import { runCustomerAuthSelftests } from "@/lib/auth/customer-selftest";
import { runJourneySelftests } from "@/lib/user/journey-selftest";

const auth = runCustomerAuthSelftests();
const journey = runJourneySelftests();
console.log(`[customer-journey] ${auth.checks + journey.checks} checks passed`);
