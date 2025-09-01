import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useQuery, useMutation } from '@vue/apollo-composable';
import { GhibliTheme, BoardTheme, UpdateBoardThemeInput, ThemeCustomizations } from '../types/theme';
import { GET_THEMES, GET_THEME, UPDATE_BOARD_THEME, ThemeService } from '../services/theme.service';
import { logger } from '../utils/logger';

export const useThemeStore = defineStore('theme', () => {
  // State
  const availableThemes = ref<GhibliTheme[]>([]);
  const currentTheme = ref<GhibliTheme | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Computed
  const themeMap = computed(() => {
    const map = new Map<string, GhibliTheme>();
    availableThemes.value.forEach(theme => {
      map.set(theme.name, theme);
    });
    return map;
  });

  // Actions
  const loadThemes = async (): Promise<void> => {
    isLoading.value = true;
    error.value = null;
    
    try {
      const { result, loading, error: queryError } = useQuery(GET_THEMES);
      
      // Wait for query to complete
      await new Promise<void>((resolve) => {
        const unwatch = loading.value ? 
          // @ts-ignore - Watch for loading to finish
          $watch(loading, (newVal) => {
            if (!newVal) {
              unwatch();
              resolve();
            }
          }) : 
          resolve();
      });

      if (queryError.value) {
        throw queryError.value;
      }

      if (result.value?.themes) {
        availableThemes.value = result.value.themes;
        logger.info(`Loaded ${availableThemes.value.length} themes`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load themes';
      error.value = message;
      logger.error('Failed to load themes:', err);
      throw new Error(message);
    } finally {
      isLoading.value = false;
    }
  };

  const loadTheme = async (themeId: string): Promise<GhibliTheme> => {
    // Check if theme is already loaded
    const cachedTheme = themeMap.value.get(themeId);
    if (cachedTheme) {
      return cachedTheme;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const { result, loading, error: queryError } = useQuery(GET_THEME, { themeId });

      // Wait for query to complete
      await new Promise<void>((resolve) => {
        const unwatch = loading.value ?
          // @ts-ignore - Watch for loading to finish
          $watch(loading, (newVal) => {
            if (!newVal) {
              unwatch();
              resolve();
            }
          }) :
          resolve();
      });

      if (queryError.value) {
        throw queryError.value;
      }

      if (!result.value?.theme) {
        throw new Error(`Theme ${themeId} not found`);
      }

      const theme = result.value.theme;
      
      // Add to available themes if not already present
      if (!themeMap.value.has(themeId)) {
        availableThemes.value.push(theme);
      }

      logger.info(`Loaded theme: ${theme.displayName}`);
      return theme;
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to load theme: ${themeId}`;
      error.value = message;
      logger.error(`Failed to load theme ${themeId}:`, err);
      throw new Error(message);
    } finally {
      isLoading.value = false;
    }
  };

  const updateBoardTheme = async (input: UpdateBoardThemeInput): Promise<any> => {
    isLoading.value = true;
    error.value = null;

    try {
      const { mutate, loading, error: mutationError } = useMutation(UPDATE_BOARD_THEME);

      const result = await mutate({ input });

      if (mutationError.value) {
        throw mutationError.value;
      }

      logger.info(`Updated board ${input.boardId} theme to ${input.themeId}`);
      return result?.data?.updateBoardTheme;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update board theme';
      error.value = message;
      logger.error('Failed to update board theme:', err);
      throw new Error(message);
    } finally {
      isLoading.value = false;
    }
  };

  const applyTheme = async (themeId: string, customizations?: ThemeCustomizations): Promise<void> => {
    try {
      // Load theme if not already loaded
      const theme = await loadTheme(themeId);
      
      // Apply theme to document
      ThemeService.applyThemeToDocument(theme);
      
      // Apply customizations if provided
      if (customizations) {
        applyCustomizations(customizations);
      }

      currentTheme.value = theme;
      logger.info(`Applied theme: ${theme.displayName}`);
    } catch (err) {
      logger.error(`Failed to apply theme ${themeId}:`, err);
      throw err;
    }
  };

  const applyCustomizations = (customizations: ThemeCustomizations): void => {
    const root = document.documentElement;

    // Apply card style
    if (customizations.cardStyle) {
      document.body.className = document.body.className
        .replace(/card-(rounded|squared|textured)/g, '')
        .trim();
      document.body.classList.add(`card-${customizations.cardStyle}`);
    }

    // Apply animation intensity
    if (customizations.animationIntensity) {
      document.body.className = document.body.className
        .replace(/animation-(subtle|normal|playful)/g, '')
        .trim();
      document.body.classList.add(`animation-${customizations.animationIntensity}`);
    }

    // Apply typography scale
    if (customizations.typographyScale) {
      document.body.className = document.body.className
        .replace(/typography-(compact|comfortable|spacious)/g, '')
        .trim();
      document.body.classList.add(`typography-${customizations.typographyScale}`);
    }

    // Apply background variant if provided
    if (customizations.backgroundVariant) {
      root.style.setProperty('--bg-main-variant', customizations.backgroundVariant);
    }
  };

  const previewTheme = (theme: GhibliTheme, customizations?: ThemeCustomizations): Record<string, string> => {
    const vars = ThemeService.getThemeCSSVariables(theme);
    
    // Add customization classes to preview
    let classList = `animation-${theme.animations.intensity} typography-${theme.typography.scale}`;
    
    if (customizations) {
      if (customizations.cardStyle) {
        classList += ` card-${customizations.cardStyle}`;
      }
      if (customizations.animationIntensity) {
        classList = classList.replace(/animation-\w+/, `animation-${customizations.animationIntensity}`);
      }
      if (customizations.typographyScale) {
        classList = classList.replace(/typography-\w+/, `typography-${customizations.typographyScale}`);
      }
      if (customizations.backgroundVariant) {
        vars['--bg-main-variant'] = customizations.backgroundVariant;
      }
    }

    return { ...vars, '--preview-classes': classList };
  };

  const resetTheme = (): void => {
    // Reset to default theme (Spirited Away)
    applyTheme('spirited-away');
  };

  const clearError = (): void => {
    error.value = null;
  };

  // Initialize with themes load
  const initialize = async (): Promise<void> => {
    try {
      await loadThemes();
      // Apply default theme
      await applyTheme('spirited-away');
    } catch (err) {
      logger.error('Failed to initialize theme store:', err);
    }
  };

  return {
    // State
    availableThemes,
    currentTheme,
    isLoading,
    error,

    // Computed
    themeMap,

    // Actions
    loadThemes,
    loadTheme,
    updateBoardTheme,
    applyTheme,
    applyCustomizations,
    previewTheme,
    resetTheme,
    clearError,
    initialize,
  };
});