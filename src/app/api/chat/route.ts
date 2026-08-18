import { createAgentUIStreamResponse } from "ai";
import { auth } from "@/auth";
import { createLedgerAgent } from "@/lib/assistant/agent";

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages } = await request.json();
  const today = new Date().toISOString().slice(0, 10);
  const agent = createLedgerAgent(Number(userId), today);

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
  });
}
