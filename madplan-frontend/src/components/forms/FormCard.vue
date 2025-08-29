<template>
  <div class="form-card-container">
    <div class="form-card">
      <!-- Header -->
      <div v-if="$slots.header || title" class="form-card-header">
        <slot name="header">
          <h2 v-if="title" class="form-card-title">
            {{ title }}
          </h2>
          <p v-if="subtitle" class="form-card-subtitle">
            {{ subtitle }}
          </p>
        </slot>
      </div>
      
      <!-- Content -->
      <div class="form-card-content">
        <slot></slot>
      </div>
      
      <!-- Footer -->
      <div v-if="$slots.footer" class="form-card-footer">
        <slot name="footer"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title?: string
  subtitle?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

const props = withDefaults(defineProps<Props>(), {
  maxWidth: 'md'
})
</script>

<style scoped>
.form-card-container {
  @apply flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8;
  
  /* Ghibli-inspired background */
  background: linear-gradient(
    135deg,
    #ecfdf5 0%,
    #d1fae5 25%,
    #a7f3d0 50%,
    #6ee7b7 75%,
    #34d399 100%
  );
  background-size: 400% 400%;
  animation: gradientShift 15s ease infinite;
}

.form-card {
  @apply w-full rounded-2xl shadow-2xl backdrop-blur-sm;
  
  /* Dynamic max-width based on prop */
  max-width: v-bind("props.maxWidth === 'sm' ? '384px' : props.maxWidth === 'md' ? '448px' : props.maxWidth === 'lg' ? '512px' : props.maxWidth === 'xl' ? '576px' : '672px'");
  
  /* Ghibli-inspired card styling */
  background: rgba(255, 255, 255, 0.95);
  border: 2px solid rgba(16, 185, 129, 0.2);
  backdrop-filter: blur(10px);
  box-shadow: 
    0 25px 50px -12px rgba(0, 0, 0, 0.1),
    0 25px 50px -12px rgba(16, 185, 129, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.form-card-header {
  @apply px-8 pt-8 pb-6 text-center;
}

.form-card-title {
  @apply text-3xl font-bold text-emerald-900 mb-2;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.form-card-subtitle {
  @apply text-emerald-700 text-base;
}

.form-card-content {
  @apply px-8 pb-8;
}

.form-card-footer {
  @apply px-8 pb-8 pt-4 border-t border-emerald-100;
}

/* Ghibli-inspired animations */
@keyframes gradientShift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

/* Floating animation for the card */
.form-card {
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .form-card-container {
    @apply px-2 py-8;
  }
  
  .form-card-header {
    @apply px-6 pt-6 pb-4;
  }
  
  .form-card-title {
    @apply text-2xl;
  }
  
  .form-card-content {
    @apply px-6 pb-6;
  }
  
  .form-card-footer {
    @apply px-6 pb-6;
  }
}
</style>