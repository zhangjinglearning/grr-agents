<template>
  <div id="app" class="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
    <header class="bg-white shadow-sm border-b border-green-200">
      <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <h1 class="text-2xl font-bold text-green-800">MadPlan</h1>
          </div>
          <div class="flex items-center space-x-4">
            <router-link
              to="/"
              class="text-gray-600 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium"
              active-class="text-green-600 bg-green-50"
            >
              Dashboard
            </router-link>
          </div>
        </div>
      </nav>
    </header>

    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
  // Component logic will be added as features are implemented
</script>

<style scoped>
  /* Component-specific styles */
</style>
