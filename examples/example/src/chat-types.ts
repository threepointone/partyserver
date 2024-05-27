import { literal, object, string } from "valibot";

import type { Output } from "valibot";

export const chatMessage = object({
  type: literal("chat-message"),
  id: string(),
  content: string(),
  sender: string()
});

export type ChatMessage = Output<typeof chatMessage>;
