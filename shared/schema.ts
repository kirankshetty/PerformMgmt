import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  decimal,
  pgEnum,
  foreignKey,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - mandatory for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User roles enum
export const userRoleEnum = pgEnum('user_role', [
  'super_admin',
  'admin', 
  'hr_manager',
  'employee',
  'manager'
]);

// User status enum
export const statusEnum = pgEnum('status', ['active', 'inactive']);

// Questionnaire category enum
export const categoryEnum = pgEnum('category', ['employee', 'manager']);

// Publish type enum
export const publishTypeEnum = pgEnum('publish_type', ['now', 'as_per_calendar']);

// Appraisal type enum
export const appraisalTypeEnum = pgEnum('appraisal_type', [
  'questionnaire_based',
  'kpi_based', 
  'mbo_based',
  'okr_based'
]);

// Appraisal cycle status enum
export const appraisalCycleStatusEnum = pgEnum('appraisal_cycle_status', [
  'draft',
  'active', 
  'closed',
  'cancelled'
]);

// Calendar provider enum
export const calendarProviderEnum = pgEnum('calendar_provider', ['google', 'outlook']);

// User storage table - mandatory for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Additional fields for the app
  code: varchar("code").unique(),
  designation: varchar("designation"),
  department: varchar("department"),
  dateOfJoining: timestamp("date_of_joining"),
  mobileNumber: varchar("mobile_number"),
  reportingManagerId: varchar("reporting_manager_id"),
  locationId: varchar("location_id"),
  companyId: varchar("company_id"),
  levelId: varchar("level_id"),
  gradeId: varchar("grade_id"),
  role: userRoleEnum("role").default('employee'),
  roles: text("roles").array(),
  status: statusEnum("status").default('active'),
  // Password field for admin-managed accounts
  passwordHash: varchar("password_hash"),
  // Track which Administrator created this user (for user isolation)
  createdById: varchar("created_by_id"),
}, (table) => [
  index("users_created_by_id_idx").on(table.createdById),
  index("users_level_id_idx").on(table.levelId),
  index("users_grade_id_idx").on(table.gradeId),
])

