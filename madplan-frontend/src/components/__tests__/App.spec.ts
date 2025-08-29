import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../../App.vue'

describe('App', () => {
  it('renders properly', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          'router-link': true,
          'router-view': true,
        },
      },
    })
    expect(wrapper.text()).toContain('MadPlan')
  })

  it('has correct navigation structure', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          'router-link': true,
          'router-view': true,
        },
      },
    })
    expect(wrapper.find('header').exists()).toBe(true)
    expect(wrapper.find('nav').exists()).toBe(true)
    expect(wrapper.find('main').exists()).toBe(true)
  })
})
