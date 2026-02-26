import { SupabaseClient } from '@supabase/supabase-js';
import logger from './logger';

// Window durations
const ORGANIC_WINDOW_HOURS = 24;
const CTWA_WINDOW_HOURS = 72; // Click-to-WhatsApp ads

export type EntryPoint = 'organic' | 'ctwa_ad' | 'fb_cta';

export interface WindowStatus {
  isOpen: boolean;
  start: Date | null;
  expires: Date | null;
  remainingSeconds: number;
  entryPoint: EntryPoint;
}

export class ServiceWindowManager {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * Open a service window when a customer sends a message.
   */
  async openWindow(conversationId: string, entryPoint: EntryPoint = 'organic'): Promise<WindowStatus> {
    const now = new Date();
    const hours = entryPoint === 'ctwa_ad' || entryPoint === 'fb_cta' ? CTWA_WINDOW_HOURS : ORGANIC_WINDOW_HOURS;
    const expires = new Date(now.getTime() + hours * 60 * 60 * 1000);

    await this.client
      .from('conversations')
      .update({
        service_window_start: now.toISOString(),
        service_window_expires: expires.toISOString(),
        entry_point: entryPoint,
      })
      .eq('id', conversationId);

    logger.info(`Service window opened for ${conversationId}: ${hours}h (${entryPoint})`);

    return {
      isOpen: true,
      start: now,
      expires,
      remainingSeconds: hours * 60 * 60,
      entryPoint,
    };
  }

  /**
   * Refresh (extend) window on new customer message.
   */
  async refreshWindow(conversationId: string): Promise<WindowStatus> {
    // Get current window to preserve entry_point
    const { data } = await this.client
      .from('conversations')
      .select('entry_point, service_window_start')
      .eq('id', conversationId)
      .single();

    const entryPoint = (data?.entry_point as EntryPoint) || 'organic';
    return this.openWindow(conversationId, entryPoint);
  }

  /**
   * Check if the service window is currently open.
   */
  async isWindowOpen(conversationId: string): Promise<WindowStatus> {
    const { data, error } = await this.client
      .from('conversations')
      .select('service_window_start, service_window_expires, entry_point')
      .eq('id', conversationId)
      .single();

    if (error || !data?.service_window_expires) {
      return { isOpen: false, start: null, expires: null, remainingSeconds: 0, entryPoint: 'organic' };
    }

    const now = new Date();
    const expires = new Date(data.service_window_expires);
    const start = data.service_window_start ? new Date(data.service_window_start) : null;
    const remainingMs = expires.getTime() - now.getTime();
    const isOpen = remainingMs > 0;

    return {
      isOpen,
      start,
      expires,
      remainingSeconds: isOpen ? Math.floor(remainingMs / 1000) : 0,
      entryPoint: (data.entry_point as EntryPoint) || 'organic',
    };
  }

  /**
   * Can we send a free-form (non-template) message?
   */
  async canSendFreeForm(conversationId: string): Promise<boolean> {
    const status = await this.isWindowOpen(conversationId);
    return status.isOpen;
  }

  /**
   * Do we need to use a template message?
   */
  async requiresTemplate(conversationId: string): Promise<boolean> {
    const canFreeForm = await this.canSendFreeForm(conversationId);
    return !canFreeForm;
  }
}
