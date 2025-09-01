export enum LabelColor {
  RED = 'red',
  ORANGE = 'orange',
  YELLOW = 'yellow',
  GREEN = 'green',
  BLUE = 'blue',
  PURPLE = 'purple',
  PINK = 'pink',
  GRAY = 'gray',
  BROWN = 'brown',
  TEAL = 'teal',
}

export enum Priority {
  LOWEST = 'lowest',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  HIGHEST = 'highest',
  CRITICAL = 'critical',
}

export enum CustomFieldType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  BOOLEAN = 'boolean',
  SELECT = 'select',
  MULTI_SELECT = 'multi_select',
  USER = 'user',
  URL = 'url',
  EMAIL = 'email',
  PHONE = 'phone',
}

export interface Label {
  id: string;
  name: string;
  color: LabelColor;
  boardId: string;
  createdBy: string;
  description?: string;
  createdAt: Date;
  usageCount: number;
  isActive: boolean;
}

export interface CustomFieldOption {
  label: string;
  value: string;
  color: LabelColor;
  position: number;
}

export interface CustomField {
  id: string;
  name: string;
  type: CustomFieldType;
  boardId: string;
  createdBy: string;
  description?: string;
  isRequired: boolean;
  isActive: boolean;
  position: number;
  options?: CustomFieldOption[];
  defaultValue?: string;
  placeholder?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CustomFieldValue {
  fieldId: string;
  fieldName: string;
  fieldType: CustomFieldType;
  value?: string;
  multiValue?: string[];
  updatedAt: Date;
}

export interface CardOrganization {
  id: string;
  cardId: string;
  boardId: string;
  labelIds: string[];
  priority?: Priority;
  customFieldValues: CustomFieldValue[];
  tags: string[];
  estimatedHours?: number;
  actualHours?: number;
  storyPoints?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardOrganizationSettings {
  id: string;
  boardId: string;
  enableLabels: boolean;
  enablePriorities: boolean;
  enableCustomFields: boolean;
  enableTags: boolean;
  enableEstimation: boolean;
  availablePriorities: Priority[];
  defaultPriority: Priority;
  maxLabelsPerCard: number;
  maxCustomFieldsPerBoard: number;
  createdAt: Date;
  updatedAt: Date;
}

// Input Types
export interface CreateLabelInput {
  name: string;
  color: LabelColor;
  boardId: string;
  description?: string;
}

export interface UpdateLabelInput {
  name?: string;
  color?: LabelColor;
  description?: string;
  isActive?: boolean;
}

export interface CreateCustomFieldInput {
  name: string;
  type: CustomFieldType;
  boardId: string;
  description?: string;
  isRequired?: boolean;
  options?: CustomFieldOption[];
  defaultValue?: string;
  placeholder?: string;
}

export interface UpdateCustomFieldInput {
  name?: string;
  description?: string;
  isRequired?: boolean;
  isActive?: boolean;
  options?: CustomFieldOption[];
  defaultValue?: string;
  placeholder?: string;
}

export interface CustomFieldValueInput {
  fieldId: string;
  fieldName: string;
  fieldType: CustomFieldType;
  value?: string;
  multiValue?: string[];
}

export interface UpdateCardOrganizationInput {
  labelIds?: string[];
  priority?: Priority;
  customFieldValues?: CustomFieldValueInput[];
  tags?: string[];
  estimatedHours?: number;
  actualHours?: number;
  storyPoints?: number;
}

export interface OrganizationQueryInput {
  boardId: string;
  labelIds?: string[];
  priority?: Priority;
  tags?: string[];
  limit?: number;
}

// Summary Types
export interface LabelStat {
  name: string;
  color: LabelColor;
  count: number;
}

export interface PriorityStat {
  _id: Priority;
  count: number;
}

export interface OrganizationSummary {
  totalCards: number;
  labelStats: LabelStat[];
  priorityStats: PriorityStat[];
  customFieldCount: number;
}