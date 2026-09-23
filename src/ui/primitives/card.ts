export type CardVariant = 'glass' | 'elevated' | 'hero' | 'stat' | 'interactive';

export interface CardProps {
  id?: string;
  variant?: CardVariant;
  className?: string;
  content: string;
  onClickAttr?: string;
}

export function renderCard(props: CardProps): string {
  const { id = '', variant = 'glass', className = '', content, onClickAttr = '' } = props;
  const idAttr = id ? ` id="${id}"` : '';
  const clickAttr = onClickAttr ? ` ${onClickAttr}` : '';

  return `<div${idAttr} class="app-card card-${variant} ${className}"${clickAttr}>${content}</div>`;
}
