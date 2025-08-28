# MadPlan Product Requirements Document (PRD)

## Goals and Background Context

### Goals
-   Acquire 1,000 active users within the first 3 months post-launch.
-   Achieve a 40% user retention rate after the first month.
-   Users can effectively manage their projects using a visually engaging, Kanban-style interface.
-   The application's Ghibli-inspired aesthetic is received positively and cited as a key differentiator.
-   Establish a strong brand identity in the niche of "aesthetic productivity tools."

### Background Context
[cite_start]Based on the project brief, MadPlan addresses a gap in the productivity software market for tools that are both functionally robust and aesthetically pleasing[cite: 239]. [cite_start]Current tools are often visually sterile, leading to user fatigue, particularly among creative professionals and students[cite: 241]. [cite_start]MadPlan's purpose is to merge the proven Kanban workflow, popularized by Trello, with an enchanting and calming art style inspired by Studio Ghibli, creating a workspace that is not only organized but also inspiring to use[cite: 240]. This PRD outlines the minimum viable product (MVP) required to validate this core hypothesis.

### Change Log
| Date | Version | Description | Author |
| :--- | :--- | :--- | :--- |
| 2025-08-27 | 1.0 | Initial PRD draft based on Project Brief. | John, PM |

---
## Requirements

### Functional
1.  **FR1:** The system shall allow users to create a new account, log in, and log out securely.
2.  **FR2:** Authenticated users shall be able to create, read, update, and delete project boards.
3.  **FR3:** Within a board, users shall be able to create, read, update, delete, and reorder lists.
4.  **FR4:** Within a list, users shall be able to create, read, update, and delete cards.
5.  **FR5:** Users shall be able to drag and drop cards within a single list and between lists on the same board.

### Non Functional
1.  **NFR1:** The entire user interface, including boards, lists, cards, and controls, must adhere to the defined Ghibli-inspired visual theme.
2.  **NFR2:** The application must be fully responsive and functional across modern desktop, tablet, and mobile web browsers.
3.  **NFR3:** The application's aesthetic elements (styles, subtle animations) must not negatively impact core performance metrics like page load time and UI responsiveness.
4.  **NFR4:** The visual style must be "inspired by" Studio Ghibli, using original artwork that evokes a similar feel without infringing on any existing intellectual property.

---
## User Interface Design Goals

### Overall UX Vision
To provide a simple, intuitive, and delightful user experience. The interface should feel less like a clinical tool and more like a magical, personal workspace. Clarity and ease of use are paramount, with the aesthetic serving to enhance, not obstruct, functionality.

### Key Interaction Paradigms
-   **Direct Manipulation:** The primary interaction model is drag-and-drop for cards and lists, providing immediate tactile feedback.
-   **Progressive Disclosure:** Keep the interface clean. Card details and options are revealed upon interaction, not shown all at once.

