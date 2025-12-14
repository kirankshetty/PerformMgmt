import nodemailer from 'nodemailer';
import { storage } from './storage';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  async initializeTransporter() {
    try {
      const config = await storage.getEmailConfig();
      if (!config) {
        throw new Error('Email configuration not found');
      }

      this.transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465,
        auth: {
          user: config.smtpUsername,
          pass: config.smtpPassword,
        },
      });

      // Verify connection
      await this.transporter.verify();
      console.log('Email service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      throw error;
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    if (!this.transporter) {
      await this.initializeTransporter();
    }

    if (!this.transporter) {
      throw new Error('Email transporter not initialized');
    }

    const config = await storage.getEmailConfig();
    if (!config) {
      throw new Error('Email configuration not found');
    }

    const mailOptions = {
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      cc: options.cc,
      bcc: options.bcc,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${options.to}`);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  generateReviewInvitationEmail(employeeName: string, reviewCycleId: string): { subject: string; html: string } {
    const subject = 'Performance Review - Action Required';
    const reviewLink = `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}/evaluations/${reviewCycleId}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Performance Review Invitation</h2>
        <p>Dear ${employeeName},</p>
        <p>You have been invited to complete your performance review. Please click the link below to access the review form:</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${reviewLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Complete Review
          </a>
        </div>
        <p>If you have any questions, please contact your HR manager.</p>
        <p>Best regards,<br>HR Team</p>
      </div>
    `;

    return { subject, html };
  }

  generateReviewReminderEmail(employeeName: string, dueDate: string): { subject: string; html: string } {
    const subject = 'Performance Review Reminder - Due Soon';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">Performance Review Reminder</h2>
        <p>Dear ${employeeName},</p>
        <p>This is a friendly reminder that your performance review is due on <strong>${dueDate}</strong>.</p>
        <p>Please complete your review as soon as possible to avoid any delays.</p>
        <p>Best regards,<br>HR Team</p>
      </div>
    `;

    return { subject, html };
  }

  generateReviewCompletionEmail(employeeName: string, managerName: string): { subject: string; html: string } {
    const subject = 'Performance Review Completed';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Performance Review Completed</h2>
        <p>Dear ${employeeName},</p>
        <p>Your performance review has been completed by ${managerName}. The review results are now available in your dashboard.</p>
        <p>Thank you for your participation in the review process.</p>
        <p>Best regards,<br>HR Team</p>
      </div>
    `;

    return { subject, html };
  }

  generateRegistrationNotificationEmail(name: string, companyName: string, designation: string, email: string, mobile: string): { subject: string; html: string } {
    const subject = 'New Performance Hub Registration Interest';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Registration Interest - Performance Hub</h2>
        <p>A new company has expressed interest in Performance Hub SaaS platform:</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #334155;">Contact Details</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Company:</strong> ${companyName}</p>
          <p><strong>Designation:</strong> ${designation}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <p><strong>Mobile:</strong> ${mobile}</p>
        </div>
        
        <p><strong>Submitted on:</strong> ${new Date().toLocaleString()}</p>
        
        <div style="text-align: center; margin: 20px 0;">
          <a href="mailto:${email}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Contact ${name}
          </a>
        </div>
        
        <p>Please follow up with this potential customer to discuss their Performance Management needs and onboarding process.</p>
        
        <p style="color: #64748b; font-size: 14px;">
          This email was automatically generated by Performance Hub registration system.
        </p>
      </div>
    `;

    return { subject, html };
  }

  generateCalendarInvite(employeeName: string, managerName: string, meetingDate: Date, duration?: number, location?: string, notes?: string, employeeEmail?: string, managerEmail?: string): string {
    const durationMinutes = duration || 60;
    const startDate = meetingDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endDate = new Date(meetingDate.getTime() + durationMinutes * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const uid = `${Date.now()}-${Math.random().toString(36).substring(2)}@performance-review.com`;
    
    let description = `One-on-one performance review meeting between ${employeeName} and ${managerName}`;
    if (notes) {
      description += `\\n\\nNotes: ${notes}`;
    }
    
    const locationLine = location ? `\nLOCATION:${location.charAt(0).toUpperCase() + location.slice(1)}` : '';
    
    // Use actual email addresses if provided, otherwise use placeholders
    const empEmail = employeeEmail || 'employee@company.com';
    const mgEmail = managerEmail || 'manager@company.com';
    
    // RFC5546-compliant ICS with METHOD:REQUEST for proper RSVP functionality
    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Performance Review System//EN
METHOD:REQUEST
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${startDate}
DTEND:${endDate}
SUMMARY:Performance Review Meeting - ${employeeName}
DESCRIPTION:${description}
ORGANIZER;CN=${employeeName}:mailto:${empEmail}
ATTENDEE;CN=${employeeName};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${empEmail}
ATTENDEE;CN=${managerName};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${mgEmail}
SEQUENCE:0
STATUS:CONFIRMED${locationLine}
TRANSP:OPAQUE
END:VEVENT
END:VCALENDAR`;
  }
}

const emailService = new EmailService();

export async function sendEmail(options: EmailOptions): Promise<void> {
  return emailService.sendEmail(options);
}

export async function sendReviewInvitation(employeeEmail: string, employeeName: string, reviewCycleId: string): Promise<void> {
  const { subject, html } = emailService.generateReviewInvitationEmail(employeeName, reviewCycleId);
  return emailService.sendEmail({
    to: employeeEmail,
    subject,
    html,
  });
}

export async function sendReviewReminder(employeeEmail: string, employeeName: string, dueDate: string, managerEmail?: string): Promise<void> {
  const { subject, html } = emailService.generateReviewReminderEmail(employeeName, dueDate);
  return emailService.sendEmail({
    to: employeeEmail,
    subject,
    html,
    cc: managerEmail,
  });
}

export async function sendAppraisalInitiationEmail(employeeEmail: string, employeeName: string, appraisalType: string, dueDate?: Date): Promise<void> {
  const dueDateStr = dueDate ? dueDate.toLocaleDateString() : 'TBD';
  const subject = 'New Performance Appraisal - Action Required';
  const appraisalLink = `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}/employee/evaluations`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">New Performance Appraisal Initiated</h2>
      <p>Dear ${employeeName},</p>
      <p>A new ${appraisalType.replace('_', ' ').toUpperCase()} performance appraisal has been initiated for you.</p>
      <p><strong>Due Date:</strong> ${dueDateStr}</p>
      <p>Please complete your self-evaluation and prepare for your performance review meeting.</p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="${appraisalLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Appraisal
        </a>
      </div>
      <p>If you have any questions, please contact your HR manager or your reporting manager.</p>
      <p>Best regards,<br>HR Team</p>
    </div>
  `;
  
  return emailService.sendEmail({
    to: employeeEmail,
    subject,
    html,
  });
}

export async function sendReviewCompletion(employeeEmail: string, employeeName: string, managerName: string): Promise<void> {
  const { subject, html } = emailService.generateReviewCompletionEmail(employeeName, managerName);
  return emailService.sendEmail({
    to: employeeEmail,
    subject,
    html,
  });
}

export async function sendCalendarInvite(employeeEmail: string, managerEmail: string, employeeName: string, managerName: string, meetingDate: Date, companyId: string, duration?: number, location?: string, notes?: string): Promise<void> {
  // Try to create calendar event using external APIs first
  const { createPerformanceReviewMeeting } = await import('./calendarService');
  
  const calendarResult = await createPerformanceReviewMeeting(
    employeeName,
    managerName,
    employeeEmail,
    managerEmail,
    meetingDate,
    companyId,
    duration,
    location,
    notes
  );

  // If Google Calendar or Outlook API succeeded, they will send their own invitations
  // with native RSVP functionality - no need to send our own email
  if (calendarResult.success && calendarResult.provider !== 'ics') {
    console.log(`Calendar invitation sent via ${calendarResult.provider} API with event ID: ${calendarResult.eventId}`);
    return; // Let Google/Outlook handle the invitation
  }

  // Format dates like Gmail calendar invitations
  const startTime = meetingDate.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  const endTime = new Date(meetingDate.getTime() + (duration || 60) * 60000).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  const dayName = meetingDate.toLocaleDateString('en-US', { weekday: 'short' });
  const dateFormatted = meetingDate.toLocaleDateString('en-US', { 
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  
  // Gmail-style subject line
  const subject = `Invitation: Performance Review @ ${dayName} ${dateFormatted} ${startTime} - ${endTime} (${employeeEmail})`;
  
  const locationText = location === 'video' ? 'Video Call' : 
                      location === 'phone' ? 'Phone Call' : 
                      location === 'office' ? 'Office - In Person' : 'Office';
  
  // Generate Google Meet link for video calls
  const meetingLink = location === 'video' ? `meet.google.com/${Math.random().toString(36).substring(2, 10)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}` : null;
  
  // Gmail-style calendar invitation HTML
  const html = `
    <div style="font-family: 'Google Sans', Roboto, RobotoDraft, Helvetica, Arial, sans-serif; background-color: #f8f9fa; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background-color: #1a73e8; color: white; padding: 12px 24px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="background-color: #4285f4; border-radius: 4px; padding: 8px 12px; text-align: center; min-width: 60px;">
              <div style="font-size: 12px; opacity: 0.9;">Sept</div>
              <div style="font-size: 24px; font-weight: bold; line-height: 1;">${meetingDate.getDate()}</div>
              <div style="font-size: 12px; opacity: 0.9;">${dayName}</div>
            </div>
            <div style="flex: 1;">
              <h2 style="margin: 0; font-size: 18px; font-weight: 400;">Performance Review</h2>
            </div>
          </div>
        </div>

        <!-- Response Buttons -->
        <div style="padding: 16px 24px; border-bottom: 1px solid #e8eaed;">
          <div style="display: flex; gap: 8px; align-items: center;">
            <button style="background-color: #1a73e8; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-size: 14px; cursor: pointer;">Yes</button>
            <button style="background-color: #f8f9fa; color: #5f6368; border: 1px solid #dadce0; padding: 8px 16px; border-radius: 4px; font-size: 14px; cursor: pointer;">Maybe</button>
            <button style="background-color: #f8f9fa; color: #5f6368; border: 1px solid #dadce0; padding: 8px 16px; border-radius: 4px; font-size: 14px; cursor: pointer;">No</button>
          </div>
        </div>

        <!-- Meeting Details -->
        <div style="padding: 24px;">
          
          <!-- When -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <div style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#5f6368">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h3 style="margin: 0; font-size: 16px; color: #202124;">When</h3>
            </div>
            <div style="margin-left: 36px;">
              <div style="font-size: 14px; color: #5f6368; margin-bottom: 4px;">
                ${dayName} ${dateFormatted} · ${startTime} – ${endTime}
              </div>
              <div style="font-size: 12px; color: #5f6368;">
                Time zone · Does not repeat
              </div>
            </div>
          </div>

          <!-- Who -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <div style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#5f6368">
                  <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.996 1.996 0 0 0 18 7c-.8 0-1.54.5-1.85 1.26l-1.92 5.77c-.18.54.17 1.13.74 1.31.56.18 1.15-.17 1.33-.73L17.5 12H18v10h2zm-12.5 0v-6h2.5l-2.54-7.63A1.996 1.996 0 0 0 6 7c-.8 0-1.54.5-1.85 1.26l-1.92 5.77c-.18.54.17 1.13.74 1.31.56.18 1.15-.17 1.33-.73L5.5 12H6v10h2z"/>
                </svg>
              </div>
              <h3 style="margin: 0; font-size: 16px; color: #202124;">Add guests</h3>
            </div>
            <div style="margin-left: 36px;">
              <div style="font-size: 14px; color: #1a73e8; text-decoration: none;">
                ${employeeEmail}, ${managerEmail}
              </div>
            </div>
          </div>

          ${location === 'video' ? `
          <!-- Google Meet -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <div style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#0f9d58">
                  <path d="M15 12c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z"/>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h3 style="margin: 0; font-size: 16px; color: #202124;">Add Google Meet video conferencing</h3>
            </div>
          </div>
          ` : ''}

          ${location !== 'video' ? `
          <!-- Location -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <div style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#5f6368">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
              </div>
              <h3 style="margin: 0; font-size: 16px; color: #202124;">Add location</h3>
            </div>
            <div style="margin-left: 36px;">
              <div style="font-size: 14px; color: #5f6368;">
                ${locationText}
              </div>
            </div>
          </div>
          ` : ''}

          ${notes ? `
          <!-- Description -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <div style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#5f6368">
                  <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                </svg>
              </div>
              <h3 style="margin: 0; font-size: 16px; color: #202124;">Add description or a Google Drive attachment</h3>
            </div>
            <div style="margin-left: 36px;">
              <div style="font-size: 14px; color: #5f6368;">
                ${notes}
              </div>
            </div>
          </div>
          ` : ''}

          <!-- Organizer -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <div style="width: 24px; height: 24px; background-color: #4285f4; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">
                ${employeeName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style="font-size: 14px; color: #202124;">${employeeName}</div>
                <div style="font-size: 12px; color: #5f6368;">Busy · Default visibility · Notify 10 minutes before</div>
              </div>
            </div>
          </div>

        </div>

        ${location === 'video' && meetingLink ? `
        <!-- Join Meeting Section -->
        <div style="background-color: #f8f9fa; padding: 20px 24px; border-top: 1px solid #e8eaed;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <button style="background-color: #1a73e8; color: white; border: none; padding: 10px 24px; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer;">
              Join with Google Meet
            </button>
            <div style="text-align: right;">
              <div style="font-size: 12px; color: #5f6368; margin-bottom: 4px;">Meeting link</div>
              <div style="font-size: 14px; color: #1a73e8; text-decoration: none;">${meetingLink}</div>
            </div>
          </div>
          
          <div style="border-top: 1px solid #e8eaed; padding-top: 16px;">
            <div style="font-size: 12px; color: #5f6368; margin-bottom: 4px;">Join by phone</div>
            <div style="font-size: 14px; color: #1a73e8; margin-bottom: 2px;">(US) +1 731-420-5183</div>
            <div style="font-size: 12px; color: #5f6368;">PIN: 415600630</div>
            <div style="margin-top: 8px;">
              <a href="#" style="font-size: 12px; color: #1a73e8; text-decoration: none;">More phone numbers</a>
            </div>
          </div>
        </div>
        ` : ''}

        <!-- Reply Section -->
        <div style="background-color: #f8f9fa; padding: 16px 24px; border-top: 1px solid #e8eaed;">
          <div style="font-size: 12px; color: #5f6368; margin-bottom: 8px;">Reply for ${managerEmail}</div>
          <div style="display: flex; gap: 8px;">
            <button style="background-color: white; color: #1a73e8; border: 1px solid #dadce0; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">Yes</button>
            <button style="background-color: white; color: #5f6368; border: 1px solid #dadce0; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">No</button>
            <button style="background-color: white; color: #5f6368; border: 1px solid #dadce0; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">Maybe</button>
            <button style="background-color: white; color: #5f6368; border: 1px solid #dadce0; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">More options</button>
          </div>
        </div>

        <!-- Footer -->
        <div style="padding: 16px 24px; border-top: 1px solid #e8eaed; text-align: center;">
          <div style="font-size: 12px; color: #5f6368;">
            Invitation from <a href="#" style="color: #1a73e8; text-decoration: none;">Google Calendar</a>
          </div>
        </div>

      </div>
    </div>
  `;

  // Generate RFC5546-compliant ICS content with proper RSVP functionality for fallback
  const icsContent = emailService.generateCalendarInvite(employeeName, managerName, meetingDate, duration, location, notes, employeeEmail, managerEmail);

  const emailOptions: any = {
    subject,
    html,
  };

  // Add ICS attachment if calendar API failed or is not configured
  if (calendarResult.provider === 'ics' || !calendarResult.success) {
    emailOptions.attachments = [{
      filename: 'meeting-invite.ics',
      content: icsContent,
      contentType: 'text/calendar'
    }];
  }

  // Send to both employee and manager
  await emailService.sendEmail({
    to: employeeEmail,
    ...emailOptions,
  });

  await emailService.sendEmail({
    to: managerEmail,
    ...emailOptions,
  });
}

export function generateRegistrationNotificationEmail(name: string, companyName: string, designation: string, email: string, mobile: string): { subject: string; html: string } {
  return emailService.generateRegistrationNotificationEmail(name, companyName, designation, email, mobile);
}

// Manager Workflow Email Functions

export async function sendMeetingInvite(
  employeeEmail: string, 
  employeeName: string, 
  managerName: string, 
  meetingDate: Date, 
  meetingTitle: string, 
  meetingDescription: string
): Promise<void> {
  const icsContent = emailService.generateCalendarInvite(employeeName, managerName, meetingDate);
  
  const subject = `Meeting Invitation: ${meetingTitle}`;
  const formattedDate = meetingDate.toLocaleDateString();
  const formattedTime = meetingDate.toLocaleTimeString();
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Performance Review Meeting Invitation</h2>
      <p>Dear ${employeeName},</p>
      <p>${managerName} has scheduled a one-on-one meeting to discuss your performance review.</p>
      
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #1e40af; margin-top: 0;">Meeting Details</h3>
        <p><strong>Title:</strong> ${meetingTitle}</p>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time:</strong> ${formattedTime}</p>
        <p><strong>With:</strong> ${managerName}</p>
        <p><strong>Description:</strong> ${meetingDescription}</p>
      </div>
      
      <p>Please add this meeting to your calendar using the attached invitation.</p>
      <p>If you have any scheduling conflicts, please reach out to ${managerName} as soon as possible.</p>
      
      <p>Best regards,<br>Performance Management System</p>
    </div>
  `;

  return emailService.sendEmail({
    to: employeeEmail,
    subject,
    html,
    attachments: [{
      filename: 'meeting-invite.ics',
      content: icsContent,
      contentType: 'text/calendar'
    }] as any
  });
}

export async function sendEvaluationCompletionNotification(
  recipientEmail: string,
  recipientName: string,
  otherPartyName: string,
  evaluation: any,
  recipientRole: 'employee' | 'manager' | 'hr_manager',
  employeeData?: { name: string; code?: string; email?: string },
  managerName?: string
): Promise<void> {
  let subject: string;
  let html: string;
  
  // Determine if meeting notes should be shown based on role and visibility setting
  const shouldShowMeetingNotes = evaluation.meetingNotes && (
    recipientRole !== 'employee' || evaluation.showNotesToEmployee === true
  );
  
  if (recipientRole === 'employee') {
    subject = 'Performance Review Completed - Results Available';
    html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Your Performance Review is Complete!</h2>
        <p>Dear ${recipientName},</p>
        <p>Your performance review has been completed by your manager, ${managerName || otherPartyName}.</p>
        
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
          <h3 style="color: #065f46; margin-top: 0;">Review Summary</h3>
          ${employeeData?.code ? `<p><strong>Employee Code:</strong> ${employeeData.code}</p>` : ''}
          <p><strong>Employee Name:</strong> ${employeeData?.name || recipientName}</p>
          ${employeeData?.email ? `<p><strong>Employee Email ID:</strong> ${employeeData.email}</p>` : ''}
          ${evaluation.overallRating ? `<p><strong>Final Rating:</strong> ${evaluation.overallRating}/5</p>` : ''}
          <p><strong>Meeting Completed On:</strong> ${evaluation.finalizedAt ? new Date(evaluation.finalizedAt).toLocaleDateString() : 'N/A'}</p>
          ${shouldShowMeetingNotes ? `<p><strong>Meeting Notes:</strong></p><p style="white-space: pre-wrap; margin-top: 5px;">${evaluation.meetingNotes}</p>` : ''}
          <p><strong>Manager:</strong> ${managerName || otherPartyName}</p>
        </div>
        
        <p>You can view the complete review details in your performance management dashboard.</p>
        <p>If you have any questions about your review, please discuss them with your manager during your next one-on-one meeting.</p>
        
        <p>Best regards,<br>HR Team</p>
      </div>
    `;
  } else if (recipientRole === 'manager') {
    subject = `Performance Review Completed - ${employeeData?.name || otherPartyName}`;
    html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Performance Review Completion Confirmation</h2>
        <p>Dear ${recipientName},</p>
        <p>This confirms that you have successfully completed the performance review for ${employeeData?.name || otherPartyName}.</p>
        
        <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
          <h3 style="color: #1e40af; margin-top: 0;">Completion Summary</h3>
          <p><strong>Employee Name:</strong> ${employeeData?.name || otherPartyName}</p>
          ${evaluation.overallRating ? `<p><strong>Final Rating Given:</strong> ${evaluation.overallRating}/5</p>` : ''}
          <p><strong>Completed On:</strong> ${evaluation.finalizedAt ? new Date(evaluation.finalizedAt).toLocaleDateString() : 'N/A'}</p>
        </div>
        
        <p>The employee has been notified of the completion and can now view their review results.</p>
        <p>A copy of this notification has also been sent to the HR team for their records.</p>
        
        <p>Thank you for your participation in our performance management process.</p>
        
        <p>Best regards,<br>Performance Management System</p>
      </div>
    `;
  } else { // hr_manager
    subject = `Performance Review Completed - ${employeeData?.name || otherPartyName}`;
    html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">Performance Review Completion Notice</h2>
        <p>Dear ${recipientName},</p>
        <p>This is to inform you that a performance review has been completed in your organization.</p>
        
        <div style="background-color: #faf5ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed;">
          <h3 style="color: #5b21b6; margin-top: 0;">Review Details</h3>
          <p><strong>Employee Name:</strong> ${employeeData?.name || otherPartyName}</p>
          ${evaluation.overallRating ? `<p><strong>Final Rating:</strong> ${evaluation.overallRating}/5</p>` : ''}
          <p><strong>Completed On:</strong> ${evaluation.finalizedAt ? new Date(evaluation.finalizedAt).toLocaleDateString() : 'N/A'}</p>
          <p><strong>Status:</strong> Completed</p>
        </div>
        
        <p>Both the employee and manager have been notified of the completion.</p>
        <p>You can view detailed analytics and reports in the HR management dashboard.</p>
        
        <p>Best regards,<br>Performance Management System</p>
      </div>
    `;
  }

  return emailService.sendEmail({
    to: recipientEmail,
    subject,
    html,
  });
}

export async function sendEmployeeSubmissionNotification(
  managerEmail: string,
  managerName: string,
  employeeName: string,
  employeeEmail: string,
  evaluationId: string,
  hrManagerEmails?: string[]
): Promise<void> {
  const subject = `Employee Self-Evaluation Submitted - ${employeeName}`;
  const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
  const protocol = domain.includes('localhost') ? 'http://' : 'https://';
  const evaluationLink = `${protocol}${domain}/review-appraisal`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Employee Self-Evaluation Submitted</h2>
      <p>Dear ${managerName},</p>
      <p><strong>${employeeName}</strong> (${employeeEmail}) has completed and submitted their self-evaluation.</p>
      
      <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
        <h3 style="color: #1e40af; margin-top: 0;">Action Required</h3>
        <p>As the reporting manager, you are now required to:</p>
        <ul style="color: #1e293b;">
          <li>Review the employee's self-evaluation</li>
          <li>Complete your manager evaluation</li>
          <li>Schedule a one-on-one meeting to discuss the review</li>
        </ul>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${evaluationLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Review & Evaluate
        </a>
      </div>
      
      <p>Please complete your evaluation at your earliest convenience to keep the performance review process on track.</p>
      
      <p>Best regards,<br>Performance Management System</p>
    </div>
  `;
  
  return emailService.sendEmail({
    to: managerEmail,
    subject,
    html,
    cc: hrManagerEmails && hrManagerEmails.length > 0 ? hrManagerEmails : undefined,
  });
}

export async function sendManagerSubmissionNotification(
  employeeEmail: string,
  employeeName: string,
  managerName: string,
  managerEmail: string,
  evaluationId: string,
  hrManagerEmails?: string[]
): Promise<void> {
  const subject = `Manager Evaluation Submitted - Your Performance Review`;
  const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
  const protocol = domain.includes('localhost') ? 'http://' : 'https://';
  const evaluationLink = `${protocol}${domain}/evaluations`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Manager Evaluation Submitted</h2>
      <p>Dear ${employeeName},</p>
      <p>Your manager <strong>${managerName}</strong> (${managerEmail}) has completed and submitted their evaluation of your performance.</p>
      
      <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
        <h3 style="color: #1e40af; margin-top: 0;">Next Steps</h3>
        <p>Your manager will be scheduling a one-on-one meeting with you to discuss:</p>
        <ul style="color: #1e293b;">
          <li>Your self-evaluation and manager's feedback</li>
          <li>Performance highlights and areas for growth</li>
          <li>Career development and goals for next period</li>
        </ul>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${evaluationLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Evaluation Status
        </a>
      </div>
      
      <p>You will receive a meeting invitation shortly. Please prepare any questions or topics you'd like to discuss during your one-on-one.</p>
      
      <p>Best regards,<br>Performance Management System</p>
    </div>
  `;
  
  return emailService.sendEmail({
    to: employeeEmail,
    subject,
    html,
    cc: hrManagerEmails && hrManagerEmails.length > 0 ? hrManagerEmails : undefined,
  });
}

// Send feedback request email to peer reviewer
export async function sendFeedbackRequestEmail(
  reviewerEmail: string,
  reviewerName: string,
  subjectName: string,
  requesterId: string
): Promise<void> {
  const requester = await storage.getUser(requesterId);
  const requesterName = requester ? `${requester.firstName} ${requester.lastName}` : 'Your Manager';
  
  const subject = `360 Degree Feedback Request: Please provide feedback for ${subjectName}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1e293b;">360 Degree Feedback Request</h2>
      
      <p>Dear ${reviewerName},</p>
      
      <p>${requesterName} has requested you to provide 360-degree feedback for <strong>${subjectName}</strong> as part of their performance evaluation process.</p>
      
      <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
        <h3 style="color: #166534; margin-top: 0;">What You Need To Do</h3>
        <p>Please log in to the Performance Management System and navigate to <strong>Feedback Requests</strong> to submit your feedback.</p>
        <p>Your feedback will help provide a comprehensive view of ${subjectName}'s performance and development areas.</p>
      </div>
      
      <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
        <h3 style="color: #1e40af; margin-top: 0;">Guidelines</h3>
        <ul style="color: #1e293b;">
          <li>Be honest and constructive in your feedback</li>
          <li>Focus on specific behaviors and outcomes</li>
          <li>Consider both strengths and areas for improvement</li>
          <li>Your feedback will be treated confidentially</li>
        </ul>
      </div>
      
      <p>Please complete your feedback at your earliest convenience.</p>
      
      <p>Best regards,<br>Performance Management System</p>
    </div>
  `;
  
  return emailService.sendEmail({
    to: reviewerEmail,
    subject,
    html,
  });
}
