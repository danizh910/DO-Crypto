export type AgentLevel = 1 | 2 | 3;
export type AgentStatus = "active" | "idle" | "error";

export interface Agent {
  id: string;
  name: string;
  level: AgentLevel;
  role: string;
  description: string;
  systemPrompt: string;
  color: string;      // Tailwind token name
  avatar: string;     // initials
  currentTask?: string;
  status: AgentStatus;
}

export interface AgentLog {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_level: AgentLevel;
  action: string;
  status: "running" | "completed" | "error";
  metadata?: Record<string, unknown>;
  created_at: string;
}
