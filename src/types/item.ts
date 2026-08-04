import type { UpdateItemField } from "@/lib/item-schemas";
import type { ItemDetailViewModel } from "./view-models";

/**
 * What the item mutations hand back. A discriminated union rather than one optional-everything
 * object, so a caller that has checked `success` gets `data` without a second null check.
 *
 * Lives here rather than beside the action for the same reason `AccountActionState` does: a
 * `"use server"` module may only export async functions.
 */
export type UpdateItemResult =
    | { success: true; data: ItemDetailViewModel }
    | {
          success: false;
          error: string;
          /** Per-field validation messages, so the drawer can mark the input that was rejected. */
          fields?: Partial<Record<UpdateItemField, string>>;
      };
