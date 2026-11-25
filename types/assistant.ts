export interface RagSource {
  title: string;
  category: string;
  similarity: number;
}

export interface AssistantResponse {
  transcript: string;
  intent:
    | "save_schedule"
    | "save_idea"
    | "generate_workout"
    | "log_meal"
    | "open_app"
    | "daily_briefing"
    | "general_chat";
  detectedLang?: "id" | "en" | "ar";
  taskTitle?: string;
  scheduleTime?: string;
  isoDateTime?: string;
  ideaTitle?: string;
  ideaContent?: string;
  workoutGoal?: string;
  mealDescription?: string;
  targetApp?: string;
  replyMessage: string;
  spokenText?: string;
  sources?: RagSource[];
  handledByServerTools?: boolean;
  actions?: string[];
  refreshTargets?: Array<"schedules" | "ideas" | "wellness" | "rag">;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  spokenText?: string;
  intent?: string;
  sources?: RagSource[];
  actions?: string[];
  timestamp: string;
}

export interface ScheduleItem {
  id: number;
  title: string;
  schedule_time: string;
  target_datetime?: string;
  is_done: boolean;
  reminded?: boolean;
}

export interface IdeaItem {
  id: number;
  title: string;
  content: string;
  ai_expansion?: string | null;
  created_at: string;
}

export interface KnowledgeDocItem {
  title: string;
  category: string;
  preview: string;
  chunkCount: number;
  created_at: string;
}

export interface GlobalSearchResult {
  schedules: { id: number; title: string; schedule_time: string; is_done: boolean }[];
  ideas: { id: number; title: string; content: string; created_at: string }[];
  knowledge: { id: number; title: string; category: string; snippet: string }[];
}
