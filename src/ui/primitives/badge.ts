import { getIconSvg, type IconName } from '../icons/icon-registry';

export type BadgeVariant = 'purple' | 'cyan' | 'pink' | 'emerald' | 'amber' | 'glass' | 'hi-res';

export interface BadgeProps {
  label: string;
  icon?: IconName;
  variant?: BadgeVariant;
  className?: string;
}

export function renderBadge(props: BadgeProps): string {
  const { label, icon, variant = 'glass', className = '' } = props;
  const iconHtml = icon ? `<span class="badge-icon">${getIconSvg(icon, { size: 12 })}</span>` : '';

  if (variant === 'hi-res') {
    return `<span class="app-badge badge-hi-res ${className}"><span class="hi-res-text">Hi-Res</span><span class="hi-res-sub">AUDIO</span></span>`;
  }

  return `<span class="app-badge badge-${variant} ${className}">${iconHtml}<span>${label}</span></span>`;
}
