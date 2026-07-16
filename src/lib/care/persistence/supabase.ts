import "server-only";

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { detectRoutineConflicts } from "@/lib/care/conflicts";
import {
  buildCheckInDueNotification,
  checkInDueFingerprint,
} from "@/lib/care/notifications";
import { computeProgressDeltas, summarizeProgress } from "@/lib/care/progress";
import { evaluateDermatologyReferral } from "@/lib/care/referral";
import {
  applySuggestionToRoutine,
  buildRoutineSuggestions,
} from "@/lib/care/routine-suggestions";
import { createCheckInSchedule } from "@/lib/care/schedule";
import { sanitizeMemo, assertOwner, CareOwnershipError } from "@/lib/care/ownership";
import { CareApiError } from "@/lib/care/api-response";
import { getCareAuthUser, ensureCareProfile } from "@/lib/care/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CareAnalysisSession,
  CareCheckIn,
  CareCheckInAnswers,
  CareFeedback,
  CareNotification,
  CareRoutine,
  CareRoutineItem,
  CareStoreSnapshot,
  CareSuggestion,
  CareUserSettings,
} from "@/lib/care/types";
import {
  buildProgressSummaryPayload,
  localNotificationAttachFingerprint,
  mapCheckInRowToDomain,
  mapLocalSessionToAttachRow,
  mapNotificationRowToDomain,
  mapRoutineItemToRow,
  mapRoutineRowToDomain,
  mapSaveSessionInputToRow,
  mapSessionRowToDomain,
  mapSuggestionRowToDomain,
} from "@/lib/care/persistence/mappers";
import type {
  AttachLocalStoreResult,
  CareAnalysisSessionRow,
  CareCheckInRow,
  CareDashboardDTO,
  CareNotificationRow,
  CareProgressSummaryDTO,
  CareRoutineItemRow,
  CareRoutineRow,
  CareSuggestionRow,
  CreateRoutineInput,
  CreateRoutineVersionInput,
  SaveAnalysisSessionInput,
  SaveFeedbackInput,
} from "@/lib/care/persistence/types";
import { nextDueCheckIn, refreshCheckInStatuses } from "@/lib/care/schedule";

function defaultSettings(timezone: string): CareUserSettings {
  return {
    notificationsEnabled: true,
    emailOptIn: false,
    quietHoursStart: 22,
    quietHoursEnd: 8,
    timezone,
  };
}

function logCareEvent(eventType: string, count = 1): void {
  console.info(`[care] ${eventType} count=${count}`);
}

