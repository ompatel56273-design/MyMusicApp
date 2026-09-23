import { getIconSvg, type IconName } from '../icons/icon-registry';

export interface TabItem {
  id: string;
  label: string;
  icon?: IconName;
  count?: number | string;
  active?: boolean;
}

export interface TabsProps {
  id?: string;
  tabs: TabItem[];
  variant?: 'pill' | 'underline' | 'chips';
  ariaLabel: string;
  className?: string;
  dataAttributeName?: string;
}

export function renderTabs(props: TabsProps): string {
  const {
    id = '',
    tabs,
    variant = 'pill',
    ariaLabel,
    className = '',
    dataAttributeName = 'data-tab-id'
  } = props;

  const idAttr = id ? ` id="${id}"` : '';

  const tabsHtml = tabs
    .map(tab => {
      const activeAttr = tab.active ? ' aria-selected="true" data-active="true"' : ' aria-selected="false"';
      const iconHtml = tab.icon ? `<span class="tab-icon">${getIconSvg(tab.icon, { size: 16 })}</span>` : '';
      const countHtml = tab.count !== undefined ? `<span class="tab-count-badge">${tab.count}</span>` : '';

      return `
        <button
          role="tab"
          ${dataAttributeName}="${tab.id}"
          ${activeAttr}
          class="app-tab-btn tab-${variant}-item"
          aria-label="${tab.label}"
        >
          ${iconHtml}
          <span>${tab.label}</span>
          ${countHtml}
        </button>
      `;
    })
    .join('');

  return `
    <div${idAttr} role="tablist" aria-label="${ariaLabel}" class="app-tabs-container tabs-${variant} ${className}">
      ${tabsHtml}
    </div>
  `;
}
