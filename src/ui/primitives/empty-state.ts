import { getIconSvg, type IconName } from '../icons/icon-registry';
import { renderButton } from './button';

export interface EmptyStateProps {
  icon?: IconName | undefined;
  title: string;
  description?: string | undefined;
  actionLabel?: string | undefined;
  actionId?: string | undefined;
  actionIcon?: IconName | undefined;
  className?: string | undefined;
}

export function renderEmptyState(props: EmptyStateProps): string {
  const {
    icon = 'disc',
    title,
    description,
    actionLabel,
    actionId,
    actionIcon,
    className = ''
  } = props;

  const actionHtml =
    actionLabel && actionId
      ? `
      <div class="empty-state-action">
        ${renderButton({
          id: actionId,
          label: actionLabel,
          icon: actionIcon,
          variant: 'primary',
          size: 'md'
        })}
      </div>
    `
      : '';

  return `
    <div class="app-empty-state glass-card ${className}">
      <div class="empty-state-icon-bubble">
        ${getIconSvg(icon, { size: 36, color: 'var(--color-accent-purple-glow)' })}
      </div>
      <h3 class="empty-state-title text-title-2">${title}</h3>
      ${description ? `<p class="empty-state-desc text-body text-truncate-2">${description}</p>` : ''}
      ${actionHtml}
    </div>
  `;
}
