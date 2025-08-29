import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client/core'
import { setContext } from '@apollo/client/link/context'
import { DefaultApolloClient } from '@vue/apollo-composable'
import App from './App.vue'
import router from './router'
import './style.css'

// HTTP link
const httpLink = createHttpLink({
  uri: import.meta.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:3000/graphql',
})

// Auth link to add token to requests
const authLink = setContext((_, { headers }) => {
  // Get token from localStorage
  const token = localStorage.getItem('auth-token')
  
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    }
  }
})

// Apollo Client configuration
const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
    },
    query: {
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
})

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.provide(DefaultApolloClient, apolloClient)

app.mount('#app')
