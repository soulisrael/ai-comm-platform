import { MessageCircle, Instagram, Send, Globe } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ChannelType } from '../lib/types';

const channelConfig: Record<ChannelType, { icon: typeof Globe; color: string; label: string }> = {
  whatsapp: { icon: MessageCircle, color: 'text-green-600', label: 'WhatsApp' },
  instagram: { icon: Instagram, color: 'text-pink-600', label: 'Instagram' },
  telegram: { icon: Send, color: 'text-blue-500', label: 'Telegram' },
  web: { icon: Globe, color: 'text-gray-600', label: 'Web' },
};

export function ChannelIcon({ channel, size = 16 }: { channel: ChannelType; size?: number }) {
  const config = channelConfig[channel] || channelConfig.web;
  const Icon = config.icon;
  return <Icon size={size} className={cn(config.color)} aria-label={config.label} />;
}
