/**
 * Bundle Optimization and Asset Management Utilities
 * Implements Story 4.2 performance optimization requirements
 */

// Dynamic import wrapper with error handling and loading states
export function createAsyncComponent<T = any>(
  factory: () => Promise<T>,
  options: {
    loading?: any;
    error?: any;
    delay?: number;
    timeout?: number;
  } = {}
) {
  return defineAsyncComponent({
    loader: factory,
    loadingComponent: options.loading,
    errorComponent: options.error,
    delay: options.delay || 200,
    timeout: options.timeout || 3000,
  });
}

// Preload critical route chunks
export function preloadRouteChunk(routeName: string): Promise<void> {
  const preloadMap: Record<string, () => Promise<any>> = {
    BoardView: () => import('@/views/BoardView.vue'),
    LoginView: () => import('@/views/LoginView.vue'),
    RegisterView: () => import('@/views/RegisterView.vue'),
    NotFoundView: () => import('@/views/NotFoundView.vue'),
  };

  const loader = preloadMap[routeName];
  if (loader) {
    return loader().then(() => {
      console.log(`[Preload] Successfully preloaded ${routeName}`);
    }).catch(error => {
      console.warn(`[Preload] Failed to preload ${routeName}:`, error);
    });
  }

  return Promise.resolve();
}

// Intelligent prefetching based on user behavior
class PrefetchManager {
  private prefetchedChunks = new Set<string>();
  private observer: IntersectionObserver | null = null;

  constructor() {
    this.initializeObserver();
    this.setupHoverPrefetch();
  }

  private initializeObserver(): void {
    // Prefetch links that come into viewport
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const link = entry.target as HTMLElement;
            const routeName = link.dataset.preload;
            if (routeName && !this.prefetchedChunks.has(routeName)) {
              this.prefetchChunk(routeName);
            }
          }
        });
      }, {
        rootMargin: '50px',
      });
    }
  }

  private setupHoverPrefetch(): void {
    // Prefetch on hover with debounce
    let hoverTimeout: number;
    
    document.addEventListener('mouseover', (event) => {
      const target = event.target as HTMLElement;
      const link = target.closest('[data-preload]') as HTMLElement;
      
      if (link) {
        const routeName = link.dataset.preload;
        if (routeName && !this.prefetchedChunks.has(routeName)) {
          clearTimeout(hoverTimeout);
          hoverTimeout = window.setTimeout(() => {
            this.prefetchChunk(routeName);
          }, 100); // Small delay to avoid prefetching on quick mouse movements
        }
      }
    });
  }

  private async prefetchChunk(routeName: string): Promise<void> {
    if (this.prefetchedChunks.has(routeName)) return;
    
    this.prefetchedChunks.add(routeName);
    
    try {
      await preloadRouteChunk(routeName);
      console.log(`[Prefetch] Successfully prefetched ${routeName}`);
    } catch (error) {
      console.warn(`[Prefetch] Failed to prefetch ${routeName}:`, error);
      // Remove from set so we can retry later
      this.prefetchedChunks.delete(routeName);
    }
  }

  public observeElement(element: HTMLElement): void {
    this.observer?.observe(element);
  }

  public unobserveElement(element: HTMLElement): void {
    this.observer?.unobserve(element);
  }

  public cleanup(): void {
    this.observer?.disconnect();
  }
}

// Singleton prefetch manager
const prefetchManager = new PrefetchManager();

// Image optimization and lazy loading
export class ImageOptimizer {
  private static observer: IntersectionObserver | null = null;
  private static loadedImages = new Set<string>();

