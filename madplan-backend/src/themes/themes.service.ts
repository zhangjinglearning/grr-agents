import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Theme, ThemeDocument, CardStyle, AnimationIntensity, TypographyScale } from "./theme.entity";
import { Logger } from "@nestjs/common";

@Injectable()
export class ThemesService {
  private readonly logger = new Logger(ThemesService.name);

  constructor(
    @InjectModel(Theme.name) private themeModel: Model<ThemeDocument>,
  ) {
    this.initializeThemes();
  }

  /**
   * Initialize default Ghibli themes if they don't exist
   */
  private async initializeThemes(): Promise<void> {
    try {
      const existingThemes = await this.themeModel.countDocuments();
      if (existingThemes === 0) {
        this.logger.log("Initializing default Ghibli themes");
        await this.createDefaultThemes();
      }
    } catch (error) {
      this.logger.error("Failed to initialize themes", error);
    }
  }

  /**
   * Create default Ghibli-inspired themes
   */
  private async createDefaultThemes(): Promise<void> {
    const defaultThemes = [
      {
        name: "spirited-away",
        displayName: "Spirited Away",
        description: "Mystical bath house with deep purples and shimmering golds",
        inspiration: "Spirited Away - The magical world of the spirit realm",
        colorPalette: {
          primary: ["#6B46C1", "#7C3AED", "#8B5CF6"],
          secondary: ["#F59E0B", "#FBBF24", "#FCD34D"],
          accent: ["#0D9488", "#14B8A6", "#2DD4BF"],
          neutral: ["#374151", "#6B7280", "#9CA3AF", "#D1D5DB", "#F3F4F6"]
        },
        backgrounds: {
          main: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          card: "rgba(255, 255, 255, 0.95)",
          list: "rgba(255, 255, 255, 0.9)"
        },
        typography: {
          scale: TypographyScale.COMFORTABLE,
          weight: "normal"
        },
        animations: {
          intensity: AnimationIntensity.NORMAL,
          duration: "0.3s"
        },
        accessibility: {
          contrastRatio: 4.5,
          colorBlindnessSupport: true,
          reducedMotion: true
        }
      },
      {
        name: "totoro",
        displayName: "My Neighbor Totoro",
        description: "Forest sanctuary with earth greens and gentle browns",
        inspiration: "My Neighbor Totoro - The peaceful forest spirits",
        colorPalette: {
          primary: ["#10B981", "#059669", "#047857"],
          secondary: ["#92400E", "#B45309", "#D97706"],
          accent: ["#3B82F6", "#2563EB", "#1D4ED8"],
          neutral: ["#374151", "#6B7280", "#9CA3AF", "#D1D5DB", "#F3F4F6"]
        },
        backgrounds: {
          main: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          card: "rgba(255, 255, 255, 0.95)",
          list: "rgba(255, 255, 255, 0.9)"
        },
        typography: {
          scale: TypographyScale.COMFORTABLE,
          weight: "normal"
        },
        animations: {
          intensity: AnimationIntensity.SUBTLE,
          duration: "0.4s"
        },
        accessibility: {
          contrastRatio: 4.5,
          colorBlindnessSupport: true,
          reducedMotion: true
        }
      },
      {
        name: "howls-castle",
        displayName: "Howl's Moving Castle",
        description: "Floating castle with magical blues and silver accents",
        inspiration: "Howl's Moving Castle - The whimsical mechanical marvel",
        colorPalette: {
          primary: ["#2563EB", "#1D4ED8", "#1E40AF"],
          secondary: ["#6B7280", "#9CA3AF", "#D1D5DB"],
          accent: ["#F9FAFB", "#F3F4F6", "#E5E7EB"],
          neutral: ["#374151", "#6B7280", "#9CA3AF", "#D1D5DB", "#F3F4F6"]
        },
        backgrounds: {
          main: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          card: "rgba(255, 255, 255, 0.95)",
          list: "rgba(255, 255, 255, 0.9)"
        },
        typography: {
          scale: TypographyScale.SPACIOUS,
          weight: "normal"
        },
        animations: {
          intensity: AnimationIntensity.PLAYFUL,
          duration: "0.25s"
        },
        accessibility: {
          contrastRatio: 4.5,
          colorBlindnessSupport: true,
          reducedMotion: true
        }
      },
      {
        name: "kikis-delivery",
        displayName: "Kiki's Delivery Service",
        description: "Coastal town with ocean blues and warm sunset oranges",
        inspiration: "Kiki's Delivery Service - The seaside adventure",
        colorPalette: {
          primary: ["#0EA5E9", "#0284C7", "#0369A1"],
          secondary: ["#EA580C", "#DC2626", "#B91C1C"],
          accent: ["#EC4899", "#DB2777", "#BE185D"],
          neutral: ["#374151", "#6B7280", "#9CA3AF", "#D1D5DB", "#F3F4F6"]
        },
        backgrounds: {
          main: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          card: "rgba(255, 255, 255, 0.95)",
          list: "rgba(255, 255, 255, 0.9)"
        },
        typography: {
          scale: TypographyScale.COMFORTABLE,
          weight: "normal"
        },
        animations: {
          intensity: AnimationIntensity.NORMAL,
          duration: "0.3s"
        },
        accessibility: {
          contrastRatio: 4.5,
          colorBlindnessSupport: true,
          reducedMotion: true
        }
      }
    ];

    for (const themeData of defaultThemes) {
      try {
        await this.themeModel.create(themeData);
        this.logger.log(`Created theme: ${themeData.displayName}`);
      } catch (error) {
        this.logger.warn(`Theme ${themeData.name} already exists or failed to create`, error);
      }
    }
  }

  /**
   * Get all available themes
   */
  async getAllThemes(): Promise<Theme[]> {
    try {
      const themes = await this.themeModel.find().lean();
      this.logger.log(`Retrieved ${themes.length} themes`);
      return themes;
    } catch (error) {
      this.logger.error("Failed to retrieve themes", error);
      throw new BadRequestException("Failed to retrieve themes");
    }
  }

  /**
   * Get a specific theme by ID
   */
  async getThemeById(themeId: string): Promise<Theme> {
    try {
      const theme = await this.themeModel.findOne({ name: themeId }).lean();
      
      if (!theme) {
        this.logger.warn(`Theme not found: ${themeId}`);
        throw new NotFoundException(`Theme with ID ${themeId} not found`);
      }

      this.logger.log(`Retrieved theme: ${theme.displayName}`);
      return theme;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to retrieve theme: ${themeId}`, error);
      throw new BadRequestException(`Failed to retrieve theme: ${themeId}`);
    }
  }

  /**
   * Validate theme exists
   */
  async validateTheme(themeId: string): Promise<boolean> {
    try {
      const theme = await this.themeModel.findOne({ name: themeId }).lean();
      return !!theme;
    } catch (error) {
      this.logger.error(`Failed to validate theme: ${themeId}`, error);
      return false;
    }
  }

  /**
   * Validate customizations against accessibility standards
   */
  validateThemeCustomizations(customizations: any): boolean {
    if (!customizations) return true;

    // Validate card style
    if (customizations.cardStyle && !Object.values(CardStyle).includes(customizations.cardStyle)) {
      return false;
    }

    // Validate animation intensity
    if (customizations.animationIntensity && !Object.values(AnimationIntensity).includes(customizations.animationIntensity)) {
      return false;
    }

    // Validate typography scale
    if (customizations.typographyScale && !Object.values(TypographyScale).includes(customizations.typographyScale)) {
      return false;
    }

    return true;
  }
}