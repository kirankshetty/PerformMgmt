# Employee Performance Evaluation System

## Overview

This is a comprehensive employee performance evaluation and review management system built with React, Node.js, and PostgreSQL. The application facilitates structured performance reviews with role-based access control, supporting five distinct user roles: Super Administrator, Administrator, HR Manager, Employee, and Manager. The system provides end-to-end workflow management from questionnaire creation to evaluation completion with approval processes and automated email notifications, including advanced progress tracking and flexible appraisal initiation with scheduled and immediate publishing modes.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### Date Handling Fix (October 2025)
Fixed timezone-related date display issues in Frequency Calendar system:
- **Problem**: Database stored UTC timestamps (e.g., `2025-03-31 18:30:00`) representing local IST dates. PostgreSQL returned these without timezone info, causing JavaScript to interpret them as local time, resulting in off-by-one date errors.
- **Solution**: Updated database to store actual local dates (`2025-04-01 00:00:00` instead of `2025-03-31 18:30:00`).
- **Impact**: Calendar periods now display correctly (e.g., Q1-2025 shows 4/1/2025 - 6/30/2025 instead of 3/31/2025 - 6/29/2025).
- **Implementation**: Date formatting uses local component extraction to ensure consistency across timezones.

## Test Credentials

For testing HR Manager functionality:
- **Company**: hfactor
- **Username**: kirankshetty@yahoo.com
- **Password**: password123

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite
- **Routing**: Wouter for client-side routing with role-based protection
- **UI Components**: shadcn/ui built on Radix UI
- **Styling**: Tailwind CSS with CSS variables
- **State Management**: TanStack Query
- **Form Handling**: React Hook Form with Zod validation
- **File Uploads**: Uppy integration with Google Cloud Storage

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Authentication**: Replit Authentication with session-based auth
- **Email Service**: Nodemailer for notifications and calendar invites
- **File Storage**: Google Cloud Storage
- **API Design**: RESTful API with role-based access control middleware

### Database Schema Design
- **User Management**: Role-based permissions (super_admin, admin, hr_manager, employee, manager)
- **Company Structure**: Multi-tenant support (company, location, user relationships)
- **Performance Reviews**: Flexible questionnaire template system with dynamic question types
- **Evaluation Workflow**: Complete evaluation lifecycle with approval tracking
- **Session Management**: PostgreSQL-based session storage
- **Scheduled Tasks**: `scheduled_appraisal_tasks` table for managing timed appraisal initiations.

### Role-Based Access Control
- **Super Administrator**: Full system access, company management, user role assignments.
- **Administrator**: User management, location setup, questionnaire configuration, email service setup.
- **HR Manager**: Review cycle initiation, progress monitoring, evaluation oversight.
- **Employee**: Self-evaluation, document export, meeting scheduling.
- **Manager**: Team member evaluation, review approval, meeting coordination.

### Key Features
- **Email Integration**: Configurable SMTP, automated notifications (invitations, reminders, completion, employee submission alerts), calendar invite generation. When an employee submits their self-evaluation, the system automatically sends an email notification to their manager with CC to all HR managers for the company. Performance Review Completion emails include Employee Code, Employee Name, Employee Email ID, Final Rating, Meeting Completed On date, Meeting Notes (with visibility control), and Manager information. Meeting notes are only shown to employees if the manager explicitly enables the "Show notes to employee" option.
- **File Management System**: Google Cloud Storage integration, PDF/DOCX generation for evaluations, company asset management.
- **Progress Tracking**: Accurate, real-time tracking of evaluation progress with comprehensive filtering (Appraisal Cycle, Frequency Calendar, Frequency Calendar Details, Group, Employee, Location, Department, Level, Grade, Manager) and different view modes (Card, Table). The Appraisal Cycle filter displays actual cycles in "code - description" format (e.g., "FY 2025-26 - Annual Appraisal from April 2025 to March 2026"). Includes functional "Send Reminder" capabilities. Excel export includes Location, Member Rating, and Final Manager Rating columns with proper handling of 0 ratings.
- **Appraisal Initiation**: Supports "Publish Now" for immediate evaluation creation and email notifications, and "Publish As Per Calendar" for scheduled initiation based on frequency calendar periods.
- **Multi-Select Period Selection**: HR Managers can selectively choose specific calendar periods for appraisal initiation, preserving per-period timing configurations.
- **Password Management**: All user roles (HR Manager, Employee, Manager, Administrator, Super Administrator) can change their own passwords through the Settings page with secure validation and current password verification.
- **Meeting Scheduler**: Streamlined one-on-one meeting scheduler with single preferred date/time selection. Modal optimized for 100% zoom visibility (max-w-xl, max-h-90vh with scrolling).
- **Meeting Notes with Visibility Control**: Managers can add meeting notes after completing performance reviews with a toggle to control whether notes are visible to employees. The "Show notes to employee" setting defaults to "No" (hidden) and is preserved when editing notes. Meeting notes visibility is enforced in all email notifications based on this setting.
- **Development Goals**: Employees can set development goals linked to their completed evaluations. Goals include description, planned outcome, target date, and progress tracking. Goals are grouped by appraisal cycle and accessible from the sidebar menu ("Set Development Goals"), the My Evaluations page (via "Add Goal" button for completed evaluations), and the Employee Dashboard's Active Goals card. The system automatically calculates goal status (not_started, on_track, delayed, completed) based on progress percentage and target dates.

## External Dependencies

### Database Services
- **Neon Database**: PostgreSQL-compatible serverless database.
- **PostgreSQL**: Primary database for application data and session storage.

### Cloud Services
- **Google Cloud Storage**: Object storage for files, documents, and assets.
- **Replit Authentication**: OAuth-based authentication service.

### Email Services
- **Nodemailer**: SMTP client for email delivery and templates.

### UI and Styling
- **shadcn/ui**: Accessible component library based on Radix UI.
- **Tailwind CSS**: Utility-first CSS framework.

### File Upload and Processing
- **Uppy**: File upload library.

### Development Tools
- **TypeScript**: Type safety for frontend and backend.
- **Drizzle Kit**: Database migration and schema management.
- **Vite**: Fast build tool.