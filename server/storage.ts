import {
  users,
  companies,
  locations,
  questionnaireTemplates,
  reviewCycles,
  evaluations,
  emailTemplates,
  emailConfig,
  registrations,
  accessTokens,
  calendarCredentials,
  levels,
  grades,
  departments,
  appraisalCycles,
  reviewFrequencies,
  frequencyCalendars,
  frequencyCalendarDetails,
  publishQuestionnaires,
  appraisalGroups,
  appraisalGroupMembers,
  initiatedAppraisals,
  initiatedAppraisalDetailTimings,
  scheduledAppraisalTasks,
  developmentGoals,
  type User,
  type SafeUser,
  type UpsertUser,
  type InsertUser,
  type Company,
  type InsertCompany,
  type Location,
  type InsertLocation,
  type QuestionnaireTemplate,
  type InsertQuestionnaireTemplate,
  type ReviewCycle,
  type InsertReviewCycle,
  type Evaluation,
  type InsertEvaluation,
  type EmailTemplate,
  type InsertEmailTemplate,
  type EmailConfig,
  type InsertEmailConfig,
  type Registration,
  type InsertRegistration,
  type AccessToken,
  type InsertAccessToken,
  type CalendarCredential,
  type InsertCalendarCredential,
  type Level,
  type InsertLevel,
  type Grade,
  type InsertGrade,
  type Department,
  type InsertDepartment,
  type AppraisalCycle,
  type InsertAppraisalCycle,
  type ReviewFrequency,
  type InsertReviewFrequency,
  type FrequencyCalendar,
  type InsertFrequencyCalendar,
  type FrequencyCalendarDetails,
  type InsertFrequencyCalendarDetails,
  type PublishQuestionnaire,
  type InsertPublishQuestionnaire,
  type AppraisalGroup,
  type InsertAppraisalGroup,
  type AppraisalGroupMember,
  type InsertAppraisalGroupMember,
  type InitiatedAppraisal,
  type InsertInitiatedAppraisal,
  type InitiatedAppraisalDetailTiming,
  type InsertInitiatedAppraisalDetailTiming,
  type ScheduledAppraisalTask,
  type InsertScheduledAppraisalTask,
  type DevelopmentGoal,
  type InsertDevelopmentGoal,
  type UpdateDevelopmentGoal,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, like, inArray, or, sql, isNotNull } from "drizzle-orm";
import bcrypt from "bcrypt";

// Helper function to sanitize user objects by removing passwordHash
function sanitizeUser(user: User): SafeUser {
  const { passwordHash, ...sanitized } = user;
  return sanitized;
}

// Helper function to sanitize array of users
function sanitizeUsers(users: User[]): SafeUser[] {
  return users.map(sanitizeUser);
}

export interface IStorage {
  // User operations - mandatory for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Company operations
  getCompanies(): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  getCompanyByUrl(companyUrl: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, company: Partial<InsertCompany>): Promise<Company>;
  deleteCompany(id: string): Promise<void>;
  
  // Location operations
  getLocations(): Promise<Location[]>;
  getLocation(id: string): Promise<Location | undefined>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(id: string, location: Partial<InsertLocation>): Promise<Location>;
  deleteLocation(id: string): Promise<void>;
  
  // User management operations
  getUsers(filters?: { role?: string; department?: string; status?: string; companyId?: string }, requestingUserId?: string): Promise<SafeUser[]>;
  getUserByEmail(email: string): Promise<User | undefined>; // Keep as User for internal auth
  createUser(user: InsertUser, creatorId?: string): Promise<SafeUser>;
  updateUser(id: string, user: Partial<InsertUser>, requestingUserId?: string): Promise<SafeUser>;
  deleteUser(id: string, requestingUserId?: string): Promise<void>;
  getUsersByManager(managerId: string): Promise<SafeUser[]>;
  
  // Questionnaire template operations
  getQuestionnaireTemplates(requestingUserId?: string): Promise<QuestionnaireTemplate[]>;
  getQuestionnaireTemplate(id: string, requestingUserId?: string): Promise<QuestionnaireTemplate | undefined>;
  createQuestionnaireTemplate(template: InsertQuestionnaireTemplate): Promise<QuestionnaireTemplate>;
  updateQuestionnaireTemplate(id: string, template: Partial<InsertQuestionnaireTemplate>, requestingUserId?: string): Promise<QuestionnaireTemplate>;
  deleteQuestionnaireTemplate(id: string, requestingUserId?: string): Promise<void>;
  getQuestionnaireTemplatesByYear(year: number): Promise<QuestionnaireTemplate[]>;
  
  // Review cycle operations
  getReviewCycles(): Promise<ReviewCycle[]>;
  getReviewCycle(id: string): Promise<ReviewCycle | undefined>;
  createReviewCycle(cycle: InsertReviewCycle): Promise<ReviewCycle>;
  updateReviewCycle(id: string, cycle: Partial<InsertReviewCycle>): Promise<ReviewCycle>;
  deleteReviewCycle(id: string): Promise<void>;
  getActiveReviewCycles(): Promise<ReviewCycle[]>;
  
  // Evaluation operations
  getEvaluations(filters?: { employeeId?: string; managerId?: string; reviewCycleId?: string; status?: string }): Promise<Evaluation[]>;
  getEvaluation(id: string): Promise<Evaluation | undefined>;
  createEvaluation(evaluation: InsertEvaluation): Promise<Evaluation>;
  updateEvaluation(id: string, evaluation: Partial<InsertEvaluation>): Promise<Evaluation>;
  deleteEvaluation(id: string): Promise<void>;
  getEvaluationByEmployeeAndCycle(employeeId: string, reviewCycleId: string): Promise<Evaluation | undefined>;
  getEvaluationsByInitiatedAppraisal(initiatedAppraisalId: string): Promise<Evaluation[]>;
  getScheduledMeetingsForCompany(companyId: string): Promise<any[]>;
  getEvaluationsForCalibration(companyId: string): Promise<any[]>;
  getEvaluationById(id: string): Promise<Evaluation | undefined>;
  updateEvaluationCalibration(id: string, calibration: { calibratedRating: number | null; calibrationRemarks: string; calibratedBy: string; calibratedAt: Date }): Promise<Evaluation>;
  
  // Email operations
  getEmailTemplates(): Promise<EmailTemplate[]>;
  getEmailTemplate(id: string): Promise<EmailTemplate | undefined>;
  createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(id: string, template: Partial<InsertEmailTemplate>): Promise<EmailTemplate>;
  deleteEmailTemplate(id: string): Promise<void>;
  
  getEmailConfig(): Promise<EmailConfig | undefined>;
  createEmailConfig(config: InsertEmailConfig): Promise<EmailConfig>;
  updateEmailConfig(id: string, config: Partial<InsertEmailConfig>): Promise<EmailConfig>;
  
  // Registration operations - SaaS onboarding
  getRegistrations(): Promise<Registration[]>;
  getRegistration(id: string): Promise<Registration | undefined>;
  createRegistration(registration: InsertRegistration): Promise<Registration>;
  updateRegistration(id: string, registration: Partial<Registration>): Promise<Registration>;
  
  // Settings operations
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
  
  // Access token operations
  createAccessToken(token: InsertAccessToken): Promise<AccessToken>;
  getAccessToken(token: string): Promise<AccessToken | undefined>;
  markTokenAsUsed(token: string): Promise<void>;
  deactivateToken(token: string): Promise<void>;
  getActiveTokensByUser(userId: string): Promise<AccessToken[]>;
  
  // Calendar Credential operations
  getCalendarCredential(companyId: string, provider: 'google' | 'outlook'): Promise<CalendarCredential | undefined>;
  createCalendarCredential(credential: InsertCalendarCredential): Promise<CalendarCredential>;
  updateCalendarCredential(id: string, credential: Partial<InsertCalendarCredential>): Promise<CalendarCredential>;
  updateCalendarCredentialTokens(companyId: string, provider: 'google' | 'outlook', accessToken: string, refreshToken?: string, expiresAt?: Date): Promise<void>;
  deleteCalendarCredential(id: string): Promise<void>;
  
  // Level operations - Administrator isolated
  getLevels(createdById: string): Promise<Level[]>;
  getLevel(id: string, createdById: string): Promise<Level | undefined>;
  createLevel(level: InsertLevel, createdById: string): Promise<Level>;
  updateLevel(id: string, level: Partial<InsertLevel>, createdById: string): Promise<Level>;
  deleteLevel(id: string, createdById: string): Promise<void>;
  
  // Grade operations - Administrator isolated
  getGrades(createdById: string): Promise<Grade[]>;
  getGrade(id: string, createdById: string): Promise<Grade | undefined>;
  createGrade(grade: InsertGrade, createdById: string): Promise<Grade>;
  updateGrade(id: string, grade: Partial<InsertGrade>, createdById: string): Promise<Grade>;
  deleteGrade(id: string, createdById: string): Promise<void>;
  
  // Appraisal Cycle operations - Administrator isolated
  getAppraisalCycles(createdById: string): Promise<AppraisalCycle[]>;
  getAllAppraisalCycles(companyId: string): Promise<AppraisalCycle[]>; // For HR managers to see all cycles in their company
  getAppraisalCycle(id: string, createdById: string): Promise<AppraisalCycle | undefined>;
  getAppraisalCycleById(id: string): Promise<AppraisalCycle | undefined>; // For lookups without ownership check
  createAppraisalCycle(cycle: InsertAppraisalCycle, createdById: string): Promise<AppraisalCycle>;
  updateAppraisalCycle(id: string, cycle: Partial<InsertAppraisalCycle>, createdById: string): Promise<AppraisalCycle>;
  deleteAppraisalCycle(id: string, createdById: string): Promise<void>;
  
  // Review Frequency operations - Administrator isolated
  getReviewFrequencies(createdById: string): Promise<ReviewFrequency[]>;
  getReviewFrequency(id: string, createdById: string): Promise<ReviewFrequency | undefined>;
  createReviewFrequency(frequency: InsertReviewFrequency, createdById: string): Promise<ReviewFrequency>;
  updateReviewFrequency(id: string, frequency: Partial<InsertReviewFrequency>, createdById: string): Promise<ReviewFrequency>;
  deleteReviewFrequency(id: string, createdById: string): Promise<void>;
  
  // Frequency Calendar operations - Administrator isolated
  getFrequencyCalendars(createdById: string): Promise<FrequencyCalendar[]>;
  getAllFrequencyCalendars(): Promise<FrequencyCalendar[]>; // For HR managers to see all calendars
  getFrequencyCalendar(id: string, createdById: string): Promise<FrequencyCalendar | undefined>;
  getFrequencyCalendarById(id: string): Promise<FrequencyCalendar | undefined>; // For lookups without ownership check
  createFrequencyCalendar(calendar: InsertFrequencyCalendar, createdById: string): Promise<FrequencyCalendar>;
  updateFrequencyCalendar(id: string, calendar: Partial<InsertFrequencyCalendar>, createdById: string): Promise<FrequencyCalendar>;
  deleteFrequencyCalendar(id: string, createdById: string): Promise<void>;
  