// Companies table
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  address: text("address"),
  clientContact: varchar("client_contact"),
  email: varchar("email"),
  contactNumber: varchar("contact_number"),
  gstNumber: varchar("gst_number"),
  logoUrl: varchar("logo_url"),
  url: varchar("url"),
  companyUrl: varchar("company_url").unique(), // URL slug for company login (e.g., 'hfactor')
  status: statusEnum("status").default('active'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Locations table
export const locations = pgTable("locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").unique().notNull(),
  name: varchar("name").notNull(),
  state: varchar("state"),
  country: varchar("country"),
  status: statusEnum("status").default('active'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Questionnaire templates table
export const questionnaireTemplates = pgTable("questionnaire_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(), // Keep existing column name
  description: text("description"), // Keep existing column name  
  targetRole: userRoleEnum("target_role").notNull(), // Keep existing column name
  applicableCategory: categoryEnum("applicable_category"), // New field - optional for backward compatibility
  applicableLevelId: varchar("applicable_level_id"), // Optional
  applicableGradeId: varchar("applicable_grade_id"), // Optional
  applicableLocationId: varchar("applicable_location_id"), // Optional
  sendOnMail: boolean("send_on_mail").default(false),
  questions: jsonb("questions").notNull(), // Array of question objects
  year: integer("year"),
  status: statusEnum("status").default('active'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdById: varchar("created_by_id"), // New field - nullable for existing records
}, (table) => [
  index("questionnaire_templates_created_by_id_idx").on(table.createdById),
]);

// Performance review cycles table
export const reviewCycles = pgTable("review_cycles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  questionnaireTemplateId: varchar("questionnaire_template_id").notNull(),
  status: statusEnum("status").default('active'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Employee evaluations table
export const evaluations = pgTable("evaluations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  managerId: varchar("manager_id").notNull(),
  reviewCycleId: varchar("review_cycle_id").notNull(),
  initiatedAppraisalId: varchar("initiated_appraisal_id"), // Direct link to initiated appraisal for accurate progress tracking
  selfEvaluationData: jsonb("self_evaluation_data"), // Employee responses
  selfEvaluationSubmittedAt: timestamp("self_evaluation_submitted_at"),
  managerEvaluationData: jsonb("manager_evaluation_data"), // Manager responses
  managerEvaluationSubmittedAt: timestamp("manager_evaluation_submitted_at"),
  overallRating: integer("overall_rating"),
  calibratedRating: integer("calibrated_rating"), // HR-adjusted rating
  calibrationRemarks: text("calibration_remarks"), // Optional remarks from HR for calibration
  calibratedBy: varchar("calibrated_by"), // User ID of HR manager who calibrated
  calibratedAt: timestamp("calibrated_at"), // When the calibration was done
  status: varchar("status").default('not_started'), // not_started, in_progress, completed, overdue
  meetingScheduledAt: timestamp("meeting_scheduled_at"),
  meetingNotes: text("meeting_notes"),
  showNotesToEmployee: boolean("show_notes_to_employee").default(false),
  meetingCompletedAt: timestamp("meeting_completed_at"),
  finalizedAt: timestamp("finalized_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Email templates table
export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  subject: varchar("subject").notNull(),
  body: text("body").notNull(),
  templateType: varchar("template_type").notNull(), // review_invitation, reminder, completion, etc.
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Email configuration table
export const emailConfig = pgTable("email_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  smtpHost: varchar("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull(),
  smtpUsername: varchar("smtp_username").notNull(),
  smtpPassword: varchar("smtp_password").notNull(),
  fromEmail: varchar("from_email").notNull(),
  fromName: varchar("from_name").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Registration table for SaaS onboarding
export const registrations = pgTable("registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  companyName: varchar("company_name").notNull(),
  designation: varchar("designation").notNull(),
  email: varchar("email").notNull(),
  mobile: varchar("mobile").notNull(),
  status: varchar("status").default('pending'), // pending, contacted, onboarded, rejected
  notificationSent: boolean("notification_sent").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Secure access tokens for email links
export const accessTokens = pgTable("access_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: varchar("token").notNull().unique(),
  userId: varchar("user_id").notNull(),
  evaluationId: varchar("evaluation_id").notNull(),
  tokenType: varchar("token_type").notNull(), // 'self_evaluation', 'manager_review'
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Calendar credentials table for storing OAuth tokens
export const calendarCredentials = pgTable("calendar_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  provider: calendarProviderEnum("provider").notNull(),
  clientId: varchar("client_id").notNull(),
  clientSecret: varchar("client_secret").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at"),
  scope: text("scope"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Only one active credential per provider per company
  unique("unique_company_provider_active").on(table.companyId, table.provider),
  index("calendar_credentials_company_provider_idx").on(table.companyId, table.provider),
]);

// Level table - Administrator managed
export const levels = pgTable("levels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").notNull(),
  description: text("description").notNull(),
  status: statusEnum("status").default('active'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdById: varchar("created_by_id").notNull(),
}, (table) => [
  unique().on(table.createdById, table.code),
  index("levels_created_by_id_idx").on(table.createdById),
]);

// Grade table - Administrator managed  
export const grades = pgTable("grades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").notNull(),
  description: text("description").notNull(),
  status: statusEnum("status").default('active'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdById: varchar("created_by_id").notNull(),
}, (table) => [
  unique().on(table.createdById, table.code),
  index("grades_created_by_id_idx").on(table.createdById),
]);

// Department table - Administrator managed
export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").notNull(),
  description: text("description").notNull(),
  status: statusEnum("status").default('active'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdById: varchar("created_by_id").notNull(),
}, (table) => [
  unique().on(table.createdById, table.code),
  index("departments_created_by_id_idx").on(table.createdById),
]);

// Appraisal Cycle table - Administrator managed
export const appraisalCycles = pgTable("appraisal_cycles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").notNull(),
  description: text("description").notNull(),
  fromDate: timestamp("from_date").notNull(),
  toDate: timestamp("to_date").notNull(),
  status: statusEnum("status").default('active'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdById: varchar("created_by_id").notNull(),
}, (table) => [
  unique().on(table.createdById, table.code),
  check("appraisal_cycles_date_check", sql`${table.fromDate} <= ${table.toDate}`),
  index("appraisal_cycles_created_by_id_idx").on(table.createdById),
]);

// Review Frequency table - Administrator managed
export const reviewFrequencies = pgTable("review_frequencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").notNull(),
  description: text("description").notNull(),
  status: statusEnum("status").default('active'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdById: varchar("created_by_id").notNull(),
}, (table) => [
  unique().on(table.createdById, table.code),
  index("review_frequencies_created_by_id_idx").on(table.createdById),
]);

// Frequency Calendar table - Administrator managed
export const frequencyCalendars = pgTable("frequency_calendars", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").notNull(),
  description: text("description").notNull(),
  appraisalCycleId: varchar("appraisal_cycle_id").notNull(),
  reviewFrequencyId: varchar("review_frequency_id").notNull(),
  status: statusEnum("status").default('active'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdById: varchar("created_by_id").notNull(),
}, (table) => [
  unique().on(table.createdById, table.code),
  index("frequency_calendars_created_by_id_idx").on(table.createdById),
]);

// Frequency Calendar Details table - Administrator managed
export const frequencyCalendarDetails = pgTable("frequency_calendar_details", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  frequencyCalendarId: varchar("frequency_calendar_id").notNull(),
  displayName: varchar("display_name").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: statusEnum("status").default('active'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdById: varchar("created_by_id").notNull(),
}, (table) => [
  check("frequency_calendar_details_date_check", sql`${table.startDate} <= ${table.endDate}`),
  index("frequency_calendar_details_created_by_id_idx").on(table.createdById),
]);

// Publish Questionnaire table - Administrator managed
export const publishQuestionnaires = pgTable("publish_questionnaires", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").notNull(),
  displayName: varchar("display_name").notNull(),
  templateId: varchar("template_id").notNull(),
  frequencyCalendarId: varchar("frequency_calendar_id"),
  status: statusEnum("status").default('active'),
  publishType: publishTypeEnum("publish_type").default('now'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdById: varchar("created_by_id").notNull(),
}, (table) => [
  unique().on(table.createdById, table.code),
  check("publish_questionnaires_calendar_check", sql`(${table.publishType} = 'now') OR (${table.publishType} = 'as_per_calendar' AND ${table.frequencyCalendarId} IS NOT NULL)`),
  index("publish_questionnaires_created_by_id_idx").on(table.createdById),
]);

// Initiated Appraisal table - HR Manager initiated appraisals
export const initiatedAppraisals = pgTable("initiated_appraisals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  appraisalGroupId: varchar("appraisal_group_id").notNull(),
  appraisalType: appraisalTypeEnum("appraisal_type").notNull(),
  questionnaireTemplateIds: text("questionnaire_template_ids").array().default(sql`ARRAY[]::text[]`), // For questionnaire_based
  documentUrl: varchar("document_url"), // For uploaded documents (MBO/KPI)
  frequencyCalendarId: varchar("frequency_calendar_id"),
  daysToInitiate: integer("days_to_initiate").default(0), // Days after calendar period end
  daysToClose: integer("days_to_close").default(30), // Days after calendar period end  
  numberOfReminders: integer("number_of_reminders").default(3), // 1-10 reminders
  excludeTenureLessThanYear: boolean("exclude_tenure_less_than_year").default(false),
  excludedEmployeeIds: text("excluded_employee_ids").array().default(sql`ARRAY[]::text[]`), // Specific excluded employees
  status: appraisalCycleStatusEnum("status").default('draft'),
  makePublic: boolean("make_public").default(false),
  publishType: publishTypeEnum("publish_type").default('now'),
  createdById: varchar("created_by_id").notNull(), // HR Manager who created
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("initiated_appraisals_group_id_idx").on(table.appraisalGroupId),
  index("initiated_appraisals_created_by_id_idx").on(table.createdById),
  check("initiated_appraisals_template_check", sql`(${table.appraisalType} NOT IN ('questionnaire_based', 'mbo_based')) OR (array_length(${table.questionnaireTemplateIds}, 1) > 0 OR ${table.documentUrl} IS NOT NULL)`),
]);

// Initiated Appraisal Detail Timings - Per frequency calendar detail timing configurations
export const initiatedAppraisalDetailTimings = pgTable("initiated_appraisal_detail_timings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  initiatedAppraisalId: varchar("initiated_appraisal_id").notNull(),
  frequencyCalendarDetailId: varchar("frequency_calendar_detail_id").notNull(),
  daysToInitiate: integer("days_to_initiate").notNull().default(0),
  daysToClose: integer("days_to_close").notNull().default(30),
  numberOfReminders: integer("number_of_reminders").notNull().default(3),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("initiated_appraisal_detail_timings_appraisal_id_idx").on(table.initiatedAppraisalId),
  index("initiated_appraisal_detail_timings_detail_id_idx").on(table.frequencyCalendarDetailId),
  unique().on(table.initiatedAppraisalId, table.frequencyCalendarDetailId), // One timing config per detail per appraisal
]);

// Scheduled Appraisal Tasks - For calendar-based publishing
export const scheduledAppraisalTasks = pgTable("scheduled_appraisal_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  initiatedAppraisalId: varchar("initiated_appraisal_id").notNull(),
  frequencyCalendarDetailId: varchar("frequency_calendar_detail_id").notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(), // When to create evaluations
  status: varchar("status").notNull().default('pending'), // pending, completed, failed
  executedAt: timestamp("executed_at"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("scheduled_appraisal_tasks_date_idx").on(table.scheduledDate),
  index("scheduled_appraisal_tasks_status_idx").on(table.status),
  index("scheduled_appraisal_tasks_appraisal_id_idx").on(table.initiatedAppraisalId),
]);

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  reportingManager: one(users, {
    fields: [users.reportingManagerId],
    references: [users.id],
    relationName: "reportingManager",
  }),
  directReports: many(users, {
    relationName: "reportingManager",
  }),
  createdBy: one(users, {
    fields: [users.createdById],
    references: [users.id],
    relationName: "createdByUser",
  }),
  createdUsers: many(users, {
    relationName: "createdByUser",
  }),
  location: one(locations, {
    fields: [users.locationId],
    references: [locations.id],
  }),
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  evaluationsAsEmployee: many(evaluations, {
    relationName: "employeeEvaluations",
  }),
  evaluationsAsManager: many(evaluations, {
    relationName: "managerEvaluations",
  }),
  level: one(levels, {
    fields: [users.levelId],
    references: [levels.id],
  }),
  grade: one(grades, {
    fields: [users.gradeId],
    references: [grades.id],
  }),
}));

