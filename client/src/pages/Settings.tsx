import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Settings as SettingsIcon, Key, Mail, User, Shield, ChevronRight, Image, Upload } from "lucide-react";
import type { Company } from "@shared/schema";

// Schema for password change - current password optional for OIDC accounts
const passwordChangeSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password confirmation is required"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Schema for email service configuration
const emailServiceSchema = z.object({
  host: z.string().min(1, "SMTP host is required"),
  port: z.number().min(1, "Port is required").max(65535, "Invalid port"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  secure: z.boolean(),
  fromEmail: z.string().email("Valid email address is required"),
  fromName: z.string().min(1, "From name is required"),
});

type PasswordChangeForm = z.infer<typeof passwordChangeSchema>;
type EmailServiceForm = z.infer<typeof emailServiceSchema>;

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showEmailServiceForm, setShowEmailServiceForm] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin';
  const isHRManager = user?.role === 'hr_manager';
  const isEmployee = user?.role === 'employee';
  const isManager = user?.role === 'manager';
  const canChangePassword = isSuperAdmin || isAdmin || isHRManager || isEmployee || isManager;
  const canConfigureEmail = isAdmin; // Only Administrators can configure email
  const canUploadLogo = isAdmin; // Only Administrators can upload company logo

  // Password change form
  const passwordForm = useForm<PasswordChangeForm>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Email service configuration form
  const emailForm = useForm<EmailServiceForm>({
    resolver: zodResolver(emailServiceSchema),
    defaultValues: {
      host: "",
      port: 587,
      username: "",
      password: "",
      secure: true,
      fromEmail: "",
      fromName: "",
    },
  });

  // Fetch current email service configuration
  const { data: emailConfig } = useQuery<EmailServiceForm>({
    queryKey: ["/api/settings/email"],
    enabled: canConfigureEmail,
  });

  // Fetch current company information
  const { data: company } = useQuery<Company>({
    queryKey: ["/api/companies/current"],
    enabled: !!user && canUploadLogo,
  });

  // Password change mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordChangeForm) => {
      await apiRequest("POST", "/api/settings/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password changed successfully",
      });
      passwordForm.reset();
      setShowPasswordForm(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  // Email service configuration mutation
  const emailServiceMutation = useMutation({
    mutationFn: async (data: EmailServiceForm) => {
      await apiRequest("POST", "/api/settings/email", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Email service configured successfully",
      });
      setShowEmailServiceForm(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to configure email service",
        variant: "destructive",
      });
    },
  });

  // Company logo upload handler
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !company) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Logo must be smaller than 2MB",
        variant: "destructive",
      });
      return;
    }

    setUploadingLogo(true);

    try {
      console.log('Starting upload...');
      // Get signed upload URL
      const urlResponse = await fetch('/api/objects/upload', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!urlResponse.ok) {
        throw new Error('Failed to get upload URL');
      }
      
      const { uploadURL } = await urlResponse.json();
      console.log('Got upload URL, uploading file...');
      
      // Upload file to signed URL
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload logo');
      }

      // Extract the public URL from the upload URL (remove query params)
      const url = uploadURL.split('?')[0];
      console.log('File uploaded, URL:', url);

      // Set the logo to be publicly accessible
      console.log('Making logo public...');
      const aclResponse = await apiRequest('PUT', '/api/company-logos', {
        logoURL: url,
      });
      
      const { objectPath } = await aclResponse.json();
      console.log('Logo is now public, path:', objectPath);

      console.log('Updating company with logo URL...');
      // Update company with new logo URL using dedicated logo endpoint
      // Note: apiRequest already throws on non-ok responses
      const updateResponse = await apiRequest('PUT', `/api/companies/current/logo`, {
        logoUrl: objectPath,
      });
      
      console.log('PUT request successful');
      
      // Invalidate queries to refresh the logo
      queryClient.invalidateQueries({ queryKey: ['/api/companies/current'] });

      toast({
        title: "Success",
        description: "Company logo updated successfully",
      });
    } catch (error: any) {
      console.error('Logo upload error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
      // Reset the file input
      event.target.value = '';
    }
  };

  const onPasswordSubmit = (data: PasswordChangeForm) => {
    changePasswordMutation.mutate(data);
  };

  const onEmailSubmit = (data: EmailServiceForm) => {
    emailServiceMutation.mutate(data);
  };

  // Load email config into form when available
  // Pre-fill email form with current configuration when data loads
  useEffect(() => {
    if (emailConfig) {
      emailForm.reset(emailConfig);
    }
  }, [emailConfig]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-8 w-8" />
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your account settings and system configuration
        </p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* User Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Your current account details and role
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Name</Label>
                <p className="text-sm text-muted-foreground">
                  {user?.firstName} {user?.lastName}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Email</Label>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Role</Label>
                <div>
                  <Badge variant={isSuperAdmin ? "default" : "secondary"} className="flex items-center gap-1 w-fit">
                    <Shield className="h-3 w-3" />
                    {user?.role === 'super_admin' ? 'Super Administrator' : 
                     user?.role === 'admin' ? 'Administrator' : 
                     user?.role === 'hr_manager' ? 'HR Manager' :
                     user?.role === 'manager' ? 'Manager' :
                     user?.role === 'employee' ? 'Employee' : user?.role}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        {canChangePassword && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your account password for security
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!showPasswordForm ? (
                <Button 
                  onClick={() => setShowPasswordForm(true)}
                  className="flex items-center gap-2"
                  data-testid="button-change-password"
                >
                  <Key className="h-4 w-4" />
                  Change Password
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password <span className="text-muted-foreground">(optional if none set)</span></FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="Enter current password (leave blank if none set)"
                              data-testid="input-current-password"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                          <p className="text-sm text-muted-foreground">
                            Leave current password blank if this is your first time setting a password
                          </p>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="Enter new password"
                              data-testid="input-new-password"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm New Password</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="Confirm new password"
                              data-testid="input-confirm-password"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={changePasswordMutation.isPending}
                        data-testid="button-submit-password"
                      >
                        {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowPasswordForm(false);
                          passwordForm.reset();
                        }}
                        data-testid="button-cancel-password"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        )}

        {/* Email Service Configuration Card - Administrator Only */}
        {canConfigureEmail && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Service Configuration
              </CardTitle>
              <CardDescription>
                Configure SMTP settings for email notifications and invitations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!showEmailServiceForm ? (
                <div className="space-y-4">
                  {emailConfig && (
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <h4 className="font-medium mb-2">Current Configuration</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium">Host:</span> {emailConfig.host}
                        </div>
                        <div>
                          <span className="font-medium">Port:</span> {emailConfig.port}
                        </div>
                        <div>
                          <span className="font-medium">From Email:</span> {emailConfig.fromEmail}
                        </div>
                        <div>
                          <span className="font-medium">From Name:</span> {emailConfig.fromName}
                        </div>
                      </div>
                    </div>
                  )}
                  <Button 
                    onClick={() => setShowEmailServiceForm(true)}
                    className="flex items-center gap-2"
                    data-testid="button-configure-email"
                  >
                    <Mail className="h-4 w-4" />
                    {emailConfig ? "Update Email Service" : "Configure Email Service"}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Form {...emailForm}>
                  <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={emailForm.control}
                        name="host"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Host</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="smtp.gmail.com"
                                data-testid="input-smtp-host"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={emailForm.control}
                        name="port"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Port</FormLabel>
                            <FormControl>
                              <Input 
                                type="number"
                                placeholder="587"
                                data-testid="input-smtp-port"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 587)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={emailForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="your-email@example.com"
                                data-testid="input-smtp-username"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={emailForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input 
                                type="password"
                                placeholder="SMTP password or app password"
                                data-testid="input-smtp-password"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={emailForm.control}
                        name="fromEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>From Email</FormLabel>
                            <FormControl>
                              <Input 
                                type="email"
                                placeholder="noreply@yourcompany.com"
                                data-testid="input-from-email"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={emailForm.control}
                        name="fromName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>From Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Your Company Name"
                                data-testid="input-from-name"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {/* SSL/TLS Security Option */}
                    <FormField
                      control={emailForm.control}
                      name="secure"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-secure-connection"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              Use SSL/TLS (Secure Connection)
                            </FormLabel>
                            <p className="text-sm text-muted-foreground">
                              Enable secure connection for SMTP. Usually enabled for port 465 or 587 with STARTTLS.
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={emailServiceMutation.isPending}
                        data-testid="button-save-email-config"
                      >
                        {emailServiceMutation.isPending ? "Saving..." : "Save Configuration"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowEmailServiceForm(false);
                          emailForm.reset();
                        }}
                        data-testid="button-cancel-email-config"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        )}

        {/* Company Logo Upload Card - Administrator Only */}
        {canUploadLogo && company && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Company Logo
              </CardTitle>
              <CardDescription>
                Upload and manage your company logo (displayed in the sidebar)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Current Logo Preview */}
                {company.logoUrl && (
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-2">Current Logo</p>
                      <img 
                        src={company.logoUrl} 
                        alt={`${company.name} logo`}
                        className="max-w-[150px] max-h-20 object-contain"
                      />
                    </div>
                  </div>
                )}

                {/* Upload Instructions */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Upload Guidelines</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Recommended: PNG or SVG format with transparent background</li>
                    <li>• Maximum file size: 2MB</li>
                    <li>• Logo will display at 60% of sidebar width</li>
                    <li>• For best results, use a horizontal logo layout</li>
                  </ul>
                </div>

                {/* Upload Button */}
                <div>
                  <Label 
                    htmlFor="logo-upload" 
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Button 
                        type="button" 
                        disabled={uploadingLogo}
                        className="flex items-center gap-2"
                        onClick={() => document.getElementById('logo-upload')?.click()}
                        data-testid="button-upload-logo"
                      >
                        <Upload className="h-4 w-4" />
                        {uploadingLogo ? "Uploading..." : company.logoUrl ? "Update Logo" : "Upload Logo"}
                      </Button>
                    </div>
                  </Label>
                  <Input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                    data-testid="input-logo-upload"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Access Restrictions Info */}
        {!canChangePassword && !canConfigureEmail && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Limited Access</h3>
                <p className="text-muted-foreground">
                  Settings are only available for Administrators and Super Administrators.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}