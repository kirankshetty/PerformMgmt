import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RoleGuard } from "@/components/RoleGuard";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Plus, Search, Edit, Trash2, Target, Clock, ChevronDown, ChevronUp } from "lucide-react";
import type { Kra, Kpi, ReviewFrequency } from "@shared/schema";

type KraWithKpis = Kra & { kpis: Kpi[] };

interface KpiFormRow {
  code: string;
  name: string;
  inputType: "number" | "value" | "date" | "percentage";
  weightageContribution: number;
  status: "active" | "inactive";
}

interface KraFormData {
  code: string;
  displayName: string;
  description: string;
  reviewFrequencyId: string;
  status: "active" | "inactive";
  kpis: KpiFormRow[];
}

const defaultKpi: KpiFormRow = {
  code: "",
  name: "",
  inputType: "number",
  weightageContribution: 100,
  status: "active",
};

const defaultFormData: KraFormData = {
  code: "",
  displayName: "",
  description: "",
  reviewFrequencyId: "",
  status: "active",
  kpis: [],
};

export default function KraGoalsManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingKra, setEditingKra] = useState<KraWithKpis | null>(null);
  const [formData, setFormData] = useState<KraFormData>({ ...defaultFormData });
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: kraList = [], isLoading } = useQuery<KraWithKpis[]>({
    queryKey: ["/api/kras"],
  });

  const { data: reviewFrequencies = [] } = useQuery<ReviewFrequency[]>({
    queryKey: ["/api/review-frequencies-all"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: KraFormData) => {
      const { kpis, ...kraData } = data;
      await apiRequest("POST", "/api/kras", { ...kraData, kpis });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kras"] });
      setIsCreateModalOpen(false);
      resetForm();
      toast({ title: "Success", description: "KRA / Goal created successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: isUnauthorizedError(error) ? "Access denied" : "Failed to create KRA / Goal",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: KraFormData }) => {
      const { kpis, ...kraData } = data;
      await apiRequest("PUT", `/api/kras/${id}`, { ...kraData, kpis });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kras"] });
      setEditingKra(null);
      resetForm();
      toast({ title: "Success", description: "KRA / Goal updated successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: isUnauthorizedError(error) ? "Access denied" : "Failed to update KRA / Goal",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/kras/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kras"] });
      toast({ title: "Success", description: "KRA / Goal deleted successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: isUnauthorizedError(error) ? "Access denied" : "Failed to delete KRA / Goal",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({ ...defaultFormData, kpis: [] });
  };

  const handleEdit = (kra: KraWithKpis) => {
    setEditingKra(kra);
    setFormData({
      code: kra.code,
      displayName: kra.displayName,
      description: kra.description || "",
      reviewFrequencyId: kra.reviewFrequencyId || "",
      status: (kra.status as "active" | "inactive") || "active",
      kpis: (kra.kpis || []).map(kpi => ({
        code: kpi.code,
        name: kpi.name,
        inputType: kpi.inputType as KpiFormRow["inputType"],
        weightageContribution: kpi.weightageContribution,
        status: (kpi.status as "active" | "inactive") || "active",
      })),
    });
  };

  const onSubmit = () => {
    if (!formData.code.trim() || !formData.displayName.trim()) {
      toast({ title: "Validation Error", description: "Code and Display Name are required", variant: "destructive" });
      return;
    }
    if (editingKra) {
      updateMutation.mutate({ id: editingKra.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this KRA / Goal and all its KPIs?")) {
      deleteMutation.mutate(id);
    }
  };

  const addKpi = () => {
    setFormData(prev => ({
      ...prev,
      kpis: [...prev.kpis, { ...defaultKpi }],
    }));
  };

  const removeKpi = (index: number) => {
    setFormData(prev => ({
      ...prev,
      kpis: prev.kpis.filter((_, i) => i !== index),
    }));
  };

  const updateKpi = (index: number, field: keyof KpiFormRow, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      kpis: prev.kpis.map((kpi, i) => i === index ? { ...kpi, [field]: value } : kpi),
    }));
  };

  const toggleCardExpand = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredKras = kraList.filter((kra) => {
    const matchesSearch = kra.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         kra.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (kra.description && kra.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || kra.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getFrequencyName = (id: string | null) => {
    if (!id) return "Not set";
    const freq = reviewFrequencies.find(f => f.id === id);
    return freq ? `${freq.code} - ${freq.description}` : "Unknown";
  };

  const renderForm = () => (
    <div className="space-y-6">
      <div className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">KRA Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Code *</Label>
            <Input
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
              placeholder="e.g., KRA-001"
            />
          </div>
          <div className="space-y-2">
            <Label>Display Name *</Label>
            <Input
              value={formData.displayName}
              onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
              placeholder="e.g., Sales Performance"
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Label>Description</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe the KRA / Goal..."
            className="min-h-20"
          />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <Label>Review Frequency</Label>
            <Select
              value={formData.reviewFrequencyId || "none"}
              onValueChange={(val) => setFormData(prev => ({ ...prev, reviewFrequencyId: val === "none" ? "" : val }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {reviewFrequencies.map(freq => (
                  <SelectItem key={freq.id} value={freq.id}>
                    {freq.code} - {freq.description}
                  </SelectItem>
                ))}
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
      </div>

      <div className="border rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">KPI Details</h3>
          <Button type="button" variant="outline" size="sm" onClick={addKpi}>
            <Plus className="w-4 h-4 mr-2" />
            Add KPI
          </Button>
        </div>

        {formData.kpis.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No KPIs added yet. Click "Add KPI" to add one.</p>
        ) : (
          <div className="space-y-4">
            {formData.kpis.map((kpi, index) => (
              <div key={index} className="border rounded-md p-3 bg-gray-50 dark:bg-gray-900">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium">KPI #{index + 1}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeKpi(index)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Code</Label>
                    <Input
                      value={kpi.code}
                      onChange={(e) => updateKpi(index, "code", e.target.value)}
                      placeholder="e.g., KPI-001"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={kpi.name}
                      onChange={(e) => updateKpi(index, "name", e.target.value)}
                      placeholder="e.g., Revenue Target"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Input Type</Label>
                    <Select value={kpi.inputType} onValueChange={(val) => updateKpi(index, "inputType", val)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="value">Value</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="percentage">Percentage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Weightage Contribution (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={kpi.weightageContribution}
                      onChange={(e) => updateKpi(index, "weightageContribution", parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <Select value={kpi.status} onValueChange={(val) => updateKpi(index, "status", val)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setIsCreateModalOpen(false);
            setEditingKra(null);
            resetForm();
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={onSubmit}
          disabled={createMutation.isPending || updateMutation.isPending}
        >
          {createMutation.isPending || updateMutation.isPending ? "Saving..." :
           editingKra ? "Update" : "Create"}
        </Button>
      </div>
    </div>
  );

  return (
    <RoleGuard allowedRoles={['admin', 'hr_manager']}>
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">KRA / Goals</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage Key Result Areas and Key Performance Indicators
            </p>
          </div>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="w-4 h-4 mr-2" />
                Add KRA / Goal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add KRA / Goal</DialogTitle>
                <DialogDescription>
                  Define a new Key Result Area with associated KPIs
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
              placeholder="Search by code, name, or description..."
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
              <p>Loading KRA / Goals...</p>
            </div>
          ) : filteredKras.length === 0 ? (
            <div className="text-center py-8">
              <Target className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium">No KRA / Goals found</p>
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Get started by adding your first KRA / Goal"}
              </p>
            </div>
          ) : (
            filteredKras.map((kra) => (
              <Card key={kra.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 cursor-pointer" onClick={() => toggleCardExpand(kra.id)}>
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-5 h-5 text-blue-600" />
                        <CardTitle className="text-lg">
                          {kra.code} - {kra.displayName}
                        </CardTitle>
                        <Badge variant={kra.status === 'active' ? 'default' : 'secondary'}>
                          {kra.status}
                        </Badge>
                        {kra.kpis && kra.kpis.length > 0 && (
                          <Badge variant="outline">{kra.kpis.length} KPI{kra.kpis.length > 1 ? 's' : ''}</Badge>
                        )}
                        {expandedCards.has(kra.id) ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      {kra.description && (
                        <CardDescription>{kra.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(kra)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(kra.id)} disabled={deleteMutation.isPending}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {expandedCards.has(kra.id) && (
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Clock className="w-4 h-4" />
                        <span>Review Frequency: {getFrequencyName(kra.reviewFrequencyId)}</span>
                      </div>
                      {kra.kpis && kra.kpis.length > 0 && (
                        <div className="mt-3">
                          <h4 className="font-medium mb-2">Key Performance Indicators</h4>
                          <div className="border rounded-md overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium">Code</th>
                                  <th className="px-3 py-2 text-left font-medium">Name</th>
                                  <th className="px-3 py-2 text-left font-medium">Input Type</th>
                                  <th className="px-3 py-2 text-left font-medium">Weightage</th>
                                  <th className="px-3 py-2 text-left font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {kra.kpis.map((kpi) => (
                                  <tr key={kpi.id} className="border-t">
                                    <td className="px-3 py-2">{kpi.code}</td>
                                    <td className="px-3 py-2">{kpi.name}</td>
                                    <td className="px-3 py-2 capitalize">{kpi.inputType}</td>
                                    <td className="px-3 py-2">{kpi.weightageContribution}%</td>
                                    <td className="px-3 py-2">
                                      <Badge variant={kpi.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                                        {kpi.status}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>

        <Dialog open={!!editingKra} onOpenChange={(open) => { if (!open) { setEditingKra(null); resetForm(); } }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit KRA / Goal</DialogTitle>
              <DialogDescription>
                Update the KRA and its KPIs
              </DialogDescription>
            </DialogHeader>
            {renderForm()}
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}