  // Frequency Calendar Details operations - Administrator isolated through parent calendar
  getFrequencyCalendarDetails(createdById: string): Promise<FrequencyCalendarDetails[]>;
  getAllFrequencyCalendarDetails(companyId: string): Promise<FrequencyCalendarDetails[]>; // For HR managers to see all details in their company
  getFrequencyCalendarDetailsByCalendarId(calendarId: string): Promise<FrequencyCalendarDetails[]>; // For showing details of a specific calendar
  getFrequencyCalendarDetail(id: string, createdById: string): Promise<FrequencyCalendarDetails | undefined>;
  createFrequencyCalendarDetails(details: InsertFrequencyCalendarDetails, createdById: string): Promise<FrequencyCalendarDetails>;
  updateFrequencyCalendarDetails(id: string, details: Partial<InsertFrequencyCalendarDetails>, createdById: string): Promise<FrequencyCalendarDetails>;
  deleteFrequencyCalendarDetails(id: string, createdById: string): Promise<void>;

  // Publish Questionnaire operations - Administrator isolated
  getPublishQuestionnaires(createdById: string): Promise<PublishQuestionnaire[]>;
  getPublishQuestionnaire(id: string, createdById: string): Promise<PublishQuestionnaire | undefined>;
  createPublishQuestionnaire(questionnaire: InsertPublishQuestionnaire, createdById: string): Promise<PublishQuestionnaire>;
  updatePublishQuestionnaire(id: string, questionnaire: Partial<InsertPublishQuestionnaire>, createdById: string): Promise<PublishQuestionnaire>;
  deletePublishQuestionnaire(id: string, createdById: string): Promise<void>;
  
  // Appraisal Group operations - HR Manager isolated
  getAppraisalGroups(createdById: string): Promise<AppraisalGroup[]>;
  getAppraisalGroup(id: string, createdById: string): Promise<AppraisalGroup | undefined>;
  createAppraisalGroup(group: InsertAppraisalGroup, createdById: string): Promise<AppraisalGroup>;
  updateAppraisalGroup(id: string, group: Partial<InsertAppraisalGroup>, createdById: string): Promise<AppraisalGroup>;
  deleteAppraisalGroup(id: string, createdById: string): Promise<void>;
  
  // Appraisal Group Member operations 
  getAppraisalGroupMembers(groupId: string, createdById: string): Promise<(AppraisalGroupMember & { user: SafeUser | null })[]>;
  addAppraisalGroupMember(member: InsertAppraisalGroupMember, createdById: string): Promise<AppraisalGroupMember>;
  removeAppraisalGroupMember(groupId: string, userId: string, createdById: string): Promise<void>;
  getAppraisalGroupsWithMembers(createdById: string): Promise<(AppraisalGroup & { members: SafeUser[] })[]>;
  
  // Initiated Appraisal operations - HR Manager isolated
  createInitiatedAppraisal(appraisal: any, createdById: string): Promise<InitiatedAppraisal>;
  updateInitiatedAppraisalStatus(id: string, status: string): Promise<void>;
  createInitiatedAppraisalDetailTiming(timing: InsertInitiatedAppraisalDetailTiming): Promise<InitiatedAppraisalDetailTiming>;
  getInitiatedAppraisalDetailTimings(appraisalId: string): Promise<InitiatedAppraisalDetailTiming[]>;
  getInitiatedAppraisal(id: string): Promise<InitiatedAppraisal | null>;
  getInitiatedAppraisals(createdById: string): Promise<InitiatedAppraisal[]>;
  
  // Scheduled Appraisal Task operations
  createScheduledAppraisalTask(task: InsertScheduledAppraisalTask): Promise<ScheduledAppraisalTask>;
  getPendingScheduledTasks(): Promise<ScheduledAppraisalTask[]>;
  updateScheduledTaskStatus(id: string, status: string, error?: string): Promise<void>;
  getScheduledTasksByAppraisal(appraisalId: string): Promise<ScheduledAppraisalTask[]>;
  
  // Development Goal operations
  getDevelopmentGoals(employeeId: string): Promise<DevelopmentGoal[]>;
  getDevelopmentGoalsByEvaluation(evaluationId: string): Promise<DevelopmentGoal[]>;
  getDevelopmentGoal(id: string): Promise<DevelopmentGoal | undefined>;
  createDevelopmentGoal(goal: InsertDevelopmentGoal): Promise<DevelopmentGoal>;
  updateDevelopmentGoal(id: string, goal: UpdateDevelopmentGoal): Promise<DevelopmentGoal>;
  deleteDevelopmentGoal(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations - mandatory for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // UpsertUser only contains basic auth fields from Replit Auth
    // For NEW users: Set default role and roles to 'employee'
    // For EXISTING users: Only update auth fields, NEVER update role/roles to preserve existing permissions
    const normalizedData: any = { 
      ...userData,
      role: (userData as any).role || 'employee' as any,
      roles: (userData as any).roles || [(userData as any).role || 'employee']
    };
    
    // Build update data - ONLY update profile fields from auth, NEVER role/roles for existing users
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    // Only update these safe profile fields from Replit auth
    if (userData.email) updateData.email = userData.email;
    if (userData.firstName) updateData.firstName = userData.firstName;
    if (userData.lastName) updateData.lastName = userData.lastName;
    if (userData.profileImageUrl) updateData.profileImageUrl = userData.profileImageUrl;
    
    // CRITICAL: Never update role/roles for existing users from Replit auth
    // This preserves manually assigned roles like super_admin
    // Role/roles are only set during INSERT for new users, never during UPDATE
    
    const [user] = await db
      .insert(users)
      .values(normalizedData)
      .onConflictDoUpdate({
        target: users.id,
        set: updateData,
      })
      .returning();
    
    return user;
  }

  // Company operations
  async getCompanies(): Promise<Company[]> {
    return await db.select().from(companies).orderBy(asc(companies.name));
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async getCompanyByUrl(companyUrl: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.companyUrl, companyUrl));
    return company;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [newCompany] = await db.insert(companies).values(company).returning();
    return newCompany;
  }

  async updateCompany(id: string, company: Partial<InsertCompany>): Promise<Company> {
    const [updatedCompany] = await db
      .update(companies)
      .set({ ...company, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return updatedCompany;
  }

  async deleteCompany(id: string): Promise<void> {
    await db.delete(companies).where(eq(companies.id, id));
  }

  // Location operations
  async getLocations(): Promise<Location[]> {
    return await db.select().from(locations).orderBy(asc(locations.name));
  }

  async getLocation(id: string): Promise<Location | undefined> {
    const [location] = await db.select().from(locations).where(eq(locations.id, id));
    return location;
  }

  async createLocation(location: InsertLocation): Promise<Location> {
    const [newLocation] = await db.insert(locations).values(location).returning();
    return newLocation;
  }

  async updateLocation(id: string, location: Partial<InsertLocation>): Promise<Location> {
    const [updatedLocation] = await db
      .update(locations)
      .set({ ...location, updatedAt: new Date() })
      .where(eq(locations.id, id))
      .returning();
    return updatedLocation;
  }

  async deleteLocation(id: string): Promise<void> {
    await db.delete(locations).where(eq(locations.id, id));
  }

  // User management operations
  async getUsers(filters?: { role?: string; department?: string; status?: string; companyId?: string }, requestingUserId?: string): Promise<SafeUser[]> {
    const conditions = [];
    
    // SECURITY: Company isolation for Administrators and HR Managers
    if (requestingUserId) {
      const requestingUser = await this.getUser(requestingUserId);
      
      console.log('===== getUsers DEBUG =====');
      console.log('Requesting user ID:', requestingUserId);
      console.log('Requesting user role:', requestingUser?.role);
      console.log('Requesting user companyId:', requestingUser?.companyId);
      console.log('Filters:', filters);
      
      if (requestingUser && (requestingUser.role === 'admin' || requestingUser.role === 'hr_manager')) {
        if (!requestingUser.companyId) {
          // Admin/HR Manager without company cannot view any users
          console.log('No company - returning empty array');
          return [];
        }
        // Force company filter for administrators and HR managers
        conditions.push(eq(users.companyId, requestingUser.companyId));
        // Also exclude users with NULL company_id
        conditions.push(sql`${users.companyId} IS NOT NULL`);
        
        console.log('Added company filter for:', requestingUser.companyId);
        
        // SECURITY: HR Managers cannot see Super Admin and Admin roles
        if (requestingUser.role === 'hr_manager') {
          // Exclude users with super_admin or admin as primary role
          conditions.push(sql`${users.role} NOT IN ('super_admin', 'admin')`);
          // Exclude users with super_admin or admin in their roles array (handle NULL case)
          conditions.push(sql`(${users.roles} IS NULL OR NOT (${users.roles} && ARRAY['super_admin', 'admin']::text[]))`);
          console.log('Added HR Manager role exclusion filters');
        }
      }
      console.log('Total conditions:', conditions.length);
      console.log('==========================');
      // Super admins and other roles can see all users (no automatic filter)
      // But they can still use explicit companyId filter if provided
    }
    
    // SECURITY: Explicit company filter (for super admins and other roles)
    if (filters?.companyId && !conditions.find(c => c?.toString().includes('companyId'))) {
      conditions.push(eq(users.companyId, filters.companyId));
    }
    
    if (filters?.role) {
      // Support filtering by both single role and roles array
      conditions.push(
        or(
          eq(users.role, filters.role as any),
          sql`${users.roles} @> ARRAY[${filters.role}]::text[]`
        )
      );
    }
    if (filters?.status) {
      conditions.push(eq(users.status, filters.status as any));
    }
    if (filters?.department) {
      conditions.push(eq(users.department, filters.department));
    }
    
    if (conditions.length > 0) {
      const filteredUsers = await db.select().from(users).where(and(...conditions)).orderBy(asc(users.firstName));
      console.log('Filtered users count:', filteredUsers.length);
      if (filteredUsers.length > 0) {
        console.log('Sample user roles:', filteredUsers.slice(0, 3).map(u => ({ email: u.email, role: u.role, roles: (u as any).roles })));
      }
      return sanitizeUsers(filteredUsers);
    }
    
    const userList = await db.select().from(users).orderBy(asc(users.firstName));
    console.log('Unfiltered users count:', userList.length);
    return sanitizeUsers(userList);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByCode(code: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.code, code));
    return user;
  }

  async getUserByMobile(mobileNumber: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.mobileNumber, mobileNumber));
    return user;
  }

  async createUser(user: InsertUser, creatorId?: string): Promise<SafeUser> {
    // Handle empty codes by converting to null to avoid unique constraint violations
    const userData: any = {
      ...user,
      code: user.code && user.code.trim() !== '' ? user.code : null,
    };
    
    // SECURITY: Set createdById and enforce company mapping for administrators
    if (creatorId) {
      const creator = await this.getUser(creatorId);
      if (creator) {
        userData.createdById = creatorId;
        
        // SECURITY: If creator is admin, enforce their company mapping and role restrictions
        if (creator.role === 'admin') {
          if (creator.companyId) {
            userData.companyId = creator.companyId;
          }
          
          // SECURITY: Admins can only assign employee, manager, hr_manager roles - never admin or super_admin
          const allowedRoles = ['employee', 'manager', 'hr_manager'];
          if (userData.role && !allowedRoles.includes(userData.role)) {
            userData.role = 'employee'; // Force to employee if trying to assign restricted role
          }
          if (userData.roles && Array.isArray(userData.roles)) {
            userData.roles = userData.roles.filter((role: string) => allowedRoles.includes(role));
            if (userData.roles.length === 0) {
              userData.roles = ['employee']; // Ensure at least one role
            }
            userData.role = userData.roles[0] as any; // Set primary role to first allowed role
          }
        }
      }
    }
    
    // Handle password hashing
    if (user.password) {
      const saltRounds = 12;
      userData.passwordHash = await bcrypt.hash(user.password, saltRounds);
    }
    
    // Remove password fields from userData as they don't exist in the database
    delete userData.password;
    delete userData.confirmPassword;
    
    // Normalize role and roles fields for consistency
    if (userData.roles && userData.roles.length > 0) {
      // Deduplicate roles and ensure at least one role
      userData.roles = Array.from(new Set(userData.roles));
      userData.role = userData.roles[0] as any; // Set single role to first role
    } else if (userData.role) {
      // If only single role provided, create roles array
      userData.roles = [userData.role];
    } else {
      // Default fallback
      userData.role = 'employee' as any;
      userData.roles = ['employee'];
    }
    
    const [newUser] = await db.insert(users).values(userData).returning();
    return sanitizeUser(newUser);
  }

  async updateUser(id: string, user: Partial<InsertUser>, requestingUserId?: string): Promise<SafeUser> {
    // SECURITY: Administrator isolation - only update users they created
    if (requestingUserId) {
      const requestingUser = await this.getUser(requestingUserId);
      if (requestingUser && requestingUser.role === 'admin') {
        // Check if the admin created this user
        const targetUser = await this.getUser(id);
        if (!targetUser || targetUser.createdById !== requestingUserId) {
          throw new Error('Forbidden: You can only update users you created');
        }
      }
    }
    
    // SECURITY: Explicitly strip dangerous fields that should never be directly updated
    const {
      passwordHash,
      password,
      confirmPassword,
      ...sanitizedInput
    } = user as any;
    
    // Handle empty codes by converting to null to avoid unique constraint violations
    const userData: any = {
      ...sanitizedInput,
      code: sanitizedInput.code !== undefined ? (sanitizedInput.code && sanitizedInput.code.trim() !== '' ? sanitizedInput.code : null) : undefined,
      updatedAt: new Date(),
    };
    
    // SECURITY: Only set passwordHash when password is explicitly provided
    if (password && typeof password === 'string' && password.length > 0) {
      const saltRounds = 12;
      userData.passwordHash = await bcrypt.hash(password, saltRounds);
    }
    
    // Get current user data to check if role is actually changing
    const currentUser = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!currentUser || currentUser.length === 0) {
      throw new Error('User not found');
    }
    const existingUser = currentUser[0];
    
    // SECURITY: Enhanced role escalation protection - only validate when role is actually changing
    const isRoleChanging = (userData.role !== undefined && userData.role !== existingUser.role) ||
                          (userData.roles !== undefined && JSON.stringify(userData.roles) !== JSON.stringify(existingUser.roles));
    
    if (isRoleChanging) {
      // CRITICAL: requestingUserId is REQUIRED for any role changes
      if (!requestingUserId) {
        throw new Error('Unauthorized: Role changes require authenticated request');
      }
      
      const requestingUser = await this.getUser(requestingUserId);
      if (!requestingUser) {
        throw new Error('Requesting user not found');
      }
      
      // SECURITY: Admin role restrictions - admins can only assign specific roles
      if (requestingUser.role === 'admin') {
        const allowedRoles = ['employee', 'manager', 'hr_manager'];
        
        // Check direct role assignment
        if (userData.role && !allowedRoles.includes(userData.role)) {
          throw new Error('Insufficient privileges: Administrators can only assign employee, manager, or hr_manager roles');
        }
        
        // Check roles array for restricted roles
        if (userData.roles && Array.isArray(userData.roles)) {
          const hasRestrictedRole = userData.roles.some((role: string) => !allowedRoles.includes(role));
          if (hasRestrictedRole) {
            throw new Error('Insufficient privileges: Administrators can only assign employee, manager, or hr_manager roles');
          }
        }
      }
      
      // CRITICAL: Only super_admin can assign super_admin role to anyone
      if (requestingUser.role !== 'super_admin') {
        // Check direct role assignment
        if (userData.role === 'super_admin') {
          throw new Error('Insufficient privileges: Only Super Administrators can assign super_admin role');
        }
        
        // Check roles array for super_admin
        if (userData.roles && Array.isArray(userData.roles) && userData.roles.includes('super_admin')) {
          throw new Error('Insufficient privileges: Only Super Administrators can assign super_admin role');
        }
        
        // Prevent admins from escalating themselves to super_admin
        if (requestingUser.id === id && (userData.role === 'super_admin' || (userData.roles && userData.roles.includes('super_admin')))) {
          throw new Error('Forbidden: Users cannot escalate their own privileges to super_admin');
        }
      }
    }
    
    // Normalize role and roles fields for consistency (only for allowed roles)
    if (userData.roles !== undefined) {
      if (userData.roles && userData.roles.length > 0) {
        // Deduplicate roles and ensure at least one role
        userData.roles = Array.from(new Set(userData.roles));
        userData.role = userData.roles[0] as any; // Set single role to first role
      } else {
        // If roles is empty, set default
        userData.role = 'employee' as any;
        userData.roles = ['employee'];
      }
    } else if (userData.role !== undefined && userData.role) {
      // If only single role provided, create roles array
      userData.roles = [userData.role];
    }
    
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return sanitizeUser(updatedUser);
  }

  async deleteUser(id: string, requestingUserId?: string): Promise<void> {
    // SECURITY: Administrator isolation - only delete users they created
    if (requestingUserId) {
      const requestingUser = await this.getUser(requestingUserId);
      if (requestingUser && requestingUser.role === 'admin') {
        // Check if the admin created this user
        const targetUser = await this.getUser(id);
        if (!targetUser || targetUser.createdById !== requestingUserId) {
          throw new Error('Forbidden: You can only delete users you created');
        }
      }
      // Super admins can delete any user (no additional check)
    }
    
    await db.delete(users).where(eq(users.id, id));
  }

  async getUsersByManager(managerId: string): Promise<SafeUser[]> {
    const managerUsers = await db.select().from(users).where(eq(users.reportingManagerId, managerId));
    return sanitizeUsers(managerUsers);
  }

  // Questionnaire template operations
  async getQuestionnaireTemplates(requestingUserId?: string): Promise<QuestionnaireTemplate[]> {
    // SECURITY: Company isolation - HR Managers only see templates from their company
    if (requestingUserId) {
      const requestingUser = await this.getUser(requestingUserId);
      
      if (requestingUser && requestingUser.role === 'hr_manager') {
        // HR Managers can only see templates created by users (admins/hr_managers) in their company
        // DEFENSIVE: If HR Manager has no companyId, they can only see templates they created themselves
        if (!requestingUser.companyId) {
          const templates = await db
            .select()
            .from(questionnaireTemplates)
            .where(eq(questionnaireTemplates.createdById, requestingUser.id))
            .orderBy(desc(questionnaireTemplates.createdAt));
          
          return templates;
        }
        
        const templates = await db
          .select({
            id: questionnaireTemplates.id,
            name: questionnaireTemplates.name,
            description: questionnaireTemplates.description,
            targetRole: questionnaireTemplates.targetRole,
            applicableCategory: questionnaireTemplates.applicableCategory,
            applicableLevelId: questionnaireTemplates.applicableLevelId,
            applicableGradeId: questionnaireTemplates.applicableGradeId,
            applicableLocationId: questionnaireTemplates.applicableLocationId,
            sendOnMail: questionnaireTemplates.sendOnMail,
            questions: questionnaireTemplates.questions,
            year: questionnaireTemplates.year,
            status: questionnaireTemplates.status,
            createdAt: questionnaireTemplates.createdAt,
            updatedAt: questionnaireTemplates.updatedAt,
            createdById: questionnaireTemplates.createdById,
          })
          .from(questionnaireTemplates)
          .leftJoin(users, eq(questionnaireTemplates.createdById, users.id))
          .where(
            and(
              eq(users.companyId, requestingUser.companyId),
              isNotNull(questionnaireTemplates.createdById) // Only include templates with valid creators
            )
          )
          .orderBy(desc(questionnaireTemplates.createdAt));
        
        return templates;
      }
      // Admins and super admins can see all templates (no additional filter)
    }
    
    return await db.select().from(questionnaireTemplates).orderBy(desc(questionnaireTemplates.createdAt));
  }

  async getQuestionnaireTemplate(id: string, requestingUserId?: string): Promise<QuestionnaireTemplate | undefined> {
    const [template] = await db.select().from(questionnaireTemplates).where(eq(questionnaireTemplates.id, id));
    
    // SECURITY: Company isolation - HR Managers only see templates from their company
    if (template && requestingUserId) {
      const requestingUser = await this.getUser(requestingUserId);
      if (requestingUser && requestingUser.role === 'hr_manager') {
        // Check if template was created by someone in the same company
        const creator = await this.getUser(template.createdById!);
        if (!creator || creator.companyId !== requestingUser.companyId) {
          return undefined; // Template not accessible to this HR Manager
        }
      }
    }
    
    return template;
  }

  async createQuestionnaireTemplate(template: InsertQuestionnaireTemplate): Promise<QuestionnaireTemplate> {
    const [newTemplate] = await db.insert(questionnaireTemplates).values(template).returning();
    return newTemplate;
  }

  async copyQuestionnaireTemplate(id: string, requestingUserId: string): Promise<QuestionnaireTemplate> {
    // First, get the original template
    const originalTemplate = await this.getQuestionnaireTemplate(id, requestingUserId);
    if (!originalTemplate) {
      throw new Error('Template not found');
    }

    // Create a copy with modified name and new creator
    const copyData: InsertQuestionnaireTemplate = {
      name: `${originalTemplate.name} (Copy)`,
      description: originalTemplate.description,
      targetRole: originalTemplate.targetRole,
      applicableCategory: originalTemplate.applicableCategory,
      applicableLevelId: originalTemplate.applicableLevelId,
      applicableGradeId: originalTemplate.applicableGradeId,
      applicableLocationId: originalTemplate.applicableLocationId,
      sendOnMail: originalTemplate.sendOnMail,
      questions: originalTemplate.questions as any,
      year: originalTemplate.year,
      status: originalTemplate.status,
      createdById: requestingUserId, // Set the requesting user as the creator of the copy
    };

    const [copiedTemplate] = await db.insert(questionnaireTemplates).values(copyData).returning();
    return copiedTemplate;
  }

  async updateQuestionnaireTemplate(id: string, template: Partial<InsertQuestionnaireTemplate>, requestingUserId?: string): Promise<QuestionnaireTemplate> {
    // SECURITY: Company isolation - HR Managers only update templates from their company
    if (requestingUserId) {
      const existingTemplate = await this.getQuestionnaireTemplate(id, requestingUserId);
      if (!existingTemplate) {
        throw new Error('Forbidden: Questionnaire template not found or not accessible');
      }
    }
    
    const [updatedTemplate] = await db
      .update(questionnaireTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(questionnaireTemplates.id, id))
      .returning();
    return updatedTemplate;
  }

  async deleteQuestionnaireTemplate(id: string, requestingUserId?: string): Promise<void> {
    // SECURITY: Company isolation - HR Managers only delete templates from their company
    if (requestingUserId) {
      const existingTemplate = await this.getQuestionnaireTemplate(id, requestingUserId);
      if (!existingTemplate) {
        throw new Error('Forbidden: Questionnaire template not found or not accessible');
      }
    }
    
    await db.delete(questionnaireTemplates).where(eq(questionnaireTemplates.id, id));
  }

  async getQuestionnaireTemplatesByYear(year: number): Promise<QuestionnaireTemplate[]> {
    return await db.select().from(questionnaireTemplates).where(eq(questionnaireTemplates.year, year));
  }

  // Review cycle operations
  async getReviewCycles(): Promise<ReviewCycle[]> {
    return await db.select().from(reviewCycles).orderBy(desc(reviewCycles.createdAt));
  }

  async getReviewCycle(id: string): Promise<ReviewCycle | undefined> {
    const [cycle] = await db.select().from(reviewCycles).where(eq(reviewCycles.id, id));
    return cycle;
  }

  async createReviewCycle(cycle: InsertReviewCycle): Promise<ReviewCycle> {
    const [newCycle] = await db.insert(reviewCycles).values(cycle).returning();
    return newCycle;
  }

  async updateReviewCycle(id: string, cycle: Partial<InsertReviewCycle>): Promise<ReviewCycle> {
    const [updatedCycle] = await db
      .update(reviewCycles)
      .set({ ...cycle, updatedAt: new Date() })
      .where(eq(reviewCycles.id, id))
      .returning();
    return updatedCycle;
  }

  async deleteReviewCycle(id: string): Promise<void> {
    await db.delete(reviewCycles).where(eq(reviewCycles.id, id));
  }

  async getActiveReviewCycles(): Promise<ReviewCycle[]> {
    return await db.select().from(reviewCycles).where(eq(reviewCycles.status, 'active'));
  }

  // Evaluation operations
  async getEvaluations(filters?: { employeeId?: string; managerId?: string; reviewCycleId?: string; status?: string }): Promise<Evaluation[]> {
    const conditions = [];
    if (filters?.employeeId) conditions.push(eq(evaluations.employeeId, filters.employeeId));
    if (filters?.managerId) conditions.push(eq(evaluations.managerId, filters.managerId));
    if (filters?.reviewCycleId) conditions.push(eq(evaluations.reviewCycleId, filters.reviewCycleId));
    if (filters?.status) conditions.push(eq(evaluations.status, filters.status));
    
    if (conditions.length > 0) {
      return await db.select().from(evaluations).where(and(...conditions)).orderBy(desc(evaluations.createdAt));
    }
    
    return await db.select().from(evaluations).orderBy(desc(evaluations.createdAt));
  }

  async getEvaluationsWithQuestionnaires(filters?: { employeeId?: string; managerId?: string; reviewCycleId?: string; status?: string }): Promise<any[]> {
    const conditions = [];
    if (filters?.employeeId) conditions.push(eq(evaluations.employeeId, filters.employeeId));
    if (filters?.managerId) conditions.push(eq(evaluations.managerId, filters.managerId));
    if (filters?.reviewCycleId) conditions.push(eq(evaluations.reviewCycleId, filters.reviewCycleId));
    if (filters?.status) conditions.push(eq(evaluations.status, filters.status));
    
    const evaluationResults = conditions.length > 0 
      ? await db.select().from(evaluations).where(and(...conditions)).orderBy(desc(evaluations.createdAt))
      : await db.select().from(evaluations).orderBy(desc(evaluations.createdAt));

    // Fetch related data for each evaluation
    const evaluationsWithData = await Promise.all(
      evaluationResults.map(async (evaluation) => {
        let questionnaires: any[] = [];
        let appraisalCycle = null;
        let frequencyCalendar = null;
        let frequencyCalendarDetail = null;
        
        // Get questionnaire templates if evaluation is linked to an initiated appraisal
        if (evaluation.initiatedAppraisalId) {
          const initiatedAppraisal = await db
            .select()
            .from(initiatedAppraisals)
            .where(eq(initiatedAppraisals.id, evaluation.initiatedAppraisalId))
            .limit(1);

          if (initiatedAppraisal.length > 0) {
            // Get questionnaire templates
            if (initiatedAppraisal[0].questionnaireTemplateIds) {
              const templateIds = initiatedAppraisal[0].questionnaireTemplateIds;
              
              if (templateIds && templateIds.length > 0) {
                questionnaires = await db
                  .select()
                  .from(questionnaireTemplates)
                  .where(inArray(questionnaireTemplates.id, templateIds))
                  .orderBy(asc(questionnaireTemplates.name));
              }
            }

            // Get frequency calendar and appraisal cycle
            if (initiatedAppraisal[0].frequencyCalendarId) {
              const [freqCal] = await db
                .select()
                .from(frequencyCalendars)
                .where(eq(frequencyCalendars.id, initiatedAppraisal[0].frequencyCalendarId))
                .limit(1);
              
              if (freqCal) {
                frequencyCalendar = freqCal;
                
                // Get appraisal cycle from frequency calendar
                if (freqCal.appraisalCycleId) {
                  const [cycle] = await db
                    .select()
                    .from(appraisalCycles)
                    .where(eq(appraisalCycles.id, freqCal.appraisalCycleId))
                    .limit(1);
                  
                  if (cycle) {
                    appraisalCycle = cycle;
                  }
                }

                // Get the associated frequency calendar detail through initiated appraisal detail timings
                // Try to find current active period, fallback to earliest by start date
                const detailTimings = await db
                  .select({
                    detail: frequencyCalendarDetails
                  })
                  .from(initiatedAppraisalDetailTimings)
                  .leftJoin(
                    frequencyCalendarDetails,
                    eq(initiatedAppraisalDetailTimings.frequencyCalendarDetailId, frequencyCalendarDetails.id)
                  )
                  .where(eq(initiatedAppraisalDetailTimings.initiatedAppraisalId, initiatedAppraisal[0].id))
                  .orderBy(asc(frequencyCalendarDetails.startDate));

                // Find the current active period (where today is between startDate and endDate)
                const now = new Date();
                let selectedDetail = detailTimings.find(dt => 
                  dt.detail && 
                  new Date(dt.detail.startDate) <= now && 
                  new Date(dt.detail.endDate) >= now
                );

                // If no current period, use the earliest one
                if (!selectedDetail && detailTimings.length > 0) {
                  selectedDetail = detailTimings[0];
                }

                if (selectedDetail?.detail) {
                  frequencyCalendarDetail = selectedDetail.detail;
                }
              }
            }
          }
        }

        // Get employee and manager details
        const [employee, manager] = await Promise.all([
          evaluation.employeeId ? this.getUser(evaluation.employeeId) : null,
          evaluation.managerId ? this.getUser(evaluation.managerId) : null,
        ]);

        return {
          ...evaluation,
          employee,
          manager,
          questionnaires,
          appraisalCycle,
          frequencyCalendar,
          frequencyCalendarDetail,
        };
      })
    );

    return evaluationsWithData;
  }

  async getEvaluation(id: string): Promise<Evaluation | undefined> {
    const [evaluation] = await db.select().from(evaluations).where(eq(evaluations.id, id));
    return evaluation;
  }

  async createEvaluation(evaluation: InsertEvaluation): Promise<Evaluation> {
    const [newEvaluation] = await db.insert(evaluations).values(evaluation).returning();
    return newEvaluation;
  }

  async updateEvaluation(id: string, evaluation: Partial<InsertEvaluation>): Promise<Evaluation> {
    const [updatedEvaluation] = await db
      .update(evaluations)
      .set({ ...evaluation, updatedAt: new Date() })
      .where(eq(evaluations.id, id))
      .returning();
    return updatedEvaluation;
  }

  async deleteEvaluation(id: string): Promise<void> {
    await db.delete(evaluations).where(eq(evaluations.id, id));
  }

  async getEvaluationByEmployeeAndCycle(employeeId: string, reviewCycleId: string): Promise<Evaluation | undefined> {
    const [evaluation] = await db
      .select()
      .from(evaluations)
      .where(and(eq(evaluations.employeeId, employeeId), eq(evaluations.reviewCycleId, reviewCycleId)));
    return evaluation;
  }

  async getEvaluationsByInitiatedAppraisal(initiatedAppraisalId: string): Promise<Evaluation[]> {
    const results = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.initiatedAppraisalId, initiatedAppraisalId))
      .orderBy(desc(evaluations.createdAt));
    return results;
  }

  async getScheduledMeetingsForCompany(companyId: string): Promise<any[]> {
    const results = await db
      .select({
        evaluation: evaluations,
        employee: users,
        manager: {
          id: sql`manager.id`,
          firstName: sql`manager.first_name`,
          lastName: sql`manager.last_name`,
          email: sql`manager.email`,
          department: sql`manager.department`,
        },
      })
      .from(evaluations)
      .leftJoin(users, eq(evaluations.employeeId, users.id))
      .leftJoin(sql`users as manager`, sql`${evaluations.managerId} = manager.id`)
      .where(
        and(
          eq(users.companyId, companyId),
          isNotNull(evaluations.meetingScheduledAt)
        )
      )
      .orderBy(desc(evaluations.meetingScheduledAt));
    
    return results.map(result => ({
      ...result.evaluation,
      employee: result.employee ? {
        id: result.employee.id,
        firstName: result.employee.firstName,
        lastName: result.employee.lastName,
        email: result.employee.email,
        department: result.employee.department,
        designation: result.employee.designation,
      } : null,
      manager: result.manager,
    }));
  }

  async getEvaluationsForCalibration(companyId: string): Promise<any[]> {
    const results = await db
      .select({
        evaluation: evaluations,
        employee: users,
        manager: {
          id: sql`manager.id`,
          firstName: sql`manager.first_name`,
          lastName: sql`manager.last_name`,
          email: sql`manager.email`,
        },
        location: locations,
        initiatedAppraisal: initiatedAppraisals,
        appraisalGroup: appraisalGroups,
        frequencyCalendar: frequencyCalendars,
      })
      .from(evaluations)
      .leftJoin(users, eq(evaluations.employeeId, users.id))
      .leftJoin(sql`users as manager`, sql`${evaluations.managerId} = manager.id`)
      .leftJoin(locations, eq(users.locationId, locations.id))
      .leftJoin(initiatedAppraisals, eq(evaluations.initiatedAppraisalId, initiatedAppraisals.id))
      .leftJoin(appraisalGroups, eq(initiatedAppraisals.appraisalGroupId, appraisalGroups.id))
      .leftJoin(frequencyCalendars, eq(initiatedAppraisals.frequencyCalendarId, frequencyCalendars.id))
      .where(
        and(
          eq(users.companyId, companyId),
          isNotNull(evaluations.overallRating)
        )
      )
      .orderBy(desc(evaluations.updatedAt));
    
    return results.map(result => ({
      id: result.evaluation.id,
      employeeId: result.evaluation.employeeId,
      employeeName: result.employee ? `${result.employee.firstName} ${result.employee.lastName}` : 'Unknown',
      employeeCode: result.employee?.code || 'N/A',
      managerId: result.evaluation.managerId,
      managerName: result.manager ? `${result.manager.firstName} ${result.manager.lastName}` : 'Unknown',
      locationId: result.employee?.locationId,
      locationName: result.location?.name || 'N/A',
      department: result.employee?.department || 'N/A',
      level: result.employee?.level || 'N/A',
      grade: result.employee?.grade || 'N/A',
      appraisalGroupId: result.initiatedAppraisal?.appraisalGroupId,
      appraisalGroupName: result.appraisalGroup?.name || 'N/A',
      frequencyCalendarId: result.initiatedAppraisal?.frequencyCalendarId,
      frequencyCalendarName: result.frequencyCalendar?.name || 'N/A',
      overallRating: result.evaluation.overallRating,
      calibratedRating: result.evaluation.calibratedRating,
      calibrationRemarks: result.evaluation.calibrationRemarks,
      calibratedBy: result.evaluation.calibratedBy,
      calibratedAt: result.evaluation.calibratedAt,
      meetingCompletedAt: result.evaluation.meetingCompletedAt,
    }));
  }

  async getEvaluationById(id: string): Promise<Evaluation | undefined> {
    const [evaluation] = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.id, id));
    return evaluation;
  }

  async updateEvaluationCalibration(
    id: string, 
    calibration: { 
      calibratedRating: number | null; 
      calibrationRemarks: string; 
      calibratedBy: string; 
      calibratedAt: Date;
    }
  ): Promise<Evaluation> {
    const [updatedEvaluation] = await db
      .update(evaluations)
      .set({
        calibratedRating: calibration.calibratedRating,
        calibrationRemarks: calibration.calibrationRemarks,
        calibratedBy: calibration.calibratedBy,
        calibratedAt: calibration.calibratedAt,
        updatedAt: new Date(),
      })
      .where(eq(evaluations.id, id))
      .returning();
    return updatedEvaluation;
  }

  // Email operations
  async getEmailTemplates(): Promise<EmailTemplate[]> {
    return await db.select().from(emailTemplates).orderBy(asc(emailTemplates.name));
  }

  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
    return template;
  }

  async createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> {
    const [newTemplate] = await db.insert(emailTemplates).values(template).returning();
    return newTemplate;
  }

  async updateEmailTemplate(id: string, template: Partial<InsertEmailTemplate>): Promise<EmailTemplate> {
    const [updatedTemplate] = await db
      .update(emailTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(emailTemplates.id, id))
      .returning();
    return updatedTemplate;
  }

  async deleteEmailTemplate(id: string): Promise<void> {
    await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
  }

  async getEmailConfig(): Promise<EmailConfig | undefined> {
    const [config] = await db.select().from(emailConfig).where(eq(emailConfig.isActive, true));
    return config;
  }

  async createEmailConfig(config: InsertEmailConfig): Promise<EmailConfig> {
    const [newConfig] = await db.insert(emailConfig).values(config).returning();
    return newConfig;
  }

  async updateEmailConfig(id: string, config: Partial<InsertEmailConfig>): Promise<EmailConfig> {
    const [updatedConfig] = await db
      .update(emailConfig)
      .set({ ...config, updatedAt: new Date() })
      .where(eq(emailConfig.id, id))
      .returning();
    return updatedConfig;
  }

  // Registration operations - SaaS onboarding
  async getRegistrations(): Promise<Registration[]> {
    return await db.select().from(registrations).orderBy(desc(registrations.createdAt));
  }

  async getRegistration(id: string): Promise<Registration | undefined> {
    const [registration] = await db.select().from(registrations).where(eq(registrations.id, id));
    return registration;
  }

  async createRegistration(registration: InsertRegistration): Promise<Registration> {
    const [newRegistration] = await db.insert(registrations).values(registration).returning();
    return newRegistration;
  }

  async updateRegistration(id: string, registration: Partial<Registration>): Promise<Registration> {
    const [updatedRegistration] = await db
      .update(registrations)
      .set({ ...registration, updatedAt: new Date() })
      .where(eq(registrations.id, id))
      .returning();
    return updatedRegistration;
  }

  // Access token operations
  async createAccessToken(token: InsertAccessToken): Promise<AccessToken> {
    const [newToken] = await db.insert(accessTokens).values(token).returning();
    return newToken;
  }

  async getAccessToken(token: string): Promise<AccessToken | undefined> {
    const [accessToken] = await db.select().from(accessTokens).where(
      and(
        eq(accessTokens.token, token),
        eq(accessTokens.isActive, true)
      )
    );
    return accessToken;
  }

  async markTokenAsUsed(token: string): Promise<void> {
    await db
      .update(accessTokens)
      .set({ usedAt: new Date() })
      .where(eq(accessTokens.token, token));
  }

  async deactivateToken(token: string): Promise<void> {
    await db
      .update(accessTokens)
      .set({ isActive: false })
      .where(eq(accessTokens.token, token));
  }

  async getActiveTokensByUser(userId: string): Promise<AccessToken[]> {
    return await db.select().from(accessTokens).where(
      and(
        eq(accessTokens.userId, userId),
        eq(accessTokens.isActive, true)
      )
    ).orderBy(desc(accessTokens.createdAt));
  }

  // Calendar Credential operations implementation
  async getCalendarCredential(companyId: string, provider: 'google' | 'outlook'): Promise<CalendarCredential | undefined> {
    const [credential] = await db.select().from(calendarCredentials).where(
      and(
        eq(calendarCredentials.companyId, companyId),
        eq(calendarCredentials.provider, provider),
        eq(calendarCredentials.isActive, true)
      )
    );
    return credential;
  }

  async createCalendarCredential(credential: InsertCalendarCredential): Promise<CalendarCredential> {
    const [newCredential] = await db.insert(calendarCredentials).values(credential).returning();
    return newCredential;
  }

  async updateCalendarCredential(id: string, credential: Partial<InsertCalendarCredential>): Promise<CalendarCredential> {
    const [updatedCredential] = await db
      .update(calendarCredentials)
      .set({ ...credential, updatedAt: new Date() })
      .where(eq(calendarCredentials.id, id))
      .returning();
    return updatedCredential;
  }

  async updateCalendarCredentialTokens(
    companyId: string, 
    provider: 'google' | 'outlook', 
    accessToken: string, 
    refreshToken?: string, 
    expiresAt?: Date
  ): Promise<void> {
    const updateData: any = {
      accessToken,
      updatedAt: new Date(),
    };
    
    if (refreshToken) {
      updateData.refreshToken = refreshToken;
    }
    
    if (expiresAt) {
      updateData.expiresAt = expiresAt;
    }

    await db
      .update(calendarCredentials)
      .set(updateData)
      .where(
        and(
          eq(calendarCredentials.companyId, companyId),
          eq(calendarCredentials.provider, provider)
        )
      );
  }

  async deleteCalendarCredential(id: string): Promise<void> {
    await db.delete(calendarCredentials).where(eq(calendarCredentials.id, id));
  }

  // Settings operations
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    // Get the user to validate current password
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Handle OIDC accounts that don't have passwords set yet
    if (!user.passwordHash) {
      // For accounts without passwords (OIDC accounts), allow setting initial password
      // Skip current password validation since there's no existing password
      console.log(`Setting initial password for OIDC user: ${userId}`);
    } else {
      // For accounts with existing passwords, validate current password
      if (!currentPassword) {
        throw new Error('Current password is required for accounts with existing passwords');
      }
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }
    }

    // Hash the new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update the password
    await db
      .update(users)
      .set({ 
        passwordHash: newPasswordHash, 
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId));
  }

  // Level operations - Administrator isolated
  async getLevels(createdById: string): Promise<Level[]> {
    return await db.select().from(levels).where(
      and(
        eq(levels.createdById, createdById),
        eq(levels.status, 'active')
      )
    ).orderBy(asc(levels.code));
  }

  async getLevel(id: string, createdById: string): Promise<Level | undefined> {
    const [level] = await db.select().from(levels).where(
      and(
        eq(levels.id, id),
        eq(levels.createdById, createdById)
      )
    );
    return level;
  }

  async createLevel(level: InsertLevel, createdById: string): Promise<Level> {
    const [newLevel] = await db.insert(levels).values({
      ...level,
      createdById,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return newLevel;
  }

  async updateLevel(id: string, level: Partial<InsertLevel>, createdById: string): Promise<Level> {
    const [updatedLevel] = await db
      .update(levels)
      .set({ 
        ...level, 
        updatedAt: new Date() 
      })
      .where(
        and(
          eq(levels.id, id),
          eq(levels.createdById, createdById)
        )
      )
      .returning();
    
    if (!updatedLevel) {
      throw new Error('Level not found or access denied');
    }
    return updatedLevel;
  }

  async deleteLevel(id: string, createdById: string): Promise<void> {
    const result = await db
      .delete(levels)
      .where(
        and(
          eq(levels.id, id),
          eq(levels.createdById, createdById)
        )
      );
    
    if (result.rowCount === 0) {
      throw new Error('Level not found or access denied');
    }
  }

  // Grade operations - Administrator isolated
  async getGrades(createdById: string): Promise<Grade[]> {
    return await db.select().from(grades).where(
      and(
        eq(grades.createdById, createdById),
        eq(grades.status, 'active')
      )
    ).orderBy(asc(grades.code));
  }

  async getGrade(id: string, createdById: string): Promise<Grade | undefined> {
    const [grade] = await db.select().from(grades).where(
      and(
        eq(grades.id, id),
        eq(grades.createdById, createdById)
      )
    );
    return grade;
  }

  async createGrade(grade: InsertGrade, createdById: string): Promise<Grade> {
    const [newGrade] = await db.insert(grades).values({
      ...grade,
      createdById,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return newGrade;
  }

  async updateGrade(id: string, grade: Partial<InsertGrade>, createdById: string): Promise<Grade> {
    const [updatedGrade] = await db
      .update(grades)
      .set({ 
        ...grade, 
        updatedAt: new Date() 
      })
      .where(
        and(
          eq(grades.id, id),
          eq(grades.createdById, createdById)
        )
      )
      .returning();
    
    if (!updatedGrade) {
      throw new Error('Grade not found or access denied');
    }
    return updatedGrade;
  }

  async deleteGrade(id: string, createdById: string): Promise<void> {
    const result = await db
      .delete(grades)
      .where(
        and(
          eq(grades.id, id),
          eq(grades.createdById, createdById)
        )
      );
    
    if (result.rowCount === 0) {
      throw new Error('Grade not found or access denied');
    }
  }

  // Department operations - Administrator isolated
  async getDepartments(createdById: string): Promise<Department[]> {
    return await db.select().from(departments).where(
      and(
        eq(departments.createdById, createdById),
        eq(departments.status, 'active')
      )
    ).orderBy(asc(departments.code));
  }

  async getDepartment(id: string, createdById: string): Promise<Department | undefined> {
    const [department] = await db.select().from(departments).where(
      and(
        eq(departments.id, id),
        eq(departments.createdById, createdById)
      )
    );
    return department;
  }

  async createDepartment(department: InsertDepartment, createdById: string): Promise<Department> {
    const [newDepartment] = await db.insert(departments).values({
      ...department,
      createdById,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return newDepartment;
  }

  async updateDepartment(id: string, department: Partial<InsertDepartment>, createdById: string): Promise<Department> {
    const [updatedDepartment] = await db
      .update(departments)
      .set({ 
        ...department, 
        updatedAt: new Date() 
      })
      .where(
        and(
          eq(departments.id, id),
          eq(departments.createdById, createdById)
        )
      )
      .returning();
    
    if (!updatedDepartment) {
      throw new Error('Department not found or access denied');
    }
    return updatedDepartment;
  }

  async deleteDepartment(id: string, createdById: string): Promise<void> {
    const result = await db
      .delete(departments)
      .where(
        and(
          eq(departments.id, id),
          eq(departments.createdById, createdById)
        )
      );
    
    if (result.rowCount === 0) {
      throw new Error('Department not found or access denied');
    }
  }

  // Appraisal Cycle operations - Administrator isolated
  async getAppraisalCycles(createdById: string): Promise<AppraisalCycle[]> {
    return await db.select().from(appraisalCycles).where(
      and(
        eq(appraisalCycles.createdById, createdById),
        eq(appraisalCycles.status, 'active')
      )
    ).orderBy(asc(appraisalCycles.code));
  }

  // Get all appraisal cycles for HR managers in their company
  async getAllAppraisalCycles(companyId: string): Promise<AppraisalCycle[]> {
    // Join with users table to filter by company
    return await db.select({
      id: appraisalCycles.id,
      code: appraisalCycles.code,
      description: appraisalCycles.description,
      fromDate: appraisalCycles.fromDate,
      toDate: appraisalCycles.toDate,
      status: appraisalCycles.status,
      createdAt: appraisalCycles.createdAt,
      updatedAt: appraisalCycles.updatedAt,
      createdById: appraisalCycles.createdById,
    })
    .from(appraisalCycles)
    .leftJoin(users, eq(appraisalCycles.createdById, users.id))
    .where(
      and(
        eq(appraisalCycles.status, 'active'),
        eq(users.companyId, companyId)
      )
    )
    .orderBy(asc(appraisalCycles.code));
  }

  async getAppraisalCycle(id: string, createdById: string): Promise<AppraisalCycle | undefined> {
    const [cycle] = await db.select().from(appraisalCycles).where(
      and(
        eq(appraisalCycles.id, id),
        eq(appraisalCycles.createdById, createdById)
      )
    );
    return cycle;
  }

  async getAppraisalCycleById(id: string): Promise<AppraisalCycle | undefined> {
    const [cycle] = await db.select().from(appraisalCycles).where(
      eq(appraisalCycles.id, id)
    );
    return cycle;
  }

  async createAppraisalCycle(cycle: InsertAppraisalCycle, createdById: string): Promise<AppraisalCycle> {
    const [newCycle] = await db.insert(appraisalCycles).values({
      ...cycle,
      createdById,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return newCycle;
  }

  async updateAppraisalCycle(id: string, cycle: Partial<InsertAppraisalCycle>, createdById: string): Promise<AppraisalCycle> {
    const [updatedCycle] = await db
      .update(appraisalCycles)
      .set({ 
        ...cycle, 
        updatedAt: new Date() 
      })
      .where(
        and(
          eq(appraisalCycles.id, id),
          eq(appraisalCycles.createdById, createdById)
        )
      )
      .returning();
    
    if (!updatedCycle) {
      throw new Error('Appraisal Cycle not found or access denied');
    }
    return updatedCycle;
  }

  async deleteAppraisalCycle(id: string, createdById: string): Promise<void> {
    const result = await db
      .delete(appraisalCycles)
      .where(
        and(
          eq(appraisalCycles.id, id),
          eq(appraisalCycles.createdById, createdById)
        )
      );
    
    if (result.rowCount === 0) {
      throw new Error('Appraisal Cycle not found or access denied');
    }
  }

  // Review Frequency operations - Administrator isolated
  async getReviewFrequencies(createdById: string): Promise<ReviewFrequency[]> {
    return await db.select().from(reviewFrequencies).where(
      and(
        eq(reviewFrequencies.createdById, createdById),
        eq(reviewFrequencies.status, 'active')
      )
    ).orderBy(asc(reviewFrequencies.code));
  }

  async getReviewFrequency(id: string, createdById: string): Promise<ReviewFrequency | undefined> {
    const [frequency] = await db.select().from(reviewFrequencies).where(
      and(
        eq(reviewFrequencies.id, id),
        eq(reviewFrequencies.createdById, createdById)
      )
    );
    return frequency;
  }

  async createReviewFrequency(frequency: InsertReviewFrequency, createdById: string): Promise<ReviewFrequency> {
    const [newFrequency] = await db.insert(reviewFrequencies).values({
      ...frequency,
      createdById,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return newFrequency;
  }

  async updateReviewFrequency(id: string, frequency: Partial<InsertReviewFrequency>, createdById: string): Promise<ReviewFrequency> {
    const [updatedFrequency] = await db
      .update(reviewFrequencies)
      .set({ 
        ...frequency, 
        updatedAt: new Date() 
      })
      .where(
        and(
          eq(reviewFrequencies.id, id),
          eq(reviewFrequencies.createdById, createdById)
        )
      )
      .returning();
    
    if (!updatedFrequency) {
      throw new Error('Review Frequency not found or access denied');
    }
    return updatedFrequency;
  }

  async deleteReviewFrequency(id: string, createdById: string): Promise<void> {
    const result = await db
      .delete(reviewFrequencies)
      .where(
        and(
          eq(reviewFrequencies.id, id),
          eq(reviewFrequencies.createdById, createdById)
        )
      );
    
    if (result.rowCount === 0) {
      throw new Error('Review Frequency not found or access denied');
    }
  }

  // Frequency Calendar operations - Administrator isolated
  async getFrequencyCalendars(createdById: string): Promise<FrequencyCalendar[]> {
    return await db.select().from(frequencyCalendars).where(
      and(
        eq(frequencyCalendars.createdById, createdById),
        eq(frequencyCalendars.status, 'active')
      )
    ).orderBy(asc(frequencyCalendars.code));
  }

  // Get all frequency calendars for HR managers
  async getAllFrequencyCalendars(): Promise<FrequencyCalendar[]> {
    return await db.select().from(frequencyCalendars).where(
      eq(frequencyCalendars.status, 'active')
    ).orderBy(asc(frequencyCalendars.code));
  }

  async getFrequencyCalendar(id: string, createdById: string): Promise<FrequencyCalendar | undefined> {
    const [calendar] = await db.select().from(frequencyCalendars).where(
      and(
        eq(frequencyCalendars.id, id),
        eq(frequencyCalendars.createdById, createdById)
      )
    );
    return calendar;
  }

  async getFrequencyCalendarById(id: string): Promise<FrequencyCalendar | undefined> {
    const [calendar] = await db.select().from(frequencyCalendars).where(
      eq(frequencyCalendars.id, id)
    );
    return calendar;
  }

  async createFrequencyCalendar(calendar: InsertFrequencyCalendar, createdById: string): Promise<FrequencyCalendar> {
    const [newCalendar] = await db.insert(frequencyCalendars).values({
      ...calendar,
      createdById,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return newCalendar;
  }

  async updateFrequencyCalendar(id: string, calendar: Partial<InsertFrequencyCalendar>, createdById: string): Promise<FrequencyCalendar> {
    const [updatedCalendar] = await db
      .update(frequencyCalendars)
      .set({ 
        ...calendar, 
        updatedAt: new Date() 
      })
      .where(
        and(
          eq(frequencyCalendars.id, id),
          eq(frequencyCalendars.createdById, createdById)
        )
      )
      .returning();
    
    if (!updatedCalendar) {
      throw new Error('Frequency Calendar not found or access denied');
    }
    return updatedCalendar;
  }

  async deleteFrequencyCalendar(id: string, createdById: string): Promise<void> {
    const result = await db
      .delete(frequencyCalendars)
      .where(
        and(
          eq(frequencyCalendars.id, id),
          eq(frequencyCalendars.createdById, createdById)
        )
      );
    
    if (result.rowCount === 0) {
      throw new Error('Frequency Calendar not found or access denied');
    }
  }

  // Frequency Calendar Details operations - Administrator isolated through parent calendar
  async getFrequencyCalendarDetails(createdById: string): Promise<FrequencyCalendarDetails[]> {
    return await db
      .select({
        id: frequencyCalendarDetails.id,
        frequencyCalendarId: frequencyCalendarDetails.frequencyCalendarId,
        displayName: frequencyCalendarDetails.displayName,
        startDate: frequencyCalendarDetails.startDate,
        endDate: frequencyCalendarDetails.endDate,
        status: frequencyCalendarDetails.status,
        createdAt: frequencyCalendarDetails.createdAt,
        updatedAt: frequencyCalendarDetails.updatedAt,
        createdById: frequencyCalendarDetails.createdById,
      })
      .from(frequencyCalendarDetails)
      .innerJoin(frequencyCalendars, eq(frequencyCalendarDetails.frequencyCalendarId, frequencyCalendars.id))
      .where(
        and(
          eq(frequencyCalendars.createdById, createdById),
          eq(frequencyCalendarDetails.status, 'active')
        )
      )
      .orderBy(asc(frequencyCalendarDetails.startDate));
  }

  // Get all frequency calendar details for HR managers in their company
  async getAllFrequencyCalendarDetails(companyId: string): Promise<FrequencyCalendarDetails[]> {
    // Join with frequency calendars and users to filter by company
    return await db.select({
      id: frequencyCalendarDetails.id,
      frequencyCalendarId: frequencyCalendarDetails.frequencyCalendarId,
      displayName: frequencyCalendarDetails.displayName,
      startDate: frequencyCalendarDetails.startDate,
      endDate: frequencyCalendarDetails.endDate,
      status: frequencyCalendarDetails.status,
      createdAt: frequencyCalendarDetails.createdAt,
      updatedAt: frequencyCalendarDetails.updatedAt,
      createdById: frequencyCalendarDetails.createdById,
    })
    .from(frequencyCalendarDetails)
    .innerJoin(frequencyCalendars, eq(frequencyCalendarDetails.frequencyCalendarId, frequencyCalendars.id))
    .innerJoin(users, eq(frequencyCalendars.createdById, users.id))
    .where(
      and(
        eq(frequencyCalendarDetails.status, 'active'),
        eq(users.companyId, companyId)
      )
    )
    .orderBy(asc(frequencyCalendarDetails.startDate));
  }

  // Get frequency calendar details by calendar ID (for HR managers)
  async getFrequencyCalendarDetailsByCalendarId(calendarId: string): Promise<FrequencyCalendarDetails[]> {
    return await db.select().from(frequencyCalendarDetails).where(
      and(
        eq(frequencyCalendarDetails.frequencyCalendarId, calendarId),
        eq(frequencyCalendarDetails.status, 'active')
      )
    ).orderBy(asc(frequencyCalendarDetails.startDate));
  }

  async getFrequencyCalendarDetail(id: string, createdById: string): Promise<FrequencyCalendarDetails | undefined> {
    const [detail] = await db
      .select({
        id: frequencyCalendarDetails.id,
        frequencyCalendarId: frequencyCalendarDetails.frequencyCalendarId,
        displayName: frequencyCalendarDetails.displayName,
        startDate: frequencyCalendarDetails.startDate,
        endDate: frequencyCalendarDetails.endDate,
        status: frequencyCalendarDetails.status,
        createdAt: frequencyCalendarDetails.createdAt,
        updatedAt: frequencyCalendarDetails.updatedAt,
        createdById: frequencyCalendarDetails.createdById,
      })
      .from(frequencyCalendarDetails)
      .innerJoin(frequencyCalendars, eq(frequencyCalendarDetails.frequencyCalendarId, frequencyCalendars.id))
      .where(
        and(
          eq(frequencyCalendarDetails.id, id),
          eq(frequencyCalendars.createdById, createdById)
        )
      );
    return detail;
  }

  async createFrequencyCalendarDetails(details: InsertFrequencyCalendarDetails, createdById: string): Promise<FrequencyCalendarDetails> {
    // Verify the frequency calendar belongs to the administrator
    const parentCalendar = await this.getFrequencyCalendar(details.frequencyCalendarId, createdById);
    if (!parentCalendar) {
      throw new Error('Frequency Calendar not found or access denied');
    }

    const [newDetails] = await db.insert(frequencyCalendarDetails).values({
      ...details,
      createdById,
    }).returning();
    return newDetails;
  }

  async updateFrequencyCalendarDetails(id: string, details: Partial<InsertFrequencyCalendarDetails>, createdById: string): Promise<FrequencyCalendarDetails> {
    // Verify the frequency calendar detail belongs to the administrator through parent calendar
    const existingDetail = await this.getFrequencyCalendarDetail(id, createdById);
    if (!existingDetail) {
      throw new Error('Frequency Calendar Details not found or access denied');
    }

    // If frequencyCalendarId is being updated, verify the new parent calendar belongs to the administrator
    if (details.frequencyCalendarId) {
      const parentCalendar = await this.getFrequencyCalendar(details.frequencyCalendarId, createdById);
      if (!parentCalendar) {
        throw new Error('Target Frequency Calendar not found or access denied');
      }
    }

    const [updatedDetails] = await db
      .update(frequencyCalendarDetails)
      .set({ 
        ...details, 
        updatedAt: new Date() 
      })
      .where(eq(frequencyCalendarDetails.id, id))
      .returning();
    
    if (!updatedDetails) {
      throw new Error('Frequency Calendar Details not found or access denied');
    }
    return updatedDetails;
  }

  async deleteFrequencyCalendarDetails(id: string, createdById: string): Promise<void> {
    // Verify the frequency calendar detail belongs to the administrator through parent calendar
    const existingDetail = await this.getFrequencyCalendarDetail(id, createdById);
    if (!existingDetail) {
      throw new Error('Frequency Calendar Details not found or access denied');
    }

    const result = await db
      .delete(frequencyCalendarDetails)
      .where(eq(frequencyCalendarDetails.id, id));
    
    if (result.rowCount === 0) {
      throw new Error('Frequency Calendar Details not found or access denied');
    }
  }

  // Publish Questionnaire operations - Administrator isolated
  async getPublishQuestionnaires(createdById: string): Promise<PublishQuestionnaire[]> {
    return await db
      .select()
      .from(publishQuestionnaires)
      .where(eq(publishQuestionnaires.createdById, createdById))
      .orderBy(desc(publishQuestionnaires.createdAt));
  }

  async getPublishQuestionnaire(id: string, createdById: string): Promise<PublishQuestionnaire | undefined> {
    const [questionnaire] = await db
      .select()
      .from(publishQuestionnaires)
      .where(
        and(
          eq(publishQuestionnaires.id, id),
          eq(publishQuestionnaires.createdById, createdById)
        )
      );
    return questionnaire;
  }

  async createPublishQuestionnaire(questionnaire: InsertPublishQuestionnaire, createdById: string): Promise<PublishQuestionnaire> {
    // Verify template exists and belongs to the administrator
    const template = await this.getQuestionnaireTemplate(questionnaire.templateId);
    if (!template || template.createdById !== createdById) {
      throw new Error('Questionnaire Template not found or access denied');
    }

    // If publishType is 'as_per_calendar', verify frequency calendar exists and belongs to administrator
    if (questionnaire.publishType === 'as_per_calendar' && questionnaire.frequencyCalendarId) {
      const calendar = await this.getFrequencyCalendar(questionnaire.frequencyCalendarId, createdById);
      if (!calendar) {
        throw new Error('Frequency Calendar not found or access denied');
      }
    }

    const [newQuestionnaire] = await db.insert(publishQuestionnaires).values({
      ...questionnaire,
      createdById,
    }).returning();
    
    if (!newQuestionnaire) {
      throw new Error('Failed to create Publish Questionnaire');
    }
    return newQuestionnaire;
  }

  async updatePublishQuestionnaire(id: string, questionnaire: Partial<InsertPublishQuestionnaire>, createdById: string): Promise<PublishQuestionnaire> {
    // Verify the publish questionnaire belongs to the administrator
    const existing = await this.getPublishQuestionnaire(id, createdById);
    if (!existing) {
      throw new Error('Publish Questionnaire not found or access denied');
    }

    // If templateId is being updated, verify the new template belongs to the administrator
    if (questionnaire.templateId) {
      const template = await this.getQuestionnaireTemplate(questionnaire.templateId);
      if (!template || template.createdById !== createdById) {
        throw new Error('Questionnaire Template not found or access denied');
      }
    }

    // If publishType is 'as_per_calendar', verify frequency calendar exists and belongs to administrator
    if (questionnaire.publishType === 'as_per_calendar' && questionnaire.frequencyCalendarId) {
      const calendar = await this.getFrequencyCalendar(questionnaire.frequencyCalendarId, createdById);
      if (!calendar) {
        throw new Error('Frequency Calendar not found or access denied');
      }
    }

    const [updatedQuestionnaire] = await db
      .update(publishQuestionnaires)
      .set({ 
        ...questionnaire, 
        updatedAt: new Date() 
      })
      .where(eq(publishQuestionnaires.id, id))
      .returning();
    
    if (!updatedQuestionnaire) {
      throw new Error('Publish Questionnaire not found or access denied');
    }
    return updatedQuestionnaire;
  }

  async deletePublishQuestionnaire(id: string, createdById: string): Promise<void> {
    // Verify the publish questionnaire belongs to the administrator
    const existing = await this.getPublishQuestionnaire(id, createdById);
    if (!existing) {
      throw new Error('Publish Questionnaire not found or access denied');
    }

    const result = await db
      .delete(publishQuestionnaires)
      .where(eq(publishQuestionnaires.id, id));
    
    if (result.rowCount === 0) {
      throw new Error('Publish Questionnaire not found or access denied');
    }
  }

  // Appraisal Group operations - HR Manager isolated
  async getAppraisalGroups(createdById: string): Promise<AppraisalGroup[]> {
    const results = await db.select()
      .from(appraisalGroups)
      .where(and(
        eq(appraisalGroups.createdById, createdById),
        eq(appraisalGroups.status, 'active')
      ))
      .orderBy(desc(appraisalGroups.createdAt));
    
    return results;
  }

  async getAppraisalGroup(id: string, createdById: string): Promise<AppraisalGroup | undefined> {
    const [result] = await db.select()
      .from(appraisalGroups)
      .where(and(
        eq(appraisalGroups.id, id),
        eq(appraisalGroups.createdById, createdById),
        eq(appraisalGroups.status, 'active')
      ));
    
    return result;
  }

  async createAppraisalGroup(group: InsertAppraisalGroup, createdById: string): Promise<AppraisalGroup> {
    const [newGroup] = await db.insert(appraisalGroups).values({
      ...group,
      createdById,
    }).returning();
    
    if (!newGroup) {
      throw new Error('Failed to create Appraisal Group');
    }
    return newGroup;
  }

  async updateAppraisalGroup(id: string, group: Partial<InsertAppraisalGroup>, createdById: string): Promise<AppraisalGroup> {
    // Verify the group belongs to the HR Manager
    const existing = await this.getAppraisalGroup(id, createdById);
    if (!existing) {
      throw new Error('Appraisal Group not found or access denied');
    }

    const [updatedGroup] = await db
      .update(appraisalGroups)
      .set({ 
        ...group, 
        updatedAt: new Date() 
      })
      .where(eq(appraisalGroups.id, id))
      .returning();
    
    if (!updatedGroup) {
      throw new Error('Appraisal Group not found or access denied');
    }
    return updatedGroup;
  }

  async deleteAppraisalGroup(id: string, createdById: string): Promise<void> {
    // Verify the group belongs to the HR Manager
    const existing = await this.getAppraisalGroup(id, createdById);
    if (!existing) {
      throw new Error('Appraisal Group not found or access denied');
    }

    // Delete all group members first
    await db
      .delete(appraisalGroupMembers)
      .where(eq(appraisalGroupMembers.appraisalGroupId, id));

    // Delete the group
    const result = await db
      .delete(appraisalGroups)
      .where(eq(appraisalGroups.id, id));
    
    if (result.rowCount === 0) {
      throw new Error('Appraisal Group not found or access denied');
    }
  }

  // Appraisal Group Member operations
  async getAppraisalGroupMembers(groupId: string, createdById: string): Promise<(AppraisalGroupMember & { user: SafeUser | null })[]> {
    // Verify the group belongs to the HR Manager
    const group = await this.getAppraisalGroup(groupId, createdById);
    if (!group) {
      throw new Error('Appraisal Group not found or access denied');
    }

    const results = await db.select({
        member: appraisalGroupMembers,
        user: users,
      })
      .from(appraisalGroupMembers)
      .leftJoin(users, eq(appraisalGroupMembers.userId, users.id))
      .where(eq(appraisalGroupMembers.appraisalGroupId, groupId))
      .orderBy(desc(appraisalGroupMembers.addedAt));
    
    return results.map(record => ({
      ...record.member,
      user: record.user ? sanitizeUser(record.user) : null
    }));
  }

  async addAppraisalGroupMember(member: InsertAppraisalGroupMember, createdById: string): Promise<AppraisalGroupMember> {
    // Verify the group belongs to the HR Manager
    const group = await this.getAppraisalGroup(member.appraisalGroupId, createdById);
    if (!group) {
      throw new Error('Appraisal Group not found or access denied');
    }

    // Verify the user exists and is active
    const user = await this.getUser(member.userId);
    if (!user || user.status !== 'active') {
      throw new Error('User not found or inactive');
    }

    // Check if user is already in the group
    const [existing] = await db.select()
      .from(appraisalGroupMembers)
      .where(and(
        eq(appraisalGroupMembers.appraisalGroupId, member.appraisalGroupId),
        eq(appraisalGroupMembers.userId, member.userId)
      ));
    
    if (existing) {
      throw new Error('User is already a member of this group');
    }

    const [newMember] = await db.insert(appraisalGroupMembers).values({
      ...member,
      addedById: createdById,
    }).returning();
    
    if (!newMember) {
      throw new Error('Failed to add group member');
    }
    return newMember;
  }

  async removeAppraisalGroupMember(groupId: string, userId: string, createdById: string): Promise<void> {
    // Verify the group belongs to the HR Manager
    const group = await this.getAppraisalGroup(groupId, createdById);
    if (!group) {
      throw new Error('Appraisal Group not found or access denied');
    }

    const result = await db
      .delete(appraisalGroupMembers)
      .where(and(
        eq(appraisalGroupMembers.appraisalGroupId, groupId),
        eq(appraisalGroupMembers.userId, userId)
      ));
    
    if (result.rowCount === 0) {
      throw new Error('Group member not found');
    }
  }

  async getAppraisalGroupsWithMembers(createdById: string): Promise<(AppraisalGroup & { members: SafeUser[] })[]> {
    const groups = await this.getAppraisalGroups(createdById);
    
    const groupsWithMembers = await Promise.all(
      groups.map(async (group) => {
        const memberRecords = await db
          .select({
            user: users,
          })
          .from(appraisalGroupMembers)
          .leftJoin(users, eq(appraisalGroupMembers.userId, users.id))
          .where(and(
            eq(appraisalGroupMembers.appraisalGroupId, group.id),
            eq(users.status, 'active')
          ))
          .orderBy(asc(users.firstName), asc(users.lastName));

        const members = memberRecords
          .filter(record => record.user !== null)
          .map(record => sanitizeUser(record.user!));

        return {
          ...group,
          members,
        };
      })
    );
    
    return groupsWithMembers;
  }

  async createInitiatedAppraisal(appraisalData: any, createdById: string): Promise<any> {
    // Verify the appraisal group exists and belongs to the HR manager
    const group = await this.getAppraisalGroup(appraisalData.appraisalGroupId, createdById);
    if (!group) {
      throw new Error('Appraisal group not found or access denied');
    }

    // Additional validations
    if (appraisalData.questionnaireTemplateIds && appraisalData.questionnaireTemplateIds.length > 0) {
      // Validate each questionnaire template exists and belongs to the user
      for (const templateId of appraisalData.questionnaireTemplateIds) {
        const template = await this.getQuestionnaireTemplate(templateId, createdById);
        if (!template) {
          throw new Error(`Questionnaire template ${templateId} not found or access denied`);
        }
      }
    }

    // Insert the initiated appraisal
    const [newAppraisal] = await db.insert(initiatedAppraisals).values({
      appraisalGroupId: appraisalData.appraisalGroupId,
      appraisalType: appraisalData.appraisalType,
      questionnaireTemplateIds: appraisalData.questionnaireTemplateIds || [],
      documentUrl: appraisalData.documentUrl,
      frequencyCalendarId: appraisalData.frequencyCalendarId,
      daysToInitiate: appraisalData.daysToInitiate,
      daysToClose: appraisalData.daysToClose,
      numberOfReminders: appraisalData.numberOfReminders,
      excludeTenureLessThanYear: appraisalData.excludeTenureLessThanYear,
      excludedEmployeeIds: appraisalData.excludedEmployeeIds,
      status: 'draft',
      makePublic: appraisalData.makePublic,
      publishType: appraisalData.publishType,
      createdById: createdById,
    }).returning();

    if (!newAppraisal) {
      throw new Error('Failed to create initiated appraisal');
    }
    
    // If calendar detail timings are provided, save them
    if (appraisalData.calendarDetailTimings && Array.isArray(appraisalData.calendarDetailTimings)) {
      const timingPromises = appraisalData.calendarDetailTimings.map((timing: any) => 
        this.createInitiatedAppraisalDetailTiming({
          initiatedAppraisalId: newAppraisal.id,
          frequencyCalendarDetailId: timing.detailId,
          daysToInitiate: timing.daysToInitiate || 0,
          daysToClose: timing.daysToClose || 30,
          numberOfReminders: timing.numberOfReminders || 3,
        })
      );
      
      try {
        await Promise.all(timingPromises);
      } catch (error) {
        console.error('Error saving calendar detail timings:', error);
        // Continue execution but log the error
      }
    }
    
    return newAppraisal;
  }

  async updateInitiatedAppraisalStatus(id: string, status: string): Promise<void> {
    await db.update(initiatedAppraisals)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(initiatedAppraisals.id, id));
  }

  async createInitiatedAppraisalDetailTiming(timing: InsertInitiatedAppraisalDetailTiming): Promise<InitiatedAppraisalDetailTiming> {
    const [newTiming] = await db.insert(initiatedAppraisalDetailTimings).values(timing).returning();
    return newTiming;
  }

  async getInitiatedAppraisalDetailTimings(appraisalId: string): Promise<InitiatedAppraisalDetailTiming[]> {
    return await db.select().from(initiatedAppraisalDetailTimings).where(
      eq(initiatedAppraisalDetailTimings.initiatedAppraisalId, appraisalId)
    ).orderBy(asc(initiatedAppraisalDetailTimings.createdAt));
  }

  async getInitiatedAppraisal(id: string): Promise<InitiatedAppraisal | null> {
    const [appraisal] = await db.select().from(initiatedAppraisals).where(eq(initiatedAppraisals.id, id));
    return appraisal || null;
  }

  async getInitiatedAppraisals(createdById: string): Promise<(InitiatedAppraisal & { progress?: any })[]> {
    return await db
      .select({
        initiatedAppraisal: initiatedAppraisals,
        appraisalGroup: appraisalGroups,
      })
      .from(initiatedAppraisals)
      .leftJoin(appraisalGroups, eq(initiatedAppraisals.appraisalGroupId, appraisalGroups.id))
      .where(eq(initiatedAppraisals.createdById, createdById))
      .orderBy(desc(initiatedAppraisals.createdAt))
      .then(async results => {
        const appraisalsWithProgress = await Promise.all(
          results.map(async result => {
            const appraisal = {
              ...result.initiatedAppraisal,
              appraisalGroup: result.appraisalGroup,
            };

            // Get progress data for this appraisal
            const progressData = await this.getAppraisalProgress(appraisal.id, appraisal.appraisalGroupId);
            
            return {
              ...appraisal,
              progress: progressData,
            };
          })
        );
        
        return appraisalsWithProgress;
      });
  }

  async getAppraisalProgress(appraisalId: string, appraisalGroupId: string): Promise<any> {
    // Get all members of the appraisal group
    const members = await db
      .select({
        user: users,
      })
      .from(appraisalGroupMembers)
      .leftJoin(users, eq(appraisalGroupMembers.userId, users.id))
      .where(and(
        eq(appraisalGroupMembers.appraisalGroupId, appraisalGroupId),
        eq(users.status, 'active')
      ));

    if (members.length === 0) {
      return {
        totalEmployees: 0,
        completedEvaluations: 0,
        percentage: 0,
        employeeProgress: [],
      };
    }

    const memberUsers = members.filter(m => m.user !== null).map(m => m.user!);
    
    // Get evaluations for these employees
    // Note: This is a simplified approach - in a real system, you'd need to link
    // initiated appraisals to review cycles or have a direct relationship
    const employeeIds = memberUsers.map(user => user.id);
    
    // Get the initiated appraisal details to filter evaluations by date
    const initiatedAppraisal = await db
      .select()
      .from(initiatedAppraisals)
      .where(eq(initiatedAppraisals.id, appraisalId))
      .limit(1);

    if (initiatedAppraisal.length === 0) {
      return {
        totalEmployees: memberUsers.length,
        completedEvaluations: 0,
        percentage: 0,
        employeeProgress: memberUsers.map(user => ({
          employee: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            designation: user.designation,
            department: user.department,
            locationId: user.locationId,
            levelId: user.levelId,
            gradeId: user.gradeId,
          },
          evaluation: null,
          status: 'not_started',
          isCompleted: false,
        })),
      };
    }

    // Get evaluations for these employees that are directly linked to this initiated appraisal
    // Include manager information
    const memberEvaluationsWithManagers = await db
      .select({
        evaluation: evaluations,
        manager: users,
      })
      .from(evaluations)
      .leftJoin(users, eq(evaluations.managerId, users.id))
      .where(
        and(
          inArray(evaluations.employeeId, employeeIds),
          eq(evaluations.initiatedAppraisalId, appraisalId)
        )
      );

    // Group evaluations by employee
    const evaluationsByEmployee = new Map();
    memberEvaluationsWithManagers.forEach(result => {
      if (!evaluationsByEmployee.has(result.evaluation.employeeId)) {
        evaluationsByEmployee.set(result.evaluation.employeeId, []);
      }
      // Combine evaluation with manager info
      evaluationsByEmployee.get(result.evaluation.employeeId).push({
        ...result.evaluation,
        manager: result.manager ? {
          id: result.manager.id,
          firstName: result.manager.firstName,
          lastName: result.manager.lastName,
          email: result.manager.email,
        } : null,
      });
    });

    // Calculate progress for each employee
    const employeeProgress = memberUsers.map(user => {
      const userEvaluations = evaluationsByEmployee.get(user.id) || [];
      const latestEvaluation = userEvaluations
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      return {
        employee: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          designation: user.designation,
          department: user.department,
          locationId: user.locationId,
          levelId: user.levelId,
          gradeId: user.gradeId,
        },
        evaluation: latestEvaluation,
        status: latestEvaluation?.status || 'not_started',
        isCompleted: latestEvaluation?.status === 'completed',
      };
    });

    const completedCount = employeeProgress.filter(ep => ep.isCompleted).length;
    const percentage = memberUsers.length > 0 ? Math.round((completedCount / memberUsers.length) * 100) : 0;

    return {
      totalEmployees: memberUsers.length,
      completedEvaluations: completedCount,
      percentage,
      employeeProgress,
    };
  }

  // Scheduled Appraisal Task operations
  async createScheduledAppraisalTask(task: InsertScheduledAppraisalTask): Promise<ScheduledAppraisalTask> {
    const [newTask] = await db.insert(scheduledAppraisalTasks).values(task).returning();
    return newTask;
  }

  async getPendingScheduledTasks(): Promise<ScheduledAppraisalTask[]> {
    return await db
      .select()
      .from(scheduledAppraisalTasks)
      .where(
        and(
          eq(scheduledAppraisalTasks.status, 'pending'),
          sql`${scheduledAppraisalTasks.scheduledDate} <= NOW()`
        )
      )
      .orderBy(asc(scheduledAppraisalTasks.scheduledDate));
  }

  async updateScheduledTaskStatus(id: string, status: string, error?: string): Promise<void> {
    await db.update(scheduledAppraisalTasks)
      .set({ 
        status, 
        executedAt: new Date(),
        error: error || null,
        updatedAt: new Date() 
      })
      .where(eq(scheduledAppraisalTasks.id, id));
  }

  async getScheduledTasksByAppraisal(appraisalId: string): Promise<ScheduledAppraisalTask[]> {
    return await db
      .select()
      .from(scheduledAppraisalTasks)
      .where(eq(scheduledAppraisalTasks.initiatedAppraisalId, appraisalId))
      .orderBy(asc(scheduledAppraisalTasks.scheduledDate));
  }

  // Development Goal operations
  async getDevelopmentGoals(employeeId: string): Promise<DevelopmentGoal[]> {
    return await db
      .select()
      .from(developmentGoals)
      .where(eq(developmentGoals.employeeId, employeeId))
      .orderBy(desc(developmentGoals.createdAt));
  }

  async getDevelopmentGoalsByEvaluation(evaluationId: string): Promise<DevelopmentGoal[]> {
    return await db
      .select()
      .from(developmentGoals)
      .where(eq(developmentGoals.evaluationId, evaluationId))
      .orderBy(desc(developmentGoals.createdAt));
  }

  async getDevelopmentGoal(id: string): Promise<DevelopmentGoal | undefined> {
    const [goal] = await db
      .select()
      .from(developmentGoals)
      .where(eq(developmentGoals.id, id));
    return goal;
  }

  async createDevelopmentGoal(goal: InsertDevelopmentGoal): Promise<DevelopmentGoal> {
    // Calculate initial status based on target date and progress
    const status = this.calculateGoalStatus(goal.progress || 0, goal.targetDate);
    
    const [newGoal] = await db
      .insert(developmentGoals)
      .values({
        ...goal,
        status,
      })
      .returning();
    return newGoal;
  }

  async updateDevelopmentGoal(id: string, goal: UpdateDevelopmentGoal): Promise<DevelopmentGoal> {
    // Get current goal to calculate status if progress is being updated
    const currentGoal = await this.getDevelopmentGoal(id);
    if (!currentGoal) {
      throw new Error('Development goal not found');
    }

    const progress = goal.progress ?? currentGoal.progress ?? 0;
    const targetDate = goal.targetDate ?? currentGoal.targetDate;
    const status = this.calculateGoalStatus(progress, targetDate);

    const [updatedGoal] = await db
      .update(developmentGoals)
      .set({
        ...goal,
        status,
        updatedAt: new Date(),
      })
      .where(eq(developmentGoals.id, id))
      .returning();
    return updatedGoal;
  }

  async deleteDevelopmentGoal(id: string): Promise<void> {
    await db.delete(developmentGoals).where(eq(developmentGoals.id, id));
  }

  // Helper function to calculate goal status based on progress and target date
  private calculateGoalStatus(progress: number, targetDate: Date): 'on_track' | 'delayed' | 'completed' | 'not_started' {
    if (progress >= 100) {
      return 'completed';
    }
    
    if (progress === 0) {
      return 'not_started';
    }
    
    const today = new Date();
    const target = new Date(targetDate);
    const totalDays = Math.ceil((target.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    // If target date has passed and not completed
    if (target < today) {
      return 'delayed';
    }
    
    // Calculate expected progress based on time elapsed
    // If we're past the target date or significantly behind, mark as delayed
    if (totalDays < 0 || (totalDays < 30 && progress < 50) || (totalDays < 7 && progress < 80)) {
      return 'delayed';
    }
    
    return 'on_track';
  }
}

export const storage = new DatabaseStorage();
