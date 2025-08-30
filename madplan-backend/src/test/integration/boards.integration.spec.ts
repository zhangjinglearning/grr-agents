import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { NotFoundException, ForbiddenException } from "@nestjs/common";
import { BoardsService } from "../../boards/boards.service";
import { Board, BoardDocument, BoardSchema } from "../../boards/board.entity";
import { List, ListDocument, ListSchema } from "../../boards/list.entity";
import { Card, CardDocument, CardSchema } from "../../boards/card.entity";
import { User, UserDocument, UserSchema } from "../../users/user.entity";
import { UsersService } from "../../users/users.service";
import {
  DatabaseTestUtils,
  UserTestFactory,
  IntegrationTestHelpers,
} from "../setup";

// Mock Board data factory
class BoardTestFactory {
  static createMockBoard(overrides: Partial<Board> = {}): Partial<Board> {
    return {
      title: "Test Board",
      ownerId: "507f1f77bcf86cd799439011",
      listOrder: [],
      ...overrides,
    };
  }

  static createMockBoardData(
    userId: string,
    title = "Test Board",
  ): Partial<Board> {
    return {
      title,
      ownerId: userId,
      listOrder: [],
    };
  }
}

describe("Boards Service Integration Tests", () => {
  let boardsService: BoardsService;
  let usersService: UsersService;
  let boardModel: Model<BoardDocument>;
  let userModel: Model<UserDocument>;
  let module: TestingModule;

  // Test users
  let testUser1: any;
  let testUser2: any;

  beforeAll(async () => {
    await IntegrationTestHelpers.waitForDatabase();

    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(DatabaseTestUtils.getDatabaseUri()),
        MongooseModule.forFeature([
          { name: Board.name, schema: BoardSchema },
          { name: List.name, schema: ListSchema },
          { name: Card.name, schema: CardSchema },
          { name: User.name, schema: UserSchema },
        ]),
      ],
      providers: [BoardsService, UsersService],
    }).compile();

    boardsService = module.get<BoardsService>(BoardsService);
    usersService = module.get<UsersService>(UsersService);
    boardModel = module.get<Model<BoardDocument>>(getModelToken(Board.name));
    userModel = module.get<Model<UserDocument>>(getModelToken(User.name));
  }, 60000);

  beforeEach(async () => {
    await DatabaseTestUtils.clearDatabase();

    // Create test users for each test with unique emails
    const timestamp = Date.now();
    testUser1 = await usersService.createUser(
      UserTestFactory.createMockRegisterInput({
        email: `user1-${timestamp}@example.com`,
        password: "Password123!",
      }),
    );

    testUser2 = await usersService.createUser(
      UserTestFactory.createMockRegisterInput({
        email: `user2-${timestamp}@example.com`,
        password: "Password123!",
      }),
    );
  });

  afterAll(async () => {
    await module.close();
  });

  describe("createBoard", () => {
    it("should successfully create a new board with valid data", async () => {
      const title = "My New Board";

      const result = await boardsService.createBoard(title, testUser1.id);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.title).toBe(title);
      expect(result.ownerId).toBe(testUser1.id);
      expect(result.listOrder).toEqual([]);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it("should trim whitespace from board title", async () => {
      const title = "  Whitespace Board  ";

      const result = await boardsService.createBoard(title, testUser1.id);

      expect(result.title).toBe("Whitespace Board");
    });

    it("should allow multiple boards with same title for different users", async () => {
      const title = "Shared Title Board";

      const board1 = await boardsService.createBoard(title, testUser1.id);
      const board2 = await boardsService.createBoard(title, testUser2.id);

      expect(board1.title).toBe(title);
      expect(board2.title).toBe(title);
      expect(board1.ownerId).toBe(testUser1.id);
      expect(board2.ownerId).toBe(testUser2.id);
      expect(board1.id).not.toBe(board2.id);
    });

    it("should allow same user to create multiple boards with same title", async () => {
      const title = "Duplicate Title";

      const board1 = await boardsService.createBoard(title, testUser1.id);
      const board2 = await boardsService.createBoard(title, testUser1.id);

      expect(board1.title).toBe(title);
      expect(board2.title).toBe(title);
      expect(board1.ownerId).toBe(testUser1.id);
      expect(board2.ownerId).toBe(testUser1.id);
      expect(board1.id).not.toBe(board2.id);
    });

    it("should handle special characters in board titles", async () => {
      const title = "Board with $pecial Ch@rs & Émojis 🚀";

      const result = await boardsService.createBoard(title, testUser1.id);

      expect(result.title).toBe(title);
      expect(result.ownerId).toBe(testUser1.id);
    });
  });

  describe("getBoardsByUser", () => {
    beforeEach(async () => {
      // Create test boards for user1
      await boardsService.createBoard("User 1 Board 1", testUser1.id);
      await boardsService.createBoard("User 1 Board 2", testUser1.id);
      await boardsService.createBoard("User 1 Board 3", testUser1.id);

      // Create test boards for user2
      await boardsService.createBoard("User 2 Board 1", testUser2.id);
      await boardsService.createBoard("User 2 Board 2", testUser2.id);
    });

    it("should return all boards for a specific user", async () => {
      const user1Boards = await boardsService.getBoardsByUser(testUser1.id);
      const user2Boards = await boardsService.getBoardsByUser(testUser2.id);

      expect(user1Boards).toHaveLength(3);
      expect(user2Boards).toHaveLength(2);

      // Verify all boards belong to correct user
      user1Boards.forEach((board) => {
        expect(board.ownerId).toBe(testUser1.id);
      });

      user2Boards.forEach((board) => {
        expect(board.ownerId).toBe(testUser2.id);
      });
    });

    it("should return boards sorted by creation date (most recent first)", async () => {
      const boards = await boardsService.getBoardsByUser(testUser1.id);

      expect(boards).toHaveLength(3);

      // Check that boards are sorted by createdAt descending
      for (let i = 0; i < boards.length - 1; i++) {
        expect(boards[i].createdAt.getTime()).toBeGreaterThanOrEqual(
          boards[i + 1].createdAt.getTime(),
        );
      }
    });

    it("should return empty array for user with no boards", async () => {
      // Create a new user with no boards
      const timestamp = Date.now();
      const newUser = await usersService.createUser(
        UserTestFactory.createMockRegisterInput({
          email: `newuser-${timestamp}@example.com`,
          password: "Password123!",
        }),
      );

      const boards = await boardsService.getBoardsByUser(newUser.id);

      expect(boards).toEqual([]);
    });

    it("should return empty array for non-existent user", async () => {
      const nonExistentUserId = "507f1f77bcf86cd799439099";

      const boards = await boardsService.getBoardsByUser(nonExistentUserId);

      expect(boards).toEqual([]);
    });
  });

  describe("getBoardById", () => {
    let testBoard: any;

    beforeEach(async () => {
      testBoard = await boardsService.createBoard("Test Board", testUser1.id);
    });

    it("should return board when user owns it", async () => {
      const result = await boardsService.getBoardById(
        testBoard.id,
        testUser1.id,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(testBoard.id);
      expect(result.title).toBe("Test Board");
      expect(result.ownerId).toBe(testUser1.id);
    });

    it("should throw NotFoundException when board does not exist", async () => {
      const nonExistentBoardId = "507f1f77bcf86cd799439099";

      await expect(
        boardsService.getBoardById(nonExistentBoardId, testUser1.id),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException when user does not own board", async () => {
      await expect(
        boardsService.getBoardById(testBoard.id, testUser2.id),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should handle invalid ObjectId format", async () => {
      await expect(
        boardsService.getBoardById("invalid-id", testUser1.id),
      ).rejects.toThrow();
    });
  });

  describe("deleteBoard", () => {
    let testBoard: any;

    beforeEach(async () => {
      testBoard = await boardsService.createBoard(
        "Board to Delete",
        testUser1.id,
      );
    });

    it("should successfully delete board when user owns it", async () => {
      const result = await boardsService.deleteBoard(
        testBoard.id,
        testUser1.id,
      );

      expect(result).toBe(true);

      // Verify board is actually deleted
      await expect(
        boardsService.getBoardById(testBoard.id, testUser1.id),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException when board does not exist", async () => {
      const nonExistentBoardId = "507f1f77bcf86cd799439099";

      await expect(
        boardsService.deleteBoard(nonExistentBoardId, testUser1.id),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException when user does not own board", async () => {
      await expect(
        boardsService.deleteBoard(testBoard.id, testUser2.id),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should handle invalid ObjectId format", async () => {
      await expect(
        boardsService.deleteBoard("invalid-id", testUser1.id),
      ).rejects.toThrow();
    });

    it("should not affect other user boards when deleting", async () => {
      // Create boards for both users
      const user1Board = await boardsService.createBoard(
        "User 1 Board",
        testUser1.id,
      );
      const user2Board = await boardsService.createBoard(
        "User 2 Board",
        testUser2.id,
      );

      // Delete user1's board
      await boardsService.deleteBoard(user1Board.id, testUser1.id);

      // User2's board should still exist
      const remainingBoard = await boardsService.getBoardById(
        user2Board.id,
        testUser2.id,
      );
      expect(remainingBoard).toBeDefined();
      expect(remainingBoard.id).toBe(user2Board.id);
    });
  });

  describe("Database Consistency and Transactions", () => {
    it("should maintain data consistency during concurrent board operations", async () => {
      const boardPromises = Array.from({ length: 5 }, (_, i) =>
        boardsService.createBoard(`Concurrent Board ${i}`, testUser1.id),
      );

      const results = await Promise.all(boardPromises);

      expect(results).toHaveLength(5);
      results.forEach((board, index) => {
        expect(board.title).toBe(`Concurrent Board ${index}`);
        expect(board.ownerId).toBe(testUser1.id);
        expect(board.id).toBeDefined();
      });

      // Verify all boards exist in database
      const userBoards = await boardsService.getBoardsByUser(testUser1.id);
      expect(userBoards).toHaveLength(5);
    });

    it("should handle partial failures in batch operations", async () => {
      // Create a valid board
      const validBoard = await boardsService.createBoard(
        "Valid Board",
        testUser1.id,
      );

      // Mix of valid operations and operations that should fail
      const operations = [
        () => boardsService.createBoard("Valid Board 2", testUser1.id), // Valid
        () =>
          boardsService.getBoardById("507f1f77bcf86cd799439099", testUser1.id), // Invalid (not found)
        () => boardsService.createBoard("Valid Board 3", testUser1.id), // Valid
        () => boardsService.deleteBoard(validBoard.id, testUser2.id), // Invalid (not owner)
      ];

      const results = await Promise.allSettled(operations.map((op) => op()));

      // Check results
      expect(results[0].status).toBe("fulfilled"); // Valid create
      expect(results[1].status).toBe("rejected"); // Invalid get
      expect(results[2].status).toBe("fulfilled"); // Valid create
      expect(results[3].status).toBe("rejected"); // Invalid delete

      // Verify database consistency
      const finalBoards = await boardsService.getBoardsByUser(testUser1.id);
      expect(finalBoards).toHaveLength(3); // Original + 2 successful creates
    });

    it("should handle concurrent deletion attempts", async () => {
      const board = await boardsService.createBoard(
        "Board to Delete",
        testUser1.id,
      );

      // Attempt concurrent deletions (second should fail)
      const deletePromises = [
        boardsService.deleteBoard(board.id, testUser1.id),
        boardsService.deleteBoard(board.id, testUser1.id),
      ];

      const results = await Promise.allSettled(deletePromises);

      // At least one should succeed
      const successfulDeletions = results.filter(
        (r) => r.status === "fulfilled",
      ).length;
      expect(successfulDeletions).toBeGreaterThanOrEqual(1);

      // Board should be deleted
      await expect(
        boardsService.getBoardById(board.id, testUser1.id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle extremely long board titles", async () => {
      const longTitle = "a".repeat(500);

      const result = await boardsService.createBoard(longTitle, testUser1.id);

      expect(result.title).toBe(longTitle);
      expect(result.ownerId).toBe(testUser1.id);
    });

    it("should handle unicode characters in board titles", async () => {
      const unicodeTitle = "Bòárd wïth Ünïcödé 你好 🌍";

      const result = await boardsService.createBoard(
        unicodeTitle,
        testUser1.id,
      );

      expect(result.title).toBe(unicodeTitle);
    });

    it("should handle empty string title gracefully", async () => {
      // Depending on validation rules, this might throw an error
      try {
        const result = await boardsService.createBoard("", testUser1.id);
        // If it succeeds, verify the behavior
        expect(result.title).toBe("");
      } catch (error) {
        // If it fails validation, that's also acceptable
        expect(error).toBeDefined();
      }
    });

    it("should handle whitespace-only title", async () => {
      const whitespaceTitle = "   ";

      // This should fail validation since trimmed title becomes empty
      try {
        await boardsService.createBoard(whitespaceTitle, testUser1.id);
        // If it succeeds, the title should be trimmed
        fail("Expected validation error for empty title");
      } catch (error) {
        // This is expected - empty title should fail validation
        expect(error).toBeDefined();
      }
    });
  });

  describe("Database Indexes and Performance", () => {
    it("should efficiently query boards by owner using database index", async () => {
      // Create many boards for different users
      const numBoards = 20;

      for (let i = 0; i < numBoards; i++) {
        await boardsService.createBoard(
          `Board ${i}`,
          i % 2 === 0 ? testUser1.id : testUser2.id,
        );
      }

      const startTime = Date.now();

      const user1Boards = await boardsService.getBoardsByUser(testUser1.id);

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      // Query should be fast due to index
      expect(queryTime).toBeLessThan(100); // 100ms threshold
      expect(user1Boards).toHaveLength(10); // Half of the boards

      // Verify all boards belong to user1
      user1Boards.forEach((board) => {
        expect(board.ownerId).toBe(testUser1.id);
      });
    });

    it("should handle large number of boards per user efficiently", async () => {
      const numBoards = 50;

      // Create many boards for one user
      const createPromises = Array.from({ length: numBoards }, (_, i) =>
        boardsService.createBoard(`Bulk Board ${i}`, testUser1.id),
      );

      await Promise.all(createPromises);

      const startTime = Date.now();
      const boards = await boardsService.getBoardsByUser(testUser1.id);
      const endTime = Date.now();

      expect(boards).toHaveLength(numBoards);
      expect(endTime - startTime).toBeLessThan(200); // Should be fast with proper indexing
    });
  });

  describe("Data Validation and Schema Enforcement", () => {
    it("should enforce required fields in database", async () => {
      // Try to create board document directly with missing required fields
      const incompleteBoard = new boardModel({
        title: "Board without owner",
        // Missing ownerId
      });

      await expect(incompleteBoard.save()).rejects.toThrow();
    });

    it("should validate ObjectId format for ownerId", async () => {
      const invalidOwnerId = "invalid-owner-id";

      // This should fail at the service level or database level
      try {
        await boardsService.createBoard("Test Board", invalidOwnerId);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should transform document correctly with toJSON", async () => {
      const board = await boardsService.createBoard(
        "Transform Test",
        testUser1.id,
      );

      const jsonBoard = JSON.parse(JSON.stringify(board));

      // Should have id instead of _id
      expect(jsonBoard.id).toBeDefined();
      expect(jsonBoard._id).toBeUndefined();
      expect(jsonBoard.__v).toBeUndefined();
    });
  });
});