export class CarePersistence {
  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string
  ) {}

  async saveAnalysisSession(
    input: SaveAnalysisSessionInput
  ): Promise<{ session: CareAnalysisSession; routine: CareRoutine; checkIns: CareCheckIn[] }> {
    const sessionRow = mapSaveSessionInputToRow(input, this.userId);
    const { data: inserted, error } = await this.client
      .from("care_analysis_sessions")
      .insert(sessionRow)
      .select("*")
      .single();

    if (error || !inserted) {
      throw new CareApiError(500, "SAVE_FAILED", "분석 세션 저장에 실패했습니다.");
    }

    const session = mapSessionRowToDomain(inserted as CareAnalysisSessionRow);
    const routine = await this.createRoutine({
      analysisSessionId: session.id,
      timezone: input.timezone,
      items:
        input.routineItems ??
        input.rankedProductIds.slice(0, 6).map((productId, idx) => ({
          step: (idx % 2 === 0 ? "serum" : "moisturizer") as CareRoutineItem["step"],
          productId,
          customProductName: null,
          timeOfDay: idx < 3 ? ("am" as const) : ("pm" as const),
          frequency: "daily" as const,
          order: idx + 1,
        })),
      conflictNotes: [],
    });

    const schedule = createCheckInSchedule({
      analysisSessionId: session.id,
      routineId: routine.id,
      startAt: session.createdAt,
      timezone: input.timezone,
      idFactory: () => randomUUID(),
    });

    const checkInRows = schedule.map((c) => ({
      id: c.id,
      user_id: this.userId,
      analysis_session_id: c.analysisSessionId,
      routine_id: c.routineId,
      day: c.day,
      status: c.status,
      scheduled_for: c.scheduledFor,
      due_at: c.dueAt,
      timezone: c.timezone,
      referral_level: "none",
      referral_reasons: [],
    }));

    const { error: ciErr } = await this.client
      .from("care_check_ins")
      .upsert(checkInRows, {
        onConflict: "analysis_session_id,day",
        ignoreDuplicates: true,
      });

    if (ciErr) {
      throw new CareApiError(500, "CHECKIN_SCHEDULE_FAILED", "체크인 예약에 실패했습니다.");
    }

    const checkIns = await this.getCheckins({ sessionId: session.id });
    logCareEvent("analysis_session_saved");
    return { session, routine, checkIns };
  }

  async getAnalysisSessions(): Promise<CareAnalysisSession[]> {
    const { data, error } = await this.client
      .from("care_analysis_sessions")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    if (error) throw new CareApiError(500, "LOAD_FAILED", "분석 기록을 불러오지 못했습니다.");
    return (data as CareAnalysisSessionRow[]).map(mapSessionRowToDomain);
  }

  async attachAnonymousLocalStore(
    payload: CareStoreSnapshot
  ): Promise<AttachLocalStoreResult> {
    const result: AttachLocalStoreResult = {
      sessionsAttached: 0,
      routinesAttached: 0,
      checkInsAttached: 0,
      skippedDuplicates: 0,
    };

    const { data: existingSessions } = await this.client
      .from("care_analysis_sessions")
      .select("anonymous_session_id")
      .eq("user_id", this.userId)
      .not("anonymous_session_id", "is", null);

    const attachedSessionIds = new Set(
      (existingSessions ?? [])
        .map((r) => (r as { anonymous_session_id: string | null }).anonymous_session_id)
        .filter(Boolean)
    );

    const sessionIdMap = new Map<string, string>();
    const routineIdMap = new Map<string, string>();

    for (const localSession of payload.sessions) {
      if (attachedSessionIds.has(localSession.id)) {
        result.skippedDuplicates += 1;
        continue;
      }

      const newSessionId = randomUUID();
      sessionIdMap.set(localSession.id, newSessionId);

      const row = mapLocalSessionToAttachRow(localSession, this.userId, newSessionId);
      const { error } = await this.client
        .from("care_analysis_sessions")
        .insert(row);

      if (error) {
        if (error.code === "23505") {
          result.skippedDuplicates += 1;
          continue;
        }
        throw new CareApiError(500, "ATTACH_FAILED", "로컬 데이터 연결에 실패했습니다.");
      }
      attachedSessionIds.add(localSession.id);
      result.sessionsAttached += 1;
      logCareEvent("attach_session");
    }

    for (const localRoutine of payload.routines) {
      const mappedSessionId = localRoutine.analysisSessionId
        ? sessionIdMap.get(localRoutine.analysisSessionId)
        : null;
      if (!mappedSessionId) continue;

      const newRoutineId = randomUUID();
      routineIdMap.set(localRoutine.id, newRoutineId);

      const routineRow = {
        id: newRoutineId,
        user_id: this.userId,
        analysis_session_id: mappedSessionId,
        name: "default",
        version: localRoutine.version,
        status: "active",
        timezone: localRoutine.timezone,
        conflict_notes: localRoutine.conflictNotes,
        started_at: localRoutine.createdAt,
        created_at: localRoutine.createdAt,
        updated_at: localRoutine.updatedAt,
      };

      const { error: rErr } = await this.client
        .from("care_routines")
        .upsert(routineRow, {
          onConflict: "user_id,analysis_session_id,version",
          ignoreDuplicates: true,
        });

      if (rErr?.code === "23505") {
        result.skippedDuplicates += 1;
        continue;
      }
      if (rErr) {
        throw new CareApiError(500, "ATTACH_FAILED", "루틴 연결에 실패했습니다.");
      }

      const itemRows = localRoutine.items.map((item) =>
        mapRoutineItemToRow({ ...item, id: randomUUID() }, newRoutineId)
      );
      if (itemRows.length) {
        await this.client.from("care_routine_items").insert(itemRows);
      }
      result.routinesAttached += 1;
    }

    for (const localCheckIn of payload.checkIns) {
      const mappedSessionId = sessionIdMap.get(localCheckIn.analysisSessionId);
      if (!mappedSessionId) continue;

      const mappedRoutineId = localCheckIn.routineId
        ? routineIdMap.get(localCheckIn.routineId) ?? null
        : null;

      const row = {
        id: randomUUID(),
        user_id: this.userId,
        analysis_session_id: mappedSessionId,
        routine_id: mappedRoutineId,
        day: localCheckIn.day,
        status: localCheckIn.status,
        scheduled_for: localCheckIn.scheduledFor,
        due_at: localCheckIn.dueAt,
        completed_at: localCheckIn.completedAt,
        timezone: localCheckIn.timezone,
        answers: localCheckIn.answers,
        progress_summary: localCheckIn.progressDelta
          ? buildProgressSummaryPayload([localCheckIn.progressDelta])
          : null,
        referral_level: localCheckIn.referralLevel,
        referral_reasons: [],
      };

      const { error } = await this.client
        .from("care_check_ins")
        .upsert(row, {
          onConflict: "analysis_session_id,day",
          ignoreDuplicates: true,
        });

      if (error?.code === "23505") {
        result.skippedDuplicates += 1;
        continue;
      }
      if (!error) result.checkInsAttached += 1;
    }

    for (const notif of payload.notifications) {
      const fp = localNotificationAttachFingerprint(this.userId, notif.fingerprint);
      await this.createNotification({
        kind: notif.kind,
        title: notif.title,
        message: notif.message,
        relatedCheckInId: notif.relatedCheckInId,
        fingerprint: fp,
        notificationType: notif.kind,
      });
    }

    logCareEvent("attach_local_store", result.sessionsAttached);
    return result;
  }

  async createRoutine(input: CreateRoutineInput): Promise<CareRoutine> {
    const conflicts =
      input.conflictNotes ??
      detectRoutineConflicts(
        input.items.map((i, idx) => ({
          id: randomUUID(),
          step: i.step,
          productId: i.productId,
          customProductName: i.customProductName,
          timeOfDay: i.timeOfDay,
          frequency: i.frequency,
          order: i.order ?? idx + 1,
          startedAt: new Date().toISOString(),
          stoppedAt: null,
          usageNote: i.usageNote ?? null,
          cautionNotes: i.cautionNotes ?? [],
          allergyConflict: false,
          active: i.active ?? true,
        })),
        [],
        []
      );

    const routineId = randomUUID();
    const now = new Date().toISOString();
    const routineRow = {
      id: routineId,
      user_id: this.userId,
      analysis_session_id: input.analysisSessionId,
      name: input.name ?? "default",
      version: 1,
      status: "active",
      timezone: input.timezone,
      conflict_notes: conflicts,
      started_at: now,
      created_at: now,
      updated_at: now,
    };

    const { error } = await this.client.from("care_routines").insert(routineRow);
    if (error) {
      throw new CareApiError(500, "ROUTINE_FAILED", "루틴 저장에 실패했습니다.");
    }

    const items: CareRoutineItem[] = input.items.map((i, idx) => ({
      id: randomUUID(),
      step: i.step,
      productId: i.productId,
      customProductName: i.customProductName,
      timeOfDay: i.timeOfDay,
      frequency: i.frequency,
      order: i.order ?? idx + 1,
      startedAt: now,
      stoppedAt: null,
      usageNote: i.usageNote ?? null,
      cautionNotes: i.cautionNotes ?? [],
      allergyConflict: false,
      active: i.active ?? true,
    }));

    const itemRows = items.map((item) => mapRoutineItemToRow(item, routineId));
    if (itemRows.length) {
      await this.client.from("care_routine_items").insert(itemRows);
    }

    return {
      id: routineId,
      analysisSessionId: input.analysisSessionId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      timezone: input.timezone,
      items,
      conflictNotes: conflicts,
    };
  }

  async createRoutineVersion(input: CreateRoutineVersionInput): Promise<CareRoutine> {
    const { data: existing, error } = await this.client
      .from("care_routines")
      .select("*")
      .eq("id", input.routineId)
      .maybeSingle();

    if (error || !existing) {
      throw new CareOwnershipError();
    }
    const row = existing as CareRoutineRow;
    assertOwner(row.user_id, this.userId);

    const now = new Date().toISOString();
    await this.client
      .from("care_routines")
      .update({ status: "ended", ended_at: now, updated_at: now })
      .eq("id", input.routineId);

    const newRoutineId = randomUUID();
    const newVersion = row.version + 1;
    const newRow = {
      id: newRoutineId,
      user_id: this.userId,
      analysis_session_id: row.analysis_session_id,
      name: row.name,
      version: newVersion,
      status: "active",
      timezone: row.timezone,
      conflict_notes: input.conflictNotes ?? row.conflict_notes,
      started_at: now,
      created_at: now,
      updated_at: now,
    };

    const { error: insErr } = await this.client.from("care_routines").insert(newRow);
    if (insErr) {
      throw new CareApiError(500, "VERSION_FAILED", "루틴 버전 생성에 실패했습니다.");
    }

    const itemRows = input.items.map((item) =>
      mapRoutineItemToRow({ ...item, id: item.id || randomUUID() }, newRoutineId)
    );
    if (itemRows.length) {
      await this.client.from("care_routine_items").insert(itemRows);
    }

    const { data: items } = await this.client
      .from("care_routine_items")
      .select("*")
      .eq("routine_id", newRoutineId);

    logCareEvent("routine_version_created");
    return mapRoutineRowToDomain(newRow as CareRoutineRow, (items ?? []) as CareRoutineItemRow[]);
  }

  async getActiveRoutine(): Promise<CareRoutine | null> {
    const { data: routines, error } = await this.client
      .from("care_routines")
      .select("*")
      .eq("user_id", this.userId)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error || !routines?.length) return null;
    const routine = routines[0] as CareRoutineRow;

    const { data: items } = await this.client
      .from("care_routine_items")
      .select("*")
      .eq("routine_id", routine.id);

    return mapRoutineRowToDomain(routine, (items ?? []) as CareRoutineItemRow[]);
  }

  async getCheckins(opts?: {
    sessionId?: string;
    status?: string;
  }): Promise<CareCheckIn[]> {
    let q = this.client
      .from("care_check_ins")
      .select("*")
      .eq("user_id", this.userId)
      .order("due_at", { ascending: true });

    if (opts?.sessionId) q = q.eq("analysis_session_id", opts.sessionId);
    if (opts?.status) q = q.eq("status", opts.status);

    const { data, error } = await q;
    if (error) throw new CareApiError(500, "LOAD_FAILED", "체크인을 불러오지 못했습니다.");

    const rows = (data ?? []) as CareCheckInRow[];
    const suggestionMap = await this.loadSuggestionIdsByCheckIn(
      rows.map((r) => r.id)
    );

    const mapped = rows.map((r) =>
      mapCheckInRowToDomain(r, suggestionMap.get(r.id) ?? [])
    );
    return refreshCheckInStatuses(mapped);
  }

  private async loadSuggestionIdsByCheckIn(
    checkInIds: string[]
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (!checkInIds.length) return map;

    const { data } = await this.client
      .from("care_suggestions")
      .select("id, check_in_id")
      .eq("user_id", this.userId)
      .in("check_in_id", checkInIds);

    for (const row of data ?? []) {
      const r = row as { id: string; check_in_id: string | null };
      if (!r.check_in_id) continue;
      const list = map.get(r.check_in_id) ?? [];
      list.push(r.id);
      map.set(r.check_in_id, list);
    }
    return map;
  }

  async completeCheckin(
    checkInId: string,
    rawAnswers: CareCheckInAnswers
  ): Promise<{
    checkIn: CareCheckIn;
    suggestions: CareSuggestion[];
    notifications: CareNotification[];
  }> {
    const { data: row, error } = await this.client
      .from("care_check_ins")
      .select("*")
      .eq("id", checkInId)
      .maybeSingle();

    if (error || !row) throw new CareOwnershipError();
    const checkInRow = row as CareCheckInRow;
    assertOwner(checkInRow.user_id, this.userId);

    if (checkInRow.status === "completed") {
      const suggestions = await this.getSuggestions({ checkInId });
      const notifications = await this.getNotifications();
      return {
        checkIn: mapCheckInRowToDomain(checkInRow, suggestions.map((s) => s.id)),
        suggestions,
        notifications: notifications.filter((n) => n.relatedCheckInId === checkInId),
      };
    }

    const answers: CareCheckInAnswers = {
      ...rawAnswers,
      freeMemo: sanitizeMemo(rawAnswers.freeMemo),
    };

    const previous = await this.loadPreviousAnswers(
      checkInRow.analysis_session_id,
      checkInRow.day
    );
    const deltas = computeProgressDeltas(previous, answers);
    const referral = evaluateDermatologyReferral(answers, {
      daysSinceStart: checkInRow.day,
      worsening: deltas.some((d) => d.trend === "worsened"),
    });

    const routine = checkInRow.routine_id
      ? await this.getRoutineById(checkInRow.routine_id)
      : await this.getActiveRoutine();

    const checkInDomain = mapCheckInRowToDomain(checkInRow);
    const builtSuggestions = buildRoutineSuggestions({
      checkIn: checkInDomain,
      answers,
      deltas,
      routine,
    });

    const now = new Date().toISOString();
    const progressSummary = buildProgressSummaryPayload(deltas);

    const { error: upErr } = await this.client
      .from("care_check_ins")
      .update({
        status: "completed",
        completed_at: now,
        answers,
        progress_summary: progressSummary,
        referral_level: referral.level,
        referral_reasons: referral.reasons,
        updated_at: now,
      })
      .eq("id", checkInId);

    if (upErr) {
      throw new CareApiError(500, "COMPLETE_FAILED", "체크인 완료 처리에 실패했습니다.");
    }

    const suggestions = await this.createRoutineSuggestions(
      builtSuggestions,
      checkInId,
      routine?.id ?? null
    );

    await this.writeProgressSnapshot({
      routineId: routine?.id ?? null,
      checkInId,
      deltas,
      answers,
    });

    const notifications: CareNotification[] = [];
    if (referral.level !== "none") {
      const notif = await this.createNotification({
        kind: "referral",
        title: "전문가 상담 안내",
        message: referral.userMessage,
        relatedCheckInId: checkInId,
        fingerprint: `referral|${checkInId}|${referral.level}`,
        notificationType: "referral",
        checkInId,
      });
      notifications.push(notif);
    }

    logCareEvent("checkin_completed");
    const updated = mapCheckInRowToDomain(
      { ...checkInRow, status: "completed", completed_at: now, answers, progress_summary: progressSummary, referral_level: referral.level },
      suggestions.map((s) => s.id)
    );

    return { checkIn: updated, suggestions, notifications };
  }

  async skipCheckin(checkInId: string): Promise<CareCheckIn> {
    const { data: row, error } = await this.client
      .from("care_check_ins")
      .select("*")
      .eq("id", checkInId)
      .maybeSingle();

    if (error || !row) throw new CareOwnershipError();
    const checkInRow = row as CareCheckInRow;
    assertOwner(checkInRow.user_id, this.userId);

    if (checkInRow.status === "skipped" || checkInRow.status === "completed") {
      return mapCheckInRowToDomain(checkInRow);
    }

    const now = new Date().toISOString();
    await this.client
      .from("care_check_ins")
      .update({ status: "skipped", updated_at: now })
      .eq("id", checkInId);

    logCareEvent("checkin_skipped");
    return mapCheckInRowToDomain({ ...checkInRow, status: "skipped" });
  }

  private async loadPreviousAnswers(
    sessionId: string,
    currentDay: number
  ): Promise<CareCheckInAnswers | null> {
    const { data } = await this.client
      .from("care_check_ins")
      .select("day, answers, status")
      .eq("analysis_session_id", sessionId)
      .eq("user_id", this.userId)
      .eq("status", "completed")
      .lt("day", currentDay)
      .order("day", { ascending: false })
      .limit(1);

    const prev = data?.[0] as { answers: CareCheckInAnswers | null } | undefined;
    return prev?.answers ?? null;
  }

  private async getRoutineById(routineId: string): Promise<CareRoutine | null> {
    const { data: routine } = await this.client
      .from("care_routines")
      .select("*")
      .eq("id", routineId)
      .maybeSingle();

    if (!routine) return null;
    assertOwner((routine as CareRoutineRow).user_id, this.userId);

    const { data: items } = await this.client
      .from("care_routine_items")
      .select("*")
      .eq("routine_id", routineId);

    return mapRoutineRowToDomain(routine as CareRoutineRow, (items ?? []) as CareRoutineItemRow[]);
  }

  async createRoutineSuggestions(
    suggestions: CareSuggestion[],
    checkInId: string,
    routineId: string | null
  ): Promise<CareSuggestion[]> {
    if (!suggestions.length) return [];

    const rows = suggestions.map((s) => ({
      id: randomUUID(),
      user_id: this.userId,
      routine_id: routineId,
      check_in_id: checkInId,
      suggestion_type: "general",
      title: s.title,
      reason: s.reason,
      expected_effect: s.expectedEffect,
      proposed_changes: {},
      patch: s.patch,
      requires_user_confirm: true,
      status: "pending",
      applied: false,
      created_at: s.createdAt,
      updated_at: s.createdAt,
    }));

    const { data, error } = await this.client
      .from("care_suggestions")
      .insert(rows)
      .select("*");

    if (error) {
      throw new CareApiError(500, "SUGGESTION_FAILED", "제안 저장에 실패했습니다.");
    }

    logCareEvent("suggestions_created", rows.length);
    return (data as CareSuggestionRow[]).map(mapSuggestionRowToDomain);
  }

  async acceptRoutineSuggestion(suggestionId: string): Promise<{
    suggestion: CareSuggestion;
    routine: CareRoutine;
  }> {
    const { data: sug, error } = await this.client
      .from("care_suggestions")
      .select("*")
      .eq("id", suggestionId)
      .maybeSingle();

    if (error || !sug) throw new CareOwnershipError();
    const sugRow = sug as CareSuggestionRow;
    assertOwner(sugRow.user_id, this.userId);

    if (sugRow.status !== "pending") {
      throw new CareApiError(400, "INVALID_STATE", "이미 처리된 제안입니다.");
    }

    const routineId = sugRow.routine_id;
    if (!routineId) {
      throw new CareApiError(400, "NO_ROUTINE", "연결된 루틴이 없습니다.");
    }

    const routine = await this.getRoutineById(routineId);
    if (!routine) throw new CareOwnershipError();

    const suggestion = mapSuggestionRowToDomain(sugRow);
    const patched = applySuggestionToRoutine(routine, suggestion);
    const newRoutine = await this.createRoutineVersion({
      routineId,
      items: patched.items,
      conflictNotes: patched.conflictNotes,
    });

    const now = new Date().toISOString();
    await this.client
      .from("care_suggestions")
      .update({
        status: "accepted",
        applied: true,
        accepted_at: now,
        updated_at: now,
      })
      .eq("id", suggestionId);

    logCareEvent("suggestion_accepted");
    return {
      suggestion: { ...suggestion, applied: true },
      routine: newRoutine,
    };
  }

  async dismissRoutineSuggestion(suggestionId: string): Promise<CareSuggestion> {
    const { data: sug, error } = await this.client
      .from("care_suggestions")
      .select("*")
      .eq("id", suggestionId)
      .maybeSingle();

    if (error || !sug) throw new CareOwnershipError();
    const sugRow = sug as CareSuggestionRow;
    assertOwner(sugRow.user_id, this.userId);

    const now = new Date().toISOString();
    await this.client
      .from("care_suggestions")
      .update({ status: "dismissed", updated_at: now })
      .eq("id", suggestionId);

    logCareEvent("suggestion_dismissed");
    return mapSuggestionRowToDomain({ ...sugRow, status: "dismissed" });
  }

  async getSuggestions(opts?: {
    checkInId?: string;
    status?: string;
  }): Promise<CareSuggestion[]> {
    let q = this.client
      .from("care_suggestions")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    if (opts?.checkInId) q = q.eq("check_in_id", opts.checkInId);
    if (opts?.status) q = q.eq("status", opts.status);

    const { data, error } = await q;
    if (error) throw new CareApiError(500, "LOAD_FAILED", "제안을 불러오지 못했습니다.");
    return (data as CareSuggestionRow[]).map(mapSuggestionRowToDomain);
  }

  async createNotification(input: {
    kind: CareNotification["kind"];
    title: string;
    message: string;
    fingerprint: string;
    notificationType: string;
    relatedCheckInId?: string | null;
    checkInId?: string | null;
    dueAt?: string | null;
  }): Promise<CareNotification> {
    const row = {
      id: randomUUID(),
      user_id: this.userId,
      check_in_id: input.checkInId ?? input.relatedCheckInId ?? null,
      notification_type: input.notificationType,
      kind: input.kind,
      title: input.title,
      message: input.message,
      related_check_in_id: input.relatedCheckInId ?? null,
      fingerprint: input.fingerprint,
      status: "unread",
      read: false,
      due_at: input.dueAt ?? null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await this.client
      .from("care_notifications")
      .upsert(row, { onConflict: "fingerprint", ignoreDuplicates: true })
      .select("*")
      .maybeSingle();

    if (error && error.code !== "23505") {
      throw new CareApiError(500, "NOTIFICATION_FAILED", "알림 저장에 실패했습니다.");
    }

    if (data) {
      return mapNotificationRowToDomain(data as CareNotificationRow);
    }

    const { data: existing } = await this.client
      .from("care_notifications")
      .select("*")
      .eq("fingerprint", input.fingerprint)
      .maybeSingle();

    return mapNotificationRowToDomain((existing ?? row) as CareNotificationRow);
  }

  async markNotificationRead(notificationId: string): Promise<CareNotification> {
    const { data: row, error } = await this.client
      .from("care_notifications")
      .select("*")
      .eq("id", notificationId)
      .maybeSingle();

    if (error || !row) throw new CareOwnershipError();
    const notifRow = row as CareNotificationRow;
    assertOwner(notifRow.user_id, this.userId);

    const now = new Date().toISOString();
    await this.client
      .from("care_notifications")
      .update({
        read: true,
        status: "read",
        read_at: now,
      })
      .eq("id", notificationId);

    return mapNotificationRowToDomain({
      ...notifRow,
      read: true,
      status: "read",
      read_at: now,
    });
  }

  async getNotifications(): Promise<CareNotification[]> {
    const { data, error } = await this.client
      .from("care_notifications")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    if (error) throw new CareApiError(500, "LOAD_FAILED", "알림을 불러오지 못했습니다.");
    return (data as CareNotificationRow[]).map(mapNotificationRowToDomain);
  }

  async saveFeedback(input: SaveFeedbackInput): Promise<CareFeedback> {
    const row = {
      id: randomUUID(),
      user_id: this.userId,
      product_id: input.productId ? Number(input.productId) || null : null,
      routine_item_id: input.routineItemId ?? null,
      check_in_id: input.checkInId ?? null,
      used: input.used ?? null,
      purchased: input.purchased ?? null,
      satisfaction: input.satisfaction ?? null,
      irritation: input.irritation ?? null,
      stop_reason: input.stopReason ?? null,
      repurchase_intent: input.repurchaseIntent ?? null,
      concern_change: input.concernChange ?? null,
      concern_changes: {},
      created_at: new Date().toISOString(),
    };

    const { data, error } = await this.client
      .from("care_feedback")
      .insert(row)
      .select("*")
      .single();

    if (error) {
      throw new CareApiError(500, "FEEDBACK_FAILED", "피드백 저장에 실패했습니다.");
    }

    logCareEvent("feedback_saved");
    const r = data as { id: string; created_at: string; product_id: number | null };
    return {
      id: r.id,
      createdAt: r.created_at,
      productId: r.product_id != null ? String(r.product_id) : null,
      used: input.used ?? null,
      purchased: input.purchased ?? null,
      satisfaction: input.satisfaction ?? null,
      irritation: input.irritation ?? null,
      stopReason: input.stopReason ?? null,
      repurchaseIntent: input.repurchaseIntent ?? null,
      concernChange: input.concernChange ?? null,
    };
  }

  private async writeProgressSnapshot(input: {
    routineId: string | null;
    checkInId: string;
    deltas: ReturnType<typeof computeProgressDeltas>;
    answers: CareCheckInAnswers;
  }): Promise<void> {
    const primary = input.deltas[0];
    await this.client.from("care_progress_snapshots").insert({
      id: randomUUID(),
      user_id: this.userId,
      routine_id: input.routineId,
      check_in_id: input.checkInId,
      dryness: input.answers.dryness,
      oiliness: input.answers.oiliness,
      redness: input.answers.redness,
      breakouts: input.answers.breakouts,
      sensitivity: input.answers.sting,
      texture: input.answers.peeling,
      satisfaction: input.answers.satisfaction,
      adherence: input.answers.adherence,
      comparison_status: primary?.trend ?? "insufficient_data",
      metrics: { deltas: input.deltas },
      created_at: new Date().toISOString(),
    });
    logCareEvent("progress_snapshot_written");
  }

  async getProgressSummary(): Promise<CareProgressSummaryDTO> {
    const checkIns = await this.getCheckins();
    const deltas = summarizeProgress(checkIns);

    const { count } = await this.client
      .from("care_progress_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("user_id", this.userId);

    return { deltas, snapshots: count ?? 0 };
  }

  async getCareDashboard(): Promise<CareDashboardDTO> {
    const [sessions, activeRoutine, checkIns, suggestions, notifications] =
      await Promise.all([
        this.getAnalysisSessions(),
        this.getActiveRoutine(),
        this.getCheckins(),
        this.getSuggestions({ status: "pending" }),
        this.getNotifications(),
      ]);

    const progressSummary = summarizeProgress(checkIns);
    const unreadNotifications = notifications.filter((n) => !n.read).length;
    const nextDue = nextDueCheckIn(checkIns);
    const timezone =
      activeRoutine?.timezone ?? sessions[0]?.timezone ?? "Asia/Seoul";

    return {
      linkedAccount: sessions.some((s) => s.linkedAccount) || sessions.length > 0,
      source: "server",
      sessions,
      activeRoutine,
      checkIns,
      suggestions,
      notifications,
      progressSummary,
      unreadNotifications,
      nextDueCheckIn: nextDue,
      settings: defaultSettings(timezone),
    };
  }
}

export async function createCarePersistence(): Promise<CarePersistence | null> {
  const auth = await getCareAuthUser();
  if (!auth) return null;
  await ensureCareProfile(auth.userId);
  const client = await createSupabaseServerClient();
  return new CarePersistence(client, auth.userId);
}

export async function requireCarePersistence(): Promise<CarePersistence> {
  const persistence = await createCarePersistence();
  if (!persistence) {
    throw new CareApiError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }
  return persistence;
}
