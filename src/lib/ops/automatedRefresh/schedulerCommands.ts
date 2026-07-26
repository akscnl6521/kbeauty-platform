/**
 * Scheduler-ready command specs (P3-T03).
 * Documents daily product + twice-weekly clinic refresh commands.
 * Does NOT create external paid infra or Production schedules.
 */

import {
  CLINIC_TWICE_WEEKLY_CRON_NOTE_KO,
  CLINIC_TWICE_WEEKLY_CRON_UTC,
  PRODUCT_DAILY_CRON_NOTE_KO,
  PRODUCT_DAILY_CRON_UTC,
} from "./constants";
import type { SchedulerCommandSpec } from "./types";

export const PRODUCT_DAILY_SCHEDULER_COMMAND: SchedulerCommandSpec = {
  id: "product_daily",
  titleKo: "제품 일일 갱신 아티팩트",
  cadence: "daily",
  cronUtc: PRODUCT_DAILY_CRON_UTC,
  cronNoteKo: PRODUCT_DAILY_CRON_NOTE_KO,
  npmScript: "refresh:product-daily",
  runnerScript: "scripts/run-product-refresh-daily.ts",
  entityKind: "product",
  producesArtifacts: [
    "artifacts/automated-refresh-ops/product-daily/",
    "due-queue.json",
    "exceptions.json",
    "admin-review-manifest.json",
    "audit.json",
  ],
  externalPaidInfra: false,
  productionScheduleCreated: false,
  publishAllowed: false,
  destructiveUpdateAllowed: false,
};

export const CLINIC_TWICE_WEEKLY_SCHEDULER_COMMAND: SchedulerCommandSpec = {
  id: "clinic_twice_weekly",
  titleKo: "병원 주 2회 갱신 아티팩트",
  cadence: "twice_weekly_mon_thu",
  cronUtc: CLINIC_TWICE_WEEKLY_CRON_UTC,
  cronNoteKo: CLINIC_TWICE_WEEKLY_CRON_NOTE_KO,
  npmScript: "refresh:clinic-twice-weekly",
  runnerScript: "scripts/run-clinic-refresh-twice-weekly.ts",
  entityKind: "clinic",
  producesArtifacts: [
    "artifacts/automated-refresh-ops/clinic-twice-weekly/",
    "due-queue.json",
    "exceptions.json",
    "admin-review-manifest.json",
    "audit.json",
  ],
  externalPaidInfra: false,
  productionScheduleCreated: false,
  publishAllowed: false,
  destructiveUpdateAllowed: false,
};

export function listSchedulerReadyCommands(): SchedulerCommandSpec[] {
  return [
    PRODUCT_DAILY_SCHEDULER_COMMAND,
    CLINIC_TWICE_WEEKLY_SCHEDULER_COMMAND,
  ];
}

/** Assert safety invariants for scheduler specs (tests / runners). */
export function assertSchedulerCommandsSafe(
  commands: SchedulerCommandSpec[] = listSchedulerReadyCommands(),
): void {
  for (const cmd of commands) {
    if (cmd.externalPaidInfra !== false) {
      throw new Error(`${cmd.id}: externalPaidInfra must be false`);
    }
    if (cmd.productionScheduleCreated !== false) {
      throw new Error(`${cmd.id}: productionScheduleCreated must be false`);
    }
    if (cmd.publishAllowed !== false) {
      throw new Error(`${cmd.id}: publishAllowed must be false`);
    }
    if (cmd.destructiveUpdateAllowed !== false) {
      throw new Error(`${cmd.id}: destructiveUpdateAllowed must be false`);
    }
  }
}
