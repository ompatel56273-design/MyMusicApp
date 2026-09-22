import { Logger } from '../../core/logging/logger';
import { EventBus } from '../../core/events/event-bus';
import { ServiceContainer } from '../container/service-container';
import { CoreTokens } from '../container/service-tokens';

export type LifecycleState = 'uninitialized' | 'initializing' | 'running' | 'stopping' | 'stopped';

/**
 * Application Lifecycle & Context Coordinator.
 * Coordinates initialization sequence, dependency container, and graceful shutdown.
 */
export class AppLifecycle {
  private state: LifecycleState = 'uninitialized';
  private readonly container: ServiceContainer;
  private readonly logger: Logger;
  private readonly eventBus: EventBus;

  constructor(container: ServiceContainer = new ServiceContainer()) {
    this.container = container;
    this.logger = new Logger('Lifecycle');
    this.eventBus = new EventBus();

    // Register foundational singletons
    this.container.registerSingleton(CoreTokens.Logger, this.logger);
    this.container.registerSingleton(CoreTokens.EventBus, this.eventBus);
  }

  public getState(): LifecycleState {
    return this.state;
  }

  public getContainer(): ServiceContainer {
    return this.container;
  }

  public async start(): Promise<void> {
    if (this.state === 'running' || this.state === 'initializing') {
      this.logger.warn(`Application already in state: ${this.state}`);
      return;
    }

    this.state = 'initializing';
    this.logger.info('Starting Application Lifecycle...');

    try {
      // Future phases register their repositories, services & audio engines here
      this.state = 'running';
      this.logger.info('Application Lifecycle running.');
    } catch (err) {
      this.state = 'uninitialized';
      this.logger.error('Failed to start application lifecycle:', err);
      throw err;
    }
  }

  public async stop(): Promise<void> {
    if (this.state !== 'running') {
      return;
    }

    this.state = 'stopping';
    this.logger.info('Stopping Application Lifecycle...');

    this.eventBus.clear();
    this.container.clear();

    this.state = 'stopped';
    this.logger.info('Application Lifecycle stopped.');
  }
}
