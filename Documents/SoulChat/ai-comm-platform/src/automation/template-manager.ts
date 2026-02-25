import type { MessageTemplate } from '../types/automation';
import { MemoryStore } from '../conversation/memory-store';
import logger from '../services/logger';

export class TemplateManager {
  private templates = new MemoryStore<MessageTemplate>();

  createTemplate(name: string, content: string, variables?: string[], channel?: string): MessageTemplate {
    // Extract variables from content if not provided
    const vars = variables || this.extractVariables(content);

    const template: MessageTemplate = {
      id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      content,
      variables: vars,
      channel,
      approvalStatus: channel === 'whatsapp' ? 'pending' : 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.templates.create(template);
    logger.info(`Template created: ${name} (${vars.length} variables)`);
    return template;
  }

  getTemplate(id: string): MessageTemplate | undefined {
    return this.templates.get(id);
  }

  getTemplateByName(name: string): MessageTemplate | undefined {
    return this.templates.find(t => t.name === name)[0];
  }

  getAllTemplates(): MessageTemplate[] {
    return this.templates.getAll();
  }

  updateTemplate(id: string, updates: Partial<MessageTemplate>): MessageTemplate {
    const existing = this.templates.get(id);
    if (!existing) throw new Error(`Template not found: ${id}`);

    const updated: Partial<MessageTemplate> = { ...updates, updatedAt: new Date() };
    if (updates.content) {
      updated.variables = updates.variables || this.extractVariables(updates.content);
    }

    return this.templates.update(id, updated);
  }

  deleteTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  renderTemplate(nameOrId: string, context: Record<string, any>): string {
    let template = this.templates.get(nameOrId);
    if (!template) {
      template = this.getTemplateByName(nameOrId);
    }
    if (!template) {
      throw new Error(`Template not found: ${nameOrId}`);
    }

    let rendered = template.content;
    for (const variable of template.variables) {
      const value = context[variable] ?? '';
      rendered = rendered.replace(new RegExp(`\\{${variable}\\}`, 'g'), String(value));
    }

    return rendered;
  }

  updateApprovalStatus(id: string, status: 'pending' | 'approved' | 'rejected'): MessageTemplate {
    const template = this.templates.get(id);
    if (!template) throw new Error(`Template not found: ${id}`);

    template.approvalStatus = status;
    template.updatedAt = new Date();
    return this.templates.update(id, template);
  }

  private extractVariables(content: string): string[] {
    const matches = content.match(/\{(\w+)\}/g) || [];
    return [...new Set(matches.map(m => m.slice(1, -1)))];
  }
}
