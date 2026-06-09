import { DefaultChatTransport } from "ai";
import type { SessionConfig, SessionPhase } from "@/lib/session-types";

export type SessionSnapshot = {
  phase: SessionPhase;
  config: SessionConfig | null;
  caseBible: string | null;
};

export function createCaseCoachTransport(getSession: () => SessionSnapshot) {
  return new DefaultChatTransport({
    api: "/api/chat",
    prepareSendMessagesRequest: ({ messages }) => {
      const session = getSession();
      return {
        body: {
          messages,
          phase: session.phase === "setup" ? "case" : session.phase,
          sessionConfig: session.config,
          caseBible: session.caseBible,
        },
      };
    },
  });
}
