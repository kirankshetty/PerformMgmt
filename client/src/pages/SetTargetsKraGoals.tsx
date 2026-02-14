import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Target, Search, X, Trash2, Save, ChevronDown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Calendar as CalendarIcon } from "lucide-react";

interface MemberFilters {
  nameOrCode: string;
  location: string[];
  department: string[];
  level: string[];
  grade: string[];
  businessRole: string[];
  dojFromDate: Date | undefined;
  dojTillDate: Date | undefined;
}

const emptyFilters: MemberFilters = {
  nameOrCode: "",
  location: [],
  department: [],
  level: [],
  grade: [],
  businessRole: [],
  dojFromDate: undefined,
  dojTillDate: undefined,
};

interface TargetMember {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  email: string;
  designation: string;
  department: string;
  targetCount: number;
}

interface KpiItem {
  id: string;
  code: string;
  name: string;
  weightageContribution: number;
}

interface KraWithKpis {
  id: string;
  code: string;
  displayName: string;
  description: string;
  kpis: KpiItem[];
}

interface ExistingTarget {
  id: string;
  targetValue: string;
  thresholdValue: string;
}

interface TargetData {
  employee: TargetMember;
  kras: KraWithKpis[];
  existingTargets: Record<string, ExistingTarget>;
  kraWeights?: Record<string, number>;
}

interface TargetEntry {
  kpiId: string;
  kraId: string;
  targetValue: string;
  thresholdValue: string;
}

export default function SetTargetsKraGoals() {
  const [draftFilters, setDraftFilters] = useState<MemberFilters>({ ...emptyFilters });
  const [appliedFilters, setAppliedFilters] = useState<MemberFilters>({ ...emptyFilters });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [isTargetDialogOpen, setIsTargetDialogOpen] = useState(false);
  const [targetValues, setTargetValues] = useState<Record<string, { targetValue: string; thresholdValue: string }>>({});

  const { toast } = useToast();

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (appliedFilters.nameOrCode) params.set("nameOrCode", appliedFilters.nameOrCode);
    if (appliedFilters.location.length > 0) params.set("location", appliedFilters.location.join(","));
    if (appliedFilters.department.length > 0) params.set("department", appliedFilters.department.join(","));
    if (appliedFilters.level.length > 0) params.set("level", appliedFilters.level.join(","));
    if (appliedFilters.grade.length > 0) params.set("grade", appliedFilters.grade.join(","));
    if (appliedFilters.businessRole.length > 0) params.set("businessRole", appliedFilters.businessRole.join(","));
    if (appliedFilters.dojFromDate) params.set("dojFromDate", format(appliedFilters.dojFromDate, "yyyy-MM-dd"));
    if (appliedFilters.dojTillDate) params.set("dojTillDate", format(appliedFilters.dojTillDate, "yyyy-MM-dd"));
    return params.toString();
  };

  const queryParams = buildQueryParams();
  const membersUrl = queryParams ? `/api/manager/target-members?${queryParams}` : "/api/manager/target-members";

  const { data: members = [], isLoading: isLoadingMembers } = useQuery<TargetMember[]>({
    queryKey: ["/api/manager/target-members", queryParams],
    queryFn: async () => {
      const res = await fetch(membersUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
  });

  const { data: locations = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/locations"],
  });

  const { data: levels = [] } = useQuery<Array<{ id: string; code: string; description: string }>>({
    queryKey: ["/api/levels"],
  });

  const { data: grades = [] } = useQuery<Array<{ id: string; code: string; description: string }>>({
    queryKey: ["/api/grades"],
  });

  const { data: businessRoles = [] } = useQuery<Array<{ id: string; description: string }>>({
    queryKey: ["/api/business-roles"],
  });

  const { data: targetData, isLoading: isLoadingTargets } = useQuery<TargetData>({
    queryKey: ["/api/manager/targets", selectedEmployeeId],
    queryFn: async () => {
      const res = await fetch(`/api/manager/targets/${selectedEmployeeId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch targets");
      return res.json();
    },
    enabled: !!selectedEmployeeId && isTargetDialogOpen,
  });

  const departmentOptions = Array.from(new Set(members.map(m => m.department).filter(Boolean))).sort().map(d => ({ value: d, label: d }));

  const saveTargetsMutation = useMutation({
    mutationFn: async (data: { employeeId: string; targets: TargetEntry[] }) => {
      const response = await apiRequest("POST", "/api/manager/targets", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/targets", selectedEmployeeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/target-members"] });
      toast({ title: "Success", description: "Targets saved successfully" });
      setIsTargetDialogOpen(false);
      setSelectedEmployeeId(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save targets", variant: "destructive" });
    },
  });

  const deleteTargetMutation = useMutation({
    mutationFn: async (targetId: string) => {
      await apiRequest("DELETE", `/api/manager/targets/${targetId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/targets", selectedEmployeeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/target-members"] });
      toast({ title: "Success", description: "Target deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete target", variant: "destructive" });
    },
  });

  const deleteAllTargetsMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      await apiRequest("DELETE", `/api/manager/targets/employee/${employeeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/targets", selectedEmployeeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/target-members"] });
      setTargetValues({});
      toast({ title: "Success", description: "All targets deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete all targets", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (targetData && isTargetDialogOpen) {
      const values: Record<string, { targetValue: string; thresholdValue: string }> = {};
      targetData.kras.forEach(kra => {
        kra.kpis.forEach(kpi => {
          const existing = targetData.existingTargets[kpi.id];
          values[kpi.id] = {
            targetValue: existing?.targetValue || "",
            thresholdValue: existing?.thresholdValue || "",
          };
        });
      });
      setTargetValues(values);
    }
  }, [targetData, isTargetDialogOpen]);

  const handleOpenTargetDialog = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    setTargetValues({});
    setIsTargetDialogOpen(true);
  };

  const handleCloseTargetDialog = () => {
    setIsTargetDialogOpen(false);
    setSelectedEmployeeId(null);
    setTargetValues({});
  };

  const handleSaveTargets = () => {
    if (!selectedEmployeeId || !targetData) return;
    const targets: TargetEntry[] = [];
    targetData.kras.forEach(kra => {
      kra.kpis.forEach(kpi => {
        const val = targetValues[kpi.id];
        if (val && (val.targetValue || val.thresholdValue)) {
          targets.push({
            kpiId: kpi.id,
            kraId: kra.id,
            targetValue: val.targetValue,
            thresholdValue: val.thresholdValue,
          });
        }
      });
    });
    saveTargetsMutation.mutate({ employeeId: selectedEmployeeId, targets });
  };

  const handleDeleteAllTargets = () => {
    if (!selectedEmployeeId) return;
    if (confirm("Are you sure you want to delete all targets for this employee? This action cannot be undone.")) {
      deleteAllTargetsMutation.mutate(selectedEmployeeId);
    }
  };

  const handleDeleteSingleTarget = (targetId: string) => {
    if (confirm("Are you sure you want to delete this target?")) {
      deleteTargetMutation.mutate(targetId);
    }
  };

  const handleSearch = () => {
    setAppliedFilters({ ...draftFilters });
  };

  const handleClearFilters = () => {
    setDraftFilters({ ...emptyFilters });
    setAppliedFilters({ ...emptyFilters });
  };

  const MultiSelect = ({
    options,
    value,
    onChange,
    placeholder,
  }: {
    options: { value: string; label: string }[];
    value: string[];
    onChange: (value: string[]) => void;
    placeholder: string;
  }) => {
    const [open, setOpen] = useState(false);

    const handleToggle = (optionValue: string) => {
      const newValue = value.includes(optionValue)
        ? value.filter(v => v !== optionValue)
        : [...value, optionValue];
      onChange(newValue);
    };

    const handleSelectAll = () => {
      if (value.length === options.length) {
        onChange([]);
      } else {
        onChange(options.map(option => option.value));
      }
    };

    const allSelected = options.length > 0 && value.length === options.length;
    const someSelected = value.length > 0 && value.length < options.length;

    const displayValue = value.length > 0
      ? value.length === 1
        ? options.find(o => o.value === value[0])?.label || value[0]
        : `${value.length} selected`
      : placeholder;

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between text-left font-normal"
          >
            {displayValue}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <div className="max-h-60 overflow-auto p-1">
            {options.length > 0 && (
              <>
                <div className="flex items-center space-x-2 rounded-md px-2 py-1 hover:bg-accent border-b border-border mb-1">
                  <Checkbox
                    id="select-all"
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={handleSelectAll}
                  />
                  <label htmlFor="select-all" className="flex-1 cursor-pointer text-sm font-medium">
                    Select All
                  </label>
                </div>
                {options.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2 rounded-md px-2 py-1 hover:bg-accent">
                    <Checkbox
                      id={option.value}
                      checked={value.includes(option.value)}
                      onCheckedChange={() => handleToggle(option.value)}
                    />
                    <label htmlFor={option.value} className="flex-1 cursor-pointer text-sm">
                      {option.label}
                    </label>
                  </div>
                ))}
              </>
            )}
            {options.length === 0 && (
              <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                No options available
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Target className="h-8 w-8" />
            Set Targets for KRA/Goal
          </h1>
          <p className="text-muted-foreground mt-2">
            Set performance targets for your reporting team members
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filter Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Name or Code</Label>
              <Input
                placeholder="Search by name or code..."
                value={draftFilters.nameOrCode}
                onChange={(e) => setDraftFilters(prev => ({ ...prev, nameOrCode: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <MultiSelect
                options={locations.map(l => ({ value: l.id, label: l.name }))}
                value={draftFilters.location}
                onChange={(val) => setDraftFilters(prev => ({ ...prev, location: val }))}
                placeholder="Select locations"
              />
            </div>

            <div className="space-y-2">
              <Label>Department</Label>
              <MultiSelect
                options={departmentOptions}
                value={draftFilters.department}
                onChange={(val) => setDraftFilters(prev => ({ ...prev, department: val }))}
                placeholder="Select departments"
              />
            </div>

            <div className="space-y-2">
              <Label>Level</Label>
              <MultiSelect
                options={levels.map(l => ({ value: l.id, label: l.description }))}
                value={draftFilters.level}
                onChange={(val) => setDraftFilters(prev => ({ ...prev, level: val }))}
                placeholder="Select levels"
              />
            </div>

            <div className="space-y-2">
              <Label>Grade</Label>
              <MultiSelect
                options={grades.map(g => ({ value: g.id, label: g.description }))}
                value={draftFilters.grade}
                onChange={(val) => setDraftFilters(prev => ({ ...prev, grade: val }))}
                placeholder="Select grades"
              />
            </div>

            <div className="space-y-2">
              <Label>Business Role</Label>
              <MultiSelect
                options={businessRoles.map(b => ({ value: b.id, label: b.description }))}
                value={draftFilters.businessRole}
                onChange={(val) => setDraftFilters(prev => ({ ...prev, businessRole: val }))}
                placeholder="Select business roles"
              />
            </div>

            <div className="space-y-2">
              <Label>DOJ From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {draftFilters.dojFromDate ? format(draftFilters.dojFromDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={draftFilters.dojFromDate}
                    onSelect={(date) => setDraftFilters(prev => ({ ...prev, dojFromDate: date || undefined }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>DOJ Till Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {draftFilters.dojTillDate ? format(draftFilters.dojTillDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={draftFilters.dojTillDate}
                    onSelect={(date) => setDraftFilters(prev => ({ ...prev, dojTillDate: date || undefined }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Button variant="outline" onClick={handleClearFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Reporting Members
            {members.length > 0 && (
              <Badge variant="secondary">{members.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingMembers ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">No members found</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters or check if you have reporting members assigned.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Target Count</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.code}</TableCell>
                    <TableCell>{member.firstName} {member.lastName}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>{member.designation || "-"}</TableCell>
                    <TableCell>{member.department || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={member.targetCount > 0 ? "default" : "secondary"}>
                        {member.targetCount}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => handleOpenTargetDialog(member.id)}>
                        <Target className="h-4 w-4 mr-2" />
                        Set Target
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isTargetDialogOpen} onOpenChange={(open) => { if (!open) handleCloseTargetDialog(); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Set Targets
              {targetData?.employee && (
                <span className="text-muted-foreground font-normal">
                  — {targetData.employee.firstName} {targetData.employee.lastName}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {isLoadingTargets ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ))}
            </div>
          ) : targetData ? (
            <div className="space-y-6">

              {targetData.kras.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground">No KRAs available</h3>
                  <p className="text-sm text-muted-foreground">
                    There are no KRAs configured in the system yet.
                  </p>
                </div>
              ) : (
                targetData.kras.map((kra) => (
                  <Card key={kra.id}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Target className="h-4 w-4 text-blue-600" />
                        {kra.code} — {kra.displayName}
                        {targetData.kraWeights && targetData.kraWeights[kra.id] != null && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Weightage: {targetData.kraWeights[kra.id]}%
                          </Badge>
                        )}
                      </CardTitle>
                      {kra.description && (
                        <p className="text-sm text-muted-foreground">{kra.description}</p>
                      )}
                    </CardHeader>
                    <CardContent>
                      {kra.kpis.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No KPIs defined for this KRA</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>KPI Code</TableHead>
                              <TableHead>KPI Name</TableHead>
                              <TableHead>Review Frequency</TableHead>
                              <TableHead>Input Type</TableHead>
                              <TableHead>Weightage</TableHead>
                              <TableHead>Target Value</TableHead>
                              <TableHead>Min Threshold Value</TableHead>
                              <TableHead className="w-12"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {kra.kpis.map((kpi) => {
                              const existing = targetData.existingTargets[kpi.id];
                              return (
                                <TableRow key={kpi.id}>
                                  <TableCell className="font-medium">{kpi.code}</TableCell>
                                  <TableCell>{kpi.name}</TableCell>
                                  <TableCell>{kpi.reviewFrequencyName || '-'}</TableCell>
                                  <TableCell className="capitalize">{kpi.inputType || '-'}</TableCell>
                                  <TableCell>{kpi.weightageContribution}%</TableCell>
                                  <TableCell>
                                    <Input
                                      placeholder="Target"
                                      value={targetValues[kpi.id]?.targetValue || ""}
                                      onChange={(e) =>
                                        setTargetValues(prev => ({
                                          ...prev,
                                          [kpi.id]: { ...prev[kpi.id], targetValue: e.target.value },
                                        }))
                                      }
                                      className="w-24"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      placeholder="Min Threshold"
                                      value={targetValues[kpi.id]?.thresholdValue || ""}
                                      onChange={(e) =>
                                        setTargetValues(prev => ({
                                          ...prev,
                                          [kpi.id]: { ...prev[kpi.id], thresholdValue: e.target.value },
                                        }))
                                      }
                                      className="w-24"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {existing && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteSingleTarget(existing.id)}
                                        disabled={deleteTargetMutation.isPending}
                                      >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}

              {targetData.kras.length > 0 && (
                <div className="flex justify-between pt-4 border-t">
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAllTargets}
                    disabled={deleteAllTargetsMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete All Targets
                  </Button>
                  <Button
                    onClick={handleSaveTargets}
                    disabled={saveTargetsMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saveTargetsMutation.isPending ? "Saving..." : "Save Targets"}
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
