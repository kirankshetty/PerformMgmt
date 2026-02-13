import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RoleGuard } from "@/components/RoleGuard";

import { isUnauthorizedError } from "@/lib/authUtils";
import { Plus, Search, Edit, Trash2, Star, Clock } from "lucide-react";
import type { Rating, RatingDetail } from "@shared/schema";

type RatingWithDetails = Rating & { details: RatingDetail[] };

interface RatingFormData {
  ratingType: "numeric" | "text";
  ratingScaleFrom: number;
  ratingScaleTo: number;
  status: "active" | "inactive";
  details: { code: string; name: string; description: string }[];
}

export default function RatingManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRating, setEditingRating] = useState<RatingWithDetails | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: ratingsData = [], isLoading } = useQuery<RatingWithDetails[]>({
    queryKey: ["/api/ratings"],
  });

  const [formData, setFormData] = useState<RatingFormData>({
    ratingType: "numeric",
    ratingScaleFrom: 1,
    ratingScaleTo: 5,
    status: "active",
    details: Array.from({ length: 5 }, (_, i) => ({ code: "", name: "", description: "" })),
  });

  const resetForm = () => {
    setFormData({
      ratingType: "numeric",
      ratingScaleFrom: 1,
      ratingScaleTo: 5,
      status: "active",
      details: Array.from({ length: 5 }, () => ({ code: "", name: "", description: "" })),
    });
  };

  const scaleCount = formData.ratingScaleTo - formData.ratingScaleFrom + 1;

  useEffect(() => {
    const currentLength = formData.details.length;
    if (currentLength !== scaleCount) {
      const newDetails = Array.from({ length: scaleCount }, (_, i) => {
        if (i < currentLength) {
          return formData.details[i];
        }
        return { code: "", name: "", description: "" };
      });
      setFormData(prev => ({ ...prev, details: newDetails }));
    }
  }, [scaleCount]);

  const createMutation = useMutation({
    mutationFn: async (data: RatingFormData) => {
      await apiRequest("POST", "/api/ratings", {
        ratingType: data.ratingType,
        ratingScaleFrom: data.ratingScaleFrom,
        ratingScaleTo: data.ratingScaleTo,
        status: data.status,
        details: data.details,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ratings"] });
      setIsCreateModalOpen(false);
      resetForm();
      toast({ title: "Success", description: "Rating created successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: isUnauthorizedError(error) ? "Access denied" : "Failed to create rating",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RatingFormData }) => {
      await apiRequest("PUT", `/api/ratings/${id}`, {
        ratingType: data.ratingType,
        ratingScaleFrom: data.ratingScaleFrom,
        ratingScaleTo: data.ratingScaleTo,
        status: data.status,
        details: data.details,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ratings"] });
      setEditingRating(null);
      resetForm();
      toast({ title: "Success", description: "Rating updated successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: isUnauthorizedError(error) ? "Access denied" : "Failed to update rating",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/ratings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ratings"] });
      toast({ title: "Success", description: "Rating deleted successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: isUnauthorizedError(error) ? "Access denied" : "Failed to delete rating",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (rating: RatingWithDetails) => {
    setEditingRating(rating);
    const count = rating.ratingScaleTo - rating.ratingScaleFrom + 1;
    const details = Array.from({ length: count }, (_, i) => {
      const detail = rating.details[i];
      return {
        code: detail?.code || "",
        name: detail?.name || "",
        description: detail?.description || "",
      };
    });
    setFormData({
      ratingType: rating.ratingType as "numeric" | "text",
      ratingScaleFrom: rating.ratingScaleFrom,
      ratingScaleTo: rating.ratingScaleTo,
      status: (rating.status as "active" | "inactive") || "active",
      details,
    });
  };

  const handleSubmit = () => {
    const hasEmptyRequired = formData.details.some(d => !d.code.trim() || !d.name.trim());
    if (hasEmptyRequired) {
      toast({
        title: "Validation Error",
        description: "Code and Name are required for all rating details",
        variant: "destructive",
      });
      return;
    }

    if (editingRating) {
      updateMutation.mutate({ id: editingRating.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this rating?")) {
      deleteMutation.mutate(id);
    }
  };

  const updateDetail = (index: number, field: string, value: string) => {
    setFormData(prev => {
      const newDetails = [...prev.details];
      newDetails[index] = { ...newDetails[index], [field]: value };
      return { ...prev, details: newDetails };
    });
  };

  const filteredRatings = ratingsData.filter((rating) => {
    const typeLabel = rating.ratingType === 'numeric' ? 'Numeric' : 'Text';
    const scaleLabel = `${rating.ratingScaleFrom} to ${rating.ratingScaleTo}`;
    const matchesSearch = typeLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         scaleLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         rating.details?.some(d => d.code.toLowerCase().includes(searchQuery.toLowerCase()) || d.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || rating.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const renderForm = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Rating Header</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Rating Type</Label>
            <Select
              value={formData.ratingType}
              onValueChange={(val) => setFormData(prev => ({ ...prev, ratingType: val as "numeric" | "text" }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="numeric">Numeric</SelectItem>
                <SelectItem value="text">Text</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(val) => setFormData(prev => ({ ...prev, status: val as "active" | "inactive" }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label>Rating Scale: {formData.ratingScaleFrom} to {formData.ratingScaleTo}</Label>
          <div className="px-2">
            <Slider
              value={[formData.ratingScaleTo]}
              onValueChange={(val) => setFormData(prev => ({ ...prev, ratingScaleTo: val[0] }))}
              min={1}
              max={10}
              step={1}
              className="w-full"
            />
          </div>
          <div className="relative text-xs text-muted-foreground h-5">
            <span className="absolute" style={{ left: '0%' }}>1</span>
            <span className="absolute -translate-x-1/2" style={{ left: '44.4%' }}>5</span>
            <span className="absolute right-0">10</span>
          </div>
        </div>
      </div>

      <div className="border-t" />

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Rating Description ({scaleCount} {scaleCount === 1 ? 'record' : 'records'})
        </h3>
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
          {formData.details.map((detail, index) => (
            <div key={index} className="border rounded-lg p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Rating Value: {formData.ratingScaleFrom + index}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Code *</Label>
                  <Input
                    value={detail.code}
                    onChange={(e) => updateDetail(index, "code", e.target.value)}
                    placeholder="e.g., 1, A"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Name *</Label>
                  <Input
                    value={detail.name}
                    onChange={(e) => updateDetail(index, "name", e.target.value)}
                    placeholder="e.g., Poor"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={detail.description}
                    onChange={(e) => updateDetail(index, "description", e.target.value)}
                    placeholder="Optional description"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setIsCreateModalOpen(false);
            setEditingRating(null);
            resetForm();
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={createMutation.isPending || updateMutation.isPending}
        >
          {createMutation.isPending || updateMutation.isPending
            ? "Saving..."
            : editingRating ? "Update" : "Create"}
        </Button>
      </div>
    </div>
  );

  return (
    <RoleGuard allowedRoles={['admin', 'hr_manager']}>
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Ratings</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage rating scales and definitions for performance evaluations
            </p>
          </div>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Rating
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Rating</DialogTitle>
                <DialogDescription>
                  Define a new rating scale for performance evaluations
                </DialogDescription>
              </DialogHeader>
              {renderForm()}
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by type, scale, or detail..."
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
              <p>Loading ratings...</p>
            </div>
          ) : filteredRatings.length === 0 ? (
            <div className="text-center py-8">
              <Star className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium">No ratings found</p>
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Get started by creating your first rating scale"}
              </p>
            </div>
          ) : (
            filteredRatings.map((rating) => (
              <Card key={rating.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Star className="w-5 h-5 text-amber-500" />
                        <CardTitle className="text-lg">
                          {rating.ratingType === 'numeric' ? 'Numeric' : 'Text'} Rating - Scale {rating.ratingScaleFrom} to {rating.ratingScaleTo}
                        </CardTitle>
                        <Badge variant={rating.status === 'active' ? 'default' : 'secondary'}>
                          {rating.status}
                        </Badge>
                      </div>
                      <CardDescription>
                        {rating.ratingScaleTo - rating.ratingScaleFrom + 1} rating levels defined
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(rating)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(rating.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {rating.details && rating.details.length > 0 && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider pb-1 border-b">
                        <span>Value</span>
                        <span>Name</span>
                        <span>Description</span>
                      </div>
                      {rating.details.map((detail, idx) => (
                        <div key={detail.id} className="grid grid-cols-3 gap-2 text-sm py-1">
                          <span className="font-medium">{rating.ratingScaleFrom + idx}</span>
                          <span>{detail.name}</span>
                          <span className="text-muted-foreground">{detail.description || '-'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-3 mt-3 border-t text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>Created: {rating.createdAt ? new Date(rating.createdAt).toLocaleDateString() : 'Unknown'}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Dialog open={!!editingRating} onOpenChange={(open) => { if (!open) { setEditingRating(null); resetForm(); } }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Rating</DialogTitle>
              <DialogDescription>
                Update the rating scale and definitions
              </DialogDescription>
            </DialogHeader>
            {renderForm()}
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}
