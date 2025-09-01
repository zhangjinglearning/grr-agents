import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ThemesService } from './themes.service';
import { Theme, ThemeDocument, CardStyle, AnimationIntensity, TypographyScale } from './theme.entity';

describe('ThemesService', () => {
  let service: ThemesService;
  let model: Model<ThemeDocument>;

  const mockTheme = {
    _id: '64f5c8d4a8b2c1e2d3f4g5h6',
    name: 'test-theme',
    displayName: 'Test Theme',
    description: 'A test theme',
    inspiration: 'Test inspiration',
    colorPalette: {
      primary: ['#6B46C1', '#7C3AED', '#8B5CF6'],
      secondary: ['#F59E0B', '#FBBF24', '#FCD34D'],
      accent: ['#0D9488', '#14B8A6', '#2DD4BF'],
      neutral: ['#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#F3F4F6']
    },
    backgrounds: {
      main: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      card: 'rgba(255, 255, 255, 0.95)',
      list: 'rgba(255, 255, 255, 0.9)'
    },
    typography: {
      scale: TypographyScale.COMFORTABLE,
      weight: 'normal'
    },
    animations: {
      intensity: AnimationIntensity.NORMAL,
      duration: '0.3s'
    },
    accessibility: {
      contrastRatio: 4.5,
      colorBlindnessSupport: true,
      reducedMotion: true
    },
    toJSON: () => mockTheme,
    toObject: () => mockTheme,
  };

  const mockThemeModel = {
    countDocuments: jest.fn(),
    create: jest.fn(),
    find: jest.fn(() => ({
      lean: jest.fn().mockResolvedValue([mockTheme]),
    })),
    findOne: jest.fn(() => ({
      lean: jest.fn().mockResolvedValue(mockTheme),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThemesService,
        {
          provide: getModelToken(Theme.name),
          useValue: mockThemeModel,
        },
      ],
    }).compile();

    service = module.get<ThemesService>(ThemesService);
    model = module.get<Model<ThemeDocument>>(getModelToken(Theme.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllThemes', () => {
    it('should return all themes', async () => {
      const result = await service.getAllThemes();

      expect(result).toEqual([mockTheme]);
      expect(model.find).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockThemeModel.find.mockImplementation(() => ({
        lean: jest.fn().mockRejectedValue(new Error('Database error')),
      }));

      await expect(service.getAllThemes()).rejects.toThrow('Failed to retrieve themes');
    });
  });

  describe('getThemeById', () => {
    it('should return a theme by ID', async () => {
      const result = await service.getThemeById('test-theme');

      expect(result).toEqual(mockTheme);
      expect(model.findOne).toHaveBeenCalledWith({ name: 'test-theme' });
    });

    it('should throw NotFoundException when theme not found', async () => {
      mockThemeModel.findOne.mockImplementation(() => ({
        lean: jest.fn().mockResolvedValue(null),
      }));

      await expect(service.getThemeById('non-existent')).rejects.toThrow('Theme with ID non-existent not found');
    });

    it('should handle database errors', async () => {
      mockThemeModel.findOne.mockImplementation(() => ({
        lean: jest.fn().mockRejectedValue(new Error('Database error')),
      }));

      await expect(service.getThemeById('test-theme')).rejects.toThrow('Failed to retrieve theme: test-theme');
    });
  });

  describe('validateTheme', () => {
    it('should return true for existing theme', async () => {
      const result = await service.validateTheme('test-theme');

      expect(result).toBe(true);
      expect(model.findOne).toHaveBeenCalledWith({ name: 'test-theme' });
    });

    it('should return false for non-existent theme', async () => {
      mockThemeModel.findOne.mockImplementation(() => ({
        lean: jest.fn().mockResolvedValue(null),
      }));

      const result = await service.validateTheme('non-existent');

      expect(result).toBe(false);
    });

    it('should return false on database error', async () => {
      mockThemeModel.findOne.mockImplementation(() => ({
        lean: jest.fn().mockRejectedValue(new Error('Database error')),
      }));

      const result = await service.validateTheme('test-theme');

      expect(result).toBe(false);
    });
  });

  describe('validateThemeCustomizations', () => {
    it('should return true for valid customizations', () => {
      const customizations = {
        cardStyle: CardStyle.ROUNDED,
        animationIntensity: AnimationIntensity.SUBTLE,
        typographyScale: TypographyScale.COMPACT,
        backgroundVariant: 'dark',
      };

      const result = service.validateThemeCustomizations(customizations);

      expect(result).toBe(true);
    });

    it('should return true for empty customizations', () => {
      const result = service.validateThemeCustomizations(null);

      expect(result).toBe(true);
    });

    it('should return false for invalid card style', () => {
      const customizations = {
        cardStyle: 'invalid-style' as CardStyle,
      };

      const result = service.validateThemeCustomizations(customizations);

      expect(result).toBe(false);
    });

    it('should return false for invalid animation intensity', () => {
      const customizations = {
        animationIntensity: 'invalid-intensity' as AnimationIntensity,
      };

      const result = service.validateThemeCustomizations(customizations);

      expect(result).toBe(false);
    });

    it('should return false for invalid typography scale', () => {
      const customizations = {
        typographyScale: 'invalid-scale' as TypographyScale,
      };

      const result = service.validateThemeCustomizations(customizations);

      expect(result).toBe(false);
    });
  });

  describe('theme initialization', () => {
    it('should create default themes when none exist', async () => {
      mockThemeModel.countDocuments.mockResolvedValue(0);
      mockThemeModel.create.mockResolvedValue(mockTheme);

      // Create a new service instance to trigger initialization
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ThemesService,
          {
            provide: getModelToken(Theme.name),
            useValue: mockThemeModel,
          },
        ],
      }).compile();

      const newService = module.get<ThemesService>(ThemesService);

      // Allow time for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockThemeModel.countDocuments).toHaveBeenCalled();
    });

    it('should not create themes when they already exist', async () => {
      mockThemeModel.countDocuments.mockResolvedValue(4);

      // Create a new service instance to trigger initialization
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ThemesService,
          {
            provide: getModelToken(Theme.name),
            useValue: mockThemeModel,
          },
        ],
      }).compile();

      const newService = module.get<ThemesService>(ThemesService);

      // Allow time for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockThemeModel.countDocuments).toHaveBeenCalled();
      expect(mockThemeModel.create).not.toHaveBeenCalled();
    });
  });
});