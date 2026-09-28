import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { LibraryHealthDashboard } from '../../src/ui/components/library/library-health-dashboard';
import type { LibraryHealthSnapshot } from '../../src/domain/entities/library-health-types';

setupMockDomEnvironment();

describe('LibraryHealthDashboard UI Component', () => {
  let mockHealthService: any;
  let dashboard: LibraryHealthDashboard;

  const mockSnapshot: LibraryHealthSnapshot = {
    timestamp: 1600000000000,
    status: 'needs-attention',
    metrics: {
      totalTracks: 83,
      totalAlbums: 10,
      totalArtists: 5,
      totalGenres: 3,
      totalPlaylists: 2,
      totalDurationMs: 12000000,
      availableFiles: 80,
      missingFiles: 2,
      unverifiableFiles: 1,
      unsupportedFiles: 0,
      duplicateGroupsCount: 1,
      duplicateTracksCount: 1,
      potentialSpaceSavingsBytes: 5000000,
      completeMetadataCount: 75,
      missingTitleCount: 0,
      missingArtistCount: 5,
      missingAlbumCount: 8,
      missingGenreCount: 10,
      invalidDurationCount: 0,
      orphanedMetadataCount: 0
    },
    issues: [
      {
        id: 'i1',
        category: 'file-availability',
        trackId: 't1',
        trackTitle: 'Missing Track',
        description: 'File record for "Missing Track" is marked as missing',
        severity: 'error',
        targetTab: 'folders'
      },
      {
        id: 'i2',
        category: 'duplicates',
        trackId: 't2',
        trackTitle: 'Dup Track',
        description: 'Duplicate copy of "Dup Track"',
        severity: 'info',
        targetTab: 'duplicates'
      }
    ],
    verificationDurationMs: 150
  };

  beforeEach(() => {
    mockHealthService = {
      getCachedSnapshot: vi.fn().mockReturnValue(mockSnapshot),
      verifyLibraryHealth: vi.fn().mockResolvedValue(mockSnapshot)
    };
  });

  afterEach(() => {
    if (dashboard) {
      dashboard.unmount();
    }
  });

  it('should render header, status banner, overview metrics, and issue cards correctly', () => {
    dashboard = new LibraryHealthDashboard({
      healthService: mockHealthService
    });
    dashboard.mount();

    const overlay = document.querySelector('#library-health-dashboard-overlay');
    expect(overlay).not.toBeNull();

    expect(overlay?.textContent).toContain('Library Health & Integrity');
    expect(overlay?.textContent).toContain('Needs Attention');
    expect(overlay?.textContent).toContain('83'); // Songs
    expect(overlay?.textContent).toContain('80'); // Available files
    expect(overlay?.textContent).toContain('Missing Track');
  });

  it('should trigger verification when Verify Library button is clicked', async () => {
    dashboard = new LibraryHealthDashboard({
      healthService: mockHealthService
    });
    dashboard.mount();

    const verifyBtn = document.querySelector<HTMLButtonElement>('#health-btn-verify');
    expect(verifyBtn).not.toBeNull();

    verifyBtn?.click();
    expect(mockHealthService.verifyLibraryHealth).toHaveBeenCalled();
  });

  it('should navigate or open duplicates when action buttons are clicked', () => {
    const onOpenDuplicates = vi.fn();
    const onNavigateTab = vi.fn();

    dashboard = new LibraryHealthDashboard({
      healthService: mockHealthService,
      onOpenDuplicates,
      onNavigateTab
    });
    dashboard.mount();

    const dupBtn = document.querySelector<HTMLButtonElement>('#health-btn-open-dup');
    dupBtn?.click();

    expect(onOpenDuplicates).toHaveBeenCalled();
  });

  it('should unmount cleanly and remove overlay from DOM', () => {
    dashboard = new LibraryHealthDashboard({
      healthService: mockHealthService
    });
    dashboard.mount();
    expect(document.querySelector('#library-health-dashboard-overlay')).not.toBeNull();

    dashboard.unmount();
    expect(document.querySelector('#library-health-dashboard-overlay')).toBeNull();
  });
});
