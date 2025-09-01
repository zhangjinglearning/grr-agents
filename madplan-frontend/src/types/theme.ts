export enum CardStyle {
  ROUNDED = "rounded",
  SQUARED = "squared",
  TEXTURED = "textured",
}

export enum AnimationIntensity {
  SUBTLE = "subtle",
  NORMAL = "normal",
  PLAYFUL = "playful",
}

export enum TypographyScale {
  COMPACT = "compact",
  COMFORTABLE = "comfortable",
  SPACIOUS = "spacious",
}

export interface ColorPalette {
  primary: string[];
  secondary: string[];
  accent: string[];
  neutral: string[];
}

export interface ThemeBackgrounds {
  main: string;
  card: string;
  list: string;
}

export interface ThemeTypography {
  scale: TypographyScale;
  weight: string;
}

export interface ThemeAnimations {
  intensity: AnimationIntensity;
  duration: string;
}

export interface ThemeAccessibility {
  contrastRatio: number;
  colorBlindnessSupport: boolean;
  reducedMotion: boolean;
}

export interface ThemeCustomizations {
  backgroundVariant?: string;
  cardStyle?: CardStyle;
  animationIntensity?: AnimationIntensity;
  typographyScale?: TypographyScale;
}

export interface BoardTheme {
  themeId: string;
  customizations?: ThemeCustomizations;
}

export interface GhibliTheme {
  id: string;
  name: string;
  displayName: string;
  description: string;
  inspiration: string;
  colorPalette: ColorPalette;
  backgrounds: ThemeBackgrounds;
  typography: ThemeTypography;
  animations: ThemeAnimations;
  accessibility: ThemeAccessibility;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UpdateBoardThemeInput {
  boardId: string;
  themeId: string;
  customizations?: ThemeCustomizations;
}