export type FlowTrigger =
  | 'message_received'
  | 'keyword_detected'
  | 'tag_added'
  | 'conversation_started'
  | 'conversation_closed'
  | 'scheduled'
  | 'contact_created'
  | 'handoff_resolved'
  | 'custom_webhook';

export type FlowConditionOperator = 'equals' | 'contains' | 'gt' | 'lt' | 'exists';

export interface FlowCondition {
  field: string;
  operator: FlowConditionOperator;
  value: unknown;
}

export type FlowActionType =
  | 'send_message'
  | 'add_tag'
  | 'remove_tag'
  | 'assign_agent'
  | 'wait'
  | 'webhook'
  | 'update_contact'
  | 'start_conversation'
  | 'close_conversation'
  | 'send_image';

export interface FlowAction {
  type: FlowActionType;
  config: Record<string, any>;
}

export interface FlowStep {
  id: string;
  action: FlowAction;
  conditions?: FlowCondition[];
  nextStepId?: string;
}

export interface Flow {
  id: string;
  name: string;
  description?: string;
  trigger: FlowTrigger;
  triggerConfig: Record<string, any>;
  steps: FlowStep[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FlowExecution {
  id: string;
  flowId: string;
  conversationId?: string;
  contactId?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  currentStepId?: string;
  context: Record<string, any>;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface Broadcast {
  id: string;
  name: string;
  messageContent: string;
  messageType: string;
  targetFilter: Record<string, any>;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'cancelled';
  scheduledFor?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  variables: string[];
  channel?: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}
