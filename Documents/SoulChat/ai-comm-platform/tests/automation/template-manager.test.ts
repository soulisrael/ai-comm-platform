import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateManager } from '../../src/automation/template-manager';

describe('TemplateManager', () => {
  let manager: TemplateManager;

  beforeEach(() => {
    manager = new TemplateManager();
  });

  describe('createTemplate', () => {
    it('creates a template and extracts variables', () => {
      const tpl = manager.createTemplate(
        'welcome',
        'Hello {name}, welcome to {company}!',
      );

      expect(tpl.name).toBe('welcome');
      expect(tpl.variables).toEqual(['name', 'company']);
      expect(tpl.approvalStatus).toBe('approved'); // non-whatsapp default
    });

    it('uses provided variables if given', () => {
      const tpl = manager.createTemplate(
        'custom',
        'Hi {name}',
        ['name', 'extra'],
      );

      expect(tpl.variables).toEqual(['name', 'extra']);
    });

    it('sets WhatsApp templates to pending approval', () => {
      const tpl = manager.createTemplate(
        'wa_welcome',
        'Hello {name}!',
        undefined,
        'whatsapp',
      );

      expect(tpl.approvalStatus).toBe('pending');
    });
  });

  describe('renderTemplate', () => {
    it('replaces variables with context values', () => {
      manager.createTemplate('greet', 'Hello {name}, your order #{orderId} is ready!');

      const rendered = manager.renderTemplate('greet', { name: 'Alice', orderId: '12345' });
      expect(rendered).toBe('Hello Alice, your order #12345 is ready!');
    });

    it('replaces missing variables with empty string', () => {
      manager.createTemplate('partial', 'Hi {name}, your {item} is here');

      const rendered = manager.renderTemplate('partial', { name: 'Bob' });
      expect(rendered).toBe('Hi Bob, your  is here');
    });

    it('handles multiple occurrences of same variable', () => {
      manager.createTemplate('repeat', '{name} said hello. Bye, {name}!');

      const rendered = manager.renderTemplate('repeat', { name: 'Carol' });
      expect(rendered).toBe('Carol said hello. Bye, Carol!');
    });

    it('throws for non-existent template', () => {
      expect(() => manager.renderTemplate('nonexistent', {})).toThrow('not found');
    });

    it('works with template id', () => {
      const tpl = manager.createTemplate('byid', 'Hi {name}');
      const rendered = manager.renderTemplate(tpl.id, { name: 'Dave' });
      expect(rendered).toBe('Hi Dave');
    });
  });

  describe('updateTemplate', () => {
    it('updates content and re-extracts variables', () => {
      const tpl = manager.createTemplate('updatable', 'Hi {name}');
      const updated = manager.updateTemplate(tpl.id, { content: 'Hello {name} from {city}' });

      expect(updated.content).toBe('Hello {name} from {city}');
      expect(updated.variables).toEqual(['name', 'city']);
    });

    it('throws for non-existent template', () => {
      expect(() => manager.updateTemplate('nope', { content: 'x' })).toThrow('not found');
    });
  });

  describe('deleteTemplate', () => {
    it('deletes a template', () => {
      const tpl = manager.createTemplate('deleteme', 'Hi');
      expect(manager.deleteTemplate(tpl.id)).toBe(true);
      expect(manager.getTemplate(tpl.id)).toBeUndefined();
    });
  });

  describe('updateApprovalStatus', () => {
    it('updates approval status', () => {
      const tpl = manager.createTemplate('wa', 'Hi {name}', undefined, 'whatsapp');
      expect(tpl.approvalStatus).toBe('pending');

      const updated = manager.updateApprovalStatus(tpl.id, 'approved');
      expect(updated.approvalStatus).toBe('approved');
    });
  });

  describe('getAllTemplates', () => {
    it('lists all templates', () => {
      manager.createTemplate('t1', 'Hi');
      manager.createTemplate('t2', 'Hello');
      expect(manager.getAllTemplates()).toHaveLength(2);
    });
  });
});
