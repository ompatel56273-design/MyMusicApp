export interface TooltipProps {
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function renderTooltip(props: TooltipProps): string {
  const { text, position = 'top', className = '' } = props;
  return `<span role="tooltip" class="app-tooltip tooltip-${position} ${className}">${text}</span>`;
}
