import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBusinessRoleSchema, type BusinessRole, type InsertBusinessRole } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RoleGuard } from "@/components/RoleGuard";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Search, Edit, Trash2, Briefcase, Tag, Clock } from "lucide-react";

export default function BusinessRoleManagement() {
  const { user } = useAuth();
  const activeRole = (user as any)?.activeRole || (user as any)?.role || "employee";
  const isAdmin = activeRole === "admin";
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingBusinessRole, setEditingBusinessRole] = useState<BusinessRole | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: businessRoles = [], isLoading } = useQuery<BusinessRole[]>({
    queryKey: ["/api/business-roles"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertBusinessRole) => {
      await apiRequest("POST", "/api/business-roles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-roles"] });
      setIsCreateModalOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Business role created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: isUnauthorizedError(error) ? "Access denied" : "Failed to create business role",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertBusinessRole> }) => {
      await apiRequest("PUT", `/api/business-roles/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-roles"] });
      setEditingBusinessRole(null);
      resetForm();
      toast({
        title: "Success",
        description: "Business role updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: isUnauthorizedError(error) ? "Access denied" : "Failed to update business role",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/business-roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-roles"] });
      toast({
        title: "Success",
        description: "Business role deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: isUnauthorizedError(error) ? "Access denied" : "Failed to delete business role",
        variant: "destructive",
      });
    },
  });

  const form = useForm<InsertBusinessRole>({
    resolver: zodResolver(insertBusinessRoleSchema),
    defaultValues: {
      code: "",
      description: "",
      status: "active",
    },
  });

  const resetForm = () => {
    form.reset({
      code: "",
      description: "",
      status: "active",
    });
  };

  const handleEdit = (businessRole: BusinessRole) => {
    setEditingBusinessRole(businessRole);
    form.reset({
      code: businessRole.code,
      description: businessRole.description || "",
      status: businessRole.status,
    });
  };

  const onSubmit = (data: InsertBusinessRole) => {
    if (editingBusinessRole) {
      updateMutation.mutate({
        id: editingBusinessRole.id,
        data,
      });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this business role?")) {
      deleteMutation.mutate(id);
    }
  };

  const filteredBusinessRoles = businessRoles.filter((br) => {
    const matchesSearch = br.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (br.description && br.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || br.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <RoleGuard allowedRoles={['admin', 'hr_manager']}>
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Business Role Management</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage business roles for employee categorization
            </p>
          </div>
          {isAdmin && <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Business Role
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingBusinessRole ? "Edit Business Role" : "Add Business Role"}
                </DialogTitle>
                <DialogDescription>
                  {editingBusinessRole ? "Update the business role details" : "Define a new business role"}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Code</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="e.g., DEV, MGR, HR" 
                            />
                          </FormControl>
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
                              <SelectTrigger>
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

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Describe the business role..." 
                            className="min-h-24"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsCreateModalOpen(false);
                        setEditingBusinessRole(null);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      {createMutation.isPending || updateMutation.isPending ? "Saving..." : 
                       editingBusinessRole ? "Update" : "Create"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>}
        </div>

        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by code or description..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4">
          {isLoading ? (
            <div className="text-center py-8">
              <p>Loading business roles...</p>
            </div>
          ) : filteredBusinessRoles.length === 0 ? (
            <div className="text-center py-8">
              <Briefcase className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium">No business roles found</p>
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery || statusFilter !== "all" 
                  ? "Try adjusting your search or filters" 
                  : "Get started by adding your first business role"}
              </p>
            </div>
          ) : (
            filteredBusinessRoles.map((br) => (
              <Card key={br.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="w-5 h-5 text-blue-600" />
                        <CardTitle className="text-lg">
                          {br.code}
                        </CardTitle>
                        <Badge variant={br.status === 'active' ? 'default' : 'secondary'}>
                          {br.status}
                        </Badge>
                      </div>
                      {br.description && (
                        <CardDescription>
                          {br.description}
                        </CardDescription>
                      )}
                    </div>
                    {isAdmin && <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEdit(br)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDelete(br.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>}
                  </div>
                </CardHeader>
                {br.description && (
                  <CardContent>
                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        <span>Description</span>
                      </div>
                      <p className="pl-6">{br.description}</p>
                      <div className="flex items-center gap-2 pt-2">
                        <Clock className="w-4 h-4" />
                        <span>Created: {br.createdAt ? new Date(br.createdAt).toLocaleDateString() : 'Unknown'}</span>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>

        <Dialog open={!!editingBusinessRole} onOpenChange={(open) => !open && setEditingBusinessRole(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Business Role</DialogTitle>
              <DialogDescription>
                Update the business role details
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="e.g., DEV, MGR, HR" 
                          />
                        </FormControl>
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
                            <SelectTrigger>
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

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Describe the business role..." 
                          className="min-h-24"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setEditingBusinessRole(null)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? "Updating..." : "Update"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}