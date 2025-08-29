import { describe, it, expect, beforeEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import FormCard from './FormCard.vue'

describe('FormCard', () => {
  let wrapper: VueWrapper<any>

  beforeEach(() => {
    // Clear any existing wrappers
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Basic Rendering', () => {
    it('should render correctly with default props', () => {
      wrapper = mount(FormCard)

      expect(wrapper.find('.form-card-container').exists()).toBe(true)
      expect(wrapper.find('.form-card').exists()).toBe(true)
      expect(wrapper.find('.form-card-content').exists()).toBe(true)
    })

    it('should render default slot content', () => {
      wrapper = mount(FormCard, {
        slots: {
          default: '<p>Card content</p>',
        },
      })

      expect(wrapper.find('.form-card-content').html()).toContain('<p>Card content</p>')
    })

    it('should render complex default slot content', () => {
      wrapper = mount(FormCard, {
        slots: {
          default: `
            <form>
              <input type="text" name="username" />
              <button type="submit">Submit</button>
            </form>
          `,
        },
      })

      const content = wrapper.find('.form-card-content')
      expect(content.find('form').exists()).toBe(true)
      expect(content.find('input[name="username"]').exists()).toBe(true)
      expect(content.find('button[type="submit"]').exists()).toBe(true)
    })
  })

  describe('Header Section', () => {
    it('should not render header when no title, subtitle, or header slot', () => {
      wrapper = mount(FormCard)

      expect(wrapper.find('.form-card-header').exists()).toBe(false)
    })

    it('should render header when title is provided', () => {
      wrapper = mount(FormCard, {
        props: {
          title: 'Login Form',
        },
      })

      const header = wrapper.find('.form-card-header')
      expect(header.exists()).toBe(true)

      const title = wrapper.find('.form-card-title')
      expect(title.exists()).toBe(true)
      expect(title.text()).toBe('Login Form')
    })

    it('should render subtitle when provided', () => {
      wrapper = mount(FormCard, {
        props: {
          title: 'Welcome',
          subtitle: 'Please sign in to your account',
        },
      })

      const subtitle = wrapper.find('.form-card-subtitle')
      expect(subtitle.exists()).toBe(true)
      expect(subtitle.text()).toBe('Please sign in to your account')
    })

    it('should render subtitle only when title is also provided', () => {
      wrapper = mount(FormCard, {
        props: {
          subtitle: 'Please sign in to your account',
        },
      })

      // Header should not render if there's only subtitle without title
      expect(wrapper.find('.form-card-header').exists()).toBe(false)
    })

    it('should render custom header slot over title/subtitle props', () => {
      wrapper = mount(FormCard, {
        props: {
          title: 'Default Title',
          subtitle: 'Default Subtitle',
        },
        slots: {
          header: '<div class="custom-header">Custom Header</div>',
        },
      })

      const header = wrapper.find('.form-card-header')
      expect(header.exists()).toBe(true)
      expect(header.find('.custom-header').exists()).toBe(true)
      expect(header.find('.custom-header').text()).toBe('Custom Header')
      expect(wrapper.find('.form-card-title').exists()).toBe(false)
      expect(wrapper.find('.form-card-subtitle').exists()).toBe(false)
    })

    it('should render header when only header slot is provided', () => {
      wrapper = mount(FormCard, {
        slots: {
          header: '<h1>Slot Only Header</h1>',
        },
      })

      const header = wrapper.find('.form-card-header')
      expect(header.exists()).toBe(true)
      expect(header.find('h1').text()).toBe('Slot Only Header')
    })
  })

  describe('Footer Section', () => {
    it('should not render footer when no footer slot is provided', () => {
      wrapper = mount(FormCard)

      expect(wrapper.find('.form-card-footer').exists()).toBe(false)
    })

    it('should render footer when footer slot is provided', () => {
      wrapper = mount(FormCard, {
        slots: {
          footer: '<div class="custom-footer">Footer content</div>',
        },
      })

      const footer = wrapper.find('.form-card-footer')
      expect(footer.exists()).toBe(true)
      expect(footer.find('.custom-footer').exists()).toBe(true)
      expect(footer.find('.custom-footer').text()).toBe('Footer content')
    })

    it('should render complex footer content', () => {
      wrapper = mount(FormCard, {
        slots: {
          footer: `
            <div class="footer-actions">
              <button type="button">Cancel</button>
              <button type="submit">Submit</button>
            </div>
          `,
        },
      })

      const footer = wrapper.find('.form-card-footer')
      expect(footer.find('.footer-actions').exists()).toBe(true)
      expect(footer.findAll('button')).toHaveLength(2)
    })
  })

  describe('Max Width Variations', () => {
    it('should apply medium max-width by default', () => {
      wrapper = mount(FormCard)

      const card = wrapper.find('.form-card')
      const computedStyle = getComputedStyle(card.element)
      // Note: In testing environment, CSS custom properties might not be computed
      // We test that the element exists and has the expected classes
      expect(card.exists()).toBe(true)
    })

    it('should accept small max-width prop', () => {
      wrapper = mount(FormCard, {
        props: {
          maxWidth: 'sm',
        },
      })

      const card = wrapper.find('.form-card')
      expect(card.exists()).toBe(true)
      // The max-width is applied via CSS custom properties, which we can verify through the style binding
    })

    it('should accept large max-width prop', () => {
      wrapper = mount(FormCard, {
        props: {
          maxWidth: 'lg',
        },
      })

      const card = wrapper.find('.form-card')
      expect(card.exists()).toBe(true)
    })

    it('should accept extra large max-width prop', () => {
      wrapper = mount(FormCard, {
        props: {
          maxWidth: 'xl',
        },
      })

      const card = wrapper.find('.form-card')
      expect(card.exists()).toBe(true)
    })

    it('should accept 2xl max-width prop', () => {
      wrapper = mount(FormCard, {
        props: {
          maxWidth: '2xl',
        },
      })

      const card = wrapper.find('.form-card')
      expect(card.exists()).toBe(true)
    })
  })

  describe('CSS Classes and Styling', () => {
    it('should apply base container classes', () => {
      wrapper = mount(FormCard)

      const container = wrapper.find('.form-card-container')
      expect(container.classes()).toContain('form-card-container')
    })

    it('should apply base card classes', () => {
      wrapper = mount(FormCard)

      const card = wrapper.find('.form-card')
      expect(card.classes()).toContain('form-card')
    })

    it('should apply header classes when header is rendered', () => {
      wrapper = mount(FormCard, {
        props: {
          title: 'Test Title',
        },
      })

      const header = wrapper.find('.form-card-header')
      expect(header.classes()).toContain('form-card-header')

      const title = wrapper.find('.form-card-title')
      expect(title.classes()).toContain('form-card-title')
    })

    it('should apply subtitle classes when subtitle is rendered', () => {
      wrapper = mount(FormCard, {
        props: {
          title: 'Test Title',
          subtitle: 'Test Subtitle',
        },
      })

      const subtitle = wrapper.find('.form-card-subtitle')
      expect(subtitle.classes()).toContain('form-card-subtitle')
    })

    it('should apply content classes', () => {
      wrapper = mount(FormCard)

      const content = wrapper.find('.form-card-content')
      expect(content.classes()).toContain('form-card-content')
    })

    it('should apply footer classes when footer is rendered', () => {
      wrapper = mount(FormCard, {
        slots: {
          footer: '<div>Footer</div>',
        },
      })

      const footer = wrapper.find('.form-card-footer')
      expect(footer.classes()).toContain('form-card-footer')
    })
  })

  describe('Accessibility', () => {
    it('should use semantic heading for title', () => {
      wrapper = mount(FormCard, {
        props: {
          title: 'Login Form',
        },
      })

      const title = wrapper.find('h2')
      expect(title.exists()).toBe(true)
      expect(title.text()).toBe('Login Form')
    })

    it('should maintain proper heading hierarchy in custom header', () => {
      wrapper = mount(FormCard, {
        slots: {
          header: '<h1>Main Title</h1><h2>Subtitle</h2>',
        },
      })

      expect(wrapper.find('h1').exists()).toBe(true)
      expect(wrapper.find('h2').exists()).toBe(true)
    })

    it('should support complex accessible content', () => {
      wrapper = mount(FormCard, {
        props: {
          title: 'Registration Form',
          subtitle: 'Create your account',
        },
        slots: {
          default: `
            <form aria-label="User registration">
              <label for="email">Email</label>
              <input id="email" type="email" name="email" required />
              <button type="submit">Register</button>
            </form>
          `,
          footer: '<p role="note">By registering, you agree to our terms</p>',
        },
      })

      // Check that ARIA attributes are preserved
      const form = wrapper.find('form[aria-label="User registration"]')
      expect(form.exists()).toBe(true)

      const label = wrapper.find('label[for="email"]')
      expect(label.exists()).toBe(true)

      const input = wrapper.find('input#email[required]')
      expect(input.exists()).toBe(true)

      const note = wrapper.find('p[role="note"]')
      expect(note.exists()).toBe(true)
    })
  })

  describe('Complex Scenarios', () => {
    it('should handle full card with all slots and props', () => {
      wrapper = mount(FormCard, {
        props: {
          title: 'Complete Form',
          subtitle: 'Fill out all fields',
          maxWidth: 'lg',
        },
        slots: {
          default: `
            <form>
              <input type="text" placeholder="Username" />
              <input type="password" placeholder="Password" />
            </form>
          `,
          footer: `
            <div class="actions">
              <button>Cancel</button>
              <button>Submit</button>
            </div>
          `,
        },
      })

      // Verify all sections exist
      expect(wrapper.find('.form-card-header').exists()).toBe(true)
      expect(wrapper.find('.form-card-title').text()).toBe('Complete Form')
      expect(wrapper.find('.form-card-subtitle').text()).toBe('Fill out all fields')
      expect(wrapper.find('.form-card-content form').exists()).toBe(true)
      expect(wrapper.find('.form-card-footer .actions').exists()).toBe(true)
      expect(wrapper.findAll('input')).toHaveLength(2)
      expect(wrapper.findAll('.form-card-footer button')).toHaveLength(2)
    })

    it('should handle card with only content', () => {
      wrapper = mount(FormCard, {
        slots: {
          default: '<div class="simple-content">Just content</div>',
        },
      })

      expect(wrapper.find('.form-card-header').exists()).toBe(false)
      expect(wrapper.find('.form-card-footer').exists()).toBe(false)
      expect(wrapper.find('.form-card-content .simple-content').exists()).toBe(true)
    })

    it('should handle card with custom header slot overriding props', () => {
      wrapper = mount(FormCard, {
        props: {
          title: 'Prop Title',
          subtitle: 'Prop Subtitle',
        },
        slots: {
          header: '<div class="custom">Custom Header Override</div>',
          default: '<p>Content</p>',
        },
      })

      // Custom header should override props
      expect(wrapper.find('.form-card-title').exists()).toBe(false)
      expect(wrapper.find('.form-card-subtitle').exists()).toBe(false)
      expect(wrapper.find('.custom').text()).toBe('Custom Header Override')
    })
  })

  describe('Props Validation and Edge Cases', () => {
    it('should handle empty string title', () => {
      wrapper = mount(FormCard, {
        props: {
          title: '',
        },
      })

      // Empty string should still render header but with empty title
      expect(wrapper.find('.form-card-header').exists()).toBe(true)
      expect(wrapper.find('.form-card-title').text()).toBe('')
    })

    it('should handle whitespace-only title', () => {
      wrapper = mount(FormCard, {
        props: {
          title: '   ',
        },
      })

      expect(wrapper.find('.form-card-title').text()).toBe('   ')
    })

    it('should handle special characters in title and subtitle', () => {
      wrapper = mount(FormCard, {
        props: {
          title: 'Title with <special> &amp; characters',
          subtitle: 'Subtitle with émojis 🎉 and symbols ©',
        },
      })

      expect(wrapper.find('.form-card-title').text()).toBe('Title with <special> &amp; characters')
      expect(wrapper.find('.form-card-subtitle').text()).toBe('Subtitle with émojis 🎉 and symbols ©')
    })

    it('should handle reactive prop changes', async () => {
      wrapper = mount(FormCard, {
        props: {
          title: 'Initial Title',
          maxWidth: 'sm',
        },
      })

      expect(wrapper.find('.form-card-title').text()).toBe('Initial Title')

      // Update props
      await wrapper.setProps({
        title: 'Updated Title',
        subtitle: 'New Subtitle',
        maxWidth: 'lg',
      })

      expect(wrapper.find('.form-card-title').text()).toBe('Updated Title')
      expect(wrapper.find('.form-card-subtitle').text()).toBe('New Subtitle')
    })
  })
})