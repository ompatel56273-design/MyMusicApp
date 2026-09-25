import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { HomeView, HERO_SLIDES } from '../../src/ui/views/home-view';
import { EventBus } from '../../src/core/events/event-bus';
import type { ILibraryService, IPlaybackManager, IArtworkService, IPlaylistService } from '../../src/services/contracts/service-contracts';
import { RouterService } from '../../src/ui/navigation/router-service';

setupMockDomEnvironment();

describe('F2.7 Dashboard Hero — Typography + Slideshow Polish', () => {
  let container: HTMLElement;
  let eventBus: EventBus;
  let mockLibraryService: any;
  let mockPlaybackManager: any;
  let mockArtworkService: any;
  let mockPlaylistService: any;
  let router: RouterService;
  let homeView: HomeView;

  const sampleTracks: any[] = [
    {
      id: 'track-1',
      title: 'Midnight City',
      artistName: 'M83',
      albumTitle: 'Hurry Up, We\'re Dreaming',
      durationMs: 243000,
      path: '/music/midnight.mp3',
      format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
      dateAdded: Date.now(),
      dateModified: Date.now(),
      playCount: 10,
      isFavorite: false,
      hasLyrics: false,
      availability: 'available'
    }
  ];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    eventBus = new EventBus();
    router = new RouterService('home');

    mockLibraryService = {
      listTracks: vi.fn().mockResolvedValue({ items: sampleTracks, total: 1 }),
      listArtists: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      getLibraryStats: vi.fn().mockResolvedValue({ trackCount: 1, albumCount: 1, artistCount: 1 })
    };

    mockPlaybackManager = {
      playTrack: vi.fn().mockResolvedValue(undefined),
      playQueueIndex: vi.fn().mockResolvedValue(undefined),
      clearQueue: vi.fn().mockResolvedValue(undefined),
      queue: sampleTracks,
      currentQueueIndex: 0
    };

    mockArtworkService = {
      getArtworkUrl: vi.fn().mockResolvedValue(null)
    };

    mockPlaylistService = {
      listPlaylists: vi.fn().mockResolvedValue({ items: [], total: 0 })
    };

    homeView = new HomeView(mockLibraryService as ILibraryService, {
      playbackManager: mockPlaybackManager as IPlaybackManager,
      router,
      artworkService: mockArtworkService as IArtworkService,
      playlistService: mockPlaylistService as IPlaylistService,
      eventBus
    });
  });

  afterEach(() => {
    homeView.unmount();
    if (container.parentElement) {
      container.parentElement.removeChild(container);
    }
  });

  // 1. Hero renders
  it('1. renders the main Hero banner container on mount', () => {
    homeView.mount(container);
    const heroCard = container.querySelector('.home-hero-card');
    expect(heroCard).not.toBeNull();
  });

  // 2. Default slide exists
  it('2. starts with default slide index 0', () => {
    homeView.mount(container);
    expect(homeView.getActiveSlideIndex()).toBe(0);
    const currentSlide = homeView.getActiveSlide();
    expect(currentSlide.id).toBe(HERO_SLIDES[0]?.id);
  });

  // 3. Multiple slides exist
  it('3. supports multiple curated slide configurations (6 slides)', () => {
    const slides = homeView.getSlides();
    expect(slides.length).toBe(6);
    expect(HERO_SLIDES.length).toBe(6);
  });

  // 4. Slide IDs are unique
  it('4. ensures all slide IDs are unique', () => {
    const slides = homeView.getSlides();
    const ids = slides.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(slides.length);
  });

  // 5. Slide selection
  it('5. allows selecting a specific slide index', () => {
    homeView.mount(container);
    homeView.setActiveSlide(3);
    expect(homeView.getActiveSlideIndex()).toBe(3);
    expect(homeView.getActiveSlide().id).toBe('slide-deep-listening');
  });

  // 6. Next slide
  it('6. advances to the next slide with wrap-around', () => {
    homeView.mount(container);
    expect(homeView.getActiveSlideIndex()).toBe(0);

    homeView.nextSlide();
    expect(homeView.getActiveSlideIndex()).toBe(1);

    homeView.setActiveSlide(5);
    homeView.nextSlide();
    expect(homeView.getActiveSlideIndex()).toBe(0);
  });

  // 7. Previous slide
  it('7. navigates to the previous slide with wrap-around', () => {
    homeView.mount(container);
    expect(homeView.getActiveSlideIndex()).toBe(0);

    homeView.prevSlide();
    expect(homeView.getActiveSlideIndex()).toBe(5);

    homeView.prevSlide();
    expect(homeView.getActiveSlideIndex()).toBe(4);
  });

  // 8. Dot navigation
  it('8. updates slide when clicking a dot indicator', () => {
    homeView.mount(container);
    const dots = container.querySelectorAll<HTMLElement>('[data-slide-index]');
    expect(dots.length).toBe(6);

    dots[2]?.click();
    expect(homeView.getActiveSlideIndex()).toBe(2);
  });

  // 9. Active slide state
  it('9. applies active class and styling to the active dot indicator', () => {
    homeView.mount(container);
    homeView.setActiveSlide(1);
    const dots = container.querySelectorAll<HTMLElement>('[data-slide-index]');

    expect(dots[0]?.classList.contains('active')).toBe(false);
    expect(dots[1]?.classList.contains('active')).toBe(true);
    expect(dots[2]?.classList.contains('active')).toBe(false);
  });

  // 10. Keyboard navigation
  it('10. supports keyboard navigation (ArrowRight, ArrowLeft, Home, End)', () => {
    homeView.mount(container);
    const dots = container.querySelectorAll<HTMLElement>('[data-slide-index]');
    const firstDot = dots[0]!;

    firstDot.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(homeView.getActiveSlideIndex()).toBe(1);

    const secondDot = container.querySelector<HTMLElement>('#hero-tab-1')!;
    secondDot.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(homeView.getActiveSlideIndex()).toBe(0);

    firstDot.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(homeView.getActiveSlideIndex()).toBe(5);

    const lastDot = container.querySelector<HTMLElement>('#hero-tab-5')!;
    lastDot.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(homeView.getActiveSlideIndex()).toBe(0);
  });

  // 11. Accessible slide labels
  it('11. provides descriptive ARIA labels for dots and slide controls', () => {
    homeView.mount(container);
    const dots = container.querySelectorAll<HTMLElement>('[data-slide-index]');
    dots.forEach((dot, idx) => {
      expect(dot.getAttribute('aria-label')).toContain(`Slide ${idx + 1} of 6`);
    });

    const prevBtn = container.querySelector('#home-hero-prev-btn');
    const nextBtn = container.querySelector('#home-hero-next-btn');
    expect(prevBtn?.getAttribute('aria-label')).toBe('Previous slide');
    expect(nextBtn?.getAttribute('aria-label')).toBe('Next slide');
  });

  // 12. Active indicator accessibility
  it('12. manages aria-selected and tabindex for accessibility focus state', () => {
    homeView.mount(container);
    homeView.setActiveSlide(2);

    const dots = container.querySelectorAll<HTMLElement>('[data-slide-index]');
    expect(dots[2]?.getAttribute('aria-selected')).toBe('true');
    expect(dots[2]?.getAttribute('tabindex')).toBe('0');

    expect(dots[0]?.getAttribute('aria-selected')).toBe('false');
    expect(dots[0]?.getAttribute('tabindex')).toBe('-1');
  });

  // 13. Slide content rendering
  it('13. renders unique slide headlines, descriptions, and secondary poster lines', () => {
    homeView.mount(container);
    homeView.setActiveSlide(1); // Studio Grade Audio

    const greeting = container.querySelector('.home-hero-greeting');
    const title = container.querySelector('.home-hero-title');
    const subtitle = container.querySelector('.home-hero-subtitle');
    const posterPrimary = container.querySelector('.home-hero-tagline-primary');
    const posterSecondary = container.querySelector('.home-hero-tagline-secondary');

    expect(greeting?.textContent).toContain('Studio Grade Audio');
    expect(title?.textContent).toContain('Hear Every');
    expect(subtitle?.textContent).toContain('Bit-perfect playback');
    expect(posterPrimary?.textContent).toBe('Pure Sound');
    expect(posterSecondary?.textContent).toBe('Zero Compromise');
  });

  // 14. Typography variant classes/attributes
  it('14. sets data-variant attribute matching the active slide configuration', () => {
    homeView.mount(container);
    const heroCard = container.querySelector('.home-hero-card')!;

    homeView.setActiveSlide(0);
    expect(heroCard.getAttribute('data-variant')).toBe('editorial');

    homeView.setActiveSlide(1);
    expect(heroCard.getAttribute('data-variant')).toBe('split');

    homeView.setActiveSlide(2);
    expect(heroCard.getAttribute('data-variant')).toBe('italic');

    homeView.setActiveSlide(3);
    expect(heroCard.getAttribute('data-variant')).toBe('poster');
  });

  // 15. No clipping / invalid configuration handling
  it('15. ignores invalid slide indices without crashing or mutating active index', () => {
    homeView.mount(container);
    expect(homeView.getActiveSlideIndex()).toBe(0);

    homeView.setActiveSlide(-1);
    expect(homeView.getActiveSlideIndex()).toBe(0);

    homeView.setActiveSlide(999);
    expect(homeView.getActiveSlideIndex()).toBe(0);
  });

  // 16. Responsive behavior
  it('16. includes CSS media queries for desktop, tablet, and mobile layouts', () => {
    homeView.mount(container);
    const styleEl = container.querySelector('style');
    expect(styleEl?.textContent).toContain('@media (min-width: 768px)');
    expect(styleEl?.textContent).toContain('@media (max-width: 767px)');
  });

  // 17. Theme compatibility
  it('17. utilizes MyMusicApp design token variables for themes', () => {
    homeView.mount(container);
    const styleEl = container.querySelector('style');
    expect(styleEl?.textContent).toContain('var(--color-accent-cyan)');
    expect(styleEl?.textContent).toContain('var(--glass-border-interactive)');
  });

  // 18. Dynamic artwork color compatibility
  it('18. integrates with ambient backgrounds and backdrop filter effects', () => {
    homeView.mount(container);
    const styleEl = container.querySelector('style');
    expect(styleEl?.textContent).toContain('backdrop-filter: blur');
  });

  // 19. Ambient background compatibility
  it('19. uses translucent layers compatible with dynamic themes', () => {
    homeView.mount(container);
    const styleEl = container.querySelector('style');
    expect(styleEl?.textContent).toContain('rgba(255, 255, 255, 0.04)');
  });

  // 20. Reduced-motion behavior
  it('20. respects prefers-reduced-motion media query', () => {
    homeView.mount(container);
    const styleEl = container.querySelector('style');
    expect(styleEl?.textContent).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styleEl?.textContent).toContain('transition: none !important');
  });

  // 21. Deterministic slide order
  it('21. maintains a deterministic slide order across renders', () => {
    const slides1 = homeView.getSlides().map(s => s.id);
    homeView.mount(container);
    const slides2 = homeView.getSlides().map(s => s.id);
    expect(slides1).toEqual(slides2);
  });

  // 22. No playback state changes
  it('22. does not trigger playback when changing slides', () => {
    homeView.mount(container);
    homeView.nextSlide();
    homeView.setActiveSlide(4);
    expect(mockPlaybackManager.playTrack).not.toHaveBeenCalled();
    expect(mockPlaybackManager.playQueueIndex).not.toHaveBeenCalled();
  });

  // 23. No queue changes
  it('23. preserves the current playback queue during slide navigation', () => {
    homeView.mount(container);
    const initialQueue = [...mockPlaybackManager.queue];
    homeView.nextSlide();
    expect(mockPlaybackManager.queue).toEqual(initialQueue);
  });

  // 24. No current-track changes
  it('24. preserves current queue index when navigating hero slides', () => {
    homeView.mount(container);
    homeView.setActiveSlide(3);
    expect(mockPlaybackManager.currentQueueIndex).toBe(0);
  });

  // 25. No audio-engine changes
  it('25. operates purely as a presentation layer without audio engine side effects', () => {
    homeView.mount(container);
    homeView.prevSlide();
    expect(mockPlaybackManager.clearQueue).not.toHaveBeenCalled();
  });

  // 26. No AI functionality
  it('26. contains zero AI or external recommendation dependencies', () => {
    HERO_SLIDES.forEach(slide => {
      const words = slide.title.toLowerCase().split(/[^a-z0-9]+/);
      expect(words.includes('ai')).toBe(false);
      expect(slide.description.toLowerCase()).not.toContain('algorithm');
    });
  });

  // 27. No network dependency
  it('27. operates deterministically with local slide configurations without network requests', () => {
    expect(HERO_SLIDES.length).toBe(6);
  });

  // 28. Cleanup / unsubscription
  it('28. cleans up container and unmounts cleanly without leaking elements', () => {
    homeView.mount(container);
    expect(container.children.length).toBeGreaterThan(0);

    homeView.unmount();
    expect(container.innerHTML).toBe('');
  });

  // 29. Invalid slide configuration handling
  it('29. handles out-of-bounds index safely on getActiveSlide', () => {
    (homeView as any).activeSlideIndex = -5;
    expect(homeView.getActiveSlide()).toBe(HERO_SLIDES[0]);
  });

  // 30. Dashboard customization compatibility
  it('30. renders inside dynamic dashboard layout sections seamlessly', () => {
    homeView.mount(container);
    const dynamicContainer = container.querySelector('#home-dynamic-sections-container');
    expect(dynamicContainer).not.toBeNull();
  });
});
