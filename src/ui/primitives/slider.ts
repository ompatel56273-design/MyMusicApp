export interface SliderProps {
  id: string;
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  ariaLabel: string;
  ariaValueText?: string;
  className?: string;
  variant?: 'purple' | 'cyan' | 'pink';
}

export function renderSlider(props: SliderProps): string {
  const {
    id,
    min = 0,
    max = 100,
    step = 1,
    value = 0,
    ariaLabel,
    ariaValueText = '',
    className = '',
    variant = 'purple'
  } = props;

  const valueTextAttr = ariaValueText ? ` aria-valuetext="${ariaValueText}"` : '';

  return `
    <div class="app-slider-container slider-${variant} ${className}">
      <input
        type="range"
        id="${id}"
        min="${min}"
        max="${max}"
        step="${step}"
        value="${value}"
        aria-label="${ariaLabel}"
        aria-valuenow="${value}"
        aria-valuemin="${min}"
        aria-valuemax="${max}"
        ${valueTextAttr}
        class="app-slider"
      />
    </div>
  `;
}
