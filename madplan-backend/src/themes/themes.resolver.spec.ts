import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ThemesResolver } from './themes.resolver';
import { ThemesService } from './themes.service';
import { Theme, TypographyScale, AnimationIntensity } from './theme.entity';

describe('ThemesResolver', () => {
  let resolver: ThemesResolver;
  let service: ThemesService;

  const mockTheme: Partial<Theme> = {
    id: '64f5c8d4a8b2c1e2d3f4g5h6',
    name: 'spirited-away',
    displayName: 'Spirited Away',
    description: 'Mystical bath house theme',
    inspiration: 'Spirited Away - The magical world of the spirit realm',
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
    }
  };

  const mockThemesService = {
    getAllThemes: jest.fn(),
    getThemeById: jest.fn(),
  };

  const mockAuthGuard = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest();
      request.user = { id: 'test-user-id' };
      return true;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThemesResolver,
        {
          provide: ThemesService,
          useValue: mockThemesService,
        },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .compile();

    resolver = module.get<ThemesResolver>(ThemesResolver);
    service = module.get<ThemesService>(ThemesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('getThemes', () => {
    it('should return all themes', async () => {
      const expectedThemes = [mockTheme];
      mockThemesService.getAllThemes.mockResolvedValue(expectedThemes);

      const context = {
        req: {
          user: { id: 'test-user-id' }
        }
      };

      const result = await resolver.getThemes(context);

      expect(result).toEqual(expectedThemes);
      expect(service.getAllThemes).toHaveBeenCalled();
    });

    it('should log user request', async () => {
      const logSpy = jest.spyOn(resolver['logger'], 'log');
      mockThemesService.getAllThemes.mockResolvedValue([mockTheme]);

      const context = {
        req: {
          user: { id: 'test-user-id' }
        }
      };

      await resolver.getThemes(context);

      expect(logSpy).toHaveBeenCalledWith('User test-user-id requested all themes');
    });

    it('should handle service errors', async () => {
      mockThemesService.getAllThemes.mockRejectedValue(new Error('Service error'));

      const context = {
        req: {
          user: { id: 'test-user-id' }
        }
      };

      await expect(resolver.getThemes(context)).rejects.toThrow('Service error');
    });
  });

  describe('getTheme', () => {
    const themeId = 'spirited-away';

    it('should return a specific theme', async () => {
      mockThemesService.getThemeById.mockResolvedValue(mockTheme);

      const context = {
        req: {
          user: { id: 'test-user-id' }
        }
      };

      const result = await resolver.getTheme(themeId, context);

      expect(result).toEqual(mockTheme);
      expect(service.getThemeById).toHaveBeenCalledWith(themeId);
    });

    it('should log user request with theme ID', async () => {
      const logSpy = jest.spyOn(resolver['logger'], 'log');
      mockThemesService.getThemeById.mockResolvedValue(mockTheme);

      const context = {
        req: {
          user: { id: 'test-user-id' }
        }
      };

      await resolver.getTheme(themeId, context);

      expect(logSpy).toHaveBeenCalledWith(`User test-user-id requested theme: ${themeId}`);
    });

    it('should handle NotFoundException from service', async () => {
      const notFoundError = new Error('Theme not found');
      notFoundError.name = 'NotFoundException';
      mockThemesService.getThemeById.mockRejectedValue(notFoundError);

      const context = {
        req: {
          user: { id: 'test-user-id' }
        }
      };

      await expect(resolver.getTheme(themeId, context)).rejects.toThrow(notFoundError);
    });

    it('should handle service errors', async () => {
      mockThemesService.getThemeById.mockRejectedValue(new Error('Service error'));

      const context = {
        req: {
          user: { id: 'test-user-id' }
        }
      };

      await expect(resolver.getTheme(themeId, context)).rejects.toThrow('Service error');
    });
  });

  describe('authentication', () => {
    it('should require authentication for getThemes', () => {
      const guards = Reflect.getMetadata('__guards__', ThemesResolver);
      expect(guards).toBeDefined();
      expect(guards.length).toBeGreaterThan(0);
    });

    it('should require authentication for getTheme', () => {
      const guards = Reflect.getMetadata('__guards__', ThemesResolver.prototype.getTheme);
      expect(guards).toBeDefined();
    });
  });

  describe('GraphQL schema integration', () => {
    it('should have proper Query decorators', () => {
      const queryMetadata = Reflect.getMetadata('graphql:query_mapping', resolver.getThemes);
      expect(queryMetadata).toBeDefined();
    });

    it('should have proper return type decorators', () => {
      const returnTypeMetadata = Reflect.getMetadata('design:returntype', resolver.getThemes);
      expect(returnTypeMetadata).toBeDefined();
    });

    it('should handle context parameter correctly', () => {
      const paramMetadata = Reflect.getMetadata('design:paramtypes', resolver.getThemes);
      expect(paramMetadata).toBeDefined();
    });
  });
});