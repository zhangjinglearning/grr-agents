import { gql } from '@apollo/client/core';
import { GhibliTheme, UpdateBoardThemeInput } from '../types/theme';
import { validateThemeAccessibility, applyAccessibilityEnhancements, announceThemeChange } from '../utils/accessibility';

// GraphQL Queries
const GET_THEMES = gql`
  query GetThemes {
    themes {
      id
      name
      displayName
      description
      inspiration
      colorPalette {
        primary
        secondary
        accent
        neutral
      }
      backgrounds {
        main
        card
        list
      }
      typography {
        scale
        weight
      }
      animations {
        intensity
        duration
      }
      accessibility {
        contrastRatio
        colorBlindnessSupport
        reducedMotion
      }
    }
  }
`;

const GET_THEME = gql`
  query GetTheme($themeId: String!) {
    theme(themeId: $themeId) {
      id
      name
      displayName
      description
      inspiration
      colorPalette {
        primary
        secondary
        accent
        neutral
      }
      backgrounds {
        main
        card
        list
      }
      typography {
        scale
        weight
      }
      animations {
        intensity
        duration
      }
      accessibility {
        contrastRatio
        colorBlindnessSupport
        reducedMotion
      }
    }
  }
`;

const UPDATE_BOARD_THEME = gql`
  mutation UpdateBoardTheme($input: UpdateBoardThemeInput!) {
    updateBoardTheme(input: $input) {
      id
      title
      theme {
        themeId
        customizations {
          backgroundVariant
          cardStyle
          animationIntensity
          typographyScale
        }
      }
    }
  }
`;

// Export GraphQL queries for use in composables
export { GET_THEMES, GET_THEME, UPDATE_BOARD_THEME };

export class ThemeService {

  /**
   * Apply theme CSS variables to document with accessibility validation
   */
  static applyThemeToDocument(theme: GhibliTheme): void {
    // Validate theme accessibility before applying
    const validation = validateThemeAccessibility(theme);
    
    if (!validation.isValid) {
      console.warn(`Theme ${theme.displayName} has accessibility issues:`, validation.errors);
    }
    
    if (validation.warnings.length > 0) {
      console.info(`Theme ${theme.displayName} accessibility warnings:`, validation.warnings);
    }
    const root = document.documentElement;

    // Apply color palette
    root.style.setProperty('--color-primary', theme.colorPalette.primary[0]);
    root.style.setProperty('--color-primary-light', theme.colorPalette.primary[1]);
    root.style.setProperty('--color-primary-dark', theme.colorPalette.primary[2]);

    root.style.setProperty('--color-secondary', theme.colorPalette.secondary[0]);
    root.style.setProperty('--color-secondary-light', theme.colorPalette.secondary[1]);
    root.style.setProperty('--color-secondary-dark', theme.colorPalette.secondary[2]);

    root.style.setProperty('--color-accent', theme.colorPalette.accent[0]);
    root.style.setProperty('--color-accent-light', theme.colorPalette.accent[1]);
    root.style.setProperty('--color-accent-dark', theme.colorPalette.accent[2]);

    // Apply neutral colors
    root.style.setProperty('--color-gray-900', theme.colorPalette.neutral[0]);
    root.style.setProperty('--color-gray-600', theme.colorPalette.neutral[1]);
    root.style.setProperty('--color-gray-400', theme.colorPalette.neutral[2]);
    root.style.setProperty('--color-gray-200', theme.colorPalette.neutral[3]);
    root.style.setProperty('--color-gray-50', theme.colorPalette.neutral[4]);

    // Apply backgrounds
    root.style.setProperty('--bg-main', theme.backgrounds.main);
    root.style.setProperty('--bg-card', theme.backgrounds.card);
    root.style.setProperty('--bg-list', theme.backgrounds.list);

    // Apply animation duration
    root.style.setProperty('--animation-duration', theme.animations.duration);

    // Apply animation intensity through CSS class
    document.body.className = document.body.className
      .replace(/animation-(subtle|normal|playful)/g, '')
      .trim();
    document.body.classList.add(`animation-${theme.animations.intensity}`);

    // Apply typography scale through CSS class  
    document.body.className = document.body.className
      .replace(/typography-(compact|comfortable|spacious)/g, '')
      .trim();
    document.body.classList.add(`typography-${theme.typography.scale}`);

    // Store theme name for reference
    root.setAttribute('data-theme', theme.name);
    
    // Apply accessibility enhancements
    applyAccessibilityEnhancements();
    
    // Announce theme change to screen readers
    announceThemeChange(theme.displayName);
  }

  /**
   * Get CSS variables for a theme (for preview purposes)
   */
  static getThemeCSSVariables(theme: GhibliTheme): Record<string, string> {
    return {
      '--color-primary': theme.colorPalette.primary[0],
      '--color-primary-light': theme.colorPalette.primary[1],
      '--color-primary-dark': theme.colorPalette.primary[2],
      '--color-secondary': theme.colorPalette.secondary[0],
      '--color-secondary-light': theme.colorPalette.secondary[1],
      '--color-secondary-dark': theme.colorPalette.secondary[2],
      '--color-accent': theme.colorPalette.accent[0],
      '--color-accent-light': theme.colorPalette.accent[1],
      '--color-accent-dark': theme.colorPalette.accent[2],
      '--color-gray-900': theme.colorPalette.neutral[0],
      '--color-gray-600': theme.colorPalette.neutral[1],
      '--color-gray-400': theme.colorPalette.neutral[2],
      '--color-gray-200': theme.colorPalette.neutral[3],
      '--color-gray-50': theme.colorPalette.neutral[4],
      '--bg-main': theme.backgrounds.main,
      '--bg-card': theme.backgrounds.card,
      '--bg-list': theme.backgrounds.list,
      '--animation-duration': theme.animations.duration,
    };
  }
}