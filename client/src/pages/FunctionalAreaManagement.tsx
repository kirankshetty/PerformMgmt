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
import { insertFunctionalAreaSchema, type FunctionalArea, type InsertFunctionalArea } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RoleGuard } from "@/components/RoleGuard";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Search, Edit, Trash2, Layers, Tag, Clock } from "lucide-react";

export default function FunctionalAreaManagement() {
  const { user } = useAuth();
  const activeRole = (user as any)?.activeRole || (user as any)?.role || "employee";
  const isAdmin = activeRole === "admin";
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<FunctionalArea | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: functionalAreas = [], isLoading } = useQuery<FunctionalArea[]>({
    queryKey: ["/api/functional-areas"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertFunctionalArea) => {
      await apiRequest("POST", "/api/functional-areas", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/functional-areas"] });
      setIsCreateModalOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Functional area created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: isUnauthorizedError(error) ? "Access denied" : "Failed to create functional area",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertFunctionalArea> }) => {
      await apiRequest("PUT", `/api/functional-areas/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/functional-areas"] });
      setEditingArea(null);
      resetForm();
      toast({
        title: "Success",
        description: "Functional area updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: isUnauthorizedError(error) ? "Access denied" : "Failed to update functional area",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/functional-areas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/functional-areas"] });
      toast({
        title: "Success",
        description: "Functional area deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: isUnauthorizedError(error) ? "Access denied" : "Failed to delete functional area",
        variant: "destructive",
      });
    },
  });

  const form = useForm<InsertFunctionalArea>({
    resolver: zodResolver(insertFunctionalAreaSchema),
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

  const handleEdit = (area: FunctionalArea) => {
    setEditingArea(area);
    form.reset({
      code: area.code,
      description: area.description || "",
      status: area.status,
    });
  };

  const onSubmit = (data: InsertFunctionalArea) => {
    if (editingArea) {
      updateMutation.mutate({
        id: editingArea.id,
        data,
      });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this functional area?")) {
      deleteMutation.mutate(id);
    }
  };

  const filteredAreas = functionalAreas.filter((area) => {
    const matchesSearch = area.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (area.description && area.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || area.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <RoleGuard allowedRoles={['admin', 'hr_manager']}>
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Functional Areas</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage functional areas for employee categorization
            </p>
          </div>
          {isAdmin && <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Functional Area
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Functional Area</DialogTitle>
                <DialogDescription>
                  Define a new functional area
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
                              placeholder="e.g., FIN, ENG, MKT" 
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
                            placeholder="Describe the functional area..." 
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
                        setEditingArea(null);
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
                       editingArea ? "Update" : "Create"}
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
              <p>Loading functional areas...</p>
            </div>
          ) : filteredAreas.length === 0 ? (
            <div className="text-center py-8">
              <Layers className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium">No functional areas found</p>
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery || statusFilter !== "all" 
                  ? "Try adjusting your search or filters" 
                  : "Get started by adding your first functional area"}
              </p>
            </div>
          ) : (
            filteredAreas.map((area) => (
              <Card key={area.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Layers className="w-5 h-5 text-blue-600" />
                        <CardTitle className="text-lg">
                          {area.code}
                        </CardTitle>
                        <Badge variant={area.status === 'active' ? 'default' : 'secondary'}>
                          {area.status}
                        </Badge>
                      </div>
                      {area.description && (
                        <CardDescription>
                          {area.description}
                        </CardDescription>
                      )}
                    </div>
                    {isAdmin && <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEdit(area)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDelete(area.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>}
                  </div>
                </CardHeader>
                {area.description && (
                  <CardContent>
                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        <span>Description</span>
                      </div>
                      <p className="pl-6">{area.description}</p>
                      <div className="flex items-center gap-2 pt-2">
                        <Clock className="w-4 h-4" />
                        <span>Created: {area.createdAt ? new Date(area.createdAt).toLocaleDateString() : 'Unknown'}</span>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>

        {isAdmin && (
        <Dialog open={!!editingArea} onOpenChange={(open) => !open && setEditingArea(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Functional Area</DialogTitle>
              <DialogDescription>
                Update the functional area details
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
                            placeholder="e.g., FIN, ENG, MKT" 
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
                          placeholder="Describe the functional area..." 
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
                    onClick={() => setEditingArea(null)}
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
        )}
      </div>
    </RoleGuard>
  );
}