  static initialize(): void {
    if ('IntersectionObserver' in window && !this.observer) {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            this.loadImage(img);
            this.observer!.unobserve(img);
          }
        });
      }, {
        rootMargin: '50px 0px',
        threshold: 0.01,
      });
    }
  }

  static observeImage(img: HTMLImageElement): void {
    this.initialize();
    this.observer?.observe(img);
  }

  private static loadImage(img: HTMLImageElement): void {
    const src = img.dataset.src;
    const srcset = img.dataset.srcset;
    
    if (!src) return;

    // Create a new image to preload
    const imageLoader = new Image();
    
    imageLoader.onload = () => {
      // Apply fade-in transition
      img.style.transition = 'opacity 0.3s ease-in-out';
      img.style.opacity = '0';
      
      // Update src and srcset
      img.src = src;
      if (srcset) img.srcset = srcset;
      
      // Remove data attributes
      delete img.dataset.src;
      delete img.dataset.srcset;
      
      // Fade in
      requestAnimationFrame(() => {
        img.style.opacity = '1';
      });

      this.loadedImages.add(src);
    };

    imageLoader.onerror = () => {
      console.warn(`[ImageOptimizer] Failed to load image: ${src}`);
      // Show fallback or placeholder
      img.src = '/images/placeholder.svg';
      img.style.opacity = '1';
    };

    // Start loading
    imageLoader.src = src;
    if (srcset) imageLoader.srcset = srcset;
  }

  static createResponsiveImage(
    baseSrc: string, 
    alt: string,
    sizes: string[] = ['320w', '640w', '1024w']
  ): HTMLImageElement {
    const img = document.createElement('img');
    
    // Generate srcset for responsive images
    const srcset = sizes.map(size => {
      const width = size.replace('w', '');
      return `${baseSrc}?w=${width} ${size}`;
    }).join(', ');

    // Set up lazy loading
    img.dataset.src = baseSrc;
    img.dataset.srcset = srcset;
    img.alt = alt;
    img.style.opacity = '0';
    
    // Add loading placeholder
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PC9zdmc+';
    
    // Observe for intersection
    this.observeImage(img);
    
    return img;
  }
}

// Resource hints for critical assets
export function addResourceHints(): void {
  const head = document.head;
  
  // Preconnect to API server
  const preconnectAPI = document.createElement('link');
  preconnectAPI.rel = 'preconnect';
  preconnectAPI.href = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  head.appendChild(preconnectAPI);

  // DNS prefetch for external services
  const dnsPrefetchServices = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
  ];

  dnsPrefetchServices.forEach(service => {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = service;
    head.appendChild(link);
  });

  // Prefetch critical SVG icons
  const iconSprite = document.createElement('link');
  iconSprite.rel = 'prefetch';
  iconSprite.href = '/icons/sprite.svg';
  iconSprite.as = 'image';
  head.appendChild(iconSprite);
}

// Bundle analyzer in development
export function analyzeBundleSize(): void {
  if (import.meta.env.DEV) {
    // Track and log bundle sizes
    const chunkSizes: Record<string, number> = {};
    
    // Monitor dynamic imports
    const originalImport = window.__vitePreload;
    if (originalImport) {
      window.__vitePreload = async (baseModule, deps) => {
        const startTime = performance.now();
        const result = await originalImport(baseModule, deps);
        const loadTime = performance.now() - startTime;
        
        console.log(`[Bundle] Loaded ${baseModule} in ${loadTime.toFixed(2)}ms`);
        
        return result;
      };
    }
  }
}

// Export utilities
export const useBundleOptimization = () => {
  return {
    preloadRoute: preloadRouteChunk,
    observePrefetch: (element: HTMLElement) => prefetchManager.observeElement(element),
    createLazyImage: ImageOptimizer.createResponsiveImage.bind(ImageOptimizer),
  };
};

// Cleanup function for tests
export const cleanupOptimizations = () => {
  prefetchManager.cleanup();
  ImageOptimizer.observer?.disconnect();
};

// Auto-initialize optimizations
export function initializeOptimizations(): void {
  // Add resource hints
  addResourceHints();
  
  // Initialize image optimization
  ImageOptimizer.initialize();
  
  // Setup bundle analysis in dev
  analyzeBundleSize();
  
  console.log('[Optimizations] Performance optimizations initialized');
}

// Vue 3 imports (avoiding issues with build-time imports)
let defineAsyncComponent: any;
if (typeof window !== 'undefined') {
  import('vue').then(vue => {
    defineAsyncComponent = vue.defineAsyncComponent;
  });
}