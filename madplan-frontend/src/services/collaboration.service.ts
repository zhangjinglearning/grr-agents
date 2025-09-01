import { apolloClient } from './apollo.service';
import { gql } from '@apollo/client/core';
import type { BoardShare, BoardActivity, CreateShareInput, UpdateShareInput, ShareQueryInput } from '@/types/collaboration';

const CREATE_BOARD_SHARE = gql`
  mutation CreateBoardShare($input: CreateShareInput!) {
    createBoardShare(input: $input) {
      id
      boardId
      sharedBy
      sharedWith
      email
      permission
      status
      inviteMethod
      shareToken
      shareLink
      expiresAt
      createdAt
      isLinkShare
      message
    }
  }
`;

const UPDATE_BOARD_SHARE = gql`
  mutation UpdateBoardShare($shareId: ID!, $input: UpdateShareInput!) {
    updateBoardShare(shareId: $shareId, input: $input) {
      id
      permission
      status
      expiresAt
    }
  }
`;

const REVOKE_BOARD_SHARE = gql`
  mutation RevokeBoardShare($shareId: ID!) {
    revokeBoardShare(shareId: $shareId)
  }
`;

const ACCEPT_BOARD_SHARE = gql`
  mutation AcceptBoardShare($shareToken: String!, $userId: ID) {
    acceptBoardShare(shareToken: $shareToken, userId: $userId) {
      id
      boardId
      permission
      status
      acceptedAt
    }
  }
`;

const GENERATE_SHARE_LINK = gql`
  mutation GenerateShareLink($boardId: ID!, $permission: String!, $expiresAt: DateTime) {
    generateShareLink(boardId: $boardId, permission: $permission, expiresAt: $expiresAt)
  }
`;

const GET_BOARD_SHARES = gql`
  query GetBoardShares($boardId: ID!) {
    getBoardShares(boardId: $boardId) {
      id
      boardId
      sharedBy
      sharedWith
      email
      permission
      status
      inviteMethod
      shareToken
      shareLink
      expiresAt
      createdAt
      acceptedAt
      lastAccessedAt
      isLinkShare
      message
    }
  }
`;

const GET_SHARED_BOARDS = gql`
  query GetSharedBoards($query: ShareQueryInput) {
    getSharedBoards(query: $query) {
      id
      boardId
      permission
      status
      acceptedAt
      lastAccessedAt
      isLinkShare
    }
  }
`;

const GET_BOARD_ACTIVITY = gql`
  query GetBoardActivity($input: ActivityQueryInput!) {
    getBoardActivity(input: $input) {
      id
      boardId
      userId
      action
      entityType
      entityId
      details
      timestamp
      ipAddress
      userAgent
    }
  }
`;

const GET_COLLABORATION_STATS = gql`
  query GetCollaborationStats($boardId: ID!) {
    getCollaborationStats(boardId: $boardId) {
      totalShares
      byPermission {
        _id
        count
      }
      recentActivity
    }
  }
`;

class CollaborationService {
  async createBoardShare(input: CreateShareInput): Promise<BoardShare> {
    const { data } = await apolloClient.mutate({
      mutation: CREATE_BOARD_SHARE,
      variables: { input },
    });
    return data.createBoardShare;
  }

  async updateBoardShare(shareId: string, input: UpdateShareInput): Promise<BoardShare> {
    const { data } = await apolloClient.mutate({
      mutation: UPDATE_BOARD_SHARE,
      variables: { shareId, input },
    });
    return data.updateBoardShare;
  }

  async revokeBoardShare(shareId: string): Promise<boolean> {
    const { data } = await apolloClient.mutate({
      mutation: REVOKE_BOARD_SHARE,
      variables: { shareId },
    });
    return data.revokeBoardShare;
  }

  async acceptBoardShare(shareToken: string, userId?: string): Promise<BoardShare> {
    const { data } = await apolloClient.mutate({
      mutation: ACCEPT_BOARD_SHARE,
      variables: { shareToken, userId },
    });
    return data.acceptBoardShare;
  }

  async generateShareLink(boardId: string, permission: string, expiresAt?: Date): Promise<string> {
    const { data } = await apolloClient.mutate({
      mutation: GENERATE_SHARE_LINK,
      variables: { boardId, permission, expiresAt },
    });
    return data.generateShareLink;
  }

  async getBoardShares(boardId: string): Promise<BoardShare[]> {
    const { data } = await apolloClient.query({
      query: GET_BOARD_SHARES,
      variables: { boardId },
      fetchPolicy: 'network-only',
    });
    return data.getBoardShares;
  }

  async getSharedBoards(query?: ShareQueryInput): Promise<BoardShare[]> {
    const { data } = await apolloClient.query({
      query: GET_SHARED_BOARDS,
      variables: { query },
      fetchPolicy: 'network-only',
    });
    return data.getSharedBoards;
  }

  async getBoardActivity(boardId: string, limit = 50): Promise<BoardActivity[]> {
    const { data } = await apolloClient.query({
      query: GET_BOARD_ACTIVITY,
      variables: { 
        input: { 
          boardId, 
          limit 
        } 
      },
      fetchPolicy: 'network-only',
    });
    return data.getBoardActivity;
  }

  async getCollaborationStats(boardId: string): Promise<any> {
    const { data } = await apolloClient.query({
      query: GET_COLLABORATION_STATS,
      variables: { boardId },
      fetchPolicy: 'network-only',
    });
    return data.getCollaborationStats;
  }
}

export const collaborationService = new CollaborationService();