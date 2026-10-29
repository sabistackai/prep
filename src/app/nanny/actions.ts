"use server";

import { revalidatePath } from "next/cache";
import { requireNanny } from "@/lib/auth";

export async function completeTask(formData: FormData) {
  const { supabase } = await requireNanny();
  await supabase.rpc("complete_task", { p_task_id: String(formData.get("id")) });
  revalidatePath("/nanny", "layout");
}
