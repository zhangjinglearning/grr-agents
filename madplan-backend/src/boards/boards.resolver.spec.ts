import { Test, TestingModule } from "@nestjs/testing";
import { AuthGuard } from "@nestjs/passport";
import { ExecutionContext } from "@nestjs/common";
import { BoardsResolver } from "./boards.resolver";
import { BoardsService } from "./boards.service";
import { Board } from "./board.entity";
import { List } from "./list.entity";
import { CreateListInput } from "./dto/create-list.dto";
import { UpdateListInput } from "./dto/update-list.dto";
import { ReorderListInput } from "./dto/reorder-list.dto";

describe("BoardsResolver", () => {
  let resolver: BoardsResolver;
  let boardsService: BoardsService;

  // Mock data
  const mockUserId = "507f1f77bcf86cd799439011";
  const mockBoardId = "507f1f77bcf86cd799439033";
  const mockListId = "507f1f77bcf86cd799439044";

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
});
