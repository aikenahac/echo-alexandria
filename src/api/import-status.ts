import { db } from "../db";
import { importJobs } from "../db/schema";
import { desc, eq } from "drizzle-orm";

export interface ImportJobStatus {
  id: string | null;
  type: string;
  status: "idle" | "running" | "completed" | "failed";
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  progressPercentage: number;
}

export async function getLatestImportJob(
  type: "works" | "editions" | "authors"
): Promise<ImportJobStatus> {
  try {
    // Get the most recent job for this type
    const latestJob = await db.query.importJobs.findFirst({
      where: eq(importJobs.type, type),
      orderBy: [desc(importJobs.startedAt)],
    });

    if (!latestJob) {
      return {
        id: null,
        type,
        status: "idle",
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        error: null,
        startedAt: null,
        completedAt: null,
        progressPercentage: 0,
      };
    }

    // Calculate progress percentage if we know the total records
    // For now, we'll use a simple heuristic based on processing time
    let progressPercentage = 0;
    if (latestJob.status === "completed") {
      progressPercentage = 100;
    } else if (latestJob.status === "running") {
      // Estimate progress based on records processed
      // This is a rough estimate - we'd need total record counts for accuracy
      progressPercentage = Math.min(
        99,
        Math.floor((latestJob.recordsProcessed / 1000000) * 100)
      );
    }

    return {
      id: latestJob.id,
      type: latestJob.type,
      status: latestJob.status as "idle" | "running" | "completed" | "failed",
      recordsProcessed: latestJob.recordsProcessed,
      recordsInserted: latestJob.recordsInserted,
      recordsUpdated: latestJob.recordsUpdated,
      error: latestJob.error,
      startedAt: latestJob.startedAt,
      completedAt: latestJob.completedAt,
      progressPercentage,
    };
  } catch (error) {
    console.error(`Error fetching import job status for ${type}:`, error);
    return {
      id: null,
      type,
      status: "idle",
      recordsProcessed: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      error: "Failed to fetch status",
      startedAt: null,
      completedAt: null,
      progressPercentage: 0,
    };
  }
}
