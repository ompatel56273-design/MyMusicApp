import { getIconSvg } from '../icons/icon-registry';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  seeAllActionId?: string;
  seeAllText?: string;
  hasChevronNav?: boolean;
  prevBtnId?: string;
  nextBtnId?: string;
  className?: string;
}

export function renderSectionHeader(props: SectionHeaderProps): string {
  const {
    title,
    subtitle,
    seeAllActionId,
    seeAllText = 'See all',
    hasChevronNav = false,
    prevBtnId,
    nextBtnId,
    className = ''
  } = props;

  let rightActionHtml = '';

  if (seeAllActionId) {
    rightActionHtml = `
      <button id="${seeAllActionId}" class="section-see-all-btn" aria-label="${seeAllText} ${title}">
        <span>${seeAllText}</span>
        ${getIconSvg('chevron-right', { size: 14 })}
      </button>
    `;
  } else if (hasChevronNav) {
    rightActionHtml = `
      <div class="section-nav-arrows">
        <button id="${prevBtnId ?? ''}" class="section-arrow-btn" aria-label="Previous">
          ${getIconSvg('chevron-left', { size: 16 })}
        </button>
        <button id="${nextBtnId ?? ''}" class="section-arrow-btn" aria-label="Next">
          ${getIconSvg('chevron-right', { size: 16 })}
        </button>
      </div>
    `;
  }

  return `
    <header class="app-section-header ${className}">
      <div class="section-title-group">
        <h2 class="section-title text-title-2">${title}</h2>
        ${subtitle ? `<p class="section-subtitle text-caption">${subtitle}</p>` : ''}
      </div>
      ${rightActionHtml}
    </header>
  `;
}
