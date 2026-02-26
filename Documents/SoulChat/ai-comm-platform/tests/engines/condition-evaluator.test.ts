import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConditionEvaluator } from '../../src/engines/condition-evaluator';

describe('ConditionEvaluator', () => {
  let evaluator: ConditionEvaluator;

  beforeEach(() => {
    evaluator = new ConditionEvaluator();
  });

  describe('structured conditions', () => {
    it('evaluates "field contains value"', () => {
      const ctx = { message: 'Hello World' };
      expect(evaluator.evaluate('message contains hello', ctx)).toBe(true);
      expect(evaluator.evaluate('message contains goodbye', ctx)).toBe(false);
    });

    it('evaluates "field includes value" (alias for contains)', () => {
      const ctx = { name: 'John Doe' };
      expect(evaluator.evaluate('name includes john', ctx)).toBe(true);
    });

    it('evaluates "field equals value"', () => {
      const ctx = { status: 'active' };
      expect(evaluator.evaluate('status equals active', ctx)).toBe(true);
      expect(evaluator.evaluate('status equals inactive', ctx)).toBe(false);
    });

    it('evaluates "field == value"', () => {
      const ctx = { channel: 'whatsapp' };
      expect(evaluator.evaluate('channel == whatsapp', ctx)).toBe(true);
      expect(evaluator.evaluate('channel == telegram', ctx)).toBe(false);
    });

    it('evaluates "field = value"', () => {
      const ctx = { type: 'premium' };
      expect(evaluator.evaluate('type = premium', ctx)).toBe(true);
    });

    it('evaluates "field > value" (greaterThan)', () => {
      const ctx = { score: 85 };
      expect(evaluator.evaluate('score > 50', ctx)).toBe(true);
      expect(evaluator.evaluate('score > 90', ctx)).toBe(false);
      expect(evaluator.evaluate('score greaterThan 50', ctx)).toBe(true);
    });

    it('evaluates "field < value" (lessThan)', () => {
      const ctx = { age: 25 };
      expect(evaluator.evaluate('age < 30', ctx)).toBe(true);
      expect(evaluator.evaluate('age < 20', ctx)).toBe(false);
      expect(evaluator.evaluate('age lessThan 30', ctx)).toBe(true);
    });

    it('evaluates "field startsWith value"', () => {
      const ctx = { email: 'john@example.com' };
      expect(evaluator.evaluate('email startsWith john', ctx)).toBe(true);
      expect(evaluator.evaluate('email startsWith jane', ctx)).toBe(false);
    });

    it('evaluates "field endsWith value"', () => {
      const ctx = { email: 'john@example.com' };
      expect(evaluator.evaluate('email endsWith example.com', ctx)).toBe(true);
      expect(evaluator.evaluate('email endsWith gmail.com', ctx)).toBe(false);
    });
  });

  describe('simple conditions', () => {
    it('evaluates true/false literals', () => {
      expect(evaluator.evaluate('true', {})).toBe(true);
      expect(evaluator.evaluate('True', {})).toBe(true);
      expect(evaluator.evaluate('1', {})).toBe(true);
      expect(evaluator.evaluate('false', {})).toBe(false);
      expect(evaluator.evaluate('False', {})).toBe(false);
      expect(evaluator.evaluate('0', {})).toBe(false);
    });

    it('evaluates hasTag: condition', () => {
      const ctx = { tags: ['vip', 'premium', 'early-adopter'] };
      expect(evaluator.evaluate('hasTag:vip', ctx)).toBe(true);
      expect(evaluator.evaluate('hasTag:VIP', ctx)).toBe(true); // case insensitive
      expect(evaluator.evaluate('hasTag:basic', ctx)).toBe(false);
    });

    it('evaluates hasTag: with no tags in context', () => {
      expect(evaluator.evaluate('hasTag:vip', {})).toBe(false);
    });

    it('evaluates channel: condition', () => {
      const ctx = { channel: 'whatsapp' };
      expect(evaluator.evaluate('channel:whatsapp', ctx)).toBe(true);
      expect(evaluator.evaluate('channel:WhatsApp', ctx)).toBe(true); // case insensitive
      expect(evaluator.evaluate('channel:telegram', ctx)).toBe(false);
    });

    it('evaluates channel: with no channel in context', () => {
      expect(evaluator.evaluate('channel:whatsapp', {})).toBe(false);
    });

    it('evaluates windowOpen condition', () => {
      expect(evaluator.evaluate('windowOpen', { windowOpen: true })).toBe(true);
      expect(evaluator.evaluate('windowOpen', { windowOpen: false })).toBe(false);
    });

    it('evaluates windowClosed condition', () => {
      expect(evaluator.evaluate('windowClosed', { windowOpen: false })).toBe(true);
      expect(evaluator.evaluate('windowClosed', { windowOpen: true })).toBe(false);
    });

    it('evaluates sentiment: condition', () => {
      const ctx = { sentiment: 'positive' };
      expect(evaluator.evaluate('sentiment:positive', ctx)).toBe(true);
      expect(evaluator.evaluate('sentiment:negative', ctx)).toBe(false);
    });

    it('evaluates timeOfDay: morning (6-12)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 1, 26, 9, 0, 0));

      expect(evaluator.evaluate('timeOfDay:morning', {})).toBe(true);
      expect(evaluator.evaluate('timeOfDay:afternoon', {})).toBe(false);

      vi.useRealTimers();
    });

    it('evaluates timeOfDay: afternoon (12-17)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 1, 26, 14, 0, 0));

      expect(evaluator.evaluate('timeOfDay:afternoon', {})).toBe(true);
      expect(evaluator.evaluate('timeOfDay:morning', {})).toBe(false);

      vi.useRealTimers();
    });

    it('evaluates timeOfDay: evening (17-22)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 1, 26, 19, 0, 0));

      expect(evaluator.evaluate('timeOfDay:evening', {})).toBe(true);
      expect(evaluator.evaluate('timeOfDay:afternoon', {})).toBe(false);

      vi.useRealTimers();
    });

    it('evaluates timeOfDay: night (22+ or <6)', () => {
      vi.useFakeTimers();

      vi.setSystemTime(new Date(2026, 1, 26, 23, 0, 0));
      expect(evaluator.evaluate('timeOfDay:night', {})).toBe(true);
      expect(evaluator.evaluate('timeOfDay:evening', {})).toBe(false);

      vi.setSystemTime(new Date(2026, 1, 26, 3, 0, 0));
      expect(evaluator.evaluate('timeOfDay:night', {})).toBe(true);

      vi.useRealTimers();
    });

    it('evaluates truthy context field names', () => {
      expect(evaluator.evaluate('isVip', { isVip: true })).toBe(true);
      expect(evaluator.evaluate('isVip', { isVip: false })).toBe(false);
      expect(evaluator.evaluate('isVip', { isVip: 'yes' })).toBe(true);
      expect(evaluator.evaluate('isVip', { isVip: '' })).toBe(false);
      expect(evaluator.evaluate('isVip', { isVip: 0 })).toBe(false);
    });

    it('returns false for unknown expressions', () => {
      expect(evaluator.evaluate('somethingRandom', {})).toBe(false);
    });
  });

  describe('dot notation field resolution', () => {
    it('resolves nested fields', () => {
      const ctx = { contact: { name: 'David', score: 90 } };
      expect(evaluator.evaluate('contact.name equals david', ctx)).toBe(true);
      expect(evaluator.evaluate('contact.score > 80', ctx)).toBe(true);
    });

    it('resolves deeply nested fields', () => {
      const ctx = { user: { profile: { tier: 'gold' } } };
      expect(evaluator.evaluate('user.profile.tier equals gold', ctx)).toBe(true);
    });

    it('returns false for missing nested fields', () => {
      const ctx = { contact: { name: 'David' } };
      expect(evaluator.evaluate('contact.email contains @', ctx)).toBe(false);
    });

    it('returns false for missing intermediate fields', () => {
      expect(evaluator.evaluate('contact.name equals David', {})).toBe(false);
    });
  });
});
