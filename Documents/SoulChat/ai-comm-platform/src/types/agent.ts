import { AgentType } from './conversation';

export type AgentAction =
  | 'send_message'
  | 'add_tag'
  | 'book_trial_meeting'
  | 'escalate'
  | 'close_conversation'
  | 'update_contact'
  | 'pause_ai'
  | 'resume_ai'
  | 'transfer_to_human';

export interface AgentResponse {
  message: string;
  action?: AgentAction;
  shouldHandoff: boolean;
  handoffReason?: string;
  confidence: number;
  suggestedAgent?: AgentType;
}