export const locationsRelations = relations(locations, ({ many }) => ({
  users: many(users),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
}));

export const reviewCyclesRelations = relations(reviewCycles, ({ one, many }) => ({
  questionnaireTemplate: one(questionnaireTemplates, {
    fields: [reviewCycles.questionnaireTemplateId],
    references: [questionnaireTemplates.id],
  }),
  evaluations: many(evaluations),
}));

export const evaluationsRelations = relations(evaluations, ({ one }) => ({
  employee: one(users, {
    fields: [evaluations.employeeId],
    references: [users.id],
    relationName: "employeeEvaluations",
  }),
  manager: one(users, {
    fields: [evaluations.managerId],
    references: [users.id],
    relationName: "managerEvaluations",
  }),
  reviewCycle: one(reviewCycles, {
    fields: [evaluations.reviewCycleId],
    references: [reviewCycles.id],
  }),
  initiatedAppraisal: one(initiatedAppraisals, {
    fields: [evaluations.initiatedAppraisalId],
    references: [initiatedAppraisals.id],
  }),
}));

// Relations for new entities
export const levelsRelations = relations(levels, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [levels.createdById],
    references: [users.id],
  }),
  users: many(users),
  questionnaires: many(questionnaireTemplates),
}));

export const gradesRelations = relations(grades, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [grades.createdById],
    references: [users.id],
  }),
  users: many(users),
  questionnaires: many(questionnaireTemplates),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [departments.createdById],
    references: [users.id],
  }),
  users: many(users),
}));

