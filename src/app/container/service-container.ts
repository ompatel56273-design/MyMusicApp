import { AppError } from '../../core/errors/app-error';

export type Factory<T> = (container: ServiceContainer) => T;

export interface ServiceToken<T> {
  readonly name: string;
  readonly _type?: T;
}

export const createToken = <T>(name: string): ServiceToken<T> => ({ name });

/**
 * Lightweight, type-safe Dependency Injection Container.
 * Manages singleton instances and factories without external framework bloat.
 */
export class ServiceContainer {
  private singletons = new Map<string, unknown>();
  private factories = new Map<string, Factory<unknown>>();

  public registerSingleton<T>(token: ServiceToken<T>, instance: T): this {
    this.singletons.set(token.name, instance);
    return this;
  }

  public registerFactory<T>(token: ServiceToken<T>, factory: Factory<T>): this {
    this.factories.set(token.name, factory);
    return this;
  }

  public resolve<T>(token: ServiceToken<T>): T {
    if (this.singletons.has(token.name)) {
      return this.singletons.get(token.name) as T;
    }

    const factory = this.factories.get(token.name);
    if (factory) {
      const instance = factory(this) as T;
      this.singletons.set(token.name, instance);
      return instance;
    }

    throw new AppError(
      `Service "${token.name}" has not been registered in the ServiceContainer.`,
      'ERR_SERVICE_NOT_FOUND',
      { details: { serviceName: token.name } }
    );
  }

  public has<T>(token: ServiceToken<T>): boolean {
    return this.singletons.has(token.name) || this.factories.has(token.name);
  }

  public clear(): void {
    this.singletons.clear();
    this.factories.clear();
  }
}
