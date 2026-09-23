export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  margin?: string;
}

export function renderDivider(props: DividerProps = {}): string {
  const { orientation = 'horizontal', className = '', margin } = props;
  const styleAttr = margin ? ` style="margin: ${margin};"` : '';
  return `<hr class="app-divider divider-${orientation} ${className}"${styleAttr} />`;
}