export const appraisalCyclesRelations = relations(appraisalCycles, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [appraisalCycles.createdById],
    references: [users.id],
  }),
  frequencyCalendars: many(frequencyCalendars),
}));

export const reviewFrequenciesRelations = relations(reviewFrequencies, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [reviewFrequencies.createdById],
    references: [users.id],
  }),
  frequencyCalendars: many(frequencyCalendars),
}));

export const frequencyCalendarsRelations = relations(frequencyCalendars, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [frequencyCalendars.createdById],
    references: [users.id],
  }),
  appraisalCycle: one(appraisalCycles, {
    fields: [frequencyCalendars.appraisalCycleId],
    references: [appraisalCycles.id],
  }),
  reviewFrequency: one(reviewFrequencies, {
    fields: [frequencyCalendars.reviewFrequencyId],
    references: [reviewFrequencies.id],
  }),
  details: many(frequencyCalendarDetails),
  publishQuestionnaires: many(publishQuestionnaires),
}));

export const frequencyCalendarDetailsRelations = relations(frequencyCalendarDetails, ({ one }) => ({
  createdBy: one(users, {
    fields: [frequencyCalendarDetails.createdById],
    references: [users.id],
  }),
  frequencyCalendar: one(frequencyCalendars, {
    fields: [frequencyCalendarDetails.frequencyCalendarId],
    references: [frequencyCalendars.id],
  }),
}));