### Core Screens and Views
-   Login / Sign-up Page
-   Dashboard (displays all user's boards)
-   Board View (the main Kanban interface with lists and cards)

### Accessibility
-   **WCAG AA:** The application will strive to meet WCAG 2.1 Level AA compliance, ensuring usability for people with disabilities. This includes color contrast, keyboard navigation, and screen reader support.

### Branding
-   The core brand identity is the Ghibli-inspired aesthetic. This involves soft color palettes, hand-drawn style UI elements, and potentially subtle, calming animations.

### Target Device and Platforms
-   **Web Responsive:** The application will be designed with a mobile-first approach to ensure a seamless experience on all screen sizes.

---
## Technical Assumptions

-   **Repository Structure:** **Polyrepo**. The frontend (Vue 3) and backend (Nest.js) will be maintained in separate repositories.
-   **Service Architecture:** A **GraphQL API** will serve as the communication layer between the frontend and backend services.
-   **Testing Requirements:** The project will include comprehensive **Unit and Integration tests** for both the frontend and backend to ensure reliability.
-   **Additional Assumptions:**
    -   **Frontend:** Vue 3
    -   **Backend:** Nest.js
    -   **Database:** MongoDB

---
## Epic List
The MVP will be developed across three logically sequential epics. Each epic delivers a deployable and valuable increment of functionality.

-   **Epic 1: Foundation & Core User Experience:** Establish the project foundation, user authentication, and the main application layout with the Ghibli theme.
-   **Epic 2: Core Board Functionality:** Enable users to perform all create, read, update, and delete (CRUD) operations for boards, lists, and cards.
-   **Epic 3: Interactive Kanban Board:** Implement the core drag-and-drop functionality for cards and lists.

---
## Epic 1: Foundation & Core User Experience
**Goal:** To establish the foundational project structure for both frontend and backend, implement a secure authentication system, and create the main application shell that users will see after logging in.

### Story 1.1: Setup Project Repositories
**As a** developer, **I want** to initialize the separate frontend and backend project repositories, **so that** I have a clean structure for version control and CI/CD pipelines.
-   **Acceptance Criteria:**
    1.  A Git repository for the Vue 3 frontend is created.
    2.  A Git repository for the Nest.js backend is created.
    3.  Basic "Hello World" applications are running in both projects.

### Story 1.2: Implement User Registration Backend
**As a** new user, **I want** to create an account with my email and a password, **so that** I can access the application.
-   **Acceptance Criteria:**
    1.  A GraphQL mutation `registerUser` is available.
    2.  The mutation accepts an email and password.
    3.  A new user record is created in the MongoDB database with a hashed password.
    4.  The system prevents registration with a previously used email.

### Story 1.3: Implement User Login Backend
**As a** registered user, **I want** to log in with my email and password, **so that** I can access my project boards.
-   **Acceptance Criteria:**
    1.  A GraphQL mutation `loginUser` is available.
    2.  Upon successful authentication, a JWT (JSON Web Token) is returned to the client.
    3.  An error is returned for invalid credentials.

### Story 1.4: Create Frontend Login/Registration Pages
**As a** user, **I want** to see and interact with sign-up and login forms, **so that** I can access my account.
-   **Acceptance Criteria:**
    1.  A `/login` page with fields for email and password exists.
    2.  A `/register` page with fields for email and password exists.
    3.  The forms call the respective GraphQL mutations upon submission.
    4.  Users are redirected to their dashboard upon successful login/registration.

### Story 1.5: Implement Basic Application Shell/Layout
**As a** logged-in user, **I want** to see the main application layout with a consistent header and the Ghibli theme, **so that** I have a coherent and pleasant workspace.
-   **Acceptance Criteria:**
    1.  A main layout component is created that includes a header with the app name and a logout button.
    2.  The Ghibli-inspired background and color palette are applied globally.
    3.  This layout wraps the main content area (which will later hold the boards).

---
## Epic 2: Core Board Functionality
**Goal:** To implement the core project management features, allowing users to fully manage their work through boards, lists, and cards via the UI.

### Story 2.1: Implement Board Management Backend
**As a** user, **I want** to create, view, and delete my boards, **so that** I can organize my different projects.
-   **Acceptance Criteria:**
    1.  GraphQL queries and mutations for `createBoard`, `getBoardsByUser`, and `deleteBoard` are implemented.
    2.  Board operations are restricted to the authenticated user who owns them.
    3.  Data is correctly persisted in the MongoDB database.

### Story 2.2: Implement Frontend for Board Dashboard
**As a** user, **I want** to see all my boards on a dashboard and be able to create new ones, **so that** I can navigate between my projects.
-   **Acceptance Criteria:**
    1.  The main dashboard page (`/dashboard`) fetches and displays a list of the user's boards.
    2.  The UI includes a button or form to create a new board.
    3.  Clicking on a board navigates the user to the specific board view (e.g., `/board/:id`).

### Story 2.3: Implement List Management Backend
**As a** user, **I want** to add, edit, and delete lists on my board, **so that** I can structure my project workflow.
-   **Acceptance Criteria:**
    1.  GraphQL mutations for `createList`, `updateList`, and `deleteList` are implemented.
    2.  Lists are associated with a specific board.
    3.  List operations are restricted to the board owner.

### Story 2.4: Implement Frontend for List Management
**As a** user, **I want** to see lists on my board and be able to add, rename, or remove them, **so that** I can manage my workflow stages.
-   **Acceptance Criteria:**
    1.  The board view fetches and displays all lists for that board.
    2.  The UI provides controls to add a new list.
    3.  Each list displays its title and provides controls for renaming or deleting it.

### Story 2.5: Implement Card Management Backend
**As a** user, **I want** to add, edit, and delete cards within a list, **so that** I can track individual tasks.
-   **Acceptance Criteria:**
    1.  GraphQL mutations for `createCard`, `updateCard`, and `deleteCard` are implemented.
    2.  Cards are associated with a specific list.
    3.  Card operations are restricted to the board owner.

### Story 2.6: Implement Frontend for Card Management
**As a** user, **I want** to see cards in their respective lists and be able to add, edit, or remove them, **so that** I can manage my tasks.
-   **Acceptance Criteria:**
    1.  Lists fetch and display all their associated cards.
    2.  Each list provides a UI control to add a new card.
    3.  Each card displays its content and provides controls for editing or deleting it.

---
## Epic 3: Interactive Kanban Board
**Goal:** To make the board fully interactive by implementing the essential drag-and-drop functionality for organizing cards and lists.

### Story 3.1: Implement Frontend Drag-and-Drop for Cards
**As a** user, **I want** to drag and drop my cards to reorder them within a list or move them to a different list, **so that** I can visually update my task status and priority.
-   **Acceptance Criteria:**
    1.  A frontend library (like Vue.Draggable) is implemented to enable card dragging.
    2.  Cards can be visually reordered within the same list.
    3.  Cards can be visually dropped into a different list.
    4.  The UI updates optimistically to reflect the new position immediately.

### Story 3.2: Implement Backend Logic for Card Reordering
**As a** user, **I want** my card order to be saved, **so that** it persists when I refresh the page.
-   **Acceptance Criteria:**
    1.  A GraphQL mutation `reorderCard` is implemented.
    2.  The mutation accepts the card ID, its new list ID, and its new position index.
    3.  The backend logic updates the affected card(s) and list(s) in the database.

### Story 3.3: Implement Frontend Drag-and-Drop for Lists
**As a** user, **I want** to drag and drop lists to reorder them on my board, **so that** I can customize my workflow layout.
-   **Acceptance Criteria:**
    1.  The board view allows lists to be dragged and dropped to new positions.
    2.  The UI updates optimistically to show the new list order.

### Story 3.4: Implement Backend Logic for List Reordering
**As a** user, **I want** my list order to be saved, **so that** my custom workflow layout is permanent.
-   **Acceptance Criteria:**
    1.  A GraphQL mutation `reorderList` is implemented.
    2.  The mutation accepts the list ID and its new position index.
    3.  The backend logic updates the list's position in the database.

---
## Next Steps

### UX Expert Prompt
Based on this PRD, please create a UI/UX Specification. Focus on defining the Ghibli-inspired component library (buttons, cards, modals), user flows for authentication and board management, and responsive layouts for the core screens (Dashboard and Board View).

### Architect Prompt
Based on this PRD, please create a Fullstack Architecture Document. The tech stack is defined (Vue 3, Nest.js, GraphQL, MongoDB, Polyrepo). Your focus should be on designing the GraphQL schema, the MongoDB data models, the component structure for both frontend and backend, and the recommended deployment strategy.