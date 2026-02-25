import { BrainCategory, BrainEntry, BrainSearchResult, FAQEntry, ProductEntry } from '../types/brain';
import { AgentType } from '../types/conversation';
import { BrainLoader } from './brain-loader';
import logger from '../services/logger';

export class BrainSearch {
  private loader: BrainLoader;

  constructor(loader: BrainLoader) {
    this.loader = loader;
  }

  searchByKeywords(keywords: string[], category?: BrainCategory): BrainSearchResult[] {
    const results: BrainSearchResult[] = [];
    const data = this.loader.getData();
    const lowerKeywords = keywords.map(k => k.toLowerCase());

    const categoriesToSearch = category ? [category] : Array.from(data.keys());

    for (const cat of categoriesToSearch) {
      const entries = data.get(cat);
      if (!entries) continue;

      for (const entry of entries) {
        const score = this.calculateRelevance(entry, lowerKeywords);
        if (score > 0) {
          results.push({
            entry,
            relevanceScore: score,
            source: `${entry.category}/${entry.subcategory}`,
          });
        }
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  searchFAQ(query: string): BrainSearchResult[] {
    const faqEntry = this.loader.getEntry('support', 'faq');
    if (!faqEntry) return [];

    const faqs = (faqEntry.data as { faqs: FAQEntry[] }).faqs;
    const lowerQuery = query.toLowerCase();
    const queryWords = lowerQuery.split(/\s+/);
    const results: BrainSearchResult[] = [];

    for (const faq of faqs) {
      let score = 0;

      // Check keyword matches
      for (const keyword of faq.keywords) {
        if (lowerQuery.includes(keyword.toLowerCase())) {
          score += 2;
        }
      }

      // Check query word matches against question
      for (const word of queryWords) {
        if (faq.question.toLowerCase().includes(word)) {
          score += 1;
        }
      }

      if (score > 0) {
        results.push({
          entry: {
            id: faq.id,
            category: 'support',
            subcategory: 'faq',
            data: faq as unknown as Record<string, unknown>,
          },
          relevanceScore: score,
          source: 'support/faq',
        });
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  getProduct(productId: string): ProductEntry | undefined {
    const productsEntry = this.loader.getEntry('sales', 'products');
    if (!productsEntry) return undefined;

    const products = (productsEntry.data as { products: ProductEntry[] }).products;
    return products.find(p => p.id === productId);
  }

  getProducts(category?: string): ProductEntry[] {
    const productsEntry = this.loader.getEntry('sales', 'products');
    if (!productsEntry) return [];

    const products = (productsEntry.data as { products: ProductEntry[] }).products;
    if (category) {
      return products.filter(p => p.category === category);
    }
    return products;
  }

  getPolicy(policyName: string): unknown {
    const policiesEntry = this.loader.getEntry('support', 'policies');
    if (!policiesEntry) return undefined;

    return (policiesEntry.data as Record<string, unknown>)[policyName];
  }

  findRelevantBrainData(message: string, agentType: AgentType): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // Always include company info and tone of voice
    const companyInfo = this.loader.getEntry('company', 'info');
    const toneOfVoice = this.loader.getEntry('company', 'tone-of-voice');
    if (companyInfo) result.companyInfo = companyInfo.data;
    if (toneOfVoice) result.toneOfVoice = toneOfVoice.data;

    // Agent-specific config
    const agentInstructions = this.loader.getEntry('config', 'agent-instructions');
    if (agentInstructions) {
      const instructions = agentInstructions.data as Record<string, unknown>;
      result.agentInstructions = instructions[agentType];
    }

    // Agent-specific brain data
    let agentCategory: BrainCategory | null = null;
    switch (agentType) {
      case 'sales': {
        agentCategory = 'sales';
        const products = this.loader.getEntry('sales', 'products');
        const pricing = this.loader.getEntry('sales', 'pricing-rules');
        const objections = this.loader.getEntry('sales', 'objection-handling');
        const scripts = this.loader.getEntry('sales', 'sales-scripts');
        const competitors = this.loader.getEntry('sales', 'competitor-comparison');
        if (products) result.products = products.data;
        if (pricing) result.pricingRules = pricing.data;
        if (objections) result.objectionHandling = objections.data;
        if (scripts) result.salesScripts = scripts.data;
        if (competitors) result.competitors = competitors.data;
        break;
      }
      case 'support': {
        agentCategory = 'support';
        const faq = this.loader.getEntry('support', 'faq');
        const policies = this.loader.getEntry('support', 'policies');
        const troubleshooting = this.loader.getEntry('support', 'troubleshooting');
        const escalation = this.loader.getEntry('support', 'escalation-rules');
        const canned = this.loader.getEntry('support', 'canned-responses');
        if (faq) result.faq = faq.data;
        if (policies) result.policies = policies.data;
        if (troubleshooting) result.troubleshooting = troubleshooting.data;
        if (escalation) result.escalationRules = escalation.data;
        if (canned) result.cannedResponses = canned.data;
        break;
      }
      case 'router': {
        const routing = this.loader.getEntry('config', 'routing-rules');
        if (routing) result.routingRules = routing.data;
        break;
      }
      case 'handoff': {
        const handoff = this.loader.getEntry('config', 'handoff-rules');
        const team = this.loader.getEntry('company', 'team');
        if (handoff) result.handoffRules = handoff.data;
        if (team) result.team = team.data;
        break;
      }
      case 'trial_meeting': {
        const team = this.loader.getEntry('company', 'team');
        if (team) result.team = team.data;
        break;
      }
    }

    // Inject uploaded modules for the agent's category + company (general knowledge)
    const uploadCategories = new Set<BrainCategory>(['company']);
    if (agentCategory) uploadCategories.add(agentCategory);
    for (const cat of uploadCategories) {
      for (const entry of this.getUploadedModules(cat)) {
        const key = entry.subcategory.replace(/-/g, '_');
        result[key] = entry.data;
      }
    }

    // Search for keyword-relevant data from the message
    const messageKeywords = message.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const faqResults = this.searchFAQ(message);
    if (faqResults.length > 0) {
      result.relevantFAQ = faqResults.slice(0, 3).map(r => r.entry.data);
    }

    logger.debug('Found relevant brain data', { agentType, keys: Object.keys(result) });
    return result;
  }

  private getUploadedModules(category: BrainCategory): BrainEntry[] {
    const entries = this.loader.getData().get(category) || [];
    return entries.filter(e => e.subcategory.startsWith('uploaded-'));
  }

  private calculateRelevance(entry: BrainEntry, keywords: string[]): number {
    const dataStr = JSON.stringify(entry.data).toLowerCase();
    let score = 0;

    for (const keyword of keywords) {
      if (dataStr.includes(keyword)) {
        score += 1;
      }
    }

    return score;
  }
}