export const publishQuestionnairesRelations = relations(publishQuestionnaires, ({ one }) => ({
  createdBy: one(users, {
    fields: [publishQuestionnaires.createdById],
    references: [users.id],
  }),
  template: one(questionnaireTemplates, {
    fields: [publishQuestionnaires.templateId],
    references: [questionnaireTemplates.id],
  }),
  frequencyCalendar: one(frequencyCalendars, {
    fields: [publishQuestionnaires.frequencyCalendarId],
    references: [frequencyCalendars.id],
  }),
}));

export const questionnaireTemplatesRelations = relations(questionnaireTemplates, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [questionnaireTemplates.createdById],
    references: [users.id],
  }),
  applicableLevel: one(levels, {
    fields: [questionnaireTemplates.applicableLevelId],
    references: [levels.id],
  }),
  applicableGrade: one(grades, {
    fields: [questionnaireTemplates.applicableGradeId],
    references: [grades.id],
  }),
  applicableLocation: one(locations, {
    fields: [questionnaireTemplates.applicableLocationId],
    references: [locations.id],
  }),
  publishQuestionnaires: many(publishQuestionnaires),
  reviewCycles: many(reviewCycles),
}));

export const initiatedAppraisalsRelations = relations(initiatedAppraisals, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [initiatedAppraisals.createdById],
    references: [users.id],
  }),
  evaluations: many(evaluations),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  passwordHash: true,
  createdById: true,
}).extend({
  roles: z.array(z.enum(['super_admin', 'admin', 'hr_manager', 'employee', 'manager'])).optional().default(['employee']),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (data.password || data.confirmPassword) {
    return data.password === data.confirmPassword;
  }
  return true;
}, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLocationSchema = createInsertSchema(locations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuestionnaireTemplateSchema = createInsertSchema(questionnaireTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReviewCycleSchema = createInsertSchema(reviewCycles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEvaluationSchema = createInsertSchema(evaluations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailConfigSchema = createInsertSchema(emailConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRegistrationSchema = createInsertSchema(registrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  notificationSent: true,
  status: true,
});

export const insertAccessTokenSchema = createInsertSchema(accessTokens).omit({
  id: true,
  createdAt: true,
});

export const insertCalendarCredentialSchema = createInsertSchema(calendarCredentials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Insert schemas for new entities
export const insertLevelSchema = createInsertSchema(levels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
});

export const insertGradeSchema = createInsertSchema(grades).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
});

export const insertAppraisalCycleSchema = createInsertSchema(appraisalCycles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
}).extend({
  fromDate: z.preprocess((val) => new Date(val as string), z.date()),
  toDate: z.preprocess((val) => new Date(val as string), z.date()),
});

export const insertReviewFrequencySchema = createInsertSchema(reviewFrequencies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
});

export const insertFrequencyCalendarSchema = createInsertSchema(frequencyCalendars).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
});

