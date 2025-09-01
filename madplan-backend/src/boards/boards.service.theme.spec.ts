import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { Board, BoardDocument } from './board.entity';
import { List, ListDocument } from './list.entity';
import { Card, CardDocument } from './card.entity';
import { ThemesService } from '../themes/themes.service';
import { UpdateBoardThemeInput } from '../themes/dto/update-board-theme.dto';

describe('BoardsService - Theme Operations', () => {
  let service: BoardsService;
  let boardModel: Model<BoardDocument>;
  let themesService: ThemesService;

  const mockBoard = {
    _id: '64f5c8d4a8b2c1e2d3f4g5h6',
    id: '64f5c8d4a8b2c1e2d3f4g5h6',
    title: 'Test Board',
    ownerId: 'test-user-id',
    listOrder: [],
    theme: {
      themeId: 'spirited-away',
      customizations: {
        cardStyle: 'rounded',
        animationIntensity: 'normal',
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    toJSON: function() { return this; },
    toObject: function() { return this; },
  };

  const mockBoardModel = {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    exec: jest.fn(),
  };

  const mockListModel = {};
  const mockCardModel = {};

  const mockThemesService = {
    validateTheme: jest.fn(),
    validateThemeCustomizations: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardsService,
        {
          provide: getModelToken(Board.name),
          useValue: mockBoardModel,
        },
        {
          provide: getModelToken(List.name),
          useValue: mockListModel,
        },
        {
          provide: getModelToken(Card.name),
          useValue: mockCardModel,
        },
        {
          provide: ThemesService,
          useValue: mockThemesService,
        },
      ],
    }).compile();

    service = module.get<BoardsService>(BoardsService);
    boardModel = module.get<Model<BoardDocument>>(getModelToken(Board.name));
    themesService = module.get<ThemesService>(ThemesService);

    // Setup default mocks
    mockBoardModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockBoard),
    });
    mockBoardModel.findByIdAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        ...mockBoard,
        theme: { themeId: 'totoro', customizations: undefined },
      }),
    });
    mockThemesService.validateTheme.mockResolvedValue(true);
    mockThemesService.validateThemeCustomizations.mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateBoardTheme', () => {
    const updateInput: UpdateBoardThemeInput = {
      boardId: '64f5c8d4a8b2c1e2d3f4g5h6',
      themeId: 'totoro',
      customizations: {
        cardStyle: 'squared',
        animationIntensity: 'subtle',
      },
    };

    it('should successfully update board theme', async () => {
      const userId = 'test-user-id';
      
      const result = await service.updateBoardTheme(updateInput, userId);

      expect(result).toBeDefined();
      expect(result.theme.themeId).toBe('totoro');
      expect(mockBoardModel.findById).toHaveBeenCalledWith(updateInput.boardId);
      expect(themesService.validateTheme).toHaveBeenCalledWith('totoro');
      expect(themesService.validateThemeCustomizations).toHaveBeenCalledWith(updateInput.customizations);
      expect(mockBoardModel.findByIdAndUpdate).toHaveBeenCalled();
    });

    it('should update board theme without customizations', async () => {
      const inputWithoutCustomizations: UpdateBoardThemeInput = {
        boardId: '64f5c8d4a8b2c1e2d3f4g5h6',
        themeId: 'howls-castle',
      };

      await service.updateBoardTheme(inputWithoutCustomizations, 'test-user-id');

      expect(themesService.validateTheme).toHaveBeenCalledWith('howls-castle');
      expect(themesService.validateThemeCustomizations).toHaveBeenCalledWith(undefined);
    });

    it('should throw NotFoundException for non-existent board', async () => {
      mockBoardModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updateBoardTheme(updateInput, 'test-user-id')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for unauthorized user', async () => {
      const unauthorizedBoard = { ...mockBoard, ownerId: 'other-user-id' };
      mockBoardModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(unauthorizedBoard),
      });

      await expect(
        service.updateBoardTheme(updateInput, 'test-user-id')
      ).rejects.toThrow();
    });

    it('should throw BadRequestException for invalid theme', async () => {
      mockThemesService.validateTheme.mockResolvedValue(false);

      await expect(
        service.updateBoardTheme(updateInput, 'test-user-id')
      ).rejects.toThrow(BadRequestException);

      expect(themesService.validateTheme).toHaveBeenCalledWith('totoro');
    });

    it('should throw BadRequestException for invalid customizations', async () => {
      mockThemesService.validateThemeCustomizations.mockReturnValue(false);

      await expect(
        service.updateBoardTheme(updateInput, 'test-user-id')
      ).rejects.toThrow(BadRequestException);

      expect(themesService.validateThemeCustomizations).toHaveBeenCalledWith(updateInput.customizations);
    });

    it('should handle database update failure', async () => {
      mockBoardModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updateBoardTheme(updateInput, 'test-user-id')
      ).rejects.toThrow(NotFoundException);
    });

    it('should log theme update operation', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log');

      await service.updateBoardTheme(updateInput, 'test-user-id');

      expect(logSpy).toHaveBeenCalledWith('Updating theme for board 64f5c8d4a8b2c1e2d3f4g5h6 to totoro by user test-user-id');
      expect(logSpy).toHaveBeenCalledWith('Board theme updated successfully: 64f5c8d4a8b2c1e2d3f4g5h6');
    });

    it('should handle database errors gracefully', async () => {
      mockBoardModel.findById.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('Database connection error')),
      });

      await expect(
        service.updateBoardTheme(updateInput, 'test-user-id')
      ).rejects.toThrow(BadRequestException);
    });

    it('should use atomic update operation', async () => {
      await service.updateBoardTheme(updateInput, 'test-user-id');

      expect(mockBoardModel.findByIdAndUpdate).toHaveBeenCalledWith(
        updateInput.boardId,
        {
          $set: {
            theme: {
              themeId: updateInput.themeId,
              customizations: updateInput.customizations,
            },
          },
        },
        { new: true, runValidators: true }
      );
    });

    it('should handle theme service validation errors', async () => {
      mockThemesService.validateTheme.mockRejectedValue(new Error('Theme service error'));

      await expect(
        service.updateBoardTheme(updateInput, 'test-user-id')
      ).rejects.toThrow(BadRequestException);
    });
  });
});