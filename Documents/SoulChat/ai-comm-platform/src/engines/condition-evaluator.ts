/**
 * Evaluates condition expressions for flow condition nodes.
 * Supports simple expression syntax for non-technical users.
 */
export class ConditionEvaluator {
  /**
   * Evaluate a condition expression against a context object.
   * Returns true/false.
   */
  evaluate(expression: string, context: Record<string, unknown>): boolean {
    // Try structured conditions first
    const structured = this.parseStructured(expression);
    if (structured) return this.evaluateStructured(structured, context);

    // Fallback: simple keyword checks
    return this.evaluateSimple(expression, context);
  }

  private parseStructured(expression: string): { field: string; operator: string; value: string } | null {
    // Patterns: "field contains value", "field equals value", "field > value"
    const patterns = [
      /^(\w[\w.]*)\s+(contains|includes)\s+(.+)$/i,
      /^(\w[\w.]*)\s+(equals|==|=)\s+(.+)$/i,
      /^(\w[\w.]*)\s+(greaterThan|>)\s+(.+)$/i,
      /^(\w[\w.]*)\s+(lessThan|<)\s+(.+)$/i,
      /^(\w[\w.]*)\s+(startsWith)\s+(.+)$/i,
      /^(\w[\w.]*)\s+(endsWith)\s+(.+)$/i,
    ];

    for (const pattern of patterns) {
      const match = expression.match(pattern);
      if (match) {
        return { field: match[1], operator: match[2].toLowerCase(), value: match[3].trim() };
      }
    }
    return null;
  }

  private evaluateStructured(
    cond: { field: string; operator: string; value: string },
    context: Record<string, unknown>,
  ): boolean {
    const fieldValue = this.resolveField(cond.field, context);
    const strValue = String(fieldValue ?? '').toLowerCase();
    const compareValue = cond.value.toLowerCase();

    switch (cond.operator) {
      case 'contains':
      case 'includes':
        return strValue.includes(compareValue);
      case 'equals':
      case '==':
      case '=':
        return strValue === compareValue;
      case 'greaterthan':
      case '>':
        return Number(fieldValue) > Number(cond.value);
      case 'lessthan':
      case '<':
        return Number(fieldValue) < Number(cond.value);
      case 'startswith':
        return strValue.startsWith(compareValue);
      case 'endswith':
        return strValue.endsWith(compareValue);
      default:
        return false;
    }
  }

  private evaluateSimple(expression: string, context: Record<string, unknown>): boolean {
    const lower = expression.toLowerCase();

    // Built-in conditions
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;

    // Check common patterns
    if (lower.startsWith('hastag:')) {
      const tag = lower.slice(7).trim();
      const tags = (context.tags as string[]) || [];
      return tags.some(t => t.toLowerCase() === tag);
    }

    if (lower.startsWith('channel:')) {
      const ch = lower.slice(8).trim();
      return String(context.channel || '').toLowerCase() === ch;
    }

    if (lower === 'windowopen') {
      return context.windowOpen === true;
    }

    if (lower === 'windowclosed') {
      return context.windowOpen === false;
    }

    if (lower.startsWith('sentiment:')) {
      const sentiment = lower.slice(10).trim();
      return String(context.sentiment || '').toLowerCase() === sentiment;
    }

    if (lower.startsWith('timeofday:')) {
      const period = lower.slice(10).trim();
      const hour = new Date().getHours();
      if (period === 'morning') return hour >= 6 && hour < 12;
      if (period === 'afternoon') return hour >= 12 && hour < 17;
      if (period === 'evening') return hour >= 17 && hour < 22;
      if (period === 'night') return hour >= 22 || hour < 6;
    }

    // Check if expression is a context field name that's truthy
    if (context[expression] !== undefined) {
      return Boolean(context[expression]);
    }

    return false;
  }

  private resolveField(field: string, context: Record<string, unknown>): unknown {
    // Support dot notation: "contact.name"
    const parts = field.split('.');
    let value: unknown = context;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return value;
  }
}