export const insertFrequencyCalendarDetailsSchema = createInsertSchema(frequencyCalendarDetails).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
}).extend({
  startDate: z.preprocess((val) => new Date(val as string), z.date()),
  endDate: z.preprocess((val) => new Date(val as string), z.date()),
});

export const insertPublishQuestionnaireSchema = createInsertSchema(publishQuestionnaires).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
});

// Secure update schemas to prevent security vulnerabilities
export const updateUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  passwordHash: true,
  createdById: true,
}).extend({
  roles: z.array(z.enum(['super_admin', 'admin', 'hr_manager', 'employee', 'manager'])).optional(),
}).partial().strict();

// Dedicated schema for password updates only
export const passwordUpdateSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).strict().refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// Schema for role updates with authorization validation
export const roleUpdateSchema = z.object({
  role: z.enum(['super_admin', 'admin', 'hr_manager', 'employee', 'manager']).optional(),
  roles: z.array(z.enum(['super_admin', 'admin', 'hr_manager', 'employee', 'manager'])).optional()
}).strict();

// Send Reminder Request Schema
export const sendReminderRequestSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  initiatedAppraisalId: z.string().min(1, "Initiated Appraisal ID is required"),
}).strict();

// Upsert user schema for Replit Auth
export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

// Types
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type SafeUser = Omit<User, 'passwordHash'>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Location = typeof locations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type QuestionnaireTemplate = typeof questionnaireTemplates.$inferSelect;
export type InsertQuestionnaireTemplate = z.infer<typeof insertQuestionnaireTemplateSchema>;
export type ReviewCycle = typeof reviewCycles.$inferSelect;
export type InsertReviewCycle = z.infer<typeof insertReviewCycleSchema>;
export type Evaluation = typeof evaluations.$inferSelect;
export type InsertEvaluation = z.infer<typeof insertEvaluationSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailConfig = typeof emailConfig.$inferSelect;
export type InsertEmailConfig = z.infer<typeof insertEmailConfigSchema>;
export type Registration = typeof registrations.$inferSelect;
export type InsertRegistration = z.infer<typeof insertRegistrationSchema>;
export type AccessToken = typeof accessTokens.$inferSelect;
export type InsertAccessToken = z.infer<typeof insertAccessTokenSchema>;
export type CalendarCredential = typeof calendarCredentials.$inferSelect;
export type InsertCalendarCredential = z.infer<typeof insertCalendarCredentialSchema>;

// Types for new entities
export type Level = typeof levels.$inferSelect;
export type InsertLevel = z.infer<typeof insertLevelSchema>;
export type Grade = typeof grades.$inferSelect;
export type InsertGrade = z.infer<typeof insertGradeSchema>;
export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type AppraisalCycle = typeof appraisalCycles.$inferSelect;
export type InsertAppraisalCycle = z.infer<typeof insertAppraisalCycleSchema>;
export type ReviewFrequency = typeof reviewFrequencies.$inferSelect;
export type InsertReviewFrequency = z.infer<typeof insertReviewFrequencySchema>;
export type FrequencyCalendar = typeof frequencyCalendars.$inferSelect;
export type InsertFrequencyCalendar = z.infer<typeof insertFrequencyCalendarSchema>;
export type FrequencyCalendarDetails = typeof frequencyCalendarDetails.$inferSelect;
export type InsertFrequencyCalendarDetails = z.infer<typeof insertFrequencyCalendarDetailsSchema>;
export type PublishQuestionnaire = typeof publishQuestionnaires.$inferSelect;
export type InsertPublishQuestionnaire = z.infer<typeof insertPublishQuestionnaireSchema>;

// Appraisal Groups table
export const appraisalGroups = pgTable("appraisal_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  createdById: varchar("created_by_id").notNull(), // HR Manager who created the group
  companyId: varchar("company_id"), // For multi-tenant isolation
  status: statusEnum("status").default('active'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("appraisal_groups_created_by_id_idx").on(table.createdById),
  index("appraisal_groups_company_id_idx").on(table.companyId),
]);

