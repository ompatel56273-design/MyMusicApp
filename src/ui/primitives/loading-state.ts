export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function renderLoadingState(props: LoadingStateProps = {}): string {
  const { message = 'Loading music...', className = '' } = props;

  return `
    <div class="app-loading-state ${className}" role="status" aria-live="polite">
      <div class="loading-wave-bars">
        <span class="wave-bar bar-1"></span>
        <span class="wave-bar bar-2"></span>
        <span class="wave-bar bar-3"></span>
        <span class="wave-bar bar-4"></span>
        <span class="wave-bar bar-5"></span>
      </div>
      <p class="loading-message text-caption">${message}</p>
    </div>
  `;
}
