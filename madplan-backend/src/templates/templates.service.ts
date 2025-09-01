import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CardTemplate, TemplateDocument, TemplateCategory, Priority } from './template.entity';
import { Card, CardDocument } from '../boards/card.entity';
import { CreateTemplateInput } from './dto/create-template.dto';
import { UpdateTemplateInput } from './dto/update-template.dto';
import { ApplyTemplateInput } from './dto/apply-template.dto';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    @InjectModel(CardTemplate.name) private templateModel: Model<TemplateDocument>,
    @InjectModel(Card.name) private cardModel: Model<CardDocument>,
  ) {
    // Initialize default templates on service startup
    this.initializeDefaultTemplates();
  }

  /**
   * Create a new card template
   */
  async createTemplate(input: CreateTemplateInput, userId: string): Promise<CardTemplate> {
    this.logger.log(`Creating template "${input.name}" for user ${userId}`);

    try {
      // Validate custom fields JSON
      if (input.content.customFields) {
        JSON.parse(input.content.customFields);
      }

      const template = new this.templateModel({
        ...input,
        createdBy: userId,
        usageCount: 0,
      });

      const savedTemplate = await template.save();
      this.logger.log(`Template created successfully: ${savedTemplate.id}`);
      return savedTemplate;
    } catch (error) {
      this.logger.error(`Failed to create template: ${error.message}`, error.stack);
      if (error.name === 'SyntaxError') {
        throw new BadRequestException('Invalid JSON format in custom fields');
      }
      throw new BadRequestException(`Failed to create template: ${error.message}`);
    }
  }

  /**
   * Get all templates accessible to a user (their own + public templates)
   */
  async getUserTemplates(userId: string, category?: TemplateCategory): Promise<CardTemplate[]> {
    this.logger.log(`Fetching templates for user ${userId}${category ? ` in category ${category}` : ''}`);

    const filter: any = {
      $or: [
        { createdBy: userId },
        { isPublic: true }
      ]
    };

    if (category) {
      filter.category = category;
    }

    try {
      const templates = await this.templateModel
        .find(filter)
        .sort({ usageCount: -1, createdAt: -1 })
        .populate('creator', 'email')
        .exec();

      this.logger.log(`Found ${templates.length} templates for user ${userId}`);
      return templates;
    } catch (error) {
      this.logger.error(`Failed to fetch templates: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to fetch templates: ${error.message}`);
    }
  }

  /**
   * Get popular public templates
   */
  async getPopularTemplates(limit: number = 10): Promise<CardTemplate[]> {
    this.logger.log(`Fetching ${limit} popular public templates`);

    try {
      const templates = await this.templateModel
        .find({ isPublic: true })
        .sort({ usageCount: -1, createdAt: -1 })
        .limit(limit)
        .populate('creator', 'email')
        .exec();

      return templates;
    } catch (error) {
      this.logger.error(`Failed to fetch popular templates: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to fetch popular templates: ${error.message}`);
    }
  }

  /**
   * Get template by ID (with access control)
   */
  async getTemplate(templateId: string, userId: string): Promise<CardTemplate> {
    this.logger.log(`Fetching template ${templateId} for user ${userId}`);

    try {
      const template = await this.templateModel
        .findById(templateId)
        .populate('creator', 'email')
        .exec();

      if (!template) {
        throw new NotFoundException('Template not found');
      }

      // Check access permissions
      if (!template.isPublic && template.createdBy !== userId) {
        throw new ForbiddenException('Access denied to this template');
      }

      return template;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`Failed to fetch template: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to fetch template: ${error.message}`);
    }
  }

  /**
   * Update an existing template
   */
  async updateTemplate(input: UpdateTemplateInput, userId: string): Promise<CardTemplate> {
    this.logger.log(`Updating template ${input.id} for user ${userId}`);

    try {
      const template = await this.templateModel.findById(input.id).exec();

      if (!template) {
        throw new NotFoundException('Template not found');
      }

      // Check ownership
      if (template.createdBy !== userId) {
        throw new ForbiddenException('You can only update your own templates');
      }

      // Validate custom fields JSON if provided
      if (input.content?.customFields) {
        JSON.parse(input.content.customFields);
      }

      const updatedTemplate = await this.templateModel
        .findByIdAndUpdate(
          input.id,
          { 
            $set: {
              ...input,
              id: undefined, // Don't update the ID field
            }
          },
          { new: true, runValidators: true }
        )
        .populate('creator', 'email')
        .exec();

      this.logger.log(`Template updated successfully: ${updatedTemplate.id}`);
      return updatedTemplate;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      if (error.name === 'SyntaxError') {
        throw new BadRequestException('Invalid JSON format in custom fields');
      }
      this.logger.error(`Failed to update template: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to update template: ${error.message}`);
    }
  }

  /**
   * Delete a template (only by owner)
   */
  async deleteTemplate(templateId: string, userId: string): Promise<boolean> {
    this.logger.log(`Deleting template ${templateId} for user ${userId}`);

    try {
      const template = await this.templateModel.findById(templateId).exec();

      if (!template) {
        throw new NotFoundException('Template not found');
      }

      // Check ownership
      if (template.createdBy !== userId) {
        throw new ForbiddenException('You can only delete your own templates');
      }

      await this.templateModel.findByIdAndDelete(templateId).exec();
      this.logger.log(`Template deleted successfully: ${templateId}`);
      return true;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`Failed to delete template: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to delete template: ${error.message}`);
    }
  }

  /**
   * Apply a template to create a new card
   */
  async applyTemplate(input: ApplyTemplateInput, userId: string): Promise<Card> {
    this.logger.log(`Applying template ${input.templateId} to create card in list ${input.listId}`);

    try {
      // Get and validate template access
      const template = await this.getTemplate(input.templateId, userId);

      // Parse any custom data
      let customData = {};
      if (input.customData) {
        try {
          customData = JSON.parse(input.customData);
        } catch (error) {
          throw new BadRequestException('Invalid JSON format in custom data');
        }
      }

      // Create the card content from template
      let cardContent = input.titleOverride || template.content.title;
      
      // If template has a structured description, build it
      let fullDescription = template.content.description;
      
      // Add checklist items if present
      if (template.content.checklistItems.length > 0) {
        fullDescription += '\n\n**Checklist:**\n';
        template.content.checklistItems.forEach(item => {
          fullDescription += `- [ ] ${item}\n`;
        });
      }

      // Add custom fields if present
      if (template.content.customFields !== '{}') {
        try {
          const customFields = JSON.parse(template.content.customFields);
          const customFieldEntries = Object.entries(customFields);
          if (customFieldEntries.length > 0) {
            fullDescription += '\n\n**Details:**\n';
            customFieldEntries.forEach(([key, value]) => {
              fullDescription += `**${key}:** ${value}\n`;
            });
          }
        } catch (error) {
          // Skip custom fields if parsing fails
          this.logger.warn(`Failed to parse custom fields for template ${template.id}: ${error.message}`);
        }
      }

      // Combine template title and description
      const finalContent = `${cardContent}\n\n${fullDescription}`.trim();

      // Create the new card
      const newCard = new this.cardModel({
        content: finalContent,
        listId: input.listId,
      });

      const savedCard = await newCard.save();

      // Increment template usage count
      await this.templateModel.findByIdAndUpdate(
        input.templateId,
        { $inc: { usageCount: 1 } }
      ).exec();

      this.logger.log(`Card created from template successfully: ${savedCard.id}`);
      return savedCard;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to apply template: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to apply template: ${error.message}`);
    }
  }

  /**
   * Search templates by text
   */
  async searchTemplates(query: string, userId: string, limit: number = 20): Promise<CardTemplate[]> {
    this.logger.log(`Searching templates for query "${query}" by user ${userId}`);

    try {
      const templates = await this.templateModel
        .find({
          $and: [
            {
              $or: [
                { createdBy: userId },
                { isPublic: true }
              ]
            },
            {
              $text: { $search: query }
            }
          ]
        })
        .sort({ score: { $meta: 'textScore' }, usageCount: -1 })
        .limit(limit)
        .populate('creator', 'email')
        .exec();

      this.logger.log(`Found ${templates.length} templates matching query "${query}"`);
      return templates;
    } catch (error) {
      this.logger.error(`Failed to search templates: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to search templates: ${error.message}`);
    }
  }

  /**
   * Initialize default template library
   */
  private async initializeDefaultTemplates(): Promise<void> {
    this.logger.log('Initializing default template library...');

    try {
      // Check if default templates already exist
      const existingCount = await this.templateModel.countDocuments({ createdBy: 'system' }).exec();
      
      if (existingCount > 0) {
        this.logger.log('Default templates already initialized');
        return;
      }

      const defaultTemplates = [
        {
          name: 'Task Template',
          description: 'Basic task structure with description and priority',
          category: TemplateCategory.TASK,
          isPublic: true,
          createdBy: 'system',
          content: {
            title: 'Task: [Task Name]',
            description: '## Description\n[Describe what needs to be done]\n\n## Acceptance Criteria\n- [ ] [Criteria 1]\n- [ ] [Criteria 2]\n\n## Notes\n[Any additional notes]',
            labels: ['task'],
            priority: Priority.MEDIUM,
            customFields: '{"Assignee": "", "Story Points": ""}',
            checklistItems: ['Define requirements', 'Implement solution', 'Test thoroughly', 'Update documentation'],
            attachmentTypes: ['documents', 'screenshots']
          }
        },
        {
          name: 'Bug Report',
          description: 'Structured bug report with reproduction steps',
          category: TemplateCategory.BUG,
          isPublic: true,
          createdBy: 'system',
          content: {
            title: 'Bug: [Brief Description]',
            description: '## Summary\n[Brief summary of the bug]\n\n## Steps to Reproduce\n1. [Step 1]\n2. [Step 2]\n3. [Step 3]\n\n## Expected Behavior\n[What should happen]\n\n## Actual Behavior\n[What actually happens]\n\n## Environment\n- Browser: [Browser name and version]\n- OS: [Operating system]\n- Version: [Application version]',
            labels: ['bug', 'needs-investigation'],
            priority: Priority.HIGH,
            customFields: '{"Severity": "Medium", "Reporter": "", "Affected Versions": ""}',
            checklistItems: ['Reproduce the issue', 'Identify root cause', 'Implement fix', 'Test fix', 'Verify no regression'],
            attachmentTypes: ['screenshots', 'logs', 'screen-recordings']
          }
        },
        {
          name: 'Meeting Notes',
          description: 'Structure for meeting agenda and notes',
          category: TemplateCategory.MEETING,
          isPublic: true,
          createdBy: 'system',
          content: {
            title: 'Meeting: [Meeting Title] - [Date]',
            description: '## Meeting Details\n- **Date:** [Date]\n- **Time:** [Time]\n- **Location/Link:** [Location or video link]\n\n## Attendees\n- [Name 1]\n- [Name 2]\n\n## Agenda\n1. [Agenda item 1]\n2. [Agenda item 2]\n\n## Discussion Notes\n[Notes during meeting]\n\n## Action Items\n- [ ] [Action 1] - @[assignee] - [due date]\n- [ ] [Action 2] - @[assignee] - [due date]\n\n## Decisions Made\n- [Decision 1]\n- [Decision 2]',
            labels: ['meeting', 'planning'],
            priority: Priority.MEDIUM,
            customFields: '{"Meeting Type": "Planning", "Duration": "60 minutes"}',
            checklistItems: ['Send meeting invites', 'Prepare agenda', 'Conduct meeting', 'Share notes', 'Follow up on action items'],
            attachmentTypes: ['documents', 'presentations', 'recordings']
          }
        },
        {
          name: 'Feature Request',
          description: 'User story format for new features',
          category: TemplateCategory.FEATURE,
          isPublic: true,
          createdBy: 'system',
          content: {
            title: 'Feature: [Feature Name]',
            description: '## User Story\nAs a [type of user], I want [goal] so that [reason/benefit].\n\n## Acceptance Criteria\n- [ ] [Criteria 1]\n- [ ] [Criteria 2]\n- [ ] [Criteria 3]\n\n## Technical Considerations\n[Any technical requirements or constraints]\n\n## Definition of Done\n- [ ] Code implemented and reviewed\n- [ ] Tests written and passing\n- [ ] Documentation updated\n- [ ] UX/UI approved\n- [ ] Stakeholder approval received',
            labels: ['feature', 'enhancement'],
            priority: Priority.MEDIUM,
            customFields: '{"Epic": "", "Story Points": "", "Stakeholder": ""}',
            checklistItems: ['Requirements analysis', 'Design mockups', 'Technical specification', 'Implementation', 'Testing', 'Documentation'],
            attachmentTypes: ['mockups', 'wireframes', 'requirements']
          }
        },
        {
          name: 'Research Task',
          description: 'Structure for research and investigation tasks',
          category: TemplateCategory.RESEARCH,
          isPublic: true,
          createdBy: 'system',
          content: {
            title: 'Research: [Research Topic]',
            description: '## Research Questions\n- [Question 1]\n- [Question 2]\n\n## Methodology\n[How will you conduct this research?]\n\n## Resources\n- [Resource 1]\n- [Resource 2]\n\n## Findings\n[Document findings here]\n\n## Conclusions\n[Summarize conclusions and next steps]\n\n## Recommendations\n[Any recommendations based on research]',
            labels: ['research', 'analysis'],
            priority: Priority.LOW,
            customFields: '{"Research Type": "Market Research", "Timeline": "1 week"}',
            checklistItems: ['Define research questions', 'Gather resources', 'Conduct research', 'Document findings', 'Present conclusions'],
            attachmentTypes: ['documents', 'data-files', 'reports']
          }
        },
        {
          name: 'Sprint Planning',
          description: 'Template for sprint planning sessions',
          category: TemplateCategory.MEETING,
          isPublic: true,
          createdBy: 'system',
          content: {
            title: 'Sprint Planning - Sprint [Number]',
            description: '## Sprint Goal\n[What do we want to achieve this sprint?]\n\n## Sprint Duration\n- **Start Date:** [Date]\n- **End Date:** [Date]\n- **Duration:** [Duration]\n\n## Team Capacity\n- [Team member 1]: [Available hours/points]\n- [Team member 2]: [Available hours/points]\n\n## User Stories Selected\n- [ ] [Story 1] - [Points] - @[assignee]\n- [ ] [Story 2] - [Points] - @[assignee]\n\n## Sprint Backlog\n[List of tasks and subtasks]\n\n## Risks and Dependencies\n- [Risk 1]\n- [Dependency 1]\n\n## Definition of Done\n- [ ] All stories meet acceptance criteria\n- [ ] Code reviewed and merged\n- [ ] Tests passing\n- [ ] Documentation updated',
            labels: ['sprint', 'planning', 'agile'],
            priority: Priority.HIGH,
            customFields: '{"Sprint Number": "", "Total Points": "", "Team Velocity": ""}',
            checklistItems: ['Review previous sprint', 'Estimate user stories', 'Select stories for sprint', 'Break down tasks', 'Assign ownership'],
            attachmentTypes: ['burndown-charts', 'velocity-reports']
          }
        }
      ];

      for (const templateData of defaultTemplates) {
        const template = new this.templateModel(templateData);
        await template.save();
        this.logger.log(`Created default template: ${template.name}`);
      }

      this.logger.log('Default template library initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize default templates: ${error.message}`, error.stack);
    }
  }
}