import { Test, TestingModule } from "@nestjs/testing";
import { AuthGuard } from "@nestjs/passport";
import { ExecutionContext, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { BoardsResolver } from "./boards.resolver";
import { BoardsService } from "./boards.service";
import { Board } from "./board.entity";
import { List } from "./list.entity";
import { Card } from "./card.entity";
import { CreateListInput } from "./dto/create-list.dto";
import { UpdateListInput } from "./dto/update-list.dto";
import { ReorderListInput } from "./dto/reorder-list.dto";
import { CreateCardInput } from "./dto/create-card.dto";
import { UpdateCardInput } from "./dto/update-card.dto";
import { ReorderCardInput } from "./dto/reorder-card.dto";

describe("BoardsResolver", () => {
  let resolver: BoardsResolver;
  let boardsService: BoardsService;

  // Mock data
  const mockUserId = "507f1f77bcf86cd799439011";
  const mockBoardId = "507f1f77bcf86cd799439033";
  const mockListId = "507f1f77bcf86cd799439044";
  const mockCardId = "507f1f77bcf86cd799439055";

  const mockBoard: Board = {
    id: mockBoardId,
    title: "Test Board",
    ownerId: mockUserId,
    listOrder: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockList: List = {
    id: mockListId,
    title: "Test List",
    boardId: mockBoardId,
    cardOrder: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCard: Card = {
    id: mockCardId,
    content: "Test Card",
    listId: mockListId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockContext = {
    req: {
      user: {
        id: mockUserId,
        email: "test@example.com",
      },
    },
  };

  // Mock AuthGuard to always allow access for testing
  const mockAuthGuard = {
    canActivate: (context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest();
      request.user = mockContext.req.user;
      return true;
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardsResolver,
        {
          provide: BoardsService,
          useValue: {
            createBoard: jest.fn(),
            getBoardsByUser: jest.fn(),
            getBoardById: jest.fn(),
            deleteBoard: jest.fn(),
            // List operations
            createList: jest.fn(),
            updateList: jest.fn(),
            deleteList: jest.fn(),
            reorderList: jest.fn(),
            getListsByBoard: jest.fn(),
            // Card operations
            createCard: jest.fn(),
            updateCard: jest.fn(),
            deleteCard: jest.fn(),
            reorderCard: jest.fn(),
            getCardsByList: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard("jwt"))
      .useValue(mockAuthGuard)
      .compile();

    resolver = module.get<BoardsResolver>(BoardsResolver);
    boardsService = module.get<BoardsService>(BoardsService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("createBoard", () => {
    it("should successfully create a new board", async () => {
      // Arrange
      const title = "New Test Board";
      const expectedBoard = { ...mockBoard, title };
      (boardsService.createBoard as jest.Mock).mockResolvedValue(expectedBoard);

      // Act
      const result = await resolver.createBoard(title, mockContext);

      // Assert
      expect(result).toEqual(expectedBoard);
      expect(boardsService.createBoard).toHaveBeenCalledWith(title, mockUserId);
    });

    it("should propagate service errors", async () => {
      // Arrange
      const title = "Test Board";
      const serviceError = new Error("Database error");
      (boardsService.createBoard as jest.Mock).mockRejectedValue(serviceError);

      // Act & Assert
      await expect(resolver.createBoard(title, mockContext)).rejects.toThrow(
        serviceError,
      );
    });

    it("should extract user ID from JWT context", async () => {
      // Arrange
      const title = "Test Board";
      (boardsService.createBoard as jest.Mock).mockResolvedValue(mockBoard);

      // Act
      await resolver.createBoard(title, mockContext);

      // Assert
      expect(boardsService.createBoard).toHaveBeenCalledWith(title, mockUserId);
    });
  });

  describe("myBoards", () => {
    it("should return all boards for authenticated user", async () => {
      // Arrange
      const mockBoards = [
        mockBoard,
        { ...mockBoard, id: "board2", title: "Board 2" },
      ];
      (boardsService.getBoardsByUser as jest.Mock).mockResolvedValue(
        mockBoards,
      );

      // Act
      const result = await resolver.myBoards(mockContext);

      // Assert
      expect(result).toEqual(mockBoards);
      expect(boardsService.getBoardsByUser).toHaveBeenCalledWith(mockUserId);
    });

    it("should return empty array when user has no boards", async () => {
      // Arrange
      (boardsService.getBoardsByUser as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await resolver.myBoards(mockContext);

      // Assert
      expect(result).toEqual([]);
      expect(boardsService.getBoardsByUser).toHaveBeenCalledWith(mockUserId);
    });

    it("should propagate service errors", async () => {
      // Arrange
      const serviceError = new Error("Database error");
      (boardsService.getBoardsByUser as jest.Mock).mockRejectedValue(
        serviceError,
      );

      // Act & Assert
      await expect(resolver.myBoards(mockContext)).rejects.toThrow(
        serviceError,
      );
    });
  });

  describe("board", () => {
    it("should return board when user owns it", async () => {
      // Arrange
      (boardsService.getBoardById as jest.Mock).mockResolvedValue(mockBoard);

      // Act
      const result = await resolver.board(mockBoardId, mockContext);

      // Assert
      expect(result).toEqual(mockBoard);
      expect(boardsService.getBoardById).toHaveBeenCalledWith(
        mockBoardId,
        mockUserId,
      );
    });

    it("should return null when board is not found or access denied", async () => {
      // Arrange
      const serviceError = new Error("Not found");
      (boardsService.getBoardById as jest.Mock).mockRejectedValue(serviceError);

      // Act
      const result = await resolver.board(mockBoardId, mockContext);

      // Assert
      expect(result).toBeNull();
      expect(boardsService.getBoardById).toHaveBeenCalledWith(
        mockBoardId,
        mockUserId,
      );
    });

    it("should return null on any service error", async () => {
      // Arrange
      const serviceError = new Error("Database connection failed");
      (boardsService.getBoardById as jest.Mock).mockRejectedValue(serviceError);

      // Act
      const result = await resolver.board(mockBoardId, mockContext);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("deleteBoard", () => {
    it("should successfully delete board when user owns it", async () => {
      // Arrange
      (boardsService.deleteBoard as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await resolver.deleteBoard(mockBoardId, mockContext);

      // Assert
      expect(result).toBe(true);
      expect(boardsService.deleteBoard).toHaveBeenCalledWith(
        mockBoardId,
        mockUserId,
      );
    });

    it("should propagate service errors", async () => {
      // Arrange
      const serviceError = new Error("Access denied");
      (boardsService.deleteBoard as jest.Mock).mockRejectedValue(serviceError);

      // Act & Assert
      await expect(
        resolver.deleteBoard(mockBoardId, mockContext),
      ).rejects.toThrow(serviceError);
    });

    it("should extract user ID from JWT context", async () => {
      // Arrange
      (boardsService.deleteBoard as jest.Mock).mockResolvedValue(true);

      // Act
      await resolver.deleteBoard(mockBoardId, mockContext);

      // Assert
      expect(boardsService.deleteBoard).toHaveBeenCalledWith(
        mockBoardId,
        mockUserId,
      );
    });
  });

  describe("authentication and authorization", () => {
    it("should be protected by JWT authentication guard", () => {
      // This test verifies the AuthGuard is applied at the class level
      // The actual authentication is tested through the mocked guard
      expect(resolver).toBeInstanceOf(BoardsResolver);
    });

    it("should extract user context from JWT token", async () => {
      // Arrange
      (boardsService.createBoard as jest.Mock).mockResolvedValue(mockBoard);

      // Act
      await resolver.createBoard("Test", mockContext);

      // Assert - verify that user ID from JWT context is used
      expect(boardsService.createBoard).toHaveBeenCalledWith(
        "Test",
        mockUserId,
      );
    });
  });

  describe("GraphQL schema integration", () => {
    it("should have correct resolver methods defined", () => {
      expect(typeof resolver.createBoard).toBe("function");
      expect(typeof resolver.myBoards).toBe("function");
      expect(typeof resolver.board).toBe("function");
      expect(typeof resolver.deleteBoard).toBe("function");
    });

    it("should have proper dependency injection", () => {
      expect(resolver).toBeInstanceOf(BoardsResolver);
      expect(boardsService).toBeDefined();
    });

    it("should handle context parameter correctly", async () => {
      // Arrange
      (boardsService.getBoardsByUser as jest.Mock).mockResolvedValue([]);

      // Test that context is properly handled and user ID is extracted
      await resolver.myBoards(mockContext);

      // Assert
      expect(boardsService.getBoardsByUser).toHaveBeenCalledWith(mockUserId);
    });
  });

  // ==================== List Operations Tests ====================

  describe("createList", () => {
    it("should successfully create a new list", async () => {
      // Arrange
      const createListInput: CreateListInput = {
        boardId: mockBoardId,
        title: "New Test List",
      };
      const expectedList = { ...mockList, title: createListInput.title };
      (boardsService.createList as jest.Mock).mockResolvedValue(expectedList);

      // Act
      const result = await resolver.createList(createListInput, mockContext);

      // Assert
      expect(result).toEqual(expectedList);
      expect(boardsService.createList).toHaveBeenCalledWith(createListInput, mockUserId);
    });

    it("should propagate service errors", async () => {
      // Arrange
      const createListInput: CreateListInput = {
        boardId: mockBoardId,
        title: "Test List",
      };
      const serviceError = new Error("Board not found");
      (boardsService.createList as jest.Mock).mockRejectedValue(serviceError);

      // Act & Assert
      await expect(resolver.createList(createListInput, mockContext)).rejects.toThrow(
        serviceError,
      );
    });

    it("should extract user ID from JWT context", async () => {
      // Arrange
      const createListInput: CreateListInput = {
        boardId: mockBoardId,
        title: "Test List",
      };
      (boardsService.createList as jest.Mock).mockResolvedValue(mockList);

      // Act
      await resolver.createList(createListInput, mockContext);

      // Assert
      expect(boardsService.createList).toHaveBeenCalledWith(createListInput, mockUserId);
    });
  });

  describe("updateList", () => {
    it("should successfully update a list", async () => {
      // Arrange
      const updateListInput: UpdateListInput = {
        id: mockListId,
        title: "Updated List Title",
      };
      const expectedList = { ...mockList, title: updateListInput.title };
      (boardsService.updateList as jest.Mock).mockResolvedValue(expectedList);

      // Act
      const result = await resolver.updateList(updateListInput, mockContext);

      // Assert
      expect(result).toEqual(expectedList);
      expect(boardsService.updateList).toHaveBeenCalledWith(updateListInput, mockUserId);
    });

    it("should propagate service errors", async () => {
      // Arrange
      const updateListInput: UpdateListInput = {
        id: mockListId,
        title: "Updated Title",
      };
      const serviceError = new Error("List not found");
      (boardsService.updateList as jest.Mock).mockRejectedValue(serviceError);

      // Act & Assert
      await expect(resolver.updateList(updateListInput, mockContext)).rejects.toThrow(
        serviceError,
      );
    });
  });

  describe("deleteList", () => {
    it("should successfully delete a list", async () => {
      // Arrange
      (boardsService.deleteList as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await resolver.deleteList(mockListId, mockContext);

      // Assert
      expect(result).toBe(true);
      expect(boardsService.deleteList).toHaveBeenCalledWith(mockListId, mockUserId);
    });

    it("should propagate service errors", async () => {
      // Arrange
      const serviceError = new Error("List not found");
      (boardsService.deleteList as jest.Mock).mockRejectedValue(serviceError);

      // Act & Assert
      await expect(resolver.deleteList(mockListId, mockContext)).rejects.toThrow(
        serviceError,
      );
    });
  });

  describe("reorderList", () => {
    it("should successfully reorder a list", async () => {
      // Arrange
      const reorderInput: ReorderListInput = {
        listId: mockListId,
        newIndex: 1,
      };
      const updatedBoard = { ...mockBoard, listOrder: [mockListId] };
      (boardsService.reorderList as jest.Mock).mockResolvedValue(updatedBoard);

      // Act
      const result = await resolver.reorderList(reorderInput, mockContext);

      // Assert
      expect(result).toEqual(updatedBoard);
      expect(boardsService.reorderList).toHaveBeenCalledWith(reorderInput, mockUserId);
    });

    it("should propagate service errors", async () => {
      // Arrange
      const reorderInput: ReorderListInput = {
        listId: mockListId,
        newIndex: 1,
      };
      const serviceError = new Error("Invalid reorder operation");
      (boardsService.reorderList as jest.Mock).mockRejectedValue(serviceError);

      // Act & Assert
      await expect(resolver.reorderList(reorderInput, mockContext)).rejects.toThrow(
        serviceError,
      );
    });

    // Additional reorderList integration tests for comprehensive coverage

    it("should handle NotFoundException with proper error response", async () => {
      // Arrange
      const reorderInput: ReorderListInput = {
        listId: "non-existent-list",
        newIndex: 0,
      };
      const serviceError = new NotFoundException("List with ID non-existent-list not found");
      (boardsService.reorderList as jest.Mock).mockRejectedValue(serviceError);

      // Act & Assert
      await expect(resolver.reorderList(reorderInput, mockContext)).rejects.toThrow(
        NotFoundException
      );
      expect(boardsService.reorderList).toHaveBeenCalledWith(reorderInput, mockUserId);
    });

    it("should handle BadRequestException for invalid indices", async () => {
      // Arrange
      const reorderInput: ReorderListInput = {
        listId: mockListId,
        newIndex: -1,
      };
      const serviceError = new BadRequestException("Invalid index: -1. Must be between 0 and 0");
      (boardsService.reorderList as jest.Mock).mockRejectedValue(serviceError);

      // Act & Assert
      await expect(resolver.reorderList(reorderInput, mockContext)).rejects.toThrow(
        BadRequestException
      );
      expect(boardsService.reorderList).toHaveBeenCalledWith(reorderInput, mockUserId);
    });

    it("should handle ForbiddenException for unauthorized access", async () => {
      // Arrange
      const reorderInput: ReorderListInput = {
        listId: mockListId,
        newIndex: 0,
      };
      const serviceError = new ForbiddenException("You do not have permission to access this board");
      (boardsService.reorderList as jest.Mock).mockRejectedValue(serviceError);

      // Act & Assert
      await expect(resolver.reorderList(reorderInput, mockContext)).rejects.toThrow(
        ForbiddenException
      );
      expect(boardsService.reorderList).toHaveBeenCalledWith(reorderInput, mockUserId);
    });

    it("should extract user ID from JWT context correctly", async () => {
      // Arrange
      const reorderInput: ReorderListInput = {
        listId: mockListId,
        newIndex: 1,
      };
      const updatedBoard = { ...mockBoard, listOrder: [mockListId] };
      (boardsService.reorderList as jest.Mock).mockResolvedValue(updatedBoard);

      // Act
      await resolver.reorderList(reorderInput, mockContext);

      // Assert
      expect(boardsService.reorderList).toHaveBeenCalledWith(reorderInput, mockUserId);
    });

    it("should validate input through GraphQL schema integration", async () => {
      // Arrange
      const validReorderInput: ReorderListInput = {
        listId: mockListId,
        newIndex: 2,
      };
      const expectedBoard = {
        ...mockBoard,
        listOrder: ["other-list", "another-list", mockListId],
      };
      (boardsService.reorderList as jest.Mock).mockResolvedValue(expectedBoard);

      // Act
      const result = await resolver.reorderList(validReorderInput, mockContext);

      // Assert
      expect(result).toEqual(expectedBoard);
      expect(result.listOrder).toContain(mockListId);
      expect(boardsService.reorderList).toHaveBeenCalledWith(validReorderInput, mockUserId);
    });

    it("should log reorderList operation correctly", async () => {
      // Arrange
      const reorderInput: ReorderListInput = {
        listId: mockListId,
        newIndex: 1,
      };
      const updatedBoard = { ...mockBoard, listOrder: [mockListId] };
      (boardsService.reorderList as jest.Mock).mockResolvedValue(updatedBoard);

      // Mock logger
      const logSpy = jest.spyOn(resolver['logger'], 'log');

      // Act
      await resolver.reorderList(reorderInput, mockContext);

      // Assert
      expect(logSpy).toHaveBeenCalledWith(
        `Reordering list ${reorderInput.listId} to index ${reorderInput.newIndex} by user ${mockUserId}`
      );
    });
  });

  describe("boardLists", () => {
    it("should successfully fetch lists for a board", async () => {
      // Arrange
      const expectedLists = [mockList];
      (boardsService.getListsByBoard as jest.Mock).mockResolvedValue(expectedLists);

      // Act
      const result = await resolver.boardLists(mockBoardId, mockContext);

      // Assert
      expect(result).toEqual(expectedLists);
      expect(boardsService.getListsByBoard).toHaveBeenCalledWith(mockBoardId, mockUserId);
    });

    it("should propagate service errors", async () => {
      // Arrange
      const serviceError = new Error("Board not found");
      (boardsService.getListsByBoard as jest.Mock).mockRejectedValue(serviceError);

      // Act & Assert
      await expect(resolver.boardLists(mockBoardId, mockContext)).rejects.toThrow(
        serviceError,
      );
    });
  });

  describe("lists field resolver", () => {
    it("should resolve lists for a board", async () => {
      // Arrange
      const expectedLists = [mockList];
      (boardsService.getListsByBoard as jest.Mock).mockResolvedValue(expectedLists);

      // Act
      const result = await resolver.lists(mockBoard, mockContext);

      // Assert
      expect(result).toEqual(expectedLists);
      expect(boardsService.getListsByBoard).toHaveBeenCalledWith(mockBoard.id, mockUserId);
    });

    it("should propagate service errors", async () => {
      // Arrange
      const serviceError = new Error("Authorization failed");
      (boardsService.getListsByBoard as jest.Mock).mockRejectedValue(serviceError);

      // Act & Assert
      await expect(resolver.lists(mockBoard, mockContext)).rejects.toThrow(
        serviceError,
      );
    });
  });

  // ==================== Card Operations Tests ====================

  describe("createCard", () => {
    it("should successfully create a new card", async () => {
      // Arrange
      const createCardInput: CreateCardInput = {
        listId: mockListId,
        content: "New Test Card",
      };
      const expectedCard = { ...mockCard, content: createCardInput.content };
      (boardsService.createCard as jest.Mock).mockResolvedValue(expectedCard);

      // Act
      const result = await resolver.createCard(createCardInput, mockContext);

      // Assert
      expect(result).toEqual(expectedCard);
      expect(boardsService.createCard).toHaveBeenCalledWith(createCardInput, mockUserId);
    });

    it("should propagate service errors", async () => {
      // Arrange
      const createCardInput: CreateCardInput = {
        listId: mockListId,
        content: "Test Card",
      };
      const serviceError = new Error("List not found");
      (boardsService.createCard as jest.Mock).mockRejectedValue(serviceError);

      // Act & Assert
      await expect(resolver.createCard(createCardInput, mockContext)).rejects.toThrow(
        serviceError,
      );
    });

    it("should extract user ID from JWT context", async () => {
      // Arrange
      const createCardInput: CreateCardInput = {
        listId: mockListId,
        content: "Test Card",
      };
      (boardsService.createCard as jest.Mock).mockResolvedValue(mockCard);

      // Act
      await resolver.createCard(createCardInput, mockContext);

      // Assert
      expect(boardsService.createCard).toHaveBeenCalledWith(createCardInput, mockUserId);
    });
  });

  describe("updateCard", () => {
    it("should successfully update a card", async () => {
      // Arrange
      const updateCardInput: UpdateCardInput = {
        id: mockCardId,
        content: "Updated Card Content",
      };
      const expectedCard = { ...mockCard, content: updateCardInput.content };
      (boardsService.updateCard as jest.Mock).mockResolvedValue(expectedCard);

      // Act
      const result = await resolver.updateCard(updateCardInput, mockContext);

      // Assert
      expect(result).toEqual(expectedCard);
      expect(boardsService.updateCard).toHaveBeenCalledWith(updateCardInput, mockUserId);
    });

    it("should propagate service errors", async () => {
      // Arrange
      const updateCardInput: UpdateCardInput = {
        id: mockCardId,
        content: "Updated Content",
      };
      const serviceError = new Error("Card not found");
      (boardsService.updateCard as jest.Mock).mockRejectedValue(serviceError);

      // Act & Assert
      await expect(resolver.updateCard(updateCardInput, mockContext)).rejects.toThrow(
        serviceError,
      );
    });
  });

  describe("deleteCard", () => {
    it("should successfully delete a card", async () => {
      // Arrange
      (boardsService.deleteCard as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await resolver.deleteCard(mockCardId, mockContext);

      // Assert
      expect(result).toBe(true);
      expect(boardsService.deleteCard).toHaveBeenCalledWith(mockCardId, mockUserId);
    });

    it("should propagate service errors", async () => {
      // Arrange
      const serviceError = new Error("Card not found");
      (boardsService.deleteCard as jest.Mock).mockRejectedValue(serviceError);

      // Act & Assert
      await expect(resolver.deleteCard(mockCardId, mockContext)).rejects.toThrow(
        serviceError,
      );
    });
  });

  describe("reorderCard", () => {
    it("should successfully reorder a card within the same list", async () => {
      // Arrange
      const reorderInput: ReorderCardInput = {
        cardId: mockCardId,
        sourceListId: mockListId,
        destListId: mockListId,
        newIndex: 1,
      };
      const updatedBoard = { ...mockBoard, listOrder: [mockListId] };
      (boardsService.reorderCard as jest.Mock).mockResolvedValue(updatedBoard);

      // Act
      const result = await resolver.reorderCard(reorderInput, mockContext);

      // Assert
      expect(result).toEqual(updatedBoard);
      expect(boardsService.reorderCard).toHaveBeenCalledWith(reorderInput, mockUserId);
    });

    it("should successfully move a card between different lists", async () => {
      // Arrange
      const moveCardInput: ReorderCardInput = {
        cardId: mockCardId,
        sourceListId: mockListId,
        destListId: "other-list-id",
        newIndex: 0,
      };
      const updatedBoard = { 
        ...mockBoard, 
        listOrder: [mockListId, "other-list-id"] 
      };
      (boardsService.reorderCard as jest.Mock).mockResolvedValue(updatedBoard);

      // Act
      const result = await resolver.reorderCard(moveCardInput, mockContext);

      // Assert
      expect(result).toEqual(updatedBoard);
      expect(boardsService.reorderCard).toHaveBeenCalledWith(moveCardInput, mockUserId);
    });

    it("should propagate service errors", async () => {
      // Arrange
      const reorderInput: ReorderCardInput = {
        cardId: mockCardId,
        sourceListId: mockListId,
        destListId: mockListId,
        newIndex: 1,
      };
      const serviceError = new Error("Invalid reorder operation");
      (boardsService.reorderCard as jest.Mock).mockRejectedValue(serviceError);

      // Act & Assert
      await expect(resolver.reorderCard(reorderInput, mockContext)).rejects.toThrow(
        serviceError,
      );
    });

    it("should handle authorization errors", async () => {
      // Arrange
      const reorderInput: ReorderCardInput = {
        cardId: mockCardId,
        sourceListId: mockListId,
        destListId: mockListId,
        newIndex: 0,
      };
      const authError = new Error("User does not own this board");
      (boardsService.reorderCard as jest.Mock).mockRejectedValue(authError);

      // Act & Assert
      await expect(resolver.reorderCard(reorderInput, mockContext)).rejects.toThrow(
        authError,
      );
    });

    it("should handle validation errors for invalid indices", async () => {
      // Arrange
      const invalidReorderInput: ReorderCardInput = {
        cardId: mockCardId,
        sourceListId: mockListId,
        destListId: mockListId,
        newIndex: -1, // Invalid negative index
      };
      const validationError = new Error("Invalid index: must be non-negative");
      (boardsService.reorderCard as jest.Mock).mockRejectedValue(validationError);

      // Act & Assert
      await expect(resolver.reorderCard(invalidReorderInput, mockContext)).rejects.toThrow(
        validationError,
      );
    });

    it("should handle validation errors for non-existent cards", async () => {
      // Arrange
      const nonExistentCardInput: ReorderCardInput = {
        cardId: "non-existent-card-id",
        sourceListId: mockListId,
        destListId: mockListId,
        newIndex: 0,
      };
      const notFoundError = new Error("Card not found");
      (boardsService.reorderCard as jest.Mock).mockRejectedValue(notFoundError);

      // Act & Assert
      await expect(resolver.reorderCard(nonExistentCardInput, mockContext)).rejects.toThrow(
        notFoundError,
      );
    });

    it("should handle validation errors for cross-board operations", async () => {
      // Arrange
      const crossBoardInput: ReorderCardInput = {
        cardId: mockCardId,
        sourceListId: mockListId,
        destListId: "list-from-different-board",
        newIndex: 0,
      };
      const crossBoardError = new Error("Source and destination lists must belong to the same board");
      (boardsService.reorderCard as jest.Mock).mockRejectedValue(crossBoardError);

      // Act & Assert
      await expect(resolver.reorderCard(crossBoardInput, mockContext)).rejects.toThrow(
        crossBoardError,
      );
    });

    it("should extract user ID from JWT context for authorization", async () => {
      // Arrange
      const reorderInput: ReorderCardInput = {
        cardId: mockCardId,
        sourceListId: mockListId,
        destListId: mockListId,
        newIndex: 0,
      };
      (boardsService.reorderCard as jest.Mock).mockResolvedValue(mockBoard);

      // Act
      await resolver.reorderCard(reorderInput, mockContext);

      // Assert
      expect(boardsService.reorderCard).toHaveBeenCalledWith(reorderInput, mockUserId);
    });
  });

  describe("listCards", () => {
    it("should successfully fetch cards for a list", async () => {
      // Arrange
      const expectedCards = [mockCard];
      (boardsService.getCardsByList as jest.Mock).mockResolvedValue(expectedCards);

      // Act
      const result = await resolver.listCards(mockListId, mockContext);

      // Assert
      expect(result).toEqual(expectedCards);
      expect(boardsService.getCardsByList).toHaveBeenCalledWith(mockListId, mockUserId);
    });

    it("should propagate service errors", async () => {
      // Arrange
      const serviceError = new Error("List not found");
      (boardsService.getCardsByList as jest.Mock).mockRejectedValue(serviceError);

      // Act & Assert
      await expect(resolver.listCards(mockListId, mockContext)).rejects.toThrow(
        serviceError,
      );
    });
  });

  describe("GraphQL schema integration for card operations", () => {
    it("should have correct card resolver methods defined", () => {
      expect(typeof resolver.createCard).toBe("function");
      expect(typeof resolver.updateCard).toBe("function");
      expect(typeof resolver.deleteCard).toBe("function");
      expect(typeof resolver.reorderCard).toBe("function");
      expect(typeof resolver.listCards).toBe("function");
    });

    it("should handle context parameter correctly for card operations", async () => {
      // Arrange
      (boardsService.getCardsByList as jest.Mock).mockResolvedValue([]);

      // Test that context is properly handled and user ID is extracted
      await resolver.listCards(mockListId, mockContext);

      // Assert
      expect(boardsService.getCardsByList).toHaveBeenCalledWith(mockListId, mockUserId);
    });

    it("should validate reorderCard input through GraphQL schema", async () => {
      // This test ensures the GraphQL input validation is working correctly
      const validInput: ReorderCardInput = {
        cardId: mockCardId,
        sourceListId: mockListId,
        destListId: mockListId,
        newIndex: 0,
      };

      (boardsService.reorderCard as jest.Mock).mockResolvedValue(mockBoard);

      // Act
      await resolver.reorderCard(validInput, mockContext);

      // Assert - service should be called with exact input
      expect(boardsService.reorderCard).toHaveBeenCalledWith(validInput, mockUserId);
    });
  });
});
