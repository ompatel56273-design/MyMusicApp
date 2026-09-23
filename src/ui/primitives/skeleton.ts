export interface SkeletonProps {
  variant?: 'text' | 'circle' | 'card' | 'row';
  width?: string;
  height?: string;
  className?: string;
}

export function renderSkeleton(props: SkeletonProps = {}): string {
  const { variant = 'text', width, height, className = '' } = props;
  const styleWidth = width ? `width: ${width};` : '';
  const styleHeight = height ? `height: ${height};` : '';
  const styleAttr = styleWidth || styleHeight ? ` style="${styleWidth} ${styleHeight}"` : '';

  return `<div class="app-skeleton skeleton-${variant} ${className}"${styleAttr} aria-hidden="true"></div>`;
}

export function renderSkeletonTrackList(count: number = 5): string {
  return Array.from({ length: count })
    .map(
      () => `
      <div class="skeleton-track-row" aria-hidden="true">
        <div class="app-skeleton skeleton-circle" style="width: 40px; height: 40px;"></div>
        <div class="skeleton-text-group" style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
          <div class="app-skeleton skeleton-text" style="width: 60%; height: 14px;"></div>
          <div class="app-skeleton skeleton-text" style="width: 40%; height: 12px;"></div>
        </div>
        <div class="app-skeleton skeleton-text" style="width: 50px; height: 12px;"></div>
      </div>
    `
    )
    .join('');
}
