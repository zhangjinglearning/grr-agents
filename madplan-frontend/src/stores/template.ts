import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useQuery, useMutation } from '@vue/apollo-composable'
import { 
  GET_USER_TEMPLATES_QUERY,
  GET_POPULAR_TEMPLATES_QUERY,
  GET_TEMPLATE_QUERY,
  SEARCH_TEMPLATES_QUERY,
  CREATE_TEMPLATE_MUTATION,
  UPDATE_TEMPLATE_MUTATION,
  DELETE_TEMPLATE_MUTATION,
  APPLY_TEMPLATE_MUTATION,
  type CardTemplate,
  type TemplateCategory,
  type CreateTemplateInput,
  type UpdateTemplateInput,
  type ApplyTemplateInput
} from '../services/template.service'
import { useToast } from './toast'

export interface TemplateState {
  userTemplates: CardTemplate[]
  popularTemplates: CardTemplate[]
  searchResults: CardTemplate[]
  selectedTemplate: CardTemplate | null
  isLoading: boolean
  isCreating: boolean
  isUpdating: boolean
  isDeleting: string | null
  isApplying: string | null
  error: string | null
}

export const useTemplateStore = defineStore('template', () => {
  // State
  const userTemplates = ref<CardTemplate[]>([])
  const popularTemplates = ref<CardTemplate[]>([])
  const searchResults = ref<CardTemplate[]>([])
  const selectedTemplate = ref<CardTemplate | null>(null)
  const isLoading = ref(false)
  const isCreating = ref(false)
  const isUpdating = ref(false)
  const isDeleting = ref<string | null>(null)
  const isApplying = ref<string | null>(null)
  const error = ref<string | null>(null)
  
  const toast = useToast()

  // Computed
  const templatesByCategory = computed(() => {
    const categories: Record<string, CardTemplate[]> = {}
    userTemplates.value.forEach(template => {
      if (!categories[template.category]) {
        categories[template.category] = []
      }
      categories[template.category].push(template)
    })
    return categories
  })

  const isLoadingAny = computed(() => {
    return isLoading.value || isCreating.value || isUpdating.value || 
           !!isDeleting.value || !!isApplying.value
  })

  // GraphQL composables
  const { mutate: createTemplateMutation } = useMutation(CREATE_TEMPLATE_MUTATION)
  const { mutate: updateTemplateMutation } = useMutation(UPDATE_TEMPLATE_MUTATION)
  const { mutate: deleteTemplateMutation } = useMutation(DELETE_TEMPLATE_MUTATION)
  const { mutate: applyTemplateMutation } = useMutation(APPLY_TEMPLATE_MUTATION)

  // Actions
  const clearError = () => {
    error.value = null
  }

  const setError = (errorMessage: string) => {
    error.value = errorMessage
    toast.error(errorMessage, {
      title: 'Template Error',
      duration: 5000
    })
  }

  /**
   * Fetch user templates (their own + public)
   */
  const fetchUserTemplates = async (category?: TemplateCategory) => {
    try {
      isLoading.value = true
      clearError()

      const { result, loading } = useQuery(GET_USER_TEMPLATES_QUERY, { 
        category: category || null 
      })

      // Wait for the query to complete
      while (loading.value) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      if (result.value?.getUserTemplates) {
        userTemplates.value = result.value.getUserTemplates
      }
    } catch (err: any) {
      setError(`Failed to fetch templates: ${err.message}`)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch popular public templates
   */
  const fetchPopularTemplates = async (limit: number = 10) => {
    try {
      isLoading.value = true
      clearError()

      const { result, loading } = useQuery(GET_POPULAR_TEMPLATES_QUERY, { limit })

      // Wait for the query to complete
      while (loading.value) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      if (result.value?.getPopularTemplates) {
        popularTemplates.value = result.value.getPopularTemplates
      }
    } catch (err: any) {
      setError(`Failed to fetch popular templates: ${err.message}`)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get a specific template by ID
   */
  const fetchTemplate = async (templateId: string) => {
    try {
      isLoading.value = true
      clearError()

      const { result, loading } = useQuery(GET_TEMPLATE_QUERY, { id: templateId })

      // Wait for the query to complete
      while (loading.value) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      if (result.value?.getTemplate) {
        selectedTemplate.value = result.value.getTemplate
        return result.value.getTemplate
      }
    } catch (err: any) {
      setError(`Failed to fetch template: ${err.message}`)
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Search templates by query
   */
  const searchTemplates = async (query: string, limit: number = 20) => {
    try {
      isLoading.value = true
      clearError()

      const { result, loading } = useQuery(SEARCH_TEMPLATES_QUERY, { query, limit })

      // Wait for the query to complete
      while (loading.value) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      if (result.value?.searchTemplates) {
        searchResults.value = result.value.searchTemplates
        return result.value.searchTemplates
      }
    } catch (err: any) {
      setError(`Failed to search templates: ${err.message}`)
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Create a new template
   */
  const createTemplate = async (input: CreateTemplateInput) => {
    try {
      isCreating.value = true
      clearError()

      const result = await createTemplateMutation({ input })

      if (result?.data?.createTemplate) {
        const newTemplate = result.data.createTemplate
        userTemplates.value.push(newTemplate)
        
        toast.success(`Template "${newTemplate.name}" created successfully`, {
          title: 'Template Created',
          duration: 3000
        })
        
        return newTemplate
      }
    } catch (err: any) {
      setError(`Failed to create template: ${err.message}`)
      throw err
    } finally {
      isCreating.value = false
    }
  }

  /**
   * Update an existing template
   */
  const updateTemplate = async (input: UpdateTemplateInput) => {
    try {
      isUpdating.value = true
      clearError()

      const result = await updateTemplateMutation({ input })

      if (result?.data?.updateTemplate) {
        const updatedTemplate = result.data.updateTemplate
        
        // Update in userTemplates array
        const index = userTemplates.value.findIndex(t => t.id === updatedTemplate.id)
        if (index !== -1) {
          userTemplates.value[index] = updatedTemplate
        }
        
        // Update selectedTemplate if it's the same
        if (selectedTemplate.value?.id === updatedTemplate.id) {
          selectedTemplate.value = updatedTemplate
        }
        
        toast.success(`Template "${updatedTemplate.name}" updated successfully`, {
          title: 'Template Updated',
          duration: 3000
        })
        
        return updatedTemplate
      }
    } catch (err: any) {
      setError(`Failed to update template: ${err.message}`)
      throw err
    } finally {
      isUpdating.value = false
    }
  }

  /**
   * Delete a template
   */
  const deleteTemplate = async (templateId: string) => {
    try {
      isDeleting.value = templateId
      clearError()

      const result = await deleteTemplateMutation({ id: templateId })

      if (result?.data?.deleteTemplate) {
        // Remove from userTemplates array
        userTemplates.value = userTemplates.value.filter(t => t.id !== templateId)
        
        // Clear selectedTemplate if it's the same
        if (selectedTemplate.value?.id === templateId) {
          selectedTemplate.value = null
        }
        
        toast.success('Template deleted successfully', {
          title: 'Template Deleted',
          duration: 3000
        })
        
        return true
      }
    } catch (err: any) {
      setError(`Failed to delete template: ${err.message}`)
      throw err
    } finally {
      isDeleting.value = null
    }
  }

  /**
   * Apply a template to create a new card
   */
  const applyTemplate = async (input: ApplyTemplateInput) => {
    try {
      isApplying.value = input.templateId
      clearError()

      const result = await applyTemplateMutation({ input })

      if (result?.data?.applyTemplate) {
        const newCard = result.data.applyTemplate
        
        // Find and update the template usage count locally
        const template = userTemplates.value.find(t => t.id === input.templateId) ||
                         popularTemplates.value.find(t => t.id === input.templateId)
        if (template) {
          template.usageCount += 1
        }
        
        toast.success('Card created from template successfully', {
          title: 'Template Applied',
          duration: 3000
        })
        
        return newCard
      }
    } catch (err: any) {
      setError(`Failed to apply template: ${err.message}`)
      throw err
    } finally {
      isApplying.value = null
    }
  }

  /**
   * Get templates by category
   */
  const getTemplatesByCategory = (category: TemplateCategory) => {
    return userTemplates.value.filter(template => template.category === category)
  }

  /**
   * Clear search results
   */
  const clearSearchResults = () => {
    searchResults.value = []
  }

  /**
   * Clear selected template
   */
  const clearSelectedTemplate = () => {
    selectedTemplate.value = null
  }

  return {
    // State
    userTemplates,
    popularTemplates,
    searchResults,
    selectedTemplate,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    isApplying,
    error,
    
    // Computed
    templatesByCategory,
    isLoadingAny,
    
    // Actions
    clearError,
    fetchUserTemplates,
    fetchPopularTemplates,
    fetchTemplate,
    searchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    applyTemplate,
    getTemplatesByCategory,
    clearSearchResults,
    clearSelectedTemplate
  }
})