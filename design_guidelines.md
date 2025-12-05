# Employee Performance Evaluation System - Design Guidelines

## Design Approach: Carbon Design System
**Rationale:** Enterprise-focused with robust data display patterns, professional aesthetics, and established interaction models for complex workflows. Optimized for information-dense interfaces requiring clarity and efficiency.

## Core Design Elements

### A. Color Palette
**Light Mode:**
- Primary: 220 85% 45% (Professional Blue)
- Background: 220 15% 98%
- Surface Cards: 0 0% 100%
- Text Primary: 220 15% 20%
- Text Secondary: 220 10% 45%
- Border: 220 15% 88%
- Success: 145 65% 42%
- Warning: 38 92% 50%
- Error: 0 72% 51%

**Dark Mode:**
- Primary: 220 85% 60%
- Background: 220 15% 12%
- Surface Cards: 220 12% 16%
- Text Primary: 220 15% 92%
- Text Secondary: 220 10% 65%
- Border: 220 12% 24%

### B. Typography
**Font Stack:** 'Inter' from Google Fonts (400, 500, 600, 700)
- Page Headers: text-4xl font-bold (36px)
- Section Headers: text-2xl font-semibold (24px)
- Card Titles: text-lg font-semibold (18px)
- Body Text: text-base font-normal (16px)
- Labels/Meta: text-sm font-medium (14px)
- Captions: text-xs (12px)

### C. Layout System
**Spacing Primitives:** Tailwind units 2, 4, 6, 8, 12, 16
- Card padding: p-6
- Section spacing: mb-8
- Element gaps: gap-4
- Page margins: px-8 py-6
- Container max-width: max-w-7xl

### D. Component Library

**Navigation:**
- Top bar with logo, user profile, notifications
- Sidebar navigation (collapsible) with icons + labels
- Breadcrumb trail for deep navigation
- Tab navigation for section switching

**Card System - Critical Design:**
- Base card: Rounded corners (rounded-lg), subtle shadow, border
- **Action Buttons Position:** Absolute positioned top-right (top-4 right-4)
- Action buttons: Icon-only, ghost variant, grouped horizontally
- Button order: Edit, Copy, Delete with 2-unit gap
- Content padding accounts for button space: pt-12 (to prevent overlap)
- Hover states: Subtle background on actions, card border color shift

**Data Display:**
- Progress bars with percentage labels (performance metrics)
- Status badges (Outstanding, Meets Expectations, Needs Improvement)
- Data tables with sortable headers, row hover states
- Metric cards: Large number + trend indicator + sparkline suggestion
- Timeline component for evaluation history

**Forms:**
- Stacked labels above inputs
- Input groups with icon prefixes
- Multi-select dropdowns for competency selection
- Text areas for comments/feedback (min-height 120px)
- Star rating component (1-5 scale, interactive)
- Date pickers for review periods

**Interactive Elements:**
- Primary buttons: Solid fill, medium weight
- Secondary buttons: Outline variant
- Ghost buttons: For tertiary actions
- Danger buttons: Red variant for destructive actions
- Button sizes: base (px-4 py-2), large for CTAs (px-6 py-3)

**Data Visualizations:**
- Bar charts for performance comparison
- Radar charts for competency assessment
- Line graphs for performance trends
- Use consistent color coding across charts

## Page Layout Specifications

**Dashboard View:**
- Summary metrics grid (4 columns on desktop: grid-cols-4)
- Recent evaluations table below metrics
- Upcoming reviews sidebar panel
- Quick actions floating button (bottom-right)

**Evaluation Cards Grid:**
- 3-column layout desktop (grid-cols-3), 2 tablet, 1 mobile
- Each card shows: Employee photo, name, role, rating, status
- Action buttons (Edit, Copy, Delete) positioned top-right corner
- Card hover: Subtle elevation increase, border color change

**Individual Evaluation Page:**
- Two-column layout: Left (employee info, overall score), Right (action panel)
- Tabbed sections: Overview, Goals, Competencies, Feedback, History
- Comments section with threading support
- Attachment display area

**Forms & Modals:**
- Modal overlays with backdrop blur
- Multi-step forms with progress indicator
- Autosave indication (subtle badge)
- Validation messages inline below fields

## Images
**Hero Section:** Yes, professional hero image
- Location: Top of dashboard/landing
- Type: Corporate team collaboration scene, high-quality photography
- Treatment: Subtle gradient overlay (dark to transparent) for text readability
- Height: 60vh on desktop
- Text overlay: White text, outline buttons with blur backdrop

**Employee Cards:** Profile photos
- Size: 64x64px, circular crop
- Fallback: Initials on colored background
- Position: Top-left of card content

**Empty States:** Illustrations
- Friendly, minimal line-art style
- Used when no evaluations exist, no search results
- Centered in content area

## Animations
Minimal, purposeful only:
- Card hover: transform scale-102, transition 200ms
- Action button reveals: opacity fade on card hover
- Modal entry: fade + slight scale
- Loading states: skeleton screens (no spinners)

## Interaction Patterns
- Click card body → Navigate to detail view
- Hover card → Show quick actions
- Click action button → Immediate action (delete) or modal (edit)
- Copy button → Visual confirmation toast (top-right)
- Drag-and-drop for reordering evaluations (optional enhancement)
- Inline editing for quick updates
- Bulk actions via checkboxes (select multiple evaluations)

## Accessibility
- ARIA labels on icon-only buttons
- Keyboard navigation support (Tab, Enter, Escape)
- Focus indicators (ring-2 ring-offset-2)
- Color contrast ratio ≥4.5:1
- Screen reader announcements for actions
- Dark mode with consistent input backgrounds