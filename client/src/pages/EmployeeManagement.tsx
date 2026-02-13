import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertUserSchema, type User, type InsertUser } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RoleGuard } from "@/components/RoleGuard";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Plus, Search, Filter, Edit, Trash2, Key, Upload, Download, FileSpreadsheet, CheckCircle, XCircle } from "lucide-react";

export default function EmployeeManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResults, setUploadResults] = useState<any>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isAdmin = currentUser?.role === 'admin';
  
  // Calculate password change permissions based on new policy
  const canChangePassword = (user: User | null) => {
    if (!user || !currentUser) return false;
    
    const isSuperAdmin = currentUser.role === 'super_admin';
    const isAdmin = currentUser.role === 'admin';
    const isUserCreatedByAdmin = user.createdById !== null && user.createdById === currentUser.id;
    const isTargetPrivileged = user.role && ['admin', 'super_admin'].includes(user.role);
    
    return isSuperAdmin || (isAdmin && isUserCreatedByAdmin && !isTargetPrivileged);
  };

  // Build query string from filters
  const queryParams = new URLSearchParams();
  if (roleFilter && roleFilter !== "all") queryParams.set("role", roleFilter);
  if (statusFilter && statusFilter !== "all") queryParams.set("status", statusFilter);
  const queryString = queryParams.toString();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: queryString 
      ? ["/api/users", queryString] 
      : ["/api/users"],
  });

  const { data: locations = [] } = useQuery<any[]>({
    queryKey: ["/api/locations"],
  });

  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ["/api/companies"],
  });

  const { data: levels = [] } = useQuery<any[]>({
    queryKey: ["/api/levels"],
  });

  const { data: grades = [] } = useQuery<any[]>({
    queryKey: ["/api/grades"],
  });

  const { data: departments = [] } = useQuery<any[]>({
    queryKey: ["/api/departments"],
  });

  const { data: businessRoles = [] } = useQuery<any[]>({
    queryKey: ["/api/business-roles"],
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: InsertUser) => {
      await apiRequest("POST", "/api/users", userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ predicate: (query) => 
        Array.isArray(query.queryKey) && query.queryKey[0] === "/api/users" 
      });
      setIsCreateModalOpen(false);
      toast({
        title: "Success",
        description: "User created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, userData }: { id: string; userData: Partial<InsertUser> }) => {
      await apiRequest("PUT", `/api/users/${id}`, userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ predicate: (query) => 
        Array.isArray(query.queryKey) && query.queryKey[0] === "/api/users" 
      });
      setEditingUser(null);
      toast({
        title: "Success",
        description: "User updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ predicate: (query) => 
        Array.isArray(query.queryKey) && query.queryKey[0] === "/api/users" 
      });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/users/bulk-upload/template', {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Failed to download template');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'user_bulk_upload_template.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Template downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download template",
        variant: "destructive",
      });
    }
  };

  const bulkUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const base64 = e.target?.result as string;
            const fileData = base64.split(',')[1]; // Remove data:...;base64, prefix
            
            const result = await apiRequest("POST", "/api/users/bulk-upload", { fileData });
            resolve(result);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ predicate: (query) => 
        Array.isArray(query.queryKey) && query.queryKey[0] === "/api/users" 
      });
      setUploadResults(data);
      setSelectedFile(null);
      toast({
        title: "Bulk Upload Completed",
        description: `${data.summary.successful} users created successfully, ${data.summary.failed} failed`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to process bulk upload",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        toast({
          title: "Invalid File",
          description: "Please select an Excel file (.xlsx or .xls)",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      setUploadResults(null);
    }
  };

  const handleBulkUpload = () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }
    bulkUploadMutation.mutate(selectedFile);
  };

  const handleCloseBulkUploadModal = () => {
    setIsBulkUploadModalOpen(false);
    setSelectedFile(null);
    setUploadResults(null);
  };

  // Create a schema that handles empty passwords properly for updates
  const flexibleUserSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    code: z.string().min(1, "Employee code is required"),
    designation: z.string().optional(),
    mobileNumber: z.string().optional(),
    locationId: z.string().nullable().optional(),
    companyId: z.string().nullable().optional(),
    levelId: z.string().nullable().optional(),
    gradeId: z.string().nullable().optional(),
    reportingManagerId: z.string().nullable().optional(),
    department: z.string().nullable().optional(),
    businessRoleId: z.string().nullable().optional(),
    role: z.enum(['super_admin', 'admin', 'hr_manager', 'employee', 'manager']),
    roles: z.array(z.enum(['super_admin', 'admin', 'hr_manager', 'employee', 'manager'])).optional().default(['employee']),
    status: z.enum(['active', 'inactive']).default('active'),
    password: z.union([
      z.string().min(8, "Password must be at least 8 characters"),
      z.literal("").transform(() => undefined)
    ]).optional(),
    confirmPassword: z.union([
      z.string(),
      z.literal("").transform(() => undefined)
    ]).optional(),
  }).refine((data) => {
    // If either password field is provided, both must be provided and match
    if (data.password || data.confirmPassword) {
      return data.password && data.confirmPassword && data.password === data.confirmPassword;
    }
    return true;
  }, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

  const form = useForm<InsertUser>({
    resolver: zodResolver(flexibleUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      code: "",
      designation: "",
      mobileNumber: "",
      locationId: "none",
      companyId: isAdmin && currentUser?.companyId ? currentUser.companyId : "none",
      levelId: "none",
      gradeId: "none",
      businessRoleId: "none",
      reportingManagerId: "none",
      role: "employee",
      roles: ["employee"],
      status: "active",
      password: "",
      confirmPassword: "",
    },
  });

  // Update form companyId when currentUser loads (for admins)
  useEffect(() => {
    if (isAdmin && currentUser?.companyId && !editingUser) {
      form.setValue("companyId", currentUser.companyId);
    }
  }, [isAdmin, currentUser?.companyId, editingUser, form]);

  const onSubmit = (data: InsertUser) => {
    // Convert "none" placeholder values to null
    const processedData = {
      ...data,
      locationId: data.locationId === "none" ? null : data.locationId,
      companyId: data.companyId === "none" ? null : data.companyId,
      levelId: data.levelId === "none" ? null : data.levelId,
      gradeId: data.gradeId === "none" ? null : data.gradeId,
      businessRoleId: (data as any).businessRoleId === "none" ? null : (data as any).businessRoleId,
      reportingManagerId: data.reportingManagerId === "none" ? null : data.reportingManagerId,
      department: data.department === "none" ? null : data.department,
    };

    // CRITICAL: Force admin users to only create/edit users in their own company
    if (isAdmin && currentUser?.companyId) {
      processedData.companyId = currentUser.companyId;
    } else if (isAdmin && !currentUser?.companyId) {
      toast({
        title: "Error",
        description: "Administrator must be assigned to a company first",
        variant: "destructive",
      });
      return;
    }

    if (editingUser) {
      // For updates, only include password fields if they're actually filled in
      const updateData = { ...processedData };
      
      // Remove password fields if they're empty (to avoid triggering password update logic)
      if (!data.password && !data.confirmPassword) {
        delete updateData.password;
        delete updateData.confirmPassword;
      }
      
      updateUserMutation.mutate({ id: editingUser.id, userData: updateData });
    } else {
      createUserMutation.mutate(processedData);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.reset({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      code: user.code || "",
      designation: user.designation || "",
      mobileNumber: user.mobileNumber || "",
      locationId: user.locationId || "none",
      // CRITICAL: Force admin to use their company when editing
      companyId: isAdmin && currentUser?.companyId ? currentUser.companyId : (user.companyId || "none"),
      levelId: user.levelId || "none",
      gradeId: user.gradeId || "none",
      businessRoleId: (user as any).businessRoleId || "none",
      reportingManagerId: user.reportingManagerId || "none",
      role: user.role || "employee",
      roles: (user as any).roles || [user.role] || ["employee"],
      status: user.status || "active",
      password: "",
      confirmPassword: "",
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      deleteUserMutation.mutate(id);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch = searchQuery === "" || 
      user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  const resetForm = () => {
    setEditingUser(null);
    form.reset({
      firstName: "",
      lastName: "",
      email: "",
      code: "",
      designation: "",
      mobileNumber: "",
      locationId: "none",
      companyId: isAdmin && currentUser?.companyId ? currentUser.companyId : "none",
      levelId: "none",
      gradeId: "none",
      reportingManagerId: "none",
      role: "employee",
      roles: ["employee"],
      status: "active",
      password: "",
      confirmPassword: "",
    });
  };

  return (
    <RoleGuard allowedRoles={["super_admin", "admin"]}>
      <div className="space-y-6" data-testid="employee-management">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">User Management</h1>
            <p className="text-muted-foreground">Manage user profiles and roles</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsBulkUploadModalOpen(true)} 
              data-testid="bulk-upload-button"
            >
              <Upload className="h-4 w-4 mr-2" />
              Bulk Upload
            </Button>
            <Dialog open={isCreateModalOpen || !!editingUser} onOpenChange={(open) => {
              if (!open) {
                setIsCreateModalOpen(false);
                resetForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => setIsCreateModalOpen(true)} data-testid="add-user-button">
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
                <DialogDescription>
                  {editingUser ? "Update user information" : "Create a new user profile"}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} data-testid="input-first-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} data-testid="input-last-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} value={field.value ?? ""} data-testid="input-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Employee Code</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} data-testid="input-code" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="designation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Designation</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} data-testid="input-designation" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="mobileNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mobile Number</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} data-testid="input-mobile" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="locationId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? "none"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-location">
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No Location</SelectItem>
                              {locations.map((location: any) => (
                                <SelectItem key={location.id} value={location.id}>
                                  {location.name} ({location.code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="companyId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value ?? "none"}
                            disabled={isAdmin}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-company">
                                <SelectValue placeholder="Select company" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No Company</SelectItem>
                              {companies.map((company: any) => (
                                <SelectItem key={company.id} value={company.id}>
                                  {company.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                          {isAdmin && (
                            <p className="text-xs text-muted-foreground">
                              As an Administrator, you can only create users for your company
                            </p>
                          )}
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={form.control}
                      name="department"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? "none"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-department">
                                <SelectValue placeholder="Select department" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No Department</SelectItem>
                              {departments.map((department: any) => (
                                <SelectItem key={department.id} value={department.code}>
                                  {department.description} ({department.code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={form.control}
                      name="businessRoleId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Role</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? "none"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select business role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No Business Role</SelectItem>
                              {businessRoles.map((br: any) => (
                                <SelectItem key={br.id} value={br.id}>
                                  {br.description} ({br.code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="levelId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Level</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? "none"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-level">
                                <SelectValue placeholder="Select level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No Level</SelectItem>
                              {levels.map((level: any) => (
                                <SelectItem key={level.id} value={level.id}>
                                  {level.description} ({level.code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="gradeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Grade</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? "none"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-grade">
                                <SelectValue placeholder="Select grade" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No Grade</SelectItem>
                              {grades.map((grade: any) => (
                                <SelectItem key={grade.id} value={grade.id}>
                                  {grade.description} ({grade.code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="reportingManagerId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reporting Manager</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? "none"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-manager">
                                <SelectValue placeholder="Select reporting manager" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No Manager</SelectItem>
                              {users.filter((user: any) => user.id !== editingUser?.id).map((user: any) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.firstName} {user.lastName} ({user.email})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? "active"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-status">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={form.control}
                      name="roles"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Roles</FormLabel>
                          <div className="space-y-2" data-testid="select-roles">
                            {[
                              { value: "employee", label: "Employee" },
                              { value: "manager", label: "Manager" },
                              { value: "hr_manager", label: "HR Manager" },
                              { value: "admin", label: "Administrator" },
                              { value: "super_admin", label: "Super Administrator" }
                            ].map((role) => (
                              <div key={role.value} className="flex items-center space-x-2">
                                <Checkbox
                                  id={role.value}
                                  checked={field.value?.includes(role.value as "super_admin" | "admin" | "hr_manager" | "employee" | "manager")}
                                  onCheckedChange={(checked) => {
                                    const currentRoles = field.value || [];
                                    if (checked) {
                                      field.onChange([...currentRoles, role.value]);
                                    } else {
                                      field.onChange(currentRoles.filter((r: string) => r !== role.value));
                                    }
                                  }}
                                  data-testid={`checkbox-role-${role.value}`}
                                />
                                <label
                                  htmlFor={role.value}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  {role.label}
                                </label>
                              </div>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Password fields - Super Admin or Creator */}
                  {(isSuperAdmin || isAdmin) && (
                    <div className="border-t pt-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Key className="h-4 w-4" />
                        <h3 className="text-lg font-medium">{editingUser ? "Change Password" : "Set Password"}</h3>
                        {editingUser && !canChangePassword(editingUser) && (
                          <Badge variant="secondary" className="ml-2">
                            {editingUser.createdById !== currentUser?.id 
                              ? "Creator or Super Admin Required"
                              : editingUser.role && ["admin", "super_admin"].includes(editingUser.role)
                                ? "Cannot Change Admin Password"
                                : "Super Admin Required"
                            }
                          </Badge>
                        )}
                      </div>
                      
                      {editingUser && !canChangePassword(editingUser) && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 mb-4">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            <strong>Note:</strong> {
                              editingUser.createdById !== currentUser?.id
                                ? "You can only change passwords for users you created, or contact a Super Administrator."
                                : editingUser.role && ["admin", "super_admin"].includes(editingUser.role)
                                  ? "For security reasons, passwords of Administrator and Super Administrator accounts cannot be changed by other Administrators."
                                  : "Password changes require Super Administrator privileges."
                            }
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>New Password</FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder={
                                    editingUser && canChangePassword(editingUser) 
                                      ? "Enter new password" 
                                      : !editingUser 
                                        ? "Enter new password"
                                        : "Authorization required"
                                  }
                                  disabled={editingUser ? !canChangePassword(editingUser) : false}
                                  {...field}
                                  data-testid="input-password"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirm Password</FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder={
                                    editingUser && canChangePassword(editingUser) 
                                      ? "Confirm new password" 
                                      : !editingUser 
                                        ? "Confirm new password"
                                        : "Authorization required"
                                  }
                                  disabled={editingUser ? !canChangePassword(editingUser) : false}
                                  {...field}
                                  data-testid="input-confirm-password"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        {editingUser ? (
                          canChangePassword(editingUser)
                            ? "Leave password fields empty if you don't want to change the password."
                            : "Password fields are disabled based on authorization rules."
                        ) : (
                          "Set a password for the new user account."
                        )}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsCreateModalOpen(false);
                        resetForm();
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={createUserMutation.isPending || updateUserMutation.isPending}
                      data-testid="submit-user"
                    >
                      {editingUser ? "Update User" : "Create User"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Bulk Upload Modal */}
        <Dialog open={isBulkUploadModalOpen} onOpenChange={handleCloseBulkUploadModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Bulk Upload Users</DialogTitle>
              <DialogDescription>
                Upload an Excel file to create multiple users at once
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Download Template Section */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      Download Sample Template
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Start by downloading the sample template with the required format
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleDownloadTemplate}
                    data-testid="download-template-button"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>

              {/* File Upload Section */}
              <div className="border-2 border-dashed rounded-lg p-6">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="font-medium">Upload Excel File</p>
                    <p className="text-sm text-muted-foreground">
                      Select the filled template to upload
                    </p>
                  </div>
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="mt-2"
                    data-testid="file-input"
                  />
                  {selectedFile && (
                    <p className="text-sm text-green-600 mt-2">
                      Selected: {selectedFile.name}
                    </p>
                  )}
                </div>
              </div>

              {/* Upload Results */}
              {uploadResults && (
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-3">Upload Results</h3>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{uploadResults.summary.total}</p>
                      <p className="text-sm text-muted-foreground">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{uploadResults.summary.successful}</p>
                      <p className="text-sm text-muted-foreground">Successful</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{uploadResults.summary.failed}</p>
                      <p className="text-sm text-muted-foreground">Failed</p>
                    </div>
                  </div>

                  {/* Success List */}
                  {uploadResults.results.success.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Successfully Created ({uploadResults.results.success.length})
                      </h4>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {uploadResults.results.success.map((item: any, index: number) => (
                          <div key={index} className="text-sm bg-green-50 p-2 rounded">
                            Row {item.row}: {item.name} ({item.email})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Error List */}
                  {uploadResults.results.errors.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        Errors ({uploadResults.results.errors.length})
                      </h4>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {uploadResults.results.errors.map((item: any, index: number) => (
                          <div key={index} className="text-sm bg-red-50 p-2 rounded">
                            Row {item.row}: {item.error} {item.email && `(${item.email})`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleCloseBulkUploadModal}
                  className="flex-1"
                  data-testid="cancel-bulk-upload"
                >
                  {uploadResults ? 'Close' : 'Cancel'}
                </Button>
                {!uploadResults && (
                  <Button
                    onClick={handleBulkUpload}
                    disabled={!selectedFile || bulkUploadMutation.isPending}
                    className="flex-1"
                    data-testid="submit-bulk-upload"
                  >
                    {bulkUploadMutation.isPending ? 'Uploading...' : 'Upload Users'}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="search-employees"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]" data-testid="filter-role">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="hr_manager">HR Manager</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="super_admin">Super Administrator</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]" data-testid="filter-status">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Employees</CardTitle>
            <CardDescription>
              {filteredUsers.length} employee{filteredUsers.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 animate-pulse">
                    <div className="w-10 h-10 bg-muted rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No employees found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/20 transition-colors"
                    data-testid={`user-row-${user.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-primary-foreground font-medium text-sm">
                          {user.firstName?.[0]}{user.lastName?.[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium" data-testid={`user-name-${user.id}`}>
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <p className="text-sm text-muted-foreground">{user.designation}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-wrap gap-1">
                        {((user as any).roles && Array.isArray((user as any).roles) ? (user as any).roles : [user.role]).map((role: string, index: number) => (
                          <Badge 
                            key={`${user.id}-${role}-${index}`}
                            variant={role === 'super_admin' ? 'default' : 'secondary'}
                            data-testid={`user-role-${user.id}-${role}`}
                          >
                            {role === 'hr_manager' ? 'HR Manager' : role?.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                      <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                        {user.status}
                      </Badge>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(user)}
                          data-testid={`edit-user-${user.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(user.id)}
                          data-testid={`delete-user-${user.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}
