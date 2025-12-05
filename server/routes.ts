import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, requireRoles } from "./replitAuth";
import { z } from "zod";
import { 
  insertUserSchema,
  insertCompanySchema,
  insertLocationSchema,
  insertQuestionnaireTemplateSchema,
  insertReviewCycleSchema,
  insertEvaluationSchema,
  insertEmailTemplateSchema,
  insertEmailConfigSchema,
  insertRegistrationSchema,
  insertLevelSchema,
  insertGradeSchema,
  insertDepartmentSchema,
  insertAppraisalCycleSchema,
  insertReviewFrequencySchema,
  insertFrequencyCalendarSchema,
  insertFrequencyCalendarDetailsSchema,
  insertPublishQuestionnaireSchema,
  insertAppraisalGroupSchema,
  insertAppraisalGroupMemberSchema,
  updateUserSchema,
  passwordUpdateSchema,
  sendReminderRequestSchema,
  insertDevelopmentGoalSchema,
  updateDevelopmentGoalSchema,
  type SafeUser,
} from "@shared/schema";
import { sendEmail, sendReviewInvitation, sendReviewReminder, sendReviewCompletion, generateRegistrationNotificationEmail, sendEmployeeSubmissionNotification } from "./emailService";
import { ObjectStorageService, parseObjectPath, signObjectURL } from "./objectStorage";
import { seedTestUsers, testUsers } from "./seedUsers";
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Public registration route (no authentication required)
  app.post('/api/registration', async (req, res) => {
    try {
      const registrationData = insertRegistrationSchema.parse(req.body);
      
      // Create registration record
      const registration = await storage.createRegistration(registrationData);
      
      // Send notification email to kiran.shetty@refur.app
      try {
        const { subject, html } = generateRegistrationNotificationEmail(
          registrationData.name,
          registrationData.companyName,
          registrationData.designation,
          registrationData.email,
          registrationData.mobile
        );
        
        await sendEmail({
          to: 'kiran.shetty@refur.app',
          subject,
          html
        });
        
        // Mark notification as sent
        await storage.updateRegistration(registration.id, { notificationSent: true });
      } catch (emailError) {
        console.error('Failed to send registration notification email:', emailError);
        // Don't fail the registration if email fails, just log it
      }
      
      res.status(201).json({ 
        message: 'Registration submitted successfully. We will contact you soon.',
        id: registration.id 
      });
    } catch (error) {
      console.error('Error processing registration:', error);
      res.status(500).json({ message: 'Failed to submit registration. Please try again later.' });
    }
  });

  // Company login route (no authentication required)
  app.post('/api/login/company', async (req, res) => {
    try {
      const { companyUrl, email, password } = req.body;
      
      if (!companyUrl || !email || !password) {
        return res.status(400).json({ message: 'Company URL, email, and password are required.' });
      }
      
      // 1. Find company by URL slug
      const normalizedUrl = companyUrl.toLowerCase().trim();
      const company = await storage.getCompanyByUrl(normalizedUrl);
      
      if (!company) {
        return res.status(400).json({ message: 'Invalid company URL. Please check your company URL and try again.' });
      }
      
      // 2. Find user by email and verify they belong to this company
      const user = await storage.getUserByEmail(email.toLowerCase());
      
      console.log(`Company login attempt - Email: ${email}, Company: ${normalizedUrl}, Company ID: ${company.id}`);
      console.log(`Found user:`, user ? `${user.email} (ID: ${user.id}, Company: ${user.companyId})` : 'Not found');
      console.log(`User has password hash:`, user ? (user.passwordHash ? 'YES' : 'NO') : 'N/A');
      
      // Verify user belongs to this company
      if (!user || user.companyId !== company.id) {
        console.log(`User company mismatch - Expected: ${company.id}, Got: ${user?.companyId}`);
        return res.status(401).json({ message: 'Invalid email or password, or user not found in this company.' });
      }
      
      // 3. Verify password
      if (!user.passwordHash) {
        return res.status(401).json({ message: 'Password not set for this account. Please contact your administrator.' });
      }
      
      const bcrypt = await import('bcrypt');
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }
      
      // 4. Create session (using Passport login mechanism)
      const userSession = {
        claims: {
          sub: user.id,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          profile_image_url: user.profileImageUrl
        },
        access_token: 'company-login-token', // Placeholder token for company login
        refresh_token: 'company-login-refresh', // Placeholder refresh token
        expires_at: Math.floor(Date.now() / 1000) + 86400 // 24 hours from now
      };
      
      // Use Passport's login mechanism to properly authenticate the user
      req.login(userSession, (err) => {
        if (err) {
          console.error('Error establishing session:', err);
          return res.status(500).json({ message: 'Login failed. Please try again later.' });
        }
        
        // 5. Return success with user data
        const { passwordHash, ...safeUser } = user;
        res.json({ 
          message: 'Login successful',
          user: safeUser,
          companyUrl: normalizedUrl
        });
      });
      
    } catch (error) {
      console.error('Error in company login:', error);
      res.status(500).json({ message: 'Login failed. Please try again later.' });
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Sanitize user object to exclude passwordHash
      const { passwordHash, ...safeUser } = user;
      
      // Include active role from session if available, otherwise use database role
      const activeRole = req.user.activeRole || user.role;
      res.json({ ...safeUser, activeRole, availableRoles: user.roles || [user.role] });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Role switching endpoint
  app.post('/api/auth/switch-role', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({ message: "Role is required" });
      }

      // Get current user data
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user has the requested role
      const availableRoles = user.roles || [user.role];
      if (!availableRoles.includes(role)) {
        return res.status(403).json({ 
          message: "You don't have permission to switch to this role",
          availableRoles 
        });
      }

      // Update session with new active role
      req.user.activeRole = role;
      
      // Save session
      req.session.save((err: any) => {
        if (err) {
          console.error('Error saving session after role switch:', err);
          return res.status(500).json({ message: 'Failed to switch role' });
        }

        // Return updated user data
        const { passwordHash, ...safeUser } = user;
        res.json({ 
          message: 'Role switched successfully',
          user: { ...safeUser, activeRole: role, availableRoles }
        });
      });
    } catch (error) {
      console.error("Error switching role:", error);
      res.status(500).json({ message: "Failed to switch role" });
    }
  });

  // Dashboard metrics - legacy endpoint
  app.get('/api/dashboard/metrics', isAuthenticated, async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const users = await storage.getUsers({}, requestingUserId);
      const evaluations = await storage.getEvaluations();
      const activeReviews = evaluations.filter(e => e.status === 'in_progress');
      const completed = evaluations.filter(e => e.status === 'completed');
      const pending = evaluations.filter(e => e.managerEvaluationData && !e.finalizedAt);

      const metrics = {
        totalEmployees: users.length,
        activeReviews: activeReviews.length,
        completionRate: evaluations.length > 0 ? Math.round((completed.length / evaluations.length) * 100) : 0,
        pendingApprovals: pending.length,
      };

      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  // Super Admin Dashboard Endpoints
  app.get('/api/dashboard/super-admin/metrics', isAuthenticated, requireRoles(['super_admin']), async (req: any, res) => {
    try {
      const companies = await storage.getCompanies();
      const allUsers = await storage.getUsers({}, req.user.claims.sub);
      const evaluations = await storage.getEvaluations();
      
      const metrics = {
        totalCompanies: companies.length,
        totalUsers: allUsers.length,
        activeCompanies: companies.filter(c => c.status === 'active').length,
        systemHealth: 98, // Placeholder - could be calculated based on system metrics
        recentSignups: companies.filter(c => {
          const createdAt = new Date(c.createdAt);
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return createdAt > monthAgo;
        }).length,
        systemAlerts: 0, // Placeholder
        storageUsage: 75, // Placeholder
        activeEvaluations: evaluations.filter(e => e.status === 'in_progress').length,
      };

      res.json(metrics);
    } catch (error) {
      console.error("Error fetching super admin metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  app.get('/api/dashboard/super-admin/companies', isAuthenticated, requireRoles(['super_admin']), async (req: any, res) => {
    try {
      const companies = await storage.getCompanies();
      const allUsers = await storage.getUsers({}, req.user.claims.sub);
      
      const companiesWithStats = companies.map(company => {
        const companyUsers = allUsers.filter(u => u.companyId === company.id);
        return {
          id: company.id,
          name: company.name,
          domain: company.domain || 'Unknown',
          userCount: companyUsers.length,
          status: company.status || 'active',
          planType: 'Enterprise', // Placeholder
        };
      });

      res.json(companiesWithStats);
    } catch (error) {
      console.error("Error fetching companies overview:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.get('/api/dashboard/super-admin/alerts', isAuthenticated, requireRoles(['super_admin']), async (req: any, res) => {
    try {
      // Mock alerts for now
      const alerts = [
        {
          id: '1',
          type: 'info',
          message: 'System backup completed successfully',
          timestamp: '2 hours ago',
        },
        {
          id: '2', 
          type: 'warning',
          message: 'High CPU usage detected on database server',
          timestamp: '1 day ago',
        },
      ];

      res.json(alerts);
    } catch (error) {
      console.error("Error fetching system alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  // Admin Dashboard Endpoints
  app.get('/api/dashboard/admin/metrics', isAuthenticated, requireRoles(['super_admin', 'admin']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const users = await storage.getUsers({}, requestingUserId);
      const departments = await storage.getDepartments();
      const locations = await storage.getLocations();
      const templates = await storage.getQuestionnaireTemplates(requestingUserId);
      
      const metrics = {
        totalEmployees: users.length,
        departments: departments.length,
        locations: locations.length,
        questionnaireTemplates: templates.length,
        configurationComplete: 85, // Placeholder - calculate based on setup completeness
        pendingSetups: 3, // Placeholder
        activeUsers: users.filter(u => u.status === 'active').length,
        systemIntegrations: 5, // Placeholder
      };

      res.json(metrics);
    } catch (error) {
      console.error("Error fetching admin metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  app.get('/api/dashboard/admin/setup-items', isAuthenticated, requireRoles(['super_admin', 'admin']), async (req: any, res) => {
    try {
      const departments = await storage.getDepartments();
      const locations = await storage.getLocations();
      const requestingUserId = req.user.claims.sub;
      const templates = await storage.getQuestionnaireTemplates(requestingUserId);
      
      const setupItems = [
        {
          id: '1',
          name: 'Configure Departments',
          status: departments.length > 0 ? 'completed' : 'pending',
          description: 'Set up organizational departments',
          priority: 'high',
        },
        {
          id: '2',
          name: 'Add Locations',
          status: locations.length > 0 ? 'completed' : 'pending',
          description: 'Configure office locations',
          priority: 'medium',
        },
        {
          id: '3',
          name: 'Create Questionnaire Templates',
          status: templates.length > 0 ? 'completed' : 'pending',
          description: 'Build evaluation questionnaires',
          priority: 'high',
        },
        {
          id: '4',
          name: 'Email Service Configuration',
          status: 'pending',
          description: 'Configure SMTP settings',
          priority: 'medium',
        },
      ];

      res.json(setupItems);
    } catch (error) {
      console.error("Error fetching setup items:", error);
      res.status(500).json({ message: "Failed to fetch setup items" });
    }
  });

  app.get('/api/dashboard/admin/departments', isAuthenticated, requireRoles(['super_admin', 'admin']), async (req: any, res) => {
    try {
      const departments = await storage.getDepartments();
      const requestingUserId = req.user.claims.sub;
      const users = await storage.getUsers({}, requestingUserId);
      
      const departmentStats = departments.map(dept => {
        const deptUsers = users.filter(u => u.departmentId === dept.id);
        const managers = deptUsers.filter(u => u.role === 'manager');
        
        return {
          id: dept.id,
          name: dept.name,
          employeeCount: deptUsers.length,
          managersCount: managers.length,
          completionRate: Math.floor(Math.random() * 40) + 60, // Placeholder
        };
      });

      res.json(departmentStats);
    } catch (error) {
      console.error("Error fetching department stats:", error);
      res.status(500).json({ message: "Failed to fetch department stats" });
    }
  });

  // HR Manager Dashboard Endpoints
  app.get('/api/dashboard/hr-manager/metrics', isAuthenticated, requireRoles(['super_admin', 'admin', 'hr_manager']), async (req: any, res) => {
    try {
      const initiatedAppraisals = await storage.getInitiatedAppraisals();
      const evaluations = await storage.getEvaluations();
      const activeAppraisals = initiatedAppraisals.filter(a => a.status === 'active');
      
      const totalEmployeesInCycle = activeAppraisals.reduce((sum, appraisal) => 
        sum + (appraisal.employeeIds?.length || 0), 0);
      
      const completedEvaluations = evaluations.filter(e => e.status === 'completed');
      const pendingEvaluations = evaluations.filter(e => e.status === 'in_progress');
      const overdueEvaluations = evaluations.filter(e => {
        // Simple logic for overdue - in reality would check actual dates
        return e.status === 'in_progress' && Math.random() < 0.1;
      });
      
      const metrics = {
        activeAppraisalCycles: activeAppraisals.length,
        totalEmployeesInCycle,
        completionRate: evaluations.length > 0 ? 
          Math.round((completedEvaluations.length / evaluations.length) * 100) : 0,
        pendingEvaluations: pendingEvaluations.length,
        overdueEvaluations: overdueEvaluations.length,
        upcomingDeadlines: pendingEvaluations.filter(e => Math.random() < 0.3).length,
        averageRating: 4.2, // Placeholder
        managerReviewsPending: evaluations.filter(e => 
          e.selfEvaluationData && !e.managerEvaluationData).length,
      };

      res.json(metrics);
    } catch (error) {
      console.error("Error fetching HR manager metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  app.get('/api/dashboard/hr-manager/cycles', isAuthenticated, requireRoles(['super_admin', 'admin', 'hr_manager']), async (req: any, res) => {
    try {
      const initiatedAppraisals = await storage.getInitiatedAppraisals();
      
      const cycles = initiatedAppraisals.map(appraisal => ({
        id: appraisal.id,
        name: appraisal.displayName || 'Appraisal Cycle',
        startDate: appraisal.publishedAt ? 
          (typeof appraisal.publishedAt === 'string' ? 
            appraisal.publishedAt.split('T')[0] : 
            new Date(appraisal.publishedAt).toISOString().split('T')[0]) : 'N/A',
        endDate: 'TBD', // Would need end date field
        status: appraisal.status,
        employeeCount: appraisal.employeeIds?.length || 0,
        completionPercentage: Math.floor(Math.random() * 40) + 40,
        overdueCount: Math.floor(Math.random() * 3),
      }));

      res.json(cycles);
    } catch (error) {
      console.error("Error fetching appraisal cycles:", error);
      res.status(500).json({ message: "Failed to fetch cycles" });
    }
  });

  app.get('/api/dashboard/hr-manager/group-progress', isAuthenticated, requireRoles(['super_admin', 'admin', 'hr_manager']), async (req: any, res) => {
    try {
      const appraisalGroups = await storage.getAppraisalGroups();
      
      const groupProgress = appraisalGroups.map(group => ({
        id: group.id,
        name: group.displayName || 'Appraisal Group',
        employeeCount: Math.floor(Math.random() * 20) + 5,
        selfCompleted: Math.floor(Math.random() * 15) + 3,
        managerCompleted: Math.floor(Math.random() * 10) + 2,
        overallProgress: Math.floor(Math.random() * 40) + 50,
        deadline: '2024-01-31',
      }));

      res.json(groupProgress);
    } catch (error) {
      console.error("Error fetching group progress:", error);
      res.status(500).json({ message: "Failed to fetch group progress" });
    }
  });

  app.get('/api/dashboard/hr-manager/deadlines', isAuthenticated, requireRoles(['super_admin', 'admin', 'hr_manager']), async (req: any, res) => {
    try {
      const evaluations = await storage.getEvaluations();
      const requestingUserId = req.user.claims.sub;
      const users = await storage.getUsers({}, requestingUserId);
      
      const pendingEvaluations = evaluations.filter(e => e.status === 'in_progress');
      
      const upcomingDeadlines = pendingEvaluations.slice(0, 10).map(evaluation => {
        const employee = users.find(u => u.id === evaluation.employeeId);
        const daysRemaining = Math.floor(Math.random() * 10) + 1;
        
        return {
          id: evaluation.id,
          employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown',
          evaluationType: evaluation.selfEvaluationData ? 'manager' : 'self',
          dueDate: 'Jan 31, 2024',
          daysRemaining,
          priority: daysRemaining <= 2 ? 'high' : daysRemaining <= 5 ? 'medium' : 'low',
        };
      });

      res.json(upcomingDeadlines);
    } catch (error) {
      console.error("Error fetching upcoming deadlines:", error);
      res.status(500).json({ message: "Failed to fetch deadlines" });
    }
  });

  // Manager Dashboard Endpoints
  app.get('/api/dashboard/manager/metrics', isAuthenticated, requireRoles(['super_admin', 'admin', 'manager']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const users = await storage.getUsers({}, requestingUserId);
      
      // Get evaluations where user is the manager
      const managerEvaluations = await storage.getEvaluations({ managerId: requestingUserId });
      
      // Get direct reports (users who report to this manager)
      const directReports = users.filter(u => u.reportingManagerId === requestingUserId);
      const directReportIds = directReports.map(u => u.id);
      
      // Get evaluations for direct reports (where this user is the manager)
      const teamEvaluations = managerEvaluations.filter(e => 
        directReportIds.includes(e.employeeId));
      
      const pendingReviews = managerEvaluations.filter(e => 
        e.selfEvaluationSubmittedAt && !e.managerEvaluationSubmittedAt);
      const completedReviews = managerEvaluations.filter(e => 
        e.managerEvaluationSubmittedAt);
      
      // Calculate actual scheduled meetings (scheduled but not completed)
      const scheduledMeetings = managerEvaluations.filter(e => 
        e.meetingScheduledAt && !e.meetingCompletedAt);
      
      // Calculate completed meetings
      const meetingsCompleted = managerEvaluations.filter(e => 
        e.meetingCompletedAt);
      
      // Calculate average rating from completed evaluations
      const ratingsWithValues = managerEvaluations
        .filter(e => e.overallRating !== null && e.overallRating !== undefined)
        .map(e => e.overallRating as number);
      const teamAverageRating = ratingsWithValues.length > 0 
        ? ratingsWithValues.reduce((sum, r) => sum + r, 0) / ratingsWithValues.length 
        : 0;
      
      const metrics = {
        directReports: directReports.length,
        pendingReviews: pendingReviews.length,
        completedReviews: completedReviews.length,
        scheduledMeetings: scheduledMeetings.length,
        overdueReviews: 0,
        teamAverageRating: Number(teamAverageRating.toFixed(1)),
        meetingsCompleted: meetingsCompleted.length,
        teamCompletionRate: managerEvaluations.length > 0 ? 
          Math.round((completedReviews.length / managerEvaluations.length) * 100) : 0,
      };

      res.json(metrics);
    } catch (error) {
      console.error("Error fetching manager metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  app.get('/api/dashboard/manager/direct-reports', isAuthenticated, requireRoles(['super_admin', 'admin', 'manager']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const users = await storage.getUsers({}, requestingUserId);
      const evaluations = await storage.getEvaluations();
      
      const directReports = users.filter(u => u.managerId === requestingUserId);
      
      const reportsWithStatus = directReports.map(report => {
        const userEvaluations = evaluations.filter(e => e.employeeId === report.id);
        const latestEvaluation = userEvaluations[0]; // Assuming latest first
        
        return {
          id: report.id,
          name: `${report.firstName} ${report.lastName}`,
          position: report.position || 'Employee',
          selfEvaluationStatus: latestEvaluation?.selfEvaluationData ? 'completed' : 
            Math.random() < 0.2 ? 'overdue' : 'pending',
          managerReviewStatus: latestEvaluation?.managerEvaluationData ? 'completed' :
            latestEvaluation?.selfEvaluationData ? 'pending' : 'not_started',
          meetingStatus: Math.random() < 0.3 ? 'completed' : 
            Math.random() < 0.5 ? 'scheduled' : 'not_scheduled',
          dueDate: '2024-01-31',
          rating: latestEvaluation?.managerEvaluationData ? 
            Math.floor(Math.random() * 2) + 4 : undefined,
        };
      });

      res.json(reportsWithStatus);
    } catch (error) {
      console.error("Error fetching direct reports:", error);
      res.status(500).json({ message: "Failed to fetch direct reports" });
    }
  });

  app.get('/api/dashboard/manager/meetings', isAuthenticated, requireRoles(['super_admin', 'admin', 'manager']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const users = await storage.getUsers({}, requestingUserId);
      const directReports = users.filter(u => u.managerId === requestingUserId);
      
      // Mock upcoming meetings
      const upcomingMeetings = directReports.slice(0, 5).map((report, index) => ({
        id: `meeting-${index}`,
        employeeName: `${report.firstName} ${report.lastName}`,
        date: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        time: ['10:00 AM', '2:00 PM', '11:30 AM', '3:30 PM', '9:00 AM'][index],
        duration: [30, 45, 60, 30, 45][index],
        location: index % 2 === 0 ? 'Conference Room A' : 'Video Call',
        type: 'performance_review',
        status: Math.random() < 0.7 ? 'confirmed' : 'scheduled',
      }));

      res.json(upcomingMeetings);
    } catch (error) {
      console.error("Error fetching manager meetings:", error);
      res.status(500).json({ message: "Failed to fetch meetings" });
    }
  });

  app.get('/api/dashboard/manager/team-metrics', isAuthenticated, requireRoles(['super_admin', 'admin', 'manager']), async (req: any, res) => {
    try {
      const teamMetrics = [
        {
          metric: 'Avg Performance Rating',
          current: 4.2,
          previous: 4.0,
          trend: 'up',
          unit: 'rating',
        },
        {
          metric: 'Review Completion',
          current: 85,
          previous: 78,
          trend: 'up',
          unit: 'percentage',
        },
        {
          metric: 'Goal Achievement',
          current: 92,
          previous: 95,
          trend: 'down',
          unit: 'percentage',
        },
        {
          metric: 'Team Engagement',
          current: 88,
          previous: 88,
          trend: 'stable',
          unit: 'percentage',
        },
      ];

      res.json(teamMetrics);
    } catch (error) {
      console.error("Error fetching team metrics:", error);
      res.status(500).json({ message: "Failed to fetch team metrics" });
    }
  });

  // Employee Dashboard Endpoints
  app.get('/api/dashboard/employee/metrics', isAuthenticated, requireRoles(['super_admin', 'admin', 'hr_manager', 'manager', 'employee']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const evaluations = await storage.getEvaluations();
      
      const userEvaluations = evaluations.filter(e => e.employeeId === requestingUserId);
      const completedEvaluations = userEvaluations.filter(e => e.status === 'completed');
      const pendingEvaluations = userEvaluations.filter(e => e.status === 'in_progress');
      const overdueEvaluations = userEvaluations.filter(e => 
        e.status === 'in_progress' && Math.random() < 0.1);
      
      // Calculate average rating from completed evaluations
      const ratingsSum = completedEvaluations.reduce((sum, evaluation) => {
        // Mock rating calculation
        return sum + (Math.floor(Math.random() * 2) + 4);
      }, 0);
      const averageRating = completedEvaluations.length > 0 ? 
        ratingsSum / completedEvaluations.length : 0;
      
      const metrics = {
        totalEvaluations: userEvaluations.length,
        completedEvaluations: completedEvaluations.length,
        pendingEvaluations: pendingEvaluations.length,
        overdueEvaluations: overdueEvaluations.length,
        averageRating,
        lastEvaluationDate: completedEvaluations.length > 0 && completedEvaluations[0].submittedAt ? 
          (typeof completedEvaluations[0].submittedAt === 'string' ? 
            completedEvaluations[0].submittedAt.split('T')[0] : 
            new Date(completedEvaluations[0].submittedAt).toISOString().split('T')[0]) : 'N/A',
        nextDeadline: pendingEvaluations.length > 0 ? '2024-01-31' : 'None',
        improvementGoals: Math.floor(Math.random() * 5) + 2,
      };

      res.json(metrics);
    } catch (error) {
      console.error("Error fetching employee metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  app.get('/api/dashboard/employee/evaluations', isAuthenticated, requireRoles(['super_admin', 'admin', 'hr_manager', 'manager', 'employee']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const evaluations = await storage.getEvaluations();
      const users = await storage.getUsers({}, requestingUserId);
      
      const userEvaluations = evaluations.filter(e => e.employeeId === requestingUserId);
      
      const evaluationHistory = userEvaluations.map(evaluation => {
        const manager = users.find(u => u.id === evaluation.managerId);
        
        return {
          id: evaluation.id,
          period: 'Q4 2023', // Mock period
          type: 'self',
          status: evaluation.status === 'completed' ? 'completed' : 
            Math.random() < 0.1 ? 'overdue' : 'pending',
          dueDate: '2024-01-31',
          submittedDate: evaluation.submittedAt ? 
            (typeof evaluation.submittedAt === 'string' ? 
              evaluation.submittedAt.split('T')[0] : 
              new Date(evaluation.submittedAt).toISOString().split('T')[0]) : undefined,
          rating: evaluation.status === 'completed' ? 
            Math.floor(Math.random() * 2) + 4 : undefined,
          managerName: manager ? `${manager.firstName} ${manager.lastName}` : undefined,
          managerFeedback: evaluation.managerEvaluationData ? 'Feedback provided' : undefined,
        };
      });

      res.json(evaluationHistory);
    } catch (error) {
      console.error("Error fetching employee evaluations:", error);
      res.status(500).json({ message: "Failed to fetch evaluations" });
    }
  });

  app.get('/api/dashboard/employee/tasks', isAuthenticated, requireRoles(['super_admin', 'admin', 'hr_manager', 'manager', 'employee']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const evaluations = await storage.getEvaluations();
      
      const userEvaluations = evaluations.filter(e => e.employeeId === requestingUserId);
      const pendingEvaluations = userEvaluations.filter(e => e.status === 'in_progress');
      
      const upcomingTasks = pendingEvaluations.map((evaluation, index) => ({
        id: evaluation.id,
        title: 'Complete Self-Evaluation',
        type: 'evaluation',
        dueDate: '2024-01-31',
        priority: index < 2 ? 'high' : 'medium',
        description: 'Complete your quarterly performance self-evaluation',
        status: 'pending',
      }));

      // Add some mock additional tasks
      upcomingTasks.push(
        {
          id: 'goal-1',
          title: 'Update Development Goals',
          type: 'goal',
          dueDate: '2024-02-15',
          priority: 'medium',
          description: 'Review and update your professional development goals',
          status: 'pending',
        },
        {
          id: 'meeting-1',
          title: 'One-on-One with Manager',
          type: 'meeting',
          dueDate: '2024-01-25',
          priority: 'high',
          description: 'Quarterly performance review meeting',
          status: 'pending',
        }
      );

      res.json(upcomingTasks);
    } catch (error) {
      console.error("Error fetching employee tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.get('/api/dashboard/employee/goals', isAuthenticated, requireRoles(['super_admin', 'admin', 'hr_manager', 'manager', 'employee']), async (req: any, res) => {
    try {
      const employeeId = req.user.claims.sub;
      
      // Fetch real development goals from the database
      const developmentGoals = await storage.getDevelopmentGoals(employeeId);
      
      // Transform to match the dashboard format
      const goals = developmentGoals.map(goal => {
        // Calculate status based on progress and target date
        const now = new Date();
        const targetDate = new Date(goal.targetDate);
        const daysUntilTarget = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        let status = 'on_track';
        if (goal.progressPercentage === 100) {
          status = 'completed';
        } else if (daysUntilTarget < 0) {
          status = 'behind';
        } else if (daysUntilTarget < 14 && goal.progressPercentage < 75) {
          status = 'at_risk';
        } else if (daysUntilTarget < 30 && goal.progressPercentage < 50) {
          status = 'at_risk';
        }
        
        return {
          id: goal.id,
          title: goal.description.substring(0, 50) + (goal.description.length > 50 ? '...' : ''),
          description: goal.plannedOutcome || goal.description,
          progress: goal.progressPercentage,
          targetDate: new Date(goal.targetDate).toISOString().split('T')[0],
          status: status,
          category: 'development',
        };
      });

      res.json(goals);
    } catch (error) {
      console.error("Error fetching employee goals:", error);
      res.status(500).json({ message: "Failed to fetch goals" });
    }
  });

  // Company routes
  app.get('/api/companies', isAuthenticated, async (req, res) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.post('/api/companies', isAuthenticated, requireRoles(['super_admin', 'admin']), async (req, res) => {
    try {
      const companyData = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(companyData);
      res.status(201).json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  // Get current user's company (must be before :id routes)
  app.get('/api/companies/current', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.companyId) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      const company = await storage.getCompany(user.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      res.json(company);
    } catch (error) {
      console.error("Error fetching current company:", error);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  // Update company logo (must be before :id routes)
  app.put('/api/companies/current/logo', isAuthenticated, async (req: any, res) => {
    try {
      console.log('Logo update request - User:', req.user?.claims?.sub);
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Verify user is admin
      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({ message: "Only administrators can update company logo" });
      }
      
      if (!user.companyId) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      const { logoUrl } = req.body;
      if (!logoUrl || typeof logoUrl !== 'string') {
        return res.status(400).json({ message: "Logo URL is required" });
      }
      
      const updatedCompany = await storage.updateCompany(user.companyId, { logoUrl });
      res.json(updatedCompany);
    } catch (error) {
      console.error("Error updating company logo:", error);
      res.status(500).json({ message: "Failed to update company logo" });
    }
  });

  app.put('/api/companies/:id', isAuthenticated, requireRoles(['super_admin', 'admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const companyData = insertCompanySchema.partial().parse(req.body);
      const company = await storage.updateCompany(id, companyData);
      res.json(company);
    } catch (error) {
      console.error("Error updating company:", error);
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  app.delete('/api/companies/:id', isAuthenticated, requireRoles(['super_admin', 'admin']), async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCompany(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting company:", error);
      res.status(500).json({ message: "Failed to delete company" });
    }
  });

  // Location routes
  app.get('/api/locations', isAuthenticated, async (req, res) => {
    try {
      const locations = await storage.getLocations();
      res.json(locations);
    } catch (error) {
      console.error("Error fetching locations:", error);
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  app.post('/api/locations', isAuthenticated, requireRoles(['super_admin', 'admin']), async (req, res) => {
    try {
      const locationData = insertLocationSchema.parse(req.body);
      const location = await storage.createLocation(locationData);
      res.status(201).json(location);
    } catch (error) {
      console.error("Error creating location:", error);
      res.status(500).json({ message: "Failed to create location" });
    }
  });

  app.put('/api/locations/:id', isAuthenticated, requireRoles(['super_admin', 'admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const locationData = insertLocationSchema.partial().parse(req.body);
      const location = await storage.updateLocation(id, locationData);
      res.json(location);
    } catch (error) {
      console.error("Error updating location:", error);
      res.status(500).json({ message: "Failed to update location" });
    }
  });

  app.delete('/api/locations/:id', isAuthenticated, requireRoles(['super_admin', 'admin']), async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteLocation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting location:", error);
      res.status(500).json({ message: "Failed to delete location" });
    }
  });

  // User management routes
  app.get('/api/users', isAuthenticated, requireRoles(['super_admin', 'admin', 'hr_manager']), async (req: any, res) => {
    try {
      const { role, department, status } = req.query;
      const requestingUserId = req.user.claims.sub;
      
      // SECURITY: Get current user to check company restrictions for admins
      const currentUser = await storage.getUser(requestingUserId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // SECURITY: Reject administrators and HR managers without company assignment
      if ((currentUser.role === 'admin' || currentUser.role === 'hr_manager') && !currentUser.companyId) {
        return res.status(403).json({ 
          message: `${currentUser.role === 'admin' ? 'Administrator' : 'HR Manager'} must be assigned to a company before accessing user management.`
        });
      }
      
      const filters = {
        role: role as string,
        department: department as string,
        status: status as string,
      };
      // Storage layer will automatically filter by company for admins
      const users = await storage.getUsers(filters, requestingUserId);
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post('/api/users', isAuthenticated, requireRoles(['super_admin', 'admin']), async (req: any, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const creatorId = req.user.claims.sub;
      
      // Check for duplicates before creating user - more efficient individual checks
      const creator = await storage.getUser(creatorId);
      
      // SECURITY: Enforce company restriction for Administrators
      if (creator && creator.role === 'admin') {
        if (!creator.companyId) {
          return res.status(403).json({ 
            message: "Administrator must be assigned to a company before creating users."
          });
        }
        // Force the user to be created in the admin's company
        userData.companyId = creator.companyId;
      }
      
      // Check for duplicate email
      if (userData.email) {
        const existingEmailUser = await storage.getUserByEmail(userData.email);
        if (existingEmailUser) {
          // For admins, also check if it's in their company scope
          if (creator && creator.role === 'admin' && creator.companyId && existingEmailUser.companyId !== creator.companyId) {
            // Allow if it's a different company
          } else {
            return res.status(400).json({ 
              message: "Email address already exists. Please use a different email address.",
              field: "email"
            });
          }
        }
      }
      
      // Check for duplicate code  
      if (userData.code && userData.code.trim() !== '') {
        const existingCodeUser = await storage.getUserByCode(userData.code);
        if (existingCodeUser) {
          // For admins, also check if it's in their company scope
          if (creator && creator.role === 'admin' && creator.companyId && existingCodeUser.companyId !== creator.companyId) {
            // Allow if it's a different company
          } else {
            return res.status(400).json({ 
              message: "Employee code already exists. Please use a different code.",
              field: "code"
            });
          }
        }
      }
      
      // Check for duplicate mobile number
      if (userData.mobileNumber && userData.mobileNumber.trim() !== '') {
        const existingMobileUser = await storage.getUserByMobile(userData.mobileNumber);
        if (existingMobileUser) {
          // For admins, also check if it's in their company scope
          if (creator && creator.role === 'admin' && creator.companyId && existingMobileUser.companyId !== creator.companyId) {
            // Allow if it's a different company
          } else {
            return res.status(400).json({ 
              message: "Mobile number already exists. Please use a different mobile number.",
              field: "mobileNumber"
            });
          }
        }
      }
      
      const user = await storage.createUser(userData, creatorId);
      res.status(201).json(user);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put('/api/users/:id', isAuthenticated, requireRoles(['super_admin', 'admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const requestingUserId = req.user.claims.sub;
      const { password, confirmPassword, ...otherFields } = req.body;
      
      // SECURITY: Get current user and target user for company restriction check
      const currentUser = await storage.getUser(requestingUserId);
      const targetUser = await storage.getUser(id);
      
      if (!currentUser || !targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // SECURITY: Enforce company restriction for Administrators
      if (currentUser.role === 'admin') {
        if (!currentUser.companyId) {
          return res.status(403).json({ 
            message: "Administrator must be assigned to a company before updating users."
          });
        }
        // Verify target user belongs to admin's company
        if (targetUser.companyId !== currentUser.companyId) {
          return res.status(403).json({ 
            message: "Administrators can only manage users in their own company."
          });
        }
        // Force the user to stay in the admin's company (prevent company transfer)
        if (otherFields.companyId && otherFields.companyId !== currentUser.companyId) {
          otherFields.companyId = currentUser.companyId;
        }
      }
      
      // SECURITY: Detect if this is a password update vs a regular update
      const isPasswordUpdate = password || confirmPassword;
      
      if (isPasswordUpdate) {
        // Variables already declared above for company restriction check
        
        const isSuperAdmin = currentUser.role === 'super_admin';
        const isAdmin = currentUser.role === 'admin';
        const isUserCreatedByAdmin = targetUser.createdById !== null && targetUser.createdById === requestingUserId;
        const isTargetPrivileged = ['admin', 'super_admin'].includes(targetUser.role);
        
        // SECURITY: Allow password changes if:
        // 1. Super Admin (can change any password) OR
        // 2. Admin changing password of non-privileged user they created
        const canChangePassword = isSuperAdmin || (isAdmin && isUserCreatedByAdmin && !isTargetPrivileged);
        
        if (!canChangePassword) {
          const errorMessage = isSuperAdmin 
            ? "Password changes can only be performed by Super Administrators"
            : isAdmin
              ? isTargetPrivileged
                ? "Administrators cannot change passwords of other privileged users"
                : "Administrators can only change passwords of users they created"
              : "Insufficient privileges to change passwords";
              
          return res.status(403).json({ message: errorMessage });
        }
        
        // SECURITY: Validate password fields with dedicated schema
        const passwordData = passwordUpdateSchema.parse({ password, confirmPassword });
        
        // SECURITY: Validate other fields with update schema (strict mode)
        let otherData = {};
        if (Object.keys(otherFields).length > 0) {
          otherData = updateUserSchema.parse(otherFields);
        }
        
        // Combine validated data
        const userData = { ...otherData, ...passwordData };
        const user = await storage.updateUser(id, userData, requestingUserId);
        res.json(user);
      } else {
        // SECURITY: Regular update - validate with strict schema that excludes sensitive fields
        if (Object.keys(req.body).length === 0) {
          return res.status(400).json({ message: "No fields provided for update" });
        }
        
        // SECURITY: Use strict validation schema that rejects unknown keys
        const userData = updateUserSchema.parse(req.body);
        
        // SECURITY: Pass requesting user ID for role escalation protection
        const user = await storage.updateUser(id, userData, requestingUserId);
        res.json(user);
      }
    } catch (error) {
      console.error("Error updating user:", error);
      
      // SECURITY: Provide specific error messages for validation failures
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: (error as any).errors 
        });
      }
      
      // Handle authorization errors specifically
      if (error instanceof Error && (error.message?.includes('Super Administrators') || error.message?.includes('super_admin'))) {
        return res.status(403).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete('/api/users/:id', isAuthenticated, requireRoles(['super_admin', 'admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const requestingUserId = req.user.claims.sub;
      await storage.deleteUser(id, requestingUserId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      
      // Handle authorization errors specifically
      if (error instanceof Error && error.message?.includes('Forbidden')) {
        return res.status(403).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Bulk upload routes
  app.get('/api/users/bulk-upload/template', isAuthenticated, requireRoles(['super_admin', 'admin']), async (req: any, res) => {
    try {
      // Create sample template with headers and one example row
      const sampleData = [
        {
          'Email*': 'john.doe@example.com',
          'First Name*': 'John',
          'Last Name*': 'Doe',
          'Employee Code*': 'EMP001',
          'Designation': 'Software Engineer',
          'Department': 'Engineering',
          'Date of Joining (YYYY-MM-DD)*': '2024-01-15',
          'Mobile Number': '+1234567890',
          'Location ID': '',
          'Level ID': '',
          'Grade ID': '',
          'Reporting Manager ID': '',
          'Role': 'employee',
          'Status': 'active'
        }
      ];

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sampleData);

      // Set column widths
      ws['!cols'] = [
        { wch: 25 }, // Email
        { wch: 15 }, // First Name
        { wch: 15 }, // Last Name
        { wch: 15 }, // Employee Code
        { wch: 20 }, // Designation
        { wch: 15 }, // Department
        { wch: 25 }, // Date of Joining
        { wch: 15 }, // Mobile Number
        { wch: 30 }, // Location ID
        { wch: 30 }, // Level ID
        { wch: 30 }, // Grade ID
        { wch: 30 }, // Reporting Manager ID
        { wch: 15 }, // Role
        { wch: 10 }  // Status
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Users');

      // Generate buffer
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // Set response headers
      res.setHeader('Content-Disposition', 'attachment; filename=user_bulk_upload_template.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      
      res.send(buffer);
    } catch (error) {
      console.error("Error generating template:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  app.post('/api/users/bulk-upload', isAuthenticated, requireRoles(['super_admin', 'admin']), async (req: any, res) => {
    try {
      const { fileData } = req.body;
      
      if (!fileData) {
        return res.status(400).json({ message: "No file data provided" });
      }

      // Parse base64 file data
      const buffer = Buffer.from(fileData, 'base64');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      
      // Get first worksheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
      
      if (!jsonData || jsonData.length === 0) {
        return res.status(400).json({ message: "No data found in spreadsheet" });
      }

      const creatorId = req.user.claims.sub;
      const creator = await storage.getUser(creatorId);
      
      // Validate company restriction for administrators
      if (creator && creator.role === 'admin' && !creator.companyId) {
        return res.status(403).json({ 
          message: "Administrator must be assigned to a company before creating users."
        });
      }

      const results = {
        success: [] as any[],
        errors: [] as any[]
      };

      // Process each row
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNumber = i + 2; // Excel row number (accounting for header)

        try {
          // Map Excel columns to user data
          const userData: any = {
            email: row['Email*'],
            firstName: row['First Name*'],
            lastName: row['Last Name*'],
            code: row['Employee Code*'],
            designation: row['Designation'],
            department: row['Department'],
            dateOfJoining: row['Date of Joining (YYYY-MM-DD)*'] ? new Date(row['Date of Joining (YYYY-MM-DD)*']) : undefined,
            mobileNumber: row['Mobile Number'],
            locationId: row['Location ID'] || null,
            levelId: row['Level ID'] || null,
            gradeId: row['Grade ID'] || null,
            reportingManagerId: row['Reporting Manager ID'] || null,
            role: row['Role'] || 'employee',
            status: row['Status'] || 'active',
            createdById: creatorId
          };

          // Force company assignment for administrators
          if (creator && creator.role === 'admin') {
            userData.companyId = creator.companyId;
          }

          // Validate using schema
          const validatedData = insertUserSchema.parse(userData);

          // Check for duplicates
          if (validatedData.email) {
            const existingEmailUser = await storage.getUserByEmail(validatedData.email);
            if (existingEmailUser) {
              if (creator && creator.role === 'admin' && creator.companyId && existingEmailUser.companyId !== creator.companyId) {
                // Allow if different company
              } else {
                results.errors.push({
                  row: rowNumber,
                  email: validatedData.email,
                  error: "Email already exists"
                });
                continue;
              }
            }
          }

          if (validatedData.code) {
            const existingCodeUser = await storage.getUserByCode(validatedData.code);
            if (existingCodeUser) {
              if (creator && creator.role === 'admin' && creator.companyId && existingCodeUser.companyId !== creator.companyId) {
                // Allow if different company
              } else {
                results.errors.push({
                  row: rowNumber,
                  email: validatedData.email,
                  error: "Employee code already exists"
                });
                continue;
              }
            }
          }

          if (validatedData.mobileNumber) {
            const existingMobileUser = await storage.getUserByMobile(validatedData.mobileNumber);
            if (existingMobileUser) {
              if (creator && creator.role === 'admin' && creator.companyId && existingMobileUser.companyId !== creator.companyId) {
                // Allow if different company
              } else {
                results.errors.push({
                  row: rowNumber,
                  email: validatedData.email,
                  error: "Mobile number already exists"
                });
                continue;
              }
            }
          }

          // Create user
          const newUser = await storage.createUser(validatedData);
          results.success.push({
            row: rowNumber,
            email: validatedData.email,
            name: `${validatedData.firstName} ${validatedData.lastName}`
          });

        } catch (error) {
          console.error(`Error processing row ${rowNumber}:`, error);
          results.errors.push({
            row: rowNumber,
            email: row['Email*'],
            error: error instanceof Error ? error.message : "Validation failed"
          });
        }
      }

      res.json({
        message: "Bulk upload completed",
        summary: {
          total: jsonData.length,
          successful: results.success.length,
          failed: results.errors.length
        },
        results
      });

    } catch (error) {
      console.error("Error processing bulk upload:", error);
      res.status(500).json({ message: "Failed to process bulk upload" });
    }
  });

  // Questionnaire template routes
  app.get('/api/questionnaire-templates', isAuthenticated, async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const templates = await storage.getQuestionnaireTemplates(requestingUserId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching questionnaire templates:", error);
      res.status(500).json({ message: "Failed to fetch questionnaire templates" });
    }
  });

  app.post('/api/questionnaire-templates', isAuthenticated, requireRoles(['super_admin', 'admin', 'hr_manager']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const templateData = insertQuestionnaireTemplateSchema.parse(req.body);
      
      // Automatically set the createdById field to the requesting user
      templateData.createdById = requestingUserId;
      
      const template = await storage.createQuestionnaireTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating questionnaire template:", error);
      res.status(500).json({ message: "Failed to create questionnaire template" });
    }
  });

  app.get('/api/questionnaire-templates/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const requestingUserId = req.user.claims.sub;
      const template = await storage.getQuestionnaireTemplate(id, requestingUserId);
      if (!template) {
        return res.status(404).json({ message: "Questionnaire template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching questionnaire template:", error);
      res.status(500).json({ message: "Failed to fetch questionnaire template" });
    }
  });

  app.put('/api/questionnaire-templates/:id', isAuthenticated, requireRoles(['super_admin', 'admin', 'hr_manager']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const requestingUserId = req.user.claims.sub;
      
      const templateData = insertQuestionnaireTemplateSchema.partial().parse(req.body);
      const template = await storage.updateQuestionnaireTemplate(id, templateData, requestingUserId);
      res.json(template);
    } catch (error) {
      console.error("Error updating questionnaire template:", error);
      
      // Handle authorization errors specifically
      if (error instanceof Error && error.message?.includes('Forbidden')) {
        return res.status(403).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Failed to update questionnaire template" });
    }
  });

  app.delete('/api/questionnaire-templates/:id', isAuthenticated, requireRoles(['super_admin', 'admin', 'hr_manager']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const requestingUserId = req.user.claims.sub;
      
      await storage.deleteQuestionnaireTemplate(id, requestingUserId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting questionnaire template:", error);
      
      // Handle authorization errors specifically
      if (error instanceof Error && error.message?.includes('Forbidden')) {
        return res.status(403).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Failed to delete questionnaire template" });
    }
  });

  app.post('/api/questionnaire-templates/:id/copy', isAuthenticated, requireRoles(['super_admin', 'admin', 'hr_manager']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const requestingUserId = req.user.claims.sub;
      
      const copiedTemplate = await storage.copyQuestionnaireTemplate(id, requestingUserId);
      res.status(201).json(copiedTemplate);
    } catch (error) {
      console.error("Error copying questionnaire template:", error);
      
      // Handle authorization errors specifically
      if (error instanceof Error && (error.message?.includes('Forbidden') || error.message?.includes('Template not found'))) {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Failed to copy questionnaire template" });
    }
  });

  // Review cycle routes
  app.get('/api/review-cycles', isAuthenticated, async (req, res) => {
    try {
      const cycles = await storage.getReviewCycles();
      res.json(cycles);
    } catch (error) {
      console.error("Error fetching review cycles:", error);
      res.status(500).json({ message: "Failed to fetch review cycles" });
    }
  });

  app.get('/api/review-cycles/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const cycle = await storage.getReviewCycle(id);
      if (!cycle) {
        return res.status(404).json({ message: "Review cycle not found" });
      }
      res.json(cycle);
    } catch (error) {
      console.error("Error fetching review cycle:", error);
      res.status(500).json({ message: "Failed to fetch review cycle" });
    }
  });

  app.post('/api/review-cycles', isAuthenticated, requireRoles(['super_admin', 'admin', 'hr_manager']), async (req, res) => {
    try {
      const cycleData = insertReviewCycleSchema.parse(req.body);
      const cycle = await storage.createReviewCycle(cycleData);
      res.status(201).json(cycle);
    } catch (error) {
      console.error("Error creating review cycle:", error);
      res.status(500).json({ message: "Failed to create review cycle" });
    }
  });

  app.put('/api/review-cycles/:id', isAuthenticated, requireRoles(['super_admin', 'admin', 'hr_manager']), async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if review cycle exists
      const existingCycle = await storage.getReviewCycle(id);
      if (!existingCycle) {
        return res.status(404).json({ message: "Review cycle not found" });
      }
      
      const cycleData = insertReviewCycleSchema.partial().parse(req.body);
      const cycle = await storage.updateReviewCycle(id, cycleData);
      res.json(cycle);
    } catch (error) {
      console.error("Error updating review cycle:", error);
      res.status(500).json({ message: "Failed to update review cycle" });
    }
  });

  app.delete('/api/review-cycles/:id', isAuthenticated, requireRoles(['super_admin', 'admin', 'hr_manager']), async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if review cycle exists
      const existingCycle = await storage.getReviewCycle(id);
      if (!existingCycle) {
        return res.status(404).json({ message: "Review cycle not found" });
      }
      
      await storage.deleteReviewCycle(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting review cycle:", error);
      res.status(500).json({ message: "Failed to delete review cycle" });
    }
  });

  // Evaluation routes
  app.get('/api/evaluations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const { employeeId, managerId, reviewCycleId, status, includeQuestionnaires } = req.query;
      let filters = {
        employeeId: employeeId as string,
        managerId: managerId as string,
        reviewCycleId: reviewCycleId as string,
        status: status as string,
      };

      // Use active role from session for role switching support
      const activeRole = req.user.activeRole || currentUser.role;

      // Apply role-based access control based on active role
      if (activeRole === 'employee') {
        // Employees can only see their own evaluations
        filters.employeeId = currentUser.id;
      } else if (activeRole === 'manager') {
        // Managers can see evaluations they manage or their own
        if (!filters.employeeId && !filters.managerId) {
          // If no specific filter, show evaluations where they are the manager or employee
          const getEvaluationsMethod = includeQuestionnaires === 'true' 
            ? storage.getEvaluationsWithQuestionnaires 
            : storage.getEvaluations;
          
          const userManagedEvaluations = await getEvaluationsMethod({ managerId: currentUser.id });
          const userOwnEvaluations = await getEvaluationsMethod({ employeeId: currentUser.id });
          const combinedEvaluations = [...userManagedEvaluations, ...userOwnEvaluations];
          // Remove duplicates by id
          const uniqueEvaluations = combinedEvaluations.filter((evaluation, index, self) => 
            index === self.findIndex(e => e.id === evaluation.id)
          );
          return res.json(uniqueEvaluations);
        }
        // Validate they can access the requested data
        if (filters.managerId && filters.managerId !== currentUser.id) {
          return res.status(403).json({ message: "Access denied: Cannot view evaluations for other managers" });
        }
      }
      // super_admin, admin, hr_manager can access all evaluations (no additional filtering)

      // Use enhanced method if questionnaires are requested
      const evaluations = includeQuestionnaires === 'true' 
        ? await storage.getEvaluationsWithQuestionnaires(filters)
        : await storage.getEvaluations(filters);
        
      res.json(evaluations);
    } catch (error) {
      console.error("Error fetching evaluations:", error);
      res.status(500).json({ message: "Failed to fetch evaluations" });
    }
  });

  app.post('/api/evaluations', isAuthenticated, requireRoles(['super_admin', 'admin', 'hr_manager']), async (req, res) => {
    try {
      const evaluationData = insertEvaluationSchema.parse(req.body);
      const evaluation = await storage.createEvaluation(evaluationData);
      res.status(201).json(evaluation);
    } catch (error) {
      console.error("Error creating evaluation:", error);
      res.status(500).json({ message: "Failed to create evaluation" });
    }
  });

  app.put('/api/evaluations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get the existing evaluation to check permissions
      const existingEvaluation = await storage.getEvaluation(id);
      if (!existingEvaluation) {
        return res.status(404).json({ message: "Evaluation not found" });
      }

      // Convert date strings to Date objects before validation
      const requestBody = { ...req.body };
      if (requestBody.selfEvaluationSubmittedAt && typeof requestBody.selfEvaluationSubmittedAt === 'string') {
        requestBody.selfEvaluationSubmittedAt = new Date(requestBody.selfEvaluationSubmittedAt);
      }
      if (requestBody.managerEvaluationSubmittedAt && typeof requestBody.managerEvaluationSubmittedAt === 'string') {
        requestBody.managerEvaluationSubmittedAt = new Date(requestBody.managerEvaluationSubmittedAt);
      }
      if (requestBody.finalizedAt && typeof requestBody.finalizedAt === 'string') {
        requestBody.finalizedAt = new Date(requestBody.finalizedAt);
      }
      if (requestBody.meetingScheduledAt && typeof requestBody.meetingScheduledAt === 'string') {
        requestBody.meetingScheduledAt = new Date(requestBody.meetingScheduledAt);
      }
      if (requestBody.meetingCompletedAt && typeof requestBody.meetingCompletedAt === 'string') {
        requestBody.meetingCompletedAt = new Date(requestBody.meetingCompletedAt);
      }

      // Apply role-based access control for updates
      const evaluationData = insertEvaluationSchema.partial().parse(requestBody);
      
      if (currentUser.role === 'employee') {
        // Employees can only update their own evaluations and only self-evaluation data
        if (existingEvaluation.employeeId !== currentUser.id) {
          return res.status(403).json({ message: "Access denied: Cannot update evaluation for other employees" });
        }
        // Restrict what employees can update
        const allowedUpdates = {
          selfEvaluationData: evaluationData.selfEvaluationData,
          selfEvaluationSubmittedAt: evaluationData.selfEvaluationSubmittedAt,
        };
        const filteredData = Object.fromEntries(
          Object.entries(allowedUpdates).filter(([_, value]) => value !== undefined)
        );
        const evaluation = await storage.updateEvaluation(id, filteredData);
        
        // Send email notification to manager when employee submits self-evaluation
        if (evaluationData.selfEvaluationSubmittedAt && !existingEvaluation.selfEvaluationSubmittedAt) {
          try {
            const manager = await storage.getUser(existingEvaluation.managerId);
            const employee = currentUser;
            
            // Defensive checks for required email fields
            if (manager && manager.email && employee.email && employee.companyId) {
              // Get HR managers for the company
              const hrManagers = await storage.getUsers({ role: 'hr_manager', companyId: employee.companyId });
              const hrManagerEmails = hrManagers
                .filter(hrm => hrm.email)
                .map(hrm => hrm.email as string);
              
              await sendEmployeeSubmissionNotification(
                manager.email,
                `${manager.firstName} ${manager.lastName}`,
                `${employee.firstName} ${employee.lastName}`,
                employee.email,
                evaluation.id,
                hrManagerEmails
              );
              console.log(`Employee submission notification sent to manager ${manager.email} with CC to ${hrManagerEmails.length} HR manager(s)`);
            } else {
              console.log('Skipping email notification: Missing required email addresses or company ID');
            }
          } catch (emailError) {
            console.error('Failed to send employee submission notification:', emailError);
            // Don't fail the request if email fails
          }
        }
        
        res.json(evaluation);
      } else if (currentUser.role === 'manager') {
        // Managers can update evaluations for their direct reports and their own
        if (existingEvaluation.managerId !== currentUser.id && existingEvaluation.employeeId !== currentUser.id) {
          return res.status(403).json({ message: "Access denied: Cannot update evaluation for other teams" });
        }
        
        if (existingEvaluation.employeeId === currentUser.id) {
          // Managers updating their own evaluation (as employee)
          const allowedUpdates = {
            selfEvaluationData: evaluationData.selfEvaluationData,
            selfEvaluationSubmittedAt: evaluationData.selfEvaluationSubmittedAt,
          };
          const filteredData = Object.fromEntries(
            Object.entries(allowedUpdates).filter(([_, value]) => value !== undefined)
          );
          const evaluation = await storage.updateEvaluation(id, filteredData);
          
          // Send email notification to their manager when they submit self-evaluation
          if (evaluationData.selfEvaluationSubmittedAt && !existingEvaluation.selfEvaluationSubmittedAt) {
            try {
              const manager = await storage.getUser(existingEvaluation.managerId);
              const employee = currentUser;
              
              // Defensive checks for required email fields
              if (manager && manager.email && employee.email && employee.companyId) {
                // Get HR managers for the company
                const hrManagers = await storage.getUsers({ role: 'hr_manager', companyId: employee.companyId });
                const hrManagerEmails = hrManagers
                  .filter(hrm => hrm.email)
                  .map(hrm => hrm.email as string);
                
                await sendEmployeeSubmissionNotification(
                  manager.email,
                  `${manager.firstName} ${manager.lastName}`,
                  `${employee.firstName} ${employee.lastName}`,
                  employee.email,
                  evaluation.id,
                  hrManagerEmails
                );
                console.log(`Employee submission notification sent to manager ${manager.email} with CC to ${hrManagerEmails.length} HR manager(s)`);
              } else {
                console.log('Skipping email notification: Missing required email addresses or company ID');
              }
            } catch (emailError) {
              console.error('Failed to send employee submission notification:', emailError);
              // Don't fail the request if email fails
            }
          }
          
          res.json(evaluation);
        } else {
          // Managers updating their direct report's evaluation
          const allowedUpdates = {
            managerEvaluationData: evaluationData.managerEvaluationData,
            managerEvaluationSubmittedAt: evaluationData.managerEvaluationSubmittedAt,
            overallRating: evaluationData.overallRating,
            finalizedAt: evaluationData.finalizedAt,
            status: evaluationData.status,
          };
          const filteredData = Object.fromEntries(
            Object.entries(allowedUpdates).filter(([_, value]) => value !== undefined)
          );
          const evaluation = await storage.updateEvaluation(id, filteredData);
          res.json(evaluation);
        }
      } else {
        // super_admin, admin, hr_manager can update any evaluation with any data
        const evaluation = await storage.updateEvaluation(id, evaluationData);
        res.json(evaluation);
      }
    } catch (error) {
      console.error("Error updating evaluation:", error);
      res.status(500).json({ message: "Failed to update evaluation" });
    }
  });

  // Generate evaluations for review cycle
  app.post('/api/review-cycles/:cycleId/generate-evaluations', isAuthenticated, requireRoles(['super_admin', 'admin', 'hr_manager']), async (req, res) => {
    try {
      const { cycleId } = req.params;
      const { employeeIds } = req.body;
      
      // Verify review cycle exists
      const reviewCycle = await storage.getReviewCycle(cycleId);
      if (!reviewCycle) {
        return res.status(404).json({ message: "Review cycle not found" });
      }
      
      const createdEvaluations = [];
      
      for (const employeeId of employeeIds) {
        const employee = await storage.getUser(employeeId);
        if (!employee) {
          console.warn(`Employee ${employeeId} not found, skipping`);
          continue;
        }
        
        // Check if evaluation already exists for this employee and cycle
        const existingEvaluation = await storage.getEvaluationByEmployeeAndCycle(employeeId, cycleId);
        if (existingEvaluation) {
          console.log(`Evaluation already exists for employee ${employeeId} in cycle ${cycleId}, skipping`);
          continue;
        }
        
        // Get the employee's manager
        let managerId = employee.reportingManagerId;
        if (!managerId) {
          // If no manager assigned, use a default admin/HR manager for now
          console.warn(`No manager found for employee ${employeeId}`);
          continue;
        }
        
        // Create evaluation record
        const evaluationData = {
          employeeId: employeeId,
          managerId: managerId,
          reviewCycleId: cycleId,
          status: 'draft' as const,
        };
        
        const evaluation = await storage.createEvaluation(evaluationData);
        createdEvaluations.push(evaluation);
      }
      
      res.status(201).json({
        message: `Created ${createdEvaluations.length} evaluations`,
        evaluations: createdEvaluations
      });
    } catch (error) {
      console.error("Error generating evaluations:", error);
      res.status(500).json({ message: "Failed to generate evaluations" });
    }
  });

  // Get evaluations for calibration - HR Manager only
  app.get('/api/evaluations/calibrate', isAuthenticated, requireRoles(['hr_manager']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      
      // Get requesting user to determine company
      const requestingUser = await storage.getUser(requestingUserId);
      if (!requestingUser?.companyId) {
        return res.status(403).json({ message: "User company not found" });
      }
      
      // Get all evaluations with completed manager ratings
      const evaluations = await storage.getEvaluationsForCalibration(requestingUser.companyId);
      
      res.json(evaluations);
    } catch (error) {
      console.error("Error fetching evaluations for calibration:", error);
      res.status(500).json({ message: "Failed to fetch evaluations for calibration" });
    }
  });

  // Update calibrated rating for an evaluation - HR Manager only
  app.patch('/api/evaluations/:id/calibrate', isAuthenticated, requireRoles(['hr_manager']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { calibratedRating, calibrationRemarks } = req.body;
      const requestingUserId = req.user.claims.sub;
      
      // Get requesting user to verify company access
      const requestingUser = await storage.getUser(requestingUserId);
      if (!requestingUser?.companyId) {
        return res.status(403).json({ message: "User company not found" });
      }
      
      // Get the evaluation
      const evaluation = await storage.getEvaluationById(id);
      if (!evaluation) {
        return res.status(404).json({ message: "Evaluation not found" });
      }
      
      // Verify the employee belongs to the same company
      const employee = await storage.getUser(evaluation.employeeId);
      if (employee?.companyId !== requestingUser.companyId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Update calibration
      const updatedEvaluation = await storage.updateEvaluationCalibration(id, {
        calibratedRating,
        calibrationRemarks,
        calibratedBy: requestingUserId,
        calibratedAt: new Date(),
      });
      
      // Get employee details for response
      const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown';
      
      res.json({
        ...updatedEvaluation,
        employeeName,
      });
    } catch (error) {
      console.error("Error updating calibration:", error);
      res.status(500).json({ message: "Failed to update calibration" });
    }
  });

  // Get evaluations requiring manager review (submitted by employees) - MUST come before /:id route
  app.get('/api/evaluations/manager-submissions', isAuthenticated, requireRoles(['manager']), async (req: any, res) => {
    try {
      const managerId = req.user.claims.sub;
      
      // Get all evaluations where:
      // 1. Manager is the current user
      // 2. Employee has submitted their evaluation (regardless of manager review status)
      const evaluations = await storage.getEvaluations({ managerId });
      const submissionsForReview = evaluations.filter(evaluation => 
        evaluation.selfEvaluationSubmittedAt
      );

      // Get questionnaire data for each evaluation
      const evaluationsWithQuestionnaires = await Promise.all(
        submissionsForReview.map(async (evaluation) => {
          // Get employee details
          const employee = await storage.getUser(evaluation.employeeId);
          // Get questionnaire template details from selfEvaluationData
          let questionnaireTemplate = null;
          
          // First try to get from selfEvaluationData.questionnaires array
          if (evaluation.selfEvaluationData?.questionnaires && Array.isArray(evaluation.selfEvaluationData.questionnaires)) {
            const questionnaireIds = evaluation.selfEvaluationData.questionnaires;
            if (questionnaireIds.length > 0) {
              // Get all questionnaire templates referenced in the evaluation
              const templates = await Promise.all(
                questionnaireIds.map(async (templateId: string) => {
                  return await storage.getQuestionnaireTemplate(templateId);
                })
              );
              // Filter out null results and return array of templates
              questionnaireTemplate = templates.filter(template => template !== null);
            }
          }
          
          // Fallback to reviewCycle approach if no questionnaires found
          if (!questionnaireTemplate && evaluation.reviewCycleId && !evaluation.reviewCycleId.startsWith('initiated-appraisal-')) {
            const reviewCycle = await storage.getReviewCycle(evaluation.reviewCycleId);
            if (reviewCycle?.questionnaireTemplateId) {
              questionnaireTemplate = await storage.getQuestionnaireTemplate(reviewCycle.questionnaireTemplateId);
            }
          }
          
          return {
            ...evaluation,
            employee: employee ? {
              id: employee.id,
              firstName: employee.firstName,
              lastName: employee.lastName,
              email: employee.email,
              department: employee.department,
              designation: employee.designation
            } : null,
            questionnaireTemplate
          };
        })
      );

      res.json(evaluationsWithQuestionnaires);
    } catch (error) {
      console.error("Error fetching manager submissions:", error);
      res.status(500).json({ message: "Failed to fetch submissions for review" });
    }
  });

  // Get evaluation by ID with role-based access
  app.get('/api/evaluations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const evaluation = await storage.getEvaluation(id);
      if (!evaluation) {
        return res.status(404).json({ message: "Evaluation not found" });
      }

      // Apply role-based access control
      if (currentUser.role === 'employee') {
        if (evaluation.employeeId !== currentUser.id) {
          return res.status(403).json({ message: "Access denied: Cannot view evaluation for other employees" });
        }
      } else if (currentUser.role === 'manager') {
        if (evaluation.managerId !== currentUser.id && evaluation.employeeId !== currentUser.id) {
          return res.status(403).json({ message: "Access denied: Cannot view evaluation for other teams" });
        }
      }
      // super_admin, admin, hr_manager can access any evaluation

      res.json(evaluation);
    } catch (error) {
      console.error("Error fetching evaluation:", error);
      res.status(500).json({ message: "Failed to fetch evaluation" });
    }
  });

  // Finalize an evaluation (manager completes the review process)
  app.post('/api/evaluations/:id/finalize', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const evaluation = await storage.getEvaluation(id);
      if (!evaluation) {
        return res.status(404).json({ message: "Evaluation not found" });
      }

      // Only managers, HR, or admins can finalize evaluations
      if (currentUser.role === 'employee') {
        return res.status(403).json({ message: "Access denied: Employees cannot finalize evaluations" });
      }

      if (currentUser.role === 'manager' && evaluation.managerId !== currentUser.id) {
        return res.status(403).json({ message: "Access denied: Can only finalize evaluations you manage" });
      }

      // Check if evaluation is ready to be finalized
      if (!evaluation.selfEvaluationSubmittedAt) {
        return res.status(400).json({ message: "Cannot finalize: Employee self-evaluation not yet submitted" });
      }

      if (!evaluation.managerEvaluationSubmittedAt) {
        return res.status(400).json({ message: "Cannot finalize: Manager evaluation not yet submitted" });
      }

      // Finalize the evaluation
      const finalizedEvaluation = await storage.updateEvaluation(id, {
        status: 'completed',
        finalizedAt: new Date(),
      });

      res.json(finalizedEvaluation);
    } catch (error) {
      console.error("Error finalizing evaluation:", error);
      res.status(500).json({ message: "Failed to finalize evaluation" });
    }
  });

  // Export evaluation to PDF/DOCX - secure server-side data fetching
  app.post('/api/evaluations/export', isAuthenticated, async (req: any, res) => {
    try {
      // Validate request body
      const exportSchema = z.object({
        evaluationId: z.string().uuid("Invalid evaluation ID format"),
        format: z.enum(['pdf', 'docx'], { errorMap: () => ({ message: "Format must be either 'pdf' or 'docx'" }) }),
      });

      const validation = exportSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validation.error.errors 
        });
      }

      const { evaluationId, format } = validation.data;
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const evaluation = await storage.getEvaluation(evaluationId);
      if (!evaluation) {
        return res.status(404).json({ message: "Evaluation not found" });
      }

      // Get additional evaluation details from database (secure)
      const employee = await storage.getUser(evaluation.employeeId);
      const manager = await storage.getUser(evaluation.managerId);

      // Helper function to check if user has a specific role
      const hasRole = (role: string) => {
        return currentUser.role === role || (currentUser.roles || []).includes(role);
      };

      // Check access permissions (check both role field and roles array)
      const isEmployee = hasRole('employee');
      const isManager = hasRole('manager');
      const isHRManager = hasRole('hr_manager');
      const isAdmin = hasRole('admin');
      const isSuperAdmin = hasRole('super_admin');

      // Super admin and admin have full access
      if (isSuperAdmin || isAdmin) {
        // Continue to export
      }
      // HR Managers can export evaluations for employees in their company
      else if (isHRManager) {
        if (!employee || employee.companyId !== currentUser.companyId) {
          return res.status(403).json({ message: "Access denied: Can only export evaluations for employees in your company" });
        }
      }
      // Managers can export evaluations they manage or their own
      else if (isManager) {
        if (evaluation.managerId !== currentUser.id && evaluation.employeeId !== currentUser.id) {
          return res.status(403).json({ message: "Access denied: Can only export evaluations you manage or your own" });
        }
      }
      // Employees can only export their own evaluations
      else if (isEmployee) {
        if (evaluation.employeeId !== currentUser.id) {
          return res.status(403).json({ message: "Access denied: Can only export your own evaluation" });
        }
      }
      // No valid role
      else {
        return res.status(403).json({ message: "Access denied: Insufficient permissions" });
      }
      const reviewCycle = evaluation.reviewCycleId ? await storage.getReviewCycle(evaluation.reviewCycleId) : null;
      
      // Extract responses and calculate average from stored data
      const selfEvaluationData = evaluation.selfEvaluationData as any;
      // Ensure responses is always an array
      const responses = Array.isArray(selfEvaluationData?.responses) 
        ? selfEvaluationData.responses 
        : Array.isArray(selfEvaluationData)
          ? selfEvaluationData
          : [];
      const averageRating = selfEvaluationData?.averageRating || 0;
      
      // Get questionnaires associated with this evaluation from database
      let questionnaires: any[] = [];
      if (evaluation.initiatedAppraisalId) {
        const initiatedAppraisal = await storage.getInitiatedAppraisal(evaluation.initiatedAppraisalId);
        if (initiatedAppraisal && initiatedAppraisal.questionnaireTemplateIds) {
          questionnaires = await Promise.all(
            initiatedAppraisal.questionnaireTemplateIds.map(id => storage.getQuestionnaireTemplate(id))
          );
        }
      }

      if (format === 'pdf') {
        // Generate PDF using PDFKit
        const doc = new PDFDocument();
        
        // Set response headers for PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="evaluation-${evaluationId}.pdf"`);
        
        // Pipe the PDF to the response
        doc.pipe(res);
        
        // Add content to PDF
        doc.fontSize(20).text('Performance Evaluation Report', 50, 50);
        doc.fontSize(12).moveDown();
        
        // Employee information
        doc.text(`Employee: ${employee?.firstName} ${employee?.lastName}`, 50);
        doc.text(`Manager: ${manager?.firstName} ${manager?.lastName}`, 50);
        doc.text(`Review Cycle: ${reviewCycle?.name || 'N/A'}`, 50);
        doc.text(`Average Rating: ${averageRating?.toFixed(1) || 'N/A'}/5.0`, 50);
        doc.moveDown();
        
        // Questionnaires and responses
        if (questionnaires && questionnaires.length > 0) {
          questionnaires.forEach((questionnaire: any, qIndex: number) => {
            doc.fontSize(16).text(`${questionnaire.name}`, 50);
            doc.fontSize(10).text(`${questionnaire.description || ''}`, 50);
            doc.moveDown();
            
            if (questionnaire.questions) {
              questionnaire.questions.forEach((question: any, index: number) => {
                const questionKey = `${questionnaire.id}_${question.id || index}`;
                const response = responses?.find((r: any) => r.questionId === questionKey);
                
                doc.fontSize(12).text(`Q${index + 1}: ${question.text}`, 50);
                
                if (response) {
                  if (response.rating) {
                    doc.fontSize(10).text(`Rating: ${response.rating}/5`, 70);
                  }
                  if (response.response) {
                    doc.fontSize(10).text(`Response: ${response.response}`, 70);
                  }
                  if (response.remarks) {
                    doc.fontSize(10).text(`Remarks: ${response.remarks}`, 70);
                  }
                } else {
                  doc.fontSize(10).text('No response provided', 70);
                }
                doc.moveDown();
              });
            }
            doc.moveDown();
          });
        }
        
        // Finalize the PDF
        doc.end();
        
      } else if (format === 'docx') {
        // Generate DOCX using docxtemplater and pizzip
        
        // Create a simple DOCX template
        const templateContent = `
          Performance Evaluation Report
          
          Employee: ${employee?.firstName} ${employee?.lastName}
          Manager: ${manager?.firstName} ${manager?.lastName}
          Review Cycle: ${reviewCycle?.name || 'N/A'}
          Average Rating: ${averageRating?.toFixed(1) || 'N/A'}/5.0
          
          ${questionnaires?.map((questionnaire: any, qIndex: number) => `
            ${questionnaire.name}
            ${questionnaire.description || ''}
            
            ${questionnaire.questions?.map((question: any, index: number) => {
              const questionKey = `${questionnaire.id}_${question.id || index}`;
              const response = responses?.find((r: any) => r.questionId === questionKey);
              
              return `Q${index + 1}: ${question.text}
              ${response?.rating ? `Rating: ${response.rating}/5` : ''}
              ${response?.response ? `Response: ${response.response}` : 'No response provided'}
              ${response?.remarks ? `Remarks: ${response.remarks}` : ''}
              `;
            }).join('\n') || ''}
          `).join('\n') || ''}
        `;
        
        // Create a minimal DOCX structure
        const zip = new PizZip();
        
        // Add basic DOCX structure
        zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
          <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
            <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
            <Default Extension="xml" ContentType="application/xml"/>
            <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
          </Types>`);
          
        zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
          </Relationships>`);
          
        zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
          <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:body>
              <w:p><w:r><w:t>${templateContent.replace(/\n/g, '</w:t></w:r></w:p><w:p><w:r><w:t>')}</w:t></w:r></w:p>
            </w:body>
          </w:document>`);
        
        const buffer = zip.generate({ type: 'nodebuffer' });
        
        // Set response headers for DOCX
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="evaluation-${evaluationId}.docx"`);
        
        res.send(buffer);
        
      } else {
        return res.status(400).json({ message: "Invalid format. Supported formats: pdf, docx" });
      }
      
    } catch (error) {
      console.error("Error exporting evaluation:", error);
      res.status(500).json({ message: "Failed to export evaluation" });
    }
  });

  // Send review invitations
  app.post('/api/send-review-invitations', isAuthenticated, requireRoles(['super_admin', 'admin', 'hr_manager']), async (req, res) => {
    try {
      const { employeeIds, reviewCycleId } = req.body;
      
      for (const employeeId of employeeIds) {
        const employee = await storage.getUser(employeeId);
        if (employee && employee.email) {
          await sendReviewInvitation(employee.email, employee.firstName || '', reviewCycleId);
        }
      }
      
      res.json({ message: "Review invitations sent successfully" });
    } catch (error) {
      console.error("Error sending review invitations:", error);
      res.status(500).json({ message: "Failed to send review invitations" });
    }
  });

  // Email configuration routes
  app.get('/api/email-config', isAuthenticated, requireRoles(['super_admin', 'admin']), async (req, res) => {
    try {
      const config = await storage.getEmailConfig();
      res.json(config);
    } catch (error) {
      console.error("Error fetching email config:", error);
      res.status(500).json({ message: "Failed to fetch email config" });
    }
  });

  app.post('/api/email-config', isAuthenticated, requireRoles(['super_admin', 'admin']), async (req, res) => {
    try {
      const configData = insertEmailConfigSchema.parse(req.body);
      const config = await storage.createEmailConfig(configData);
      res.status(201).json(config);
    } catch (error) {
      console.error("Error creating email config:", error);
      res.status(500).json({ message: "Failed to create email config" });
    }
  });

  // Object storage routes for company logos
  app.post('/api/objects/upload', isAuthenticated, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  app.put('/api/company-logos', isAuthenticated, async (req, res) => {
    try {
      if (!req.body.logoURL) {
        return res.status(400).json({ error: "logoURL is required" });
      }

      const userId = (req.user as any)?.claims?.sub;
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.logoURL,
        {
          owner: userId,
          visibility: "public",
        },
      );

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error setting company logo:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Serve objects from object storage (public access only)
  app.get('/objects/*', async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const normalizedPath = req.path; // e.g., /objects/uploads/xxx
      
      // Get the object file to check permissions
      const objectFile = await objectStorageService.getObjectEntityFile(normalizedPath);
      
      // Verify the object is publicly accessible (visibility === "public")
      // This prevents unauthorized access to private objects
      const userId = (req.user as any)?.claims?.sub;
      const canAccess = await objectStorageService.canAccessObjectEntity({
        userId,
        objectFile,
        requestedPermission: undefined, // READ permission
      });
      
      if (!canAccess) {
        return res.status(403).send("Access denied");
      }
      
      // Extract the entity ID from the path
      const entityId = req.path.replace('/objects/', '');
      
      // Convert to the full object storage path
      const privateObjectDir = objectStorageService.getPrivateObjectDir();
      if (!privateObjectDir) {
        throw new Error("Object storage not configured");
      }
      
      const fullPath = `${privateObjectDir}/${entityId}`;
      
      // Get a signed GET URL for the object
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const signedUrl = await signObjectURL({
        bucketName,
        objectName,
        method: "GET",
        ttlSec: 3600, // 1 hour
      });
      
      // Redirect to the signed URL
      res.redirect(signedUrl);
    } catch (error) {
      console.error("Error serving object:", error);
      res.status(404).send("Object not found");
    }
  });

  // Settings routes - Change password and Email Service configuration
  app.post('/api/settings/change-password', isAuthenticated, requireRoles(['super_admin', 'admin', 'hr_manager', 'employee', 'manager']), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { currentPassword, newPassword } = req.body;

      if (!newPassword) {
        return res.status(400).json({ message: "New password is required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters long" });
      }

      // Convert empty string to undefined for OIDC accounts
      const sanitizedCurrentPassword = currentPassword && currentPassword.trim() !== '' ? currentPassword : undefined;
      await storage.changePassword(userId, sanitizedCurrentPassword, newPassword);
      res.json({ message: "Password changed successfully" });
    } catch (error: any) {
      console.error("Error changing password:", error);
      if (error.message === 'User not found' || error.message === 'Current password is incorrect') {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.get('/api/settings/email', isAuthenticated, requireRoles(['admin']), async (req, res) => {
    try {
      const config = await storage.getEmailConfig();
      if (config) {
        // Remove sensitive password field from response
        const { smtpPassword, ...safeConfig } = config;
        res.json(safeConfig);
      } else {
        res.json(null);
      }
    } catch (error) {
      console.error("Error fetching email settings:", error);
      res.status(500).json({ message: "Failed to fetch email settings" });
    }
  });

  app.post('/api/settings/email', isAuthenticated, requireRoles(['admin']), async (req, res) => {
    try {
      // Create API schema that matches frontend field names
      const emailConfigApiSchema = z.object({
        host: z.string().min(1, "SMTP host is required"),
        port: z.number().min(1, "Port is required").max(65535, "Invalid port"),
        username: z.string().min(1, "Username is required"),
        password: z.string().min(1, "Password is required"),
        secure: z.boolean(),
        fromEmail: z.string().email("Valid email address is required"),
        fromName: z.string().min(1, "From name is required"),
      });

      // Validate request body with API schema
      const validationResult = emailConfigApiSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid email configuration data",
          errors: validationResult.error.errors 
        });
      }

      const { host, port, username, password, secure, fromEmail, fromName } = validationResult.data;
      
      const emailConfigData = {
        smtpHost: host,
        smtpPort: port, // port is already a number from validation
        smtpUsername: username,
        smtpPassword: password,
        fromEmail,
        fromName,
        isActive: true, // Keep as true for now, secure is for SSL/TLS
        updatedAt: new Date(),
      };

      // Check if config already exists
      const existingConfig = await storage.getEmailConfig();
      let result;
      
      if (existingConfig) {
        // Update existing config
        result = await storage.updateEmailConfig(existingConfig.id, emailConfigData);
      } else {
        // Create new config
        result = await storage.createEmailConfig(emailConfigData);
      }

      // Remove password from response
      const { smtpPassword: _, ...safeResult } = result;
      res.json(safeResult);
    } catch (error) {
      console.error("Error saving email settings:", error);
      res.status(500).json({ message: "Failed to save email settings" });
    }
  });

  // Level management routes - Administrator isolated (GET endpoints accessible by HR Manager too)
  app.get('/api/levels', isAuthenticated, requireRoles(['admin', 'hr_manager']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const requestingUser = await storage.getUser(requestingUserId);
      
      if (!requestingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // For HR Managers, find the admin of their company to access company's levels
      let adminId = requestingUserId;
      if (requestingUser.role === 'hr_manager' && requestingUser.companyId) {
        const companyAdmins = await storage.getUsers({ role: 'admin', companyId: requestingUser.companyId });
        if (companyAdmins && companyAdmins.length > 0) {
          adminId = companyAdmins[0].id;
        }
      }
      
      const levels = await storage.getLevels(adminId);
      res.json(levels);
    } catch (error) {
      console.error("Error fetching levels:", error);
      res.status(500).json({ message: "Failed to fetch levels" });
    }
  });

  app.get('/api/levels/:id', isAuthenticated, requireRoles(['admin', 'hr_manager']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      const level = await storage.getLevel(id, createdById);
      if (!level) {
        return res.status(404).json({ message: "Level not found" });
      }
      res.json(level);
    } catch (error) {
      console.error("Error fetching level:", error);
      res.status(500).json({ message: "Failed to fetch level" });
    }
  });

  app.post('/api/levels', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const levelData = insertLevelSchema.parse(req.body);
      const createdById = req.user.claims.sub;
      const level = await storage.createLevel(levelData, createdById);
      res.status(201).json(level);
    } catch (error) {
      console.error("Error creating level:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid level data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create level" });
    }
  });

  app.put('/api/levels/:id', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      
      // Check if level exists and belongs to the administrator
      const existingLevel = await storage.getLevel(id, createdById);
      if (!existingLevel) {
        return res.status(404).json({ message: "Level not found" });
      }
      
      // Parse and sanitize the request body to prevent ownership changes
      const { id: _id, createdById: _createdById, createdAt: _createdAt, ...safeLevelData } = insertLevelSchema.partial().parse(req.body);
      const level = await storage.updateLevel(id, safeLevelData, createdById);
      res.json(level);
    } catch (error) {
      console.error("Error updating level:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid level data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update level" });
    }
  });

  app.delete('/api/levels/:id', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      
      // Check if level exists and belongs to the administrator
      const existingLevel = await storage.getLevel(id, createdById);
      if (!existingLevel) {
        return res.status(404).json({ message: "Level not found" });
      }
      
      await storage.deleteLevel(id, createdById);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting level:", error);
      res.status(500).json({ message: "Failed to delete level" });
    }
  });

  // Grade management routes - Administrator isolated (GET endpoints accessible by HR Manager too)
  app.get('/api/grades', isAuthenticated, requireRoles(['admin', 'hr_manager']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const requestingUser = await storage.getUser(requestingUserId);
      
      if (!requestingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // For HR Managers, find the admin of their company to access company's grades
      let adminId = requestingUserId;
      if (requestingUser.role === 'hr_manager' && requestingUser.companyId) {
        const companyAdmins = await storage.getUsers({ role: 'admin', companyId: requestingUser.companyId });
        if (companyAdmins && companyAdmins.length > 0) {
          adminId = companyAdmins[0].id;
        }
      }
      
      const grades = await storage.getGrades(adminId);
      res.json(grades);
    } catch (error) {
      console.error("Error fetching grades:", error);
      res.status(500).json({ message: "Failed to fetch grades" });
    }
  });

  app.get('/api/grades/:id', isAuthenticated, requireRoles(['admin', 'hr_manager']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      const grade = await storage.getGrade(id, createdById);
      if (!grade) {
        return res.status(404).json({ message: "Grade not found" });
      }
      res.json(grade);
    } catch (error) {
      console.error("Error fetching grade:", error);
      res.status(500).json({ message: "Failed to fetch grade" });
    }
  });

  app.post('/api/grades', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const gradeData = insertGradeSchema.parse(req.body);
      const createdById = req.user.claims.sub;
      const grade = await storage.createGrade(gradeData, createdById);
      res.status(201).json(grade);
    } catch (error) {
      console.error("Error creating grade:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid grade data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create grade" });
    }
  });

  app.put('/api/grades/:id', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      
      // Check if grade exists and belongs to the administrator
      const existingGrade = await storage.getGrade(id, createdById);
      if (!existingGrade) {
        return res.status(404).json({ message: "Grade not found" });
      }
      
      // Parse and sanitize the request body to prevent ownership changes
      const { id: _id, createdById: _createdById, createdAt: _createdAt, ...safeGradeData } = insertGradeSchema.partial().parse(req.body);
      const grade = await storage.updateGrade(id, safeGradeData, createdById);
      res.json(grade);
    } catch (error) {
      console.error("Error updating grade:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid grade data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update grade" });
    }
  });

  app.delete('/api/grades/:id', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      
      // Check if grade exists and belongs to the administrator
      const existingGrade = await storage.getGrade(id, createdById);
      if (!existingGrade) {
        return res.status(404).json({ message: "Grade not found" });
      }
      
      await storage.deleteGrade(id, createdById);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting grade:", error);
      res.status(500).json({ message: "Failed to delete grade" });
    }
  });

  // Department management routes - Administrator and HR Manager access for filtering
  app.get('/api/departments', isAuthenticated, requireRoles(['admin', 'hr_manager']), async (req: any, res) => {
    try {
      const createdById = req.user.claims.sub;
      const departments = await storage.getDepartments(createdById);
      res.json(departments);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ message: "Failed to fetch departments" });
    }
  });

  app.get('/api/departments/:id', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      const department = await storage.getDepartment(id, createdById);
      if (!department) {
        return res.status(404).json({ message: "Department not found" });
      }
      res.json(department);
    } catch (error) {
      console.error("Error fetching department:", error);
      res.status(500).json({ message: "Failed to fetch department" });
    }
  });

  app.post('/api/departments', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const departmentData = insertDepartmentSchema.parse(req.body);
      const createdById = req.user.claims.sub;
      const department = await storage.createDepartment(departmentData, createdById);
      res.status(201).json(department);
    } catch (error) {
      console.error("Error creating department:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid department data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create department" });
    }
  });

  app.put('/api/departments/:id', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      
      // Check if department exists and belongs to the administrator
      const existingDepartment = await storage.getDepartment(id, createdById);
      if (!existingDepartment) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      // Parse and sanitize the request body to prevent ownership changes
      const { id: _id, createdById: _createdById, createdAt: _createdAt, ...safeDepartmentData } = insertDepartmentSchema.partial().parse(req.body);
      const department = await storage.updateDepartment(id, safeDepartmentData, createdById);
      res.json(department);
    } catch (error) {
      console.error("Error updating department:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid department data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update department" });
    }
  });

  app.delete('/api/departments/:id', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      
      // Check if department exists and belongs to the administrator
      const existingDepartment = await storage.getDepartment(id, createdById);
      if (!existingDepartment) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      await storage.deleteDepartment(id, createdById);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting department:", error);
      res.status(500).json({ message: "Failed to delete department" });
    }
  });

  // Appraisal Cycle management routes - Administrator isolated
  app.get('/api/appraisal-cycles', isAuthenticated, requireRoles(['admin', 'hr_manager']), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // HR managers can see all active appraisal cycles in their company, admins see only theirs
      const activeRole = req.user.activeRole || user.role;
      let cycles;
      if (activeRole === 'hr_manager') {
        cycles = await storage.getAllAppraisalCycles(user.companyId);
      } else {
        cycles = await storage.getAppraisalCycles(userId);
      }
      
      res.json(cycles);
    } catch (error) {
      console.error("Error fetching appraisal cycles:", error);
      res.status(500).json({ message: "Failed to fetch appraisal cycles" });
    }
  });

  app.get('/api/appraisal-cycles/:id', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      const cycle = await storage.getAppraisalCycle(id, createdById);
      if (!cycle) {
        return res.status(404).json({ message: "Appraisal cycle not found" });
      }
      res.json(cycle);
    } catch (error) {
      console.error("Error fetching appraisal cycle:", error);
      res.status(500).json({ message: "Failed to fetch appraisal cycle" });
    }
  });

  app.post('/api/appraisal-cycles', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const cycleData = insertAppraisalCycleSchema.parse(req.body);
      const createdById = req.user.claims.sub;
      const cycle = await storage.createAppraisalCycle(cycleData, createdById);
      res.status(201).json(cycle);
    } catch (error) {
      console.error("Error creating appraisal cycle:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid appraisal cycle data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create appraisal cycle" });
    }
  });

  app.put('/api/appraisal-cycles/:id', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      
      // Check if appraisal cycle exists and belongs to the administrator
      const existingCycle = await storage.getAppraisalCycle(id, createdById);
      if (!existingCycle) {
        return res.status(404).json({ message: "Appraisal cycle not found" });
      }
      
      // Parse and sanitize the request body to prevent ownership changes
      const { id: _id, createdById: _createdById, createdAt: _createdAt, ...safeCycleData } = insertAppraisalCycleSchema.partial().parse(req.body);
      const cycle = await storage.updateAppraisalCycle(id, safeCycleData, createdById);
      res.json(cycle);
    } catch (error) {
      console.error("Error updating appraisal cycle:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid appraisal cycle data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update appraisal cycle" });
    }
  });

  app.delete('/api/appraisal-cycles/:id', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      
      // Check if appraisal cycle exists and belongs to the administrator
      const existingCycle = await storage.getAppraisalCycle(id, createdById);
      if (!existingCycle) {
        return res.status(404).json({ message: "Appraisal cycle not found" });
      }
      
      await storage.deleteAppraisalCycle(id, createdById);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting appraisal cycle:", error);
      res.status(500).json({ message: "Failed to delete appraisal cycle" });
    }
  });

  // Review Frequency management routes - Administrator isolated
  app.get('/api/review-frequencies', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const createdById = req.user.claims.sub;
      const frequencies = await storage.getReviewFrequencies(createdById);
      res.json(frequencies);
    } catch (error) {
      console.error("Error fetching review frequencies:", error);
      res.status(500).json({ message: "Failed to fetch review frequencies" });
    }
  });

  app.get('/api/review-frequencies/:id', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      const frequency = await storage.getReviewFrequency(id, createdById);
      if (!frequency) {
        return res.status(404).json({ message: "Review frequency not found" });
      }
      res.json(frequency);
    } catch (error) {
      console.error("Error fetching review frequency:", error);
      res.status(500).json({ message: "Failed to fetch review frequency" });
    }
  });

  app.post('/api/review-frequencies', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const frequencyData = insertReviewFrequencySchema.parse(req.body);
      const createdById = req.user.claims.sub;
      const frequency = await storage.createReviewFrequency(frequencyData, createdById);
      res.status(201).json(frequency);
    } catch (error) {
      console.error("Error creating review frequency:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid review frequency data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create review frequency" });
    }
  });

  app.put('/api/review-frequencies/:id', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      
      // Check if review frequency exists and belongs to the administrator
      const existingFrequency = await storage.getReviewFrequency(id, createdById);
      if (!existingFrequency) {
        return res.status(404).json({ message: "Review frequency not found" });
      }
      
      // Parse and sanitize the request body to prevent ownership changes
      const { id: _id, createdById: _createdById, createdAt: _createdAt, ...safeFrequencyData } = insertReviewFrequencySchema.partial().parse(req.body);
      const frequency = await storage.updateReviewFrequency(id, safeFrequencyData, createdById);
      res.json(frequency);
    } catch (error) {
      console.error("Error updating review frequency:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid review frequency data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update review frequency" });
    }
  });

  app.delete('/api/review-frequencies/:id', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      
      // Check if review frequency exists and belongs to the administrator
      const existingFrequency = await storage.getReviewFrequency(id, createdById);
      if (!existingFrequency) {
        return res.status(404).json({ message: "Review frequency not found" });
      }
      
      await storage.deleteReviewFrequency(id, createdById);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting review frequency:", error);
      res.status(500).json({ message: "Failed to delete review frequency" });
    }
  });

  // Frequency Calendar management routes - Administrator isolated
  app.get('/api/frequency-calendars', isAuthenticated, requireRoles(['admin', 'hr_manager']), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // HR managers can see all calendars, admins see only theirs
      // Use active role from session if available, otherwise fall back to database role
      const activeRole = req.user.activeRole || user.role;
      let calendars;
      if (activeRole === 'hr_manager') {
        calendars = await storage.getAllFrequencyCalendars();
      } else {
        calendars = await storage.getFrequencyCalendars(userId);
      }
      
      res.json(calendars);
    } catch (error) {
      console.error("Error fetching frequency calendars:", error);
      res.status(500).json({ message: "Failed to fetch frequency calendars" });
    }
  });

  app.get('/api/frequency-calendars/:id', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      const calendar = await storage.getFrequencyCalendar(id, createdById);
      if (!calendar) {
        return res.status(404).json({ message: "Frequency calendar not found" });
      }
      res.json(calendar);
    } catch (error) {
      console.error("Error fetching frequency calendar:", error);
      res.status(500).json({ message: "Failed to fetch frequency calendar" });
    }
  });

  app.post('/api/frequency-calendars', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const calendarData = insertFrequencyCalendarSchema.parse(req.body);
      const createdById = req.user.claims.sub;
      const calendar = await storage.createFrequencyCalendar(calendarData, createdById);
      res.status(201).json(calendar);
    } catch (error) {
      console.error("Error creating frequency calendar:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid frequency calendar data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create frequency calendar" });
    }
  });

  app.put('/api/frequency-calendars/:id', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      
      // Check if frequency calendar exists and belongs to the administrator
      const existingCalendar = await storage.getFrequencyCalendar(id, createdById);
      if (!existingCalendar) {
        return res.status(404).json({ message: "Frequency calendar not found" });
      }
      
      // Parse and sanitize the request body to prevent ownership changes
      const { id: _id, createdById: _createdById, createdAt: _createdAt, ...safeCalendarData } = insertFrequencyCalendarSchema.partial().parse(req.body);
      const calendar = await storage.updateFrequencyCalendar(id, safeCalendarData, createdById);
      res.json(calendar);
    } catch (error) {
      console.error("Error updating frequency calendar:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid frequency calendar data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update frequency calendar" });
    }
  });

  app.delete('/api/frequency-calendars/:id', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      
      // Check if frequency calendar exists and belongs to the administrator
      const existingCalendar = await storage.getFrequencyCalendar(id, createdById);
      if (!existingCalendar) {
        return res.status(404).json({ message: "Frequency calendar not found" });
      }
      
      await storage.deleteFrequencyCalendar(id, createdById);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting frequency calendar:", error);
      res.status(500).json({ message: "Failed to delete frequency calendar" });
    }
  });

  // Frequency Calendar Details management routes - Administrator isolated through parent calendar
  app.get('/api/frequency-calendar-details', isAuthenticated, requireRoles(['admin', 'hr_manager']), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // HR managers can see all active frequency calendar details in their company, admins see only theirs
      const activeRole = req.user.activeRole || user.role;
      let details;
      if (activeRole === 'hr_manager') {
        details = await storage.getAllFrequencyCalendarDetails(user.companyId);
      } else {
        details = await storage.getFrequencyCalendarDetails(userId);
      }
      
      res.json(details);
    } catch (error) {
      console.error("Error fetching frequency calendar details:", error);
      res.status(500).json({ message: "Failed to fetch frequency calendar details" });
    }
  });

  app.get('/api/frequency-calendar-details/:id', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      const detail = await storage.getFrequencyCalendarDetail(id, createdById);
      if (!detail) {
        return res.status(404).json({ message: "Frequency calendar details not found" });
      }
      res.json(detail);
    } catch (error) {
      console.error("Error fetching frequency calendar detail:", error);
      res.status(500).json({ message: "Failed to fetch frequency calendar detail" });
    }
  });

  app.post('/api/frequency-calendar-details', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const detailsData = insertFrequencyCalendarDetailsSchema.parse(req.body);
      const createdById = req.user.claims.sub;
      const details = await storage.createFrequencyCalendarDetails(detailsData, createdById);
      res.status(201).json(details);
    } catch (error) {
      console.error("Error creating frequency calendar details:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid frequency calendar details data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create frequency calendar details" });
    }
  });

  app.put('/api/frequency-calendar-details/:id', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      
      // Check if frequency calendar details exist and belong to the administrator through parent calendar
      const existingDetails = await storage.getFrequencyCalendarDetail(id, createdById);
      if (!existingDetails) {
        return res.status(404).json({ message: "Frequency calendar details not found" });
      }
      
      // Parse and sanitize the request body to prevent ownership changes
      const { id: _id, createdAt: _createdAt, ...safeDetailsData } = insertFrequencyCalendarDetailsSchema.partial().parse(req.body);
      const details = await storage.updateFrequencyCalendarDetails(id, safeDetailsData, createdById);
      res.json(details);
    } catch (error) {
      console.error("Error updating frequency calendar details:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid frequency calendar details data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update frequency calendar details" });
    }
  });

  app.delete('/api/frequency-calendar-details/:id', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      
      // Check if frequency calendar details exist and belong to the administrator through parent calendar
      const existingDetails = await storage.getFrequencyCalendarDetail(id, createdById);
      if (!existingDetails) {
        return res.status(404).json({ message: "Frequency calendar details not found" });
      }
      
      await storage.deleteFrequencyCalendarDetails(id, createdById);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting frequency calendar details:", error);
      res.status(500).json({ message: "Failed to delete frequency calendar details" });
    }
  });

  // New endpoint for HR managers to get frequency calendar details by calendar ID
  app.get('/api/frequency-calendars/:calendarId/details', isAuthenticated, requireRoles(['admin', 'hr_manager']), async (req: any, res) => {
    try {
      const { calendarId } = req.params;
      const details = await storage.getFrequencyCalendarDetailsByCalendarId(calendarId);
      res.json(details);
    } catch (error) {
      console.error("Error fetching frequency calendar details by calendar ID:", error);
      res.status(500).json({ message: "Failed to fetch frequency calendar details" });
    }
  });

  // Publish Questionnaire management routes - Administrator isolated
  app.get('/api/publish-questionnaires', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const createdById = req.user.claims.sub;
      const questionnaires = await storage.getPublishQuestionnaires(createdById);
      res.json(questionnaires);
    } catch (error) {
      console.error("Error fetching publish questionnaires:", error);
      res.status(500).json({ message: "Failed to fetch publish questionnaires" });
    }
  });

  app.get('/api/publish-questionnaires/:id', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      const questionnaire = await storage.getPublishQuestionnaire(id, createdById);
      if (!questionnaire) {
        return res.status(404).json({ message: "Publish questionnaire not found" });
      }
      res.json(questionnaire);
    } catch (error) {
      console.error("Error fetching publish questionnaire:", error);
      res.status(500).json({ message: "Failed to fetch publish questionnaire" });
    }
  });

  app.post('/api/publish-questionnaires', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const questionnaireData = insertPublishQuestionnaireSchema.parse(req.body);
      const createdById = req.user.claims.sub;
      const questionnaire = await storage.createPublishQuestionnaire(questionnaireData, createdById);
      res.status(201).json(questionnaire);
    } catch (error) {
      console.error("Error creating publish questionnaire:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid publish questionnaire data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create publish questionnaire" });
    }
  });

  app.put('/api/publish-questionnaires/:id', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      
      // Check if publish questionnaire exists and belongs to the administrator
      const existingQuestionnaire = await storage.getPublishQuestionnaire(id, createdById);
      if (!existingQuestionnaire) {
        return res.status(404).json({ message: "Publish questionnaire not found" });
      }
      
      // Parse and sanitize the request body to prevent ownership changes
      const { id: _id, createdById: _createdById, createdAt: _createdAt, ...safeQuestionnaireData } = insertPublishQuestionnaireSchema.partial().parse(req.body);
      const questionnaire = await storage.updatePublishQuestionnaire(id, safeQuestionnaireData, createdById);
      res.json(questionnaire);
    } catch (error) {
      console.error("Error updating publish questionnaire:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid publish questionnaire data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update publish questionnaire" });
    }
  });

  app.delete('/api/publish-questionnaires/:id', isAuthenticated, requireRoles(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const createdById = req.user.claims.sub;
      
      // Check if publish questionnaire exists and belongs to the administrator
      const existingQuestionnaire = await storage.getPublishQuestionnaire(id, createdById);
      if (!existingQuestionnaire) {
        return res.status(404).json({ message: "Publish questionnaire not found" });
      }
      
      await storage.deletePublishQuestionnaire(id, createdById);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting publish questionnaire:", error);
      res.status(500).json({ message: "Failed to delete publish questionnaire" });
    }
  });

  // Appraisal Groups routes - HR Manager access
  app.get('/api/appraisal-groups', isAuthenticated, requireRoles(['hr_manager']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const groups = await storage.getAppraisalGroupsWithMembers(requestingUserId);
      res.json(groups);
    } catch (error) {
      console.error("Error fetching appraisal groups:", error);
      res.status(500).json({ message: "Failed to fetch appraisal groups" });
    }
  });

  app.get('/api/appraisal-groups/:id', isAuthenticated, requireRoles(['hr_manager']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const { id } = req.params;
      const group = await storage.getAppraisalGroup(id, requestingUserId);
      if (!group) {
        return res.status(404).json({ message: "Appraisal group not found" });
      }
      res.json(group);
    } catch (error) {
      console.error("Error fetching appraisal group:", error);
      res.status(500).json({ message: "Failed to fetch appraisal group" });
    }
  });

  app.post('/api/appraisal-groups', isAuthenticated, requireRoles(['hr_manager']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      // Validate request body and add createdById from session
      const validatedData = insertAppraisalGroupSchema.omit({ createdById: true }).parse(req.body);
      const groupData = {
        ...validatedData,
        createdById: requestingUserId,
      };
      const group = await storage.createAppraisalGroup(groupData, requestingUserId);
      res.status(201).json(group);
    } catch (error) {
      console.error("Error creating appraisal group:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create appraisal group" });
    }
  });

  app.put('/api/appraisal-groups/:id', isAuthenticated, requireRoles(['hr_manager']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const { id } = req.params;
      const validatedData = insertAppraisalGroupSchema.partial().parse(req.body);
      const group = await storage.updateAppraisalGroup(id, validatedData, requestingUserId);
      res.json(group);
    } catch (error) {
      console.error("Error updating appraisal group:", error);
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: "Appraisal group not found" });
      }
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update appraisal group" });
    }
  });

  app.delete('/api/appraisal-groups/:id', isAuthenticated, requireRoles(['hr_manager']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const { id } = req.params;
      await storage.deleteAppraisalGroup(id, requestingUserId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting appraisal group:", error);
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: "Appraisal group not found" });
      }
      res.status(500).json({ message: "Failed to delete appraisal group" });
    }
  });

  // Appraisal Group Members routes
  app.get('/api/appraisal-groups/:groupId/members', isAuthenticated, requireRoles(['hr_manager']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const { groupId } = req.params;
      const members = await storage.getAppraisalGroupMembers(groupId, requestingUserId);
      res.json(members);
    } catch (error) {
      console.error("Error fetching group members:", error);
      res.status(500).json({ message: "Failed to fetch group members" });
    }
  });

  app.post('/api/appraisal-groups/:groupId/members', isAuthenticated, requireRoles(['hr_manager']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const { groupId } = req.params;
      const { userId } = req.body;
      
      // Validate that the user being added is not an admin or super_admin
      const userToAdd = await storage.getUser(userId);
      if (!userToAdd) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check both role field and roles array
      const hasAdminRole = userToAdd.role === 'admin' || userToAdd.role === 'super_admin' ||
                          (userToAdd.roles || []).some(r => r === 'admin' || r === 'super_admin');
      
      if (hasAdminRole) {
        return res.status(403).json({ message: "Cannot add users with admin or super_admin roles to appraisal groups" });
      }
      
      const memberData = {
        appraisalGroupId: groupId,
        userId: userId,
        addedById: requestingUserId,
      };
      
      const validatedData = insertAppraisalGroupMemberSchema.parse(memberData);
      const member = await storage.addAppraisalGroupMember(validatedData, requestingUserId);
      res.status(201).json(member);
    } catch (error) {
      console.error("Error adding group member:", error);
      if (error.message.includes('already a member')) {
        return res.status(409).json({ message: "User is already a member of this group" });
      }
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: "Group or user not found" });
      }
      res.status(500).json({ message: "Failed to add group member" });
    }
  });

  app.delete('/api/appraisal-groups/:groupId/members/:userId', isAuthenticated, requireRoles(['hr_manager']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const { groupId, userId } = req.params;
      await storage.removeAppraisalGroupMember(groupId, userId, requestingUserId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing group member:", error);
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: "Group member not found" });
      }
      res.status(500).json({ message: "Failed to remove group member" });
    }
  });

  // Initiate Appraisal endpoint - HR Manager can initiate appraisals for groups
  app.post('/api/initiate-appraisal', isAuthenticated, requireRoles(['hr_manager']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      
      // Handle form data if file upload is present
      let parsedData: any;
      let documentUrl: string | undefined;

      if (req.headers['content-type']?.includes('multipart/form-data')) {
        // Handle file upload (this would need multer middleware setup)
        // For now, we'll handle JSON data in the 'data' field
        parsedData = JSON.parse(req.body.data);
        // File handling would be implemented here with proper upload logic
        if (req.file) {
          // Upload file to object storage and get URL
          documentUrl = `/uploads/${req.file.filename}`;
        }
      } else {
        // Handle regular JSON data
        parsedData = req.body;
      }

      // Validate the appraisal initiation data
      const validatedData = {
        appraisalGroupId: parsedData.appraisalGroupId,
        appraisalType: parsedData.appraisalType,
        questionnaireTemplateIds: Array.isArray(parsedData.questionnaireTemplateIds) 
          ? parsedData.questionnaireTemplateIds 
          : [],
        documentUrl: documentUrl || parsedData.documentUrl || null,
        frequencyCalendarId: parsedData.frequencyCalendarId || null,
        selectedCalendarDetailIds: parsedData.selectedCalendarDetailIds || [], // Selected calendar detail IDs for multi-select
        calendarDetailTimings: parsedData.calendarDetailTimings || [], // Add calendar detail timings
        daysToInitiate: parsedData.daysToInitiate || 0,
        daysToClose: parsedData.daysToClose || 30,
        numberOfReminders: parsedData.numberOfReminders || 3,
        excludeTenureLessThanYear: parsedData.excludeTenureLessThanYear || false,
        excludedEmployeeIds: parsedData.excludedEmployeeIds || [],
        makePublic: parsedData.makePublic || false,
        publishType: parsedData.publishType || 'now',
        createdById: requestingUserId,
      };

      // Basic validation
      if (!validatedData.appraisalGroupId) {
        return res.status(400).json({ message: "Appraisal group ID is required" });
      }

      if (!validatedData.appraisalType) {
        return res.status(400).json({ message: "Appraisal type is required" });
      }

      // Type-specific validation
      if (validatedData.appraisalType === 'questionnaire_based' && (!validatedData.questionnaireTemplateIds || validatedData.questionnaireTemplateIds.length === 0)) {
        return res.status(400).json({ message: "At least one questionnaire template is required for questionnaire-based appraisals" });
      }

      if ((validatedData.appraisalType === 'kpi_based' || validatedData.appraisalType === 'mbo_based') && !validatedData.documentUrl) {
        return res.status(400).json({ message: "Document is required for KPI/MBO-based appraisals" });
      }

      // Create the initiated appraisal
      const initiatedAppraisal = await storage.createInitiatedAppraisal(validatedData, requestingUserId);
      
      let evaluationsCreated = 0;
      let emailsSent = 0;
      
      // If publish type is "now", automatically generate evaluations and send notifications
      if (validatedData.publishType === 'now') {
        try {
          // Get all members of the appraisal group
          const members = await storage.getAppraisalGroupMembers(validatedData.appraisalGroupId, requestingUserId);
          const activeMembers = members.filter(member => member.user && member.user.status === 'active');
          
          // Create evaluations for each active member
          for (const member of activeMembers) {
            const employee = member.user!;
            
            // Skip if employee is in excluded list
            if (validatedData.excludedEmployeeIds?.includes(employee.id)) {
              continue;
            }
            
            // Get the employee's manager
            let managerId = employee.reportingManagerId;
            if (!managerId) {
              // If no manager assigned, use the HR manager who created the appraisal
              managerId = requestingUserId;
            }
            
            // Create evaluation record with initiated appraisal link
            const evaluationData = {
              employeeId: employee.id,
              managerId: managerId,
              reviewCycleId: 'initiated-appraisal-' + initiatedAppraisal.id,
              initiatedAppraisalId: initiatedAppraisal.id,
              status: 'not_started' as const,
            };
            
            try {
              await storage.createEvaluation(evaluationData);
              evaluationsCreated++;
              console.log(`Created evaluation for employee ${employee.id} (${employee.email})`);
            } catch (evalError) {
              console.error(`Failed to create evaluation for employee ${employee.id} (${employee.email}):`, evalError);
            }
            
            // Send email notification to employee (if email service is configured)
            try {
              const { sendAppraisalInitiationEmail } = await import('./emailService');
              const dueDate = new Date();
              dueDate.setDate(dueDate.getDate() + validatedData.daysToClose);
              
              await sendAppraisalInitiationEmail(
                employee.email,
                `${employee.firstName} ${employee.lastName}`,
                validatedData.appraisalType,
                dueDate
              );
              emailsSent++;
              console.log(`Email sent successfully to ${employee.email}`);
            } catch (emailError) {
              console.error(`Failed to send email to ${employee.email}:`, emailError);
              // Don't fail the whole process if email fails
            }
          }
          
          // Update appraisal status to 'active' since it's published now
          await storage.updateInitiatedAppraisalStatus(initiatedAppraisal.id, 'active');
          
        } catch (error) {
          console.error("Error generating evaluations or sending notifications:", error);
          // Don't fail the entire request, but log the error
        }
      }
      
      // If publish type is "as_per_calendar", create scheduled tasks for calendar-based publishing
      if (validatedData.publishType === 'as_per_calendar') {
        try {
          // Get the calendar details for this frequency calendar
          const calendarDetails = await storage.getFrequencyCalendarDetailsByCalendarId(validatedData.frequencyCalendarId!);
          
          // Filter calendar details to only include selected ones
          const selectedDetails = validatedData.selectedCalendarDetailIds && validatedData.selectedCalendarDetailIds.length > 0
            ? calendarDetails.filter(detail => validatedData.selectedCalendarDetailIds.includes(detail.id))
            : calendarDetails; // If no selection, process all (backward compatibility)
          
          // Create scheduled tasks for each selected calendar detail period
          for (const detail of selectedDetails) {
            // Find the timing config for this detail from calendarDetailTimings
            const timingConfig = validatedData.calendarDetailTimings.find(
              (t: any) => t.detailId === detail.id
            );
            
            if (!timingConfig) {
              console.warn(`No timing config found for calendar detail ${detail.id}, skipping`);
              continue;
            }
            
            // Calculate the scheduled date: detail.endDate + daysToInitiate
            // Use local date components to preserve the intended date
            let scheduledDate: Date;
            
            if (detail.endDate instanceof Date) {
              // Use LOCAL date components to preserve the date as it appears in server timezone
              scheduledDate = new Date(
                detail.endDate.getFullYear(),
                detail.endDate.getMonth(),
                detail.endDate.getDate()
              );
            } else {
              // Parse string date
              const dateStr = String(detail.endDate).split('T')[0];
              const [year, month, day] = dateStr.split('-').map(Number);
              scheduledDate = new Date(year, month - 1, day);
            }
            
            scheduledDate.setDate(scheduledDate.getDate() + Number(timingConfig.daysToInitiate));
            
            // Create the scheduled task
            await storage.createScheduledAppraisalTask({
              initiatedAppraisalId: initiatedAppraisal.id,
              frequencyCalendarDetailId: detail.id,
              scheduledDate: scheduledDate,
              status: 'pending',
            });
            
            console.log(`Created scheduled task for detail ${detail.id} at ${scheduledDate}`);
          }
          
          console.log(`Created ${selectedDetails.length} scheduled tasks for calendar-based appraisal`);
        } catch (error) {
          console.error("Error creating scheduled tasks:", error);
          // Don't fail the request, but log the error
        }
      }
      
      res.status(201).json({
        message: "Appraisal initiated successfully",
        appraisal: { ...initiatedAppraisal, status: validatedData.publishType === 'now' ? 'active' : 'draft' },
        evaluationsCreated,
        emailsSent
      });
      
    } catch (error) {
      console.error("Error initiating appraisal:", error);
      if (error.message?.includes('not found')) {
        return res.status(404).json({ message: "Appraisal group not found" });
      }
      if (error.message?.includes('access')) {
        return res.status(403).json({ message: "Access denied to this appraisal group" });
      }
      res.status(500).json({ message: "Failed to initiate appraisal" });
    }
  });

  // GET /api/initiated-appraisals - Get all initiated appraisals for HR manager
  app.get('/api/initiated-appraisals', isAuthenticated, requireRoles(['hr_manager']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const appraisals = await storage.getInitiatedAppraisals(requestingUserId);
      res.json(appraisals);
    } catch (error) {
      console.error('Error fetching initiated appraisals:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/process-scheduled-tasks - Process pending scheduled appraisal tasks (protected endpoint for cron/scheduler)
  app.post('/api/process-scheduled-tasks', isAuthenticated, requireRoles(['super_admin', 'admin', 'hr_manager']), async (req: any, res) => {
    try {
      const pendingTasks = await storage.getPendingScheduledTasks();
      
      if (pendingTasks.length === 0) {
        return res.json({ message: "No pending tasks to process", tasksProcessed: 0 });
      }
      
      let tasksProcessed = 0;
      let tasksFailed = 0;
      
      for (const task of pendingTasks) {
        try {
          console.log(`Processing scheduled task ${task.id} for appraisal ${task.initiatedAppraisalId}`);
          
          // Get the initiated appraisal details
          const [appraisal] = await db.select().from(initiatedAppraisals).where(eq(initiatedAppraisals.id, task.initiatedAppraisalId));
          if (!appraisal) {
            throw new Error(`Initiated appraisal ${task.initiatedAppraisalId} not found`);
          }
          
          // Get the calendar detail for timing information
          const [calendarDetail] = await db.select().from(frequencyCalendarDetails).where(eq(frequencyCalendarDetails.id, task.frequencyCalendarDetailId));
          if (!calendarDetail) {
            throw new Error(`Calendar detail ${task.frequencyCalendarDetailId} not found`);
          }
          
          // Get the timing config for this detail
          const [timingConfig] = await db.select().from(initiatedAppraisalDetailTimings).where(
            and(
              eq(initiatedAppraisalDetailTimings.initiatedAppraisalId, appraisal.id),
              eq(initiatedAppraisalDetailTimings.frequencyCalendarDetailId, calendarDetail.id)
            )
          );
          
          const daysToClose = timingConfig?.daysToClose || appraisal.daysToClose || 30;
          
          // Get all members of the appraisal group
          const members = await storage.getAppraisalGroupMembers(appraisal.appraisalGroupId, appraisal.createdById);
          const activeMembers = members.filter(member => member.user && member.user.status === 'active');
          
          let evaluationsCreated = 0;
          let emailsSent = 0;
          
          // Create evaluations for each active member
          for (const member of activeMembers) {
            const employee = member.user!;
            
            // Skip if employee is in excluded list
            if (appraisal.excludedEmployeeIds?.includes(employee.id)) {
              continue;
            }
            
            // Get the employee's manager
            let managerId = employee.reportingManagerId;
            if (!managerId) {
              managerId = appraisal.createdById;
            }
            
            // Create evaluation record with initiated appraisal link
            const evaluationData = {
              employeeId: employee.id,
              managerId: managerId,
              reviewCycleId: 'initiated-appraisal-' + appraisal.id + '-' + calendarDetail.id,
              initiatedAppraisalId: appraisal.id,
              status: 'not_started' as const,
            };
            
            try {
              await storage.createEvaluation(evaluationData);
              evaluationsCreated++;
              console.log(`Created evaluation for employee ${employee.id} (${employee.email})`);
            } catch (evalError) {
              console.error(`Failed to create evaluation for employee ${employee.id}:`, evalError);
            }
            
            // Send email notification to employee
            try {
              const { sendAppraisalInitiationEmail } = await import('./emailService');
              const dueDate = new Date(calendarDetail.endDate);
              dueDate.setDate(dueDate.getDate() + daysToClose);
              
              await sendAppraisalInitiationEmail(
                employee.email,
                `${employee.firstName} ${employee.lastName}`,
                appraisal.appraisalType,
                dueDate
              );
              emailsSent++;
              console.log(`Email sent successfully to ${employee.email}`);
            } catch (emailError) {
              console.error(`Failed to send email to ${employee.email}:`, emailError);
            }
          }
          
          // Mark task as completed
          await storage.updateScheduledTaskStatus(task.id, 'completed');
          tasksProcessed++;
          
          console.log(`Task ${task.id} completed: ${evaluationsCreated} evaluations created, ${emailsSent} emails sent`);
          
        } catch (taskError) {
          console.error(`Error processing task ${task.id}:`, taskError);
          await storage.updateScheduledTaskStatus(task.id, 'failed', taskError.message);
          tasksFailed++;
        }
      }
      
      res.json({
        message: "Scheduled tasks processing completed",
        tasksProcessed,
        tasksFailed,
        totalTasks: pendingTasks.length
      });
      
    } catch (error) {
      console.error("Error processing scheduled tasks:", error);
      res.status(500).json({ message: "Failed to process scheduled tasks" });
    }
  });

  // Development endpoints for user seeding and testing
  // Development endpoints - only available in development environment
  if (process.env.NODE_ENV === 'development') {
    app.post('/api/dev/seed-users', async (req, res) => {
      try {
        await seedTestUsers();
        res.json({ 
          message: "Test users seeded successfully",
          users: testUsers.map(u => ({ 
            role: u.role, 
            email: u.email, 
            name: `${u.firstName} ${u.lastName}` 
          }))
        });
      } catch (error) {
        console.error("Error seeding users:", error);
        res.status(500).json({ message: "Failed to seed users" });
      }
    });

    app.get('/api/dev/test-users', async (req, res) => {
      try {
        res.json({
          message: "Available test user accounts",
          instructions: "After seeding, you can login with any Replit account and manually change your role in the database, or use the 'Switch User' functionality if implemented",
          testUsers: testUsers.map(u => ({
            role: u.role,
            email: u.email,
            name: `${u.firstName} ${u.lastName}`,
            id: u.id
          }))
        });
      } catch (error) {
        console.error("Error getting test users:", error);
        res.status(500).json({ message: "Failed to get test users" });
      }
    });

    // Development login endpoint to bypass OAuth
    app.post('/api/dev/login', async (req, res) => {
      try {
        const { userId } = req.body;
        
        if (!userId) {
          return res.status(400).json({ message: "User ID is required" });
        }

        // Get the user from storage
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Set the user in the session (mimicking OAuth flow)
        const expires_at = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days from now
        
        (req.session as any).passport = {
          user: {
            id: user.id,
            claims: {
              sub: user.id,
              email: user.email,
              first_name: user.firstName,
              last_name: user.lastName,
              exp: expires_at
            },
            expires_at: expires_at,
            access_token: 'dev-token',
            refresh_token: 'dev-refresh-token'
          }
        };

        // Mark request as authenticated for immediate use
        (req as any).user = (req.session as any).passport.user;

        res.json({ 
          message: "Logged in successfully",
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role
          }
        });
      } catch (error) {
        console.error("Error in dev login:", error);
        res.status(500).json({ message: "Failed to login" });
      }
    });
  } else {
    // In production, return 404 for all dev endpoints
    app.all('/api/dev/*', (req, res) => {
      res.status(404).json({ message: "Not found" });
    });
  }

  // Generate evaluations for initiated appraisal
  app.post('/api/initiated-appraisals/:appraisalId/generate-evaluations', isAuthenticated, requireRoles(['hr_manager']), async (req: any, res) => {
    try {
      const { appraisalId } = req.params;
      const requestingUserId = req.user.claims.sub;
      
      // Verify initiated appraisal exists and belongs to the HR manager
      const userAppraisals = await storage.getInitiatedAppraisals(requestingUserId);
      const targetAppraisal = userAppraisals.find(appraisal => appraisal.id === appraisalId);
      
      if (!targetAppraisal) {
        return res.status(403).json({ message: "Initiated appraisal not found or access denied" });
      }

      // Get all members of the appraisal group
      const members = await storage.getAppraisalGroupMembers(targetAppraisal.appraisalGroupId);
      const activeMembers = members.filter(member => member.user && member.user.status === 'active');
      
      if (activeMembers.length === 0) {
        return res.status(400).json({ message: "No active members found in the appraisal group" });
      }

      const createdEvaluations = [];
      
      for (const member of activeMembers) {
        const employee = member.user!;
        
        // Check if evaluation already exists for this employee and initiated appraisal
        const existingEvaluations = await storage.getEvaluationsByInitiatedAppraisal(appraisalId);
        const existingEvaluation = existingEvaluations.find(evaluation => evaluation.employeeId === employee.id);
        
        if (existingEvaluation) {
          console.log(`Evaluation already exists for employee ${employee.id} in initiated appraisal ${appraisalId}, skipping`);
          continue;
        }
        
        // Get the employee's manager
        let managerId = employee.reportingManagerId;
        if (!managerId) {
          // If no manager assigned, use the HR manager who created the appraisal
          managerId = requestingUserId;
          console.warn(`No manager found for employee ${employee.id}, using HR manager as fallback`);
        }
        
        // Create evaluation record with initiated appraisal link
        const evaluationData = {
          employeeId: employee.id,
          managerId: managerId,
          reviewCycleId: 'initiated-appraisal-' + appraisalId, // Create a synthetic review cycle ID
          initiatedAppraisalId: appraisalId, // Link to the initiated appraisal
          status: 'not_started' as const,
        };
        
        const evaluation = await storage.createEvaluation(evaluationData);
        createdEvaluations.push(evaluation);
      }
      
      res.status(201).json({
        message: `Created ${createdEvaluations.length} evaluations for initiated appraisal`,
        evaluations: createdEvaluations,
        totalMembers: activeMembers.length,
        skipped: activeMembers.length - createdEvaluations.length
      });
    } catch (error) {
      console.error("Error generating evaluations for initiated appraisal:", error);
      res.status(500).json({ message: "Failed to generate evaluations" });
    }
  });

  // Get scheduled meetings for HR Manager
  app.get('/api/hr-manager/scheduled-meetings', isAuthenticated, requireRoles(['hr_manager']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      
      // Get user to find company ID
      const user = await storage.getUser(requestingUserId);
      if (!user || !user.companyId) {
        return res.status(404).json({ message: "User or company not found" });
      }
      
      // Get all scheduled meetings for the company
      const meetings = await storage.getScheduledMeetingsForCompany(user.companyId);
      
      res.json(meetings);
    } catch (error) {
      console.error("Error fetching scheduled meetings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Send Reminder Email endpoint
  app.post('/api/send-reminder', isAuthenticated, requireRoles(['hr_manager']), async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      
      // Validate request body with Zod schema
      const { employeeId, initiatedAppraisalId } = sendReminderRequestSchema.parse(req.body);

      // Get employee details
      const employee = await storage.getUser(employeeId, requestingUserId);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      // Verify the initiated appraisal exists and belongs to the requesting HR manager
      const userAppraisals = await storage.getInitiatedAppraisals(requestingUserId);
      const targetAppraisal = userAppraisals.find(appraisal => appraisal.id === initiatedAppraisalId);
      
      if (!targetAppraisal) {
        return res.status(403).json({ message: "Initiated appraisal not found or access denied" });
      }

      // Verify the employee is part of this appraisal and needs a reminder
      const progress = targetAppraisal.progress;
      if (!progress || !progress.employeeProgress) {
        return res.status(400).json({ message: "No progress data available for this appraisal" });
      }

      const employeeProgress = progress.employeeProgress.find((ep: any) => ep.employee.id === employeeId);
      if (!employeeProgress) {
        return res.status(403).json({ message: "Employee is not part of this appraisal" });
      }

      if (employeeProgress.status === 'completed') {
        return res.status(400).json({ message: "Employee has already completed their evaluation" });
      }

      // Calculate due date (7 days from now as default)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
      const formattedDueDate = dueDate.toLocaleDateString();

      // Extract manager email from evaluation data
      const managerEmail = employeeProgress.evaluation?.manager?.email;

      // Send reminder email with manager CC
      await sendReviewReminder(
        employee.email,
        `${employee.firstName} ${employee.lastName}`,
        formattedDueDate,
        managerEmail
      );

      res.json({ 
        message: "Reminder sent successfully",
        employeeName: `${employee.firstName} ${employee.lastName}`,
        employeeEmail: employee.email,
        dueDate: formattedDueDate,
        managerCc: managerEmail || null
      });
    } catch (error) {
      console.error("Error sending reminder:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to send reminder" });
    }
  });

  // Manager Workflow API Routes (moved above to avoid route conflicts)

  // Submit manager review with remarks and final rating
  app.put('/api/evaluations/:id/manager-review', isAuthenticated, requireRoles(['manager']), async (req: any, res) => {
    try {
      const evaluationId = req.params.id;
      const managerId = req.user.claims.sub;
      
      const { managerRemarks, finalRating, managerEvaluationData } = req.body;
      
      // Validate the evaluation belongs to this manager
      const evaluation = await storage.getEvaluation(evaluationId);
      if (!evaluation) {
        return res.status(404).json({ message: "Evaluation not found" });
      }
      if (evaluation.managerId !== managerId) {
        return res.status(403).json({ message: "Access denied: You can only review evaluations for your direct reports" });
      }
      if (!evaluation.selfEvaluationSubmittedAt) {
        return res.status(400).json({ message: "Cannot review: Employee hasn't submitted their evaluation yet" });
      }
      
      // Prepare manager evaluation data with remarks (only add if provided)
      const completeManagerEvaluationData = {
        ...managerEvaluationData,
        ...(managerRemarks && { managerRemarks })
      };
      
      // Prepare update data
      const updateData: any = {
        managerEvaluationData: completeManagerEvaluationData,
        managerEvaluationSubmittedAt: new Date(),
        status: 'reviewed'
      };
      
      // Only set overallRating if finalRating is provided
      if (finalRating !== undefined && finalRating !== null) {
        updateData.overallRating = finalRating;
      }
      
      // Update evaluation with manager review
      const updatedEvaluation = await storage.updateEvaluation(evaluationId, updateData);
      
      // Send email notification to employee when manager submits evaluation
      try {
        const employee = await storage.getUser(evaluation.employeeId);
        const manager = await storage.getUser(managerId);
        
        // Defensive checks for required email fields
        if (employee && employee.email && manager && manager.email && employee.companyId) {
          // Get HR managers for the company
          const hrManagers = await storage.getUsers({ role: 'hr_manager', companyId: employee.companyId });
          const hrManagerEmails = hrManagers
            .filter(hrm => hrm.email)
            .map(hrm => hrm.email as string);
          
          const { sendManagerSubmissionNotification } = await import('./emailService');
          await sendManagerSubmissionNotification(
            employee.email,
            `${employee.firstName} ${employee.lastName}`,
            `${manager.firstName} ${manager.lastName}`,
            manager.email,
            updatedEvaluation.id,
            hrManagerEmails
          );
          console.log(`Manager submission notification sent to employee ${employee.email} with CC to ${hrManagerEmails.length} HR manager(s)`);
        } else {
          console.log('Skipping email notification: Missing required email addresses or company ID');
        }
      } catch (emailError) {
        console.error('Failed to send manager submission notification:', emailError);
        // Don't fail the request if email fails
      }
      
      res.json({
        message: "Manager review submitted successfully",
        evaluation: updatedEvaluation
      });
    } catch (error) {
      console.error("Error submitting manager review:", error);
      res.status(500).json({ message: "Failed to submit manager review" });
    }
  });

  // Schedule one-on-one meeting and send calendar invite
  app.post('/api/evaluations/:id/schedule-meeting', isAuthenticated, requireRoles(['manager']), async (req: any, res) => {
    try {
      const evaluationId = req.params.id;
      const managerId = req.user.claims.sub;
      
      const { meetingDate, meetingTitle, meetingDescription } = req.body;
      
      if (!meetingDate) {
        return res.status(400).json({ message: "Meeting date is required" });
      }
      
      // Validate the evaluation belongs to this manager
      const evaluation = await storage.getEvaluation(evaluationId);
      if (!evaluation) {
        return res.status(404).json({ message: "Evaluation not found" });
      }
      if (evaluation.managerId !== managerId) {
        return res.status(403).json({ message: "Access denied: You can only schedule meetings for your direct reports" });
      }
      if (!evaluation.managerEvaluationSubmittedAt) {
        return res.status(400).json({ message: "Cannot schedule meeting: Complete your review first" });
      }

      // Get employee and manager details
      const employee = await storage.getUser(evaluation.employeeId);
      const manager = await storage.getUser(managerId);
      
      if (!employee || !manager) {
        return res.status(404).json({ message: "Employee or manager not found" });
      }

      // Update evaluation with meeting schedule
      const updatedEvaluation = await storage.updateEvaluation(evaluationId, {
        meetingScheduledAt: new Date(meetingDate)
      });

      // Send calendar invite
      const { sendMeetingInvite } = await import('./emailService');
      await sendMeetingInvite(
        employee.email,
        `${employee.firstName} ${employee.lastName}`,
        `${manager.firstName} ${manager.lastName}`,
        new Date(meetingDate),
        meetingTitle || 'Performance Review One-on-One Meeting',
        meetingDescription || 'Discussion about your performance review and career development.'
      );

      res.json({
        message: "Meeting scheduled successfully and calendar invite sent",
        evaluation: updatedEvaluation,
        meetingDetails: {
          date: meetingDate,
          title: meetingTitle || 'Performance Review One-on-One Meeting',
          attendees: [employee.email, manager.email]
        }
      });
    } catch (error) {
      console.error("Error scheduling meeting:", error);
      res.status(500).json({ message: "Failed to schedule meeting" });
    }
  });

  // Employee-initiated meeting scheduling
  app.post('/api/evaluations/:id/schedule-meeting-employee', isAuthenticated, requireRoles(['employee']), async (req: any, res) => {
    try {
      const evaluationId = req.params.id;
      const employeeId = req.user.claims.sub;
      
      const { meetingDate, duration, location, notes } = req.body;
      
      if (!meetingDate) {
        return res.status(400).json({ message: "Meeting date is required" });
      }
      
      // Validate the evaluation belongs to this employee
      const evaluation = await storage.getEvaluation(evaluationId);
      if (!evaluation) {
        return res.status(404).json({ message: "Evaluation not found" });
      }
      if (evaluation.employeeId !== employeeId) {
        return res.status(403).json({ message: "Access denied: You can only schedule meetings for your own evaluations" });
      }
      if (!evaluation.managerEvaluationSubmittedAt) {
        return res.status(400).json({ message: "Cannot schedule meeting: Manager review must be completed first" });
      }

      // Get employee and manager details
      const employee = await storage.getUser(evaluation.employeeId);
      const manager = await storage.getUser(evaluation.managerId);
      
      if (!employee || !manager) {
        return res.status(404).json({ message: "Employee or manager not found" });
      }

      // Update evaluation with meeting schedule and details
      const meetingDetails = {
        scheduledDate: new Date(meetingDate),
        duration: duration || 60,
        location: location || 'office',
        notes: notes || ''
      };
      
      const updatedEvaluation = await storage.updateEvaluation(evaluationId, {
        meetingScheduledAt: new Date(meetingDate),
        meetingDetails: meetingDetails
      });

      // Send calendar invite to both employee and manager using the email service function
      const { sendCalendarInvite } = await import('./emailService');
      await sendCalendarInvite(
        employee.email,
        manager.email,
        `${employee.firstName} ${employee.lastName}`,
        `${manager.firstName} ${manager.lastName}`,
        new Date(meetingDate),
        employee.companyId!, // Pass company ID for multi-tenant calendar support
        duration || 60,
        location || 'office',
        notes || ''
      );

      res.json({
        message: "Meeting request sent successfully and calendar invites have been sent",
        evaluation: updatedEvaluation,
        meetingDetails: {
          date: meetingDate,
          duration: duration || 60,
          location: location || 'office',
          notes: notes || '',
          attendees: [employee.email, manager.email]
        }
      });
    } catch (error) {
      console.error('Error scheduling employee meeting:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add or update meeting notes
  app.put('/api/evaluations/:id/meeting-notes', isAuthenticated, async (req: any, res) => {
    try {
      const evaluationId = req.params.id;
      const managerId = req.user.claims.sub;
      
      const { meetingNotes, finalRating, showNotesToEmployee } = req.body;
      
      if (!meetingNotes) {
        return res.status(400).json({ message: "Meeting notes are required" });
      }
      
      // Validate the evaluation belongs to this manager
      const evaluation = await storage.getEvaluation(evaluationId);
      if (!evaluation) {
        return res.status(404).json({ message: "Evaluation not found" });
      }
      if (evaluation.managerId !== managerId) {
        return res.status(403).json({ message: "Access denied: You can only add notes for your direct reports" });
      }
      if (!evaluation.meetingScheduledAt) {
        return res.status(400).json({ message: "Cannot add notes: Schedule a meeting first" });
      }

      // Update evaluation with meeting notes
      const updateData: any = {
        meetingNotes,
        meetingCompletedAt: new Date()
      };
      
      // Only set showNotesToEmployee if provided
      if (showNotesToEmployee !== undefined) {
        updateData.showNotesToEmployee = showNotesToEmployee;
      }
      
      // Allow updating final rating if provided
      if (finalRating !== undefined) {
        updateData.overallRating = finalRating;
      }
      
      const updatedEvaluation = await storage.updateEvaluation(evaluationId, updateData);
      
      res.json({
        message: "Meeting notes saved successfully",
        evaluation: updatedEvaluation
      });
    } catch (error) {
      console.error("Error saving meeting notes:", error);
      res.status(500).json({ message: "Failed to save meeting notes" });
    }
  });

  // Mark evaluation as completed and send notifications
  app.post('/api/evaluations/:id/complete', isAuthenticated, async (req: any, res) => {
    try {
      const evaluationId = req.params.id;
      const managerId = req.user.claims.sub;
      
      // Validate the evaluation belongs to this manager
      const evaluation = await storage.getEvaluation(evaluationId);
      if (!evaluation) {
        return res.status(404).json({ message: "Evaluation not found" });
      }
      if (evaluation.managerId !== managerId) {
        return res.status(403).json({ message: "Access denied: You can only complete evaluations for your direct reports" });
      }
      if (!evaluation.managerEvaluationSubmittedAt) {
        return res.status(400).json({ message: "Cannot complete: Submit your review first" });
      }
      if (evaluation.finalizedAt) {
        return res.status(400).json({ message: "Evaluation already completed" });
      }

      // Mark evaluation as completed
      const updatedEvaluation = await storage.updateEvaluation(evaluationId, {
        status: 'completed',
        finalizedAt: new Date()
      });

      // Get all parties for notification
      const employee = await storage.getUser(evaluation.employeeId);
      const manager = await storage.getUser(managerId);
      
      if (!employee || !manager) {
        return res.status(404).json({ message: "Employee or manager not found" });
      }

      // Find HR Manager(s) from the same company
      const allUsers = await storage.getUsers({ role: 'hr_manager' });
      const hrManagers = allUsers.filter(user => user.companyId === manager.companyId);
      
      // Send completion notifications
      const { sendEvaluationCompletionNotification } = await import('./emailService');
      
      // Prepare employee data for email
      const employeeData = {
        name: `${employee.firstName} ${employee.lastName}`,
        code: employee.code,
        email: employee.email
      };
      
      const managerFullName = `${manager.firstName} ${manager.lastName}`;
      
      // Notify employee (primary recipient)
      await sendEvaluationCompletionNotification(
        employee.email,
        `${employee.firstName} ${employee.lastName}`,
        managerFullName,
        updatedEvaluation,
        'employee',
        employeeData,
        managerFullName
      );

      // Notify manager (secondary recipient) 
      await sendEvaluationCompletionNotification(
        manager.email,
        `${manager.firstName} ${manager.lastName}`,
        `${employee.firstName} ${employee.lastName}`,
        updatedEvaluation,
        'manager',
        employeeData,
        managerFullName
      );

      // Notify HR Manager(s) (CC recipients)
      for (const hrManager of hrManagers) {
        if (hrManager.email) {
          await sendEvaluationCompletionNotification(
            hrManager.email,
            `${hrManager.firstName} ${hrManager.lastName}`,
            `${employee.firstName} ${employee.lastName}`,
            updatedEvaluation,
            'hr_manager',
            employeeData,
            managerFullName
          );
        }
      }

      res.json({
        message: "Evaluation completed successfully and notifications sent",
        evaluation: updatedEvaluation,
        notificationsSent: {
          employee: employee.email,
          manager: manager.email,
          hrManagers: hrManagers.map(hr => hr.email).filter(Boolean)
        }
      });
    } catch (error) {
      console.error("Error completing evaluation:", error);
      res.status(500).json({ message: "Failed to complete evaluation" });
    }
  });

  // Development Goals API routes
  
  // Get all development goals for current employee
  app.get('/api/development-goals', isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = req.user.claims.sub;
      const goals = await storage.getDevelopmentGoals(employeeId);
      
      // Fetch evaluation details for each goal
      const goalsWithDetails = await Promise.all(goals.map(async (goal) => {
        const evaluation = await storage.getEvaluation(goal.evaluationId);
        let appraisalCycle = null;
        let frequencyCalendarPeriod = null;
        
        if (evaluation?.initiatedAppraisalId) {
          const initiatedAppraisal = await storage.getInitiatedAppraisal(evaluation.initiatedAppraisalId);
          if (initiatedAppraisal?.frequencyCalendarId) {
            const frequencyCalendar = await storage.getFrequencyCalendarById(initiatedAppraisal.frequencyCalendarId);
            if (frequencyCalendar?.appraisalCycleId) {
              appraisalCycle = await storage.getAppraisalCycleById(frequencyCalendar.appraisalCycleId);
            }
            
            // Get the frequency calendar period from initiated_appraisal_detail_timings
            const detailTimings = await storage.getInitiatedAppraisalDetailTimings(evaluation.initiatedAppraisalId);
            if (detailTimings.length > 0) {
              const detailTiming = detailTimings[0];
              const calendarDetails = await storage.getFrequencyCalendarDetailsByCalendarId(initiatedAppraisal.frequencyCalendarId);
              const matchingDetail = calendarDetails.find(d => d.id === detailTiming.frequencyCalendarDetailId);
              if (matchingDetail) {
                frequencyCalendarPeriod = {
                  displayName: matchingDetail.displayName,
                  startDate: matchingDetail.startDate,
                  endDate: matchingDetail.endDate,
                };
              }
            }
          }
        }
        
        return {
          ...goal,
          evaluation: evaluation ? {
            id: evaluation.id,
            status: evaluation.status,
            meetingCompletedAt: evaluation.meetingCompletedAt,
            overallRating: evaluation.overallRating,
          } : null,
          appraisalCycle: appraisalCycle ? {
            id: appraisalCycle.id,
            code: appraisalCycle.code,
            description: appraisalCycle.description,
          } : null,
          frequencyCalendarPeriod,
        };
      }));
      
      res.json(goalsWithDetails);
    } catch (error) {
      console.error("Error fetching development goals:", error);
      res.status(500).json({ message: "Failed to fetch development goals" });
    }
  });

  // Get development goals for a specific evaluation
  app.get('/api/development-goals/evaluation/:evaluationId', isAuthenticated, async (req: any, res) => {
    try {
      const { evaluationId } = req.params;
      const userId = req.user.claims.sub;
      
      // Verify the user has access to this evaluation
      const evaluation = await storage.getEvaluation(evaluationId);
      if (!evaluation) {
        return res.status(404).json({ message: "Evaluation not found" });
      }
      
      // Only allow the employee who owns the evaluation to access their goals
      if (evaluation.employeeId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const goals = await storage.getDevelopmentGoalsByEvaluation(evaluationId);
      res.json(goals);
    } catch (error) {
      console.error("Error fetching development goals for evaluation:", error);
      res.status(500).json({ message: "Failed to fetch development goals" });
    }
  });

  // Get completed evaluations eligible for development goals
  // IMPORTANT: This route must come before parameterized routes like /api/development-goals/:id
  app.get('/api/development-goals/eligible-evaluations', isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = req.user.claims.sub;
      // Get all evaluations for this employee
      const evaluations = await storage.getEvaluations({ employeeId });
      
      // Filter to only completed evaluations (meeting completed)
      const withMeeting = evaluations.filter(e => e.meetingCompletedAt);
      
      const eligibleEvaluations = await Promise.all(
        withMeeting
          .map(async (evaluation) => {
            let appraisalCycle = null;
            let frequencyCalendarPeriod = null;
            let isActiveAppraisalCycle = false;
            
            if (evaluation.initiatedAppraisalId) {
              const initiatedAppraisal = await storage.getInitiatedAppraisal(evaluation.initiatedAppraisalId);
              
              if (initiatedAppraisal?.frequencyCalendarId) {
                const frequencyCalendar = await storage.getFrequencyCalendarById(initiatedAppraisal.frequencyCalendarId);
                
                if (frequencyCalendar?.appraisalCycleId) {
                  appraisalCycle = await storage.getAppraisalCycleById(frequencyCalendar.appraisalCycleId);
                  isActiveAppraisalCycle = appraisalCycle?.status === 'active';
                }
                
                // Get the frequency calendar period from initiated_appraisal_detail_timings
                const detailTimings = await storage.getInitiatedAppraisalDetailTimings(evaluation.initiatedAppraisalId!);
                if (detailTimings.length > 0) {
                  const detailTiming = detailTimings[0]; // Each initiated appraisal typically has one period
                  const calendarDetails = await storage.getFrequencyCalendarDetailsByCalendarId(initiatedAppraisal.frequencyCalendarId);
                  const matchingDetail = calendarDetails.find(d => d.id === detailTiming.frequencyCalendarDetailId);
                  if (matchingDetail) {
                    frequencyCalendarPeriod = {
                      displayName: matchingDetail.displayName,
                      startDate: matchingDetail.startDate,
                      endDate: matchingDetail.endDate,
                    };
                  }
                }
              }
            }
            
            // Get existing goals count for this evaluation
            const existingGoals = await storage.getDevelopmentGoalsByEvaluation(evaluation.id);
            
            return {
              id: evaluation.id,
              meetingCompletedAt: evaluation.meetingCompletedAt,
              overallRating: evaluation.overallRating,
              appraisalCycle: appraisalCycle ? {
                id: appraisalCycle.id,
                code: appraisalCycle.code,
                description: appraisalCycle.description,
                status: appraisalCycle.status,
              } : null,
              frequencyCalendarPeriod,
              isActiveAppraisalCycle,
              goalsCount: existingGoals.length,
            };
          })
      );
      
      // Only return evaluations with active appraisal cycles
      const activeEligibleEvaluations = eligibleEvaluations.filter(e => e.isActiveAppraisalCycle);
      
      res.json(activeEligibleEvaluations);
    } catch (error) {
      console.error("Error fetching eligible evaluations:", error);
      res.status(500).json({ message: "Failed to fetch eligible evaluations" });
    }
  });

  // Create a new development goal
  app.post('/api/development-goals', isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = req.user.claims.sub;
      const goalData = insertDevelopmentGoalSchema.parse({
        ...req.body,
        employeeId,
      });
      
      // Verify the evaluation exists and belongs to this employee
      const evaluation = await storage.getEvaluation(goalData.evaluationId);
      if (!evaluation) {
        return res.status(404).json({ message: "Evaluation not found" });
      }
      if (evaluation.employeeId !== employeeId) {
        return res.status(403).json({ message: "Access denied: You can only add goals to your own evaluations" });
      }
      
      // Verify the evaluation is completed (meeting completed)
      if (!evaluation.meetingCompletedAt) {
        return res.status(400).json({ message: "Development goals can only be added after the evaluation meeting is completed" });
      }
      
      // Verify the appraisal cycle is still active
      if (evaluation.initiatedAppraisalId) {
        const initiatedAppraisal = await storage.getInitiatedAppraisal(evaluation.initiatedAppraisalId);
        if (initiatedAppraisal?.frequencyCalendarId) {
          const frequencyCalendar = await storage.getFrequencyCalendar(initiatedAppraisal.frequencyCalendarId, '');
          if (frequencyCalendar?.appraisalCycleId) {
            const appraisalCycle = await storage.getAppraisalCycle(frequencyCalendar.appraisalCycleId, '');
            if (appraisalCycle?.status !== 'active') {
              return res.status(400).json({ message: "Development goals can only be added for active appraisal cycles" });
            }
          }
        }
      }
      
      const goal = await storage.createDevelopmentGoal(goalData);
      res.status(201).json(goal);
    } catch (error) {
      console.error("Error creating development goal:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create development goal" });
    }
  });

  // Update a development goal
  app.put('/api/development-goals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const employeeId = req.user.claims.sub;
      
      // Verify the goal exists and belongs to this employee
      const existingGoal = await storage.getDevelopmentGoal(id);
      if (!existingGoal) {
        return res.status(404).json({ message: "Development goal not found" });
      }
      if (existingGoal.employeeId !== employeeId) {
        return res.status(403).json({ message: "Access denied: You can only edit your own goals" });
      }
      
      const updateData = updateDevelopmentGoalSchema.parse(req.body);
      const updatedGoal = await storage.updateDevelopmentGoal(id, updateData);
      res.json(updatedGoal);
    } catch (error) {
      console.error("Error updating development goal:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update development goal" });
    }
  });

  // Delete a development goal
  app.delete('/api/development-goals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const employeeId = req.user.claims.sub;
      
      // Verify the goal exists and belongs to this employee
      const existingGoal = await storage.getDevelopmentGoal(id);
      if (!existingGoal) {
        return res.status(404).json({ message: "Development goal not found" });
      }
      if (existingGoal.employeeId !== employeeId) {
        return res.status(403).json({ message: "Access denied: You can only delete your own goals" });
      }
      
      await storage.deleteDevelopmentGoal(id);
      res.json({ message: "Development goal deleted successfully" });
    } catch (error) {
      console.error("Error deleting development goal:", error);
      res.status(500).json({ message: "Failed to delete development goal" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
