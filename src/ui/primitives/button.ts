import { getIconSvg, type IconName } from '../icons/icon-registry';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon' | 'pill' | 'play-glow';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  id?: string | undefined;
  label?: string | undefined;
  icon?: IconName | undefined;
  iconRight?: IconName | undefined;
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  disabled?: boolean | undefined;
  active?: boolean | undefined;
  ariaLabel?: string | undefined;
  className?: string | undefined;
  type?: ('button' | 'submit' | 'reset') | undefined;
  onClick?: ((e: MouseEvent) => void) | undefined;
}

/**
 * Creates an accessible, high-fidelity button HTML string.
 */
export function renderButton(props: ButtonProps): string {
  const {
    id = '',
    label = '',
    icon,
    iconRight,
    variant = 'secondary',
    size = 'md',
    disabled = false,
    active = false,
    ariaLabel,
    className = '',
    type = 'button'
  } = props;

  const idAttr = id ? ` id="${id}"` : '';
  const ariaAttr = ariaLabel ? ` aria-label="${ariaLabel}"` : '';
  const disabledAttr = disabled ? ' disabled aria-disabled="true"' : '';
  const activeAttr = active ? ' data-active="true"' : '';

  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'btn-sm',
    md: 'btn-md',
    lg: 'btn-lg'
  };

  const variantClasses: Record<ButtonVariant, string> = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    icon: 'btn-icon',
    pill: 'btn-pill',
    'play-glow': 'btn-play-glow'
  };

  const iconSvg = icon ? `<span class="btn-icon-slot">${getIconSvg(icon, { size: size === 'sm' ? 16 : size === 'lg' ? 24 : 20 })}</span>` : '';
  const iconRightSvg = iconRight ? `<span class="btn-icon-right-slot">${getIconSvg(iconRight, { size: size === 'sm' ? 14 : 18 })}</span>` : '';
  const labelHtml = label ? `<span class="btn-label">${label}</span>` : '';

  return `<button type="${type}"${idAttr}${ariaAttr}${disabledAttr}${activeAttr} class="app-btn ${variantClasses[variant]} ${sizeClasses[size]} ${className}">${iconSvg}${labelHtml}${iconRightSvg}</button>`;
}
