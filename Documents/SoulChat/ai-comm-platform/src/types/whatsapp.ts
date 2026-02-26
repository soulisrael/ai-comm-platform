// ─── WhatsApp Config ────────────────────────────────────────────────────────

export type WaConnectionStatus = 'connected' | 'disconnected' | 'error';
export type WaTemplateCategory = 'marketing' | 'utility' | 'authentication';
export type WaTemplateStatus = 'pending' | 'approved' | 'rejected';

export interface WaConfig {
  id: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  verifyToken: string;
  webhookUrl: string | null;
  businessName: string | null;
  status: WaConnectionStatus;
  lastVerifiedAt: Date | null;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WaTemplate {
  id: string;
  templateName: string;
  category: WaTemplateCategory;
  language: string;
  content: string;
  header: Record<string, unknown> | null;
  footer: string | null;
  buttons: Record<string, unknown>[];
  metaStatus: WaTemplateStatus;
  metaTemplateId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceWindow {
  start: Date;
  expires: Date;
  isOpen: boolean;
  entryPoint: 'organic' | 'ctwa_ad' | 'fb_cta';
  remainingSeconds: number;
}