// Appraisal Group Members table (many-to-many relationship)
export const appraisalGroupMembers = pgTable("appraisal_group_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  appraisalGroupId: varchar("appraisal_group_id").notNull(),
  userId: varchar("user_id").notNull(),
  addedById: varchar("added_by_id").notNull(), // HR Manager who added this member
  addedAt: timestamp("added_at").defaultNow(),
}, (table) => [
  index("appraisal_group_members_group_id_idx").on(table.appraisalGroupId),
  index("appraisal_group_members_user_id_idx").on(table.userId),
  unique("appraisal_group_members_unique").on(table.appraisalGroupId, table.userId), // Prevent duplicate members
]);

// Insert schemas
export const insertAppraisalGroupSchema = createInsertSchema(appraisalGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAppraisalGroupMemberSchema = createInsertSchema(appraisalGroupMembers).omit({
  id: true,
  addedAt: true,
});

export const insertInitiatedAppraisalSchema = createInsertSchema(initiatedAppraisals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInitiatedAppraisalDetailTimingSchema = createInsertSchema(initiatedAppraisalDetailTimings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScheduledAppraisalTaskSchema = createInsertSchema(scheduledAppraisalTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Export types
export type AppraisalGroup = typeof appraisalGroups.$inferSelect;
export type InsertAppraisalGroup = z.infer<typeof insertAppraisalGroupSchema>;
export type AppraisalGroupMember = typeof appraisalGroupMembers.$inferSelect;
export type InsertAppraisalGroupMember = z.infer<typeof insertAppraisalGroupMemberSchema>;
export type InitiatedAppraisal = typeof initiatedAppraisals.$inferSelect;
export type InsertInitiatedAppraisal = z.infer<typeof insertInitiatedAppraisalSchema>;
export type InitiatedAppraisalDetailTiming = typeof initiatedAppraisalDetailTimings.$inferSelect;
export type InsertInitiatedAppraisalDetailTiming = z.infer<typeof insertInitiatedAppraisalDetailTimingSchema>;
export type ScheduledAppraisalTask = typeof scheduledAppraisalTasks.$inferSelect;
export type InsertScheduledAppraisalTask = z.infer<typeof insertScheduledAppraisalTaskSchema>;

// Goal status enum
export const goalStatusEnum = pgEnum('goal_status', ['on_track', 'delayed', 'completed', 'not_started']);

// Development Goals table - Employee development goals linked to evaluations
export const developmentGoals = pgTable("development_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  evaluationId: varchar("evaluation_id").notNull(),
  employeeId: varchar("employee_id").notNull(),
  description: text("description").notNull(),
  plannedOutcome: text("planned_outcome").notNull(),
  targetDate: timestamp("target_date").notNull(),
  progress: integer("progress").default(0), // 0-100 percentage
  status: goalStatusEnum("status").default('not_started'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("development_goals_evaluation_id_idx").on(table.evaluationId),
  index("development_goals_employee_id_idx").on(table.employeeId),
]);

// Development Goals Relations
export const developmentGoalsRelations = relations(developmentGoals, ({ one }) => ({
  evaluation: one(evaluations, {
    fields: [developmentGoals.evaluationId],
    references: [evaluations.id],
  }),
  employee: one(users, {
    fields: [developmentGoals.employeeId],
    references: [users.id],
  }),
}));

// Insert schema for development goals
export const insertDevelopmentGoalSchema = createInsertSchema(developmentGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
}).extend({
  targetDate: z.preprocess((val) => new Date(val as string), z.date()),
  progress: z.number().min(0).max(100).optional().default(0),
});

// Update schema for development goals
export const updateDevelopmentGoalSchema = z.object({
  description: z.string().min(1).optional(),
  plannedOutcome: z.string().min(1).optional(),
  targetDate: z.preprocess((val) => val ? new Date(val as string) : undefined, z.date().optional()),
  progress: z.number().min(0).max(100).optional(),
}).strict();

// Export types
export type DevelopmentGoal = typeof developmentGoals.$inferSelect;
export type InsertDevelopmentGoal = z.infer<typeof insertDevelopmentGoalSchema>;
export type UpdateDevelopmentGoal = z.infer<typeof updateDevelopmentGoalSchema>;
