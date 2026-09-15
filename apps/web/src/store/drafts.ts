import { newOpId, type Priority } from "@offlinear/shared";
import { db, type Draft } from "@/db/db";

export interface DraftInput {
  title: string;
  description: string;
  stateId: string | null;
  priority: Priority;
  assigneeId: string | null;
  labelIds: string[];
}

/** Create or update a draft. Returns its id. */
export async function saveDraft(input: DraftInput, id?: string): Promise<string> {
  const draftId = id ?? newOpId();
  await db.drafts.put({ ...input, id: draftId, updatedAt: new Date().toISOString() });
  return draftId;
}

export async function deleteDraft(id: string): Promise<void> {
  await db.drafts.delete(id);
}

export const getDraft = (id: string): Promise<Draft | undefined> => db.drafts.get(id);
