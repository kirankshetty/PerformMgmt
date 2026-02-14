import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Target, Clock, FileText, Send, CheckCircle, AlertCircle, Save, Square, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface GoalItem {
  id: string | null;
  kpiTargetId: string;
  kpiId: string;
  kraId: string;
  kraCode: string;
  kraName: string;
  kpiCode: string;
  kpiName: string;
  kpiInputType: string;
  reviewFrequency: string;
  targetValue: string;
  thresholdValue: string | null;
  periodKey: string;
  periodName: string;
  periodStart: string;
  periodEnd: string;
  selfRating: string;
  pipelineValue: string;
  selfComments: string;
  pipelineRemarks: string;
  status: string;
  category: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  managerComments: string | null;
}

interface GoalsData {
  goals: GoalItem[];
  counts: {
    pending: number;
    new: number;
    toBeSubmitted: number;
    pendingApproval: number;
    approved: number;
  };
}

type CategoryType = 'pending' | 'new' | 'toBeSubmitted' | 'pendingApproval' | 'approved';

export default function KraGoalsSelfReview() {
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState<CategoryType>('new');
  const [editValues, setEditValues] = useState<Record<string, { selfRating: string; pipelineValue: string; selfComments: string; pipelineRemarks: string }>>({});
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<GoalsData>({
    queryKey: ["/api/employee/kra-goal-reviews"],
  });

  const saveMutation = useMutation({
    mutationFn: async (reviews: any[]) => {
      const response = await apiRequest("POST", "/api/employee/kra-goal-reviews/save", { reviews });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee/kra-goal-reviews"] });
      toast({ title: "Success", description: "Reviews saved as draft" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save", variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (reviews: any[]) => {
      const response = await apiRequest("POST", "/api/employee/kra-goal-reviews/submit", { reviews });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee/kra-goal-reviews"] });
      setEditValues({});
      toast({ title: "Success", description: "Reviews submitted for approval" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to submit", variant: "destructive" });
    },
  });

  const filteredGoals = data?.goals.filter(g => g.category === activeCategory) || [];
  const hasMultiSelect = activeCategory === 'pending' || activeCategory === 'new';

  const getGoalKey = (goal: GoalItem) => `${goal.kpiId}_${goal.periodKey}`;

  const toggleGoalSelection = (goal: GoalItem) => {
    const key = getGoalKey(goal);
    setSelectedGoals(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedGoals.size === filteredGoals.length) {
      setSelectedGoals(new Set());
    } else {
      setSelectedGoals(new Set(filteredGoals.map(g => getGoalKey(g))));
    }
  };

  const groupedByKraPeriod = filteredGoals.reduce<Record<string, { kraCode: string; kraName: string; periodKey: string; periodName: string; periodStart: string; periodEnd: string; reviewFrequency: string; goals: GoalItem[] }>>((acc, goal) => {
    const key = `${goal.kraId}_${goal.periodKey}`;
    if (!acc[key]) {
      acc[key] = {
        kraCode: goal.kraCode,
        kraName: goal.kraName,
        periodKey: goal.periodKey,
        periodName: goal.periodName,
        periodStart: goal.periodStart,
        periodEnd: goal.periodEnd,
        reviewFrequency: goal.reviewFrequency,
        goals: [],
      };
    }
    acc[key].goals.push(goal);
    return acc;
  }, {});

  const getEditKey = (goal: GoalItem) => `${goal.kpiId}_${goal.periodKey}`;

  const getGoalsForAction = () => {
    if (hasMultiSelect && selectedGoals.size > 0) {
      return filteredGoals.filter(g => selectedGoals.has(getGoalKey(g)));
    }
    return filteredGoals;
  };

  const handleSave = () => {
    const goalsToProcess = getGoalsForAction();
    const reviewsToSave = goalsToProcess
      .filter(g => {
        const key = getEditKey(g);
        return editValues[key] || selectedGoals.has(getGoalKey(g));
      })
      .map(g => {
        const key = getEditKey(g);
        return {
          kpiTargetId: g.kpiTargetId,
          kpiId: g.kpiId,
          kraId: g.kraId,
          periodKey: g.periodKey,
          periodStart: g.periodStart,
          periodEnd: g.periodEnd,
          selfRating: editValues[key]?.selfRating || g.selfRating || '',
          pipelineValue: editValues[key]?.pipelineValue || g.pipelineValue || '',
          selfComments: editValues[key]?.selfComments || g.selfComments || '',
          pipelineRemarks: editValues[key]?.pipelineRemarks || g.pipelineRemarks || '',
        };
      });

    if (reviewsToSave.length === 0) {
      toast({ title: "Info", description: hasMultiSelect ? "Please select goals to save" : "No changes to save" });
      return;
    }
    saveMutation.mutate(reviewsToSave);
  };

  const handleSubmit = () => {
    const goalsToProcess = getGoalsForAction();
    if (hasMultiSelect && selectedGoals.size === 0) {
      toast({ title: "Info", description: "Please select goals to submit" });
      return;
    }
    const allGoals = goalsToProcess.map(g => {
      const key = getEditKey(g);
      return {
        kpiTargetId: g.kpiTargetId,
        kpiId: g.kpiId,
        kraId: g.kraId,
        periodKey: g.periodKey,
        periodStart: g.periodStart,
        periodEnd: g.periodEnd,
        selfRating: editValues[key]?.selfRating || g.selfRating || '',
        pipelineValue: editValues[key]?.pipelineValue || g.pipelineValue || '',
        selfComments: editValues[key]?.selfComments || g.selfComments || '',
        pipelineRemarks: editValues[key]?.pipelineRemarks || g.pipelineRemarks || '',
      };
    });

    if (allGoals.length === 0) {
      toast({ title: "Info", description: "No goals to submit" });
      return;
    }
    submitMutation.mutate(allGoals);
    setSelectedGoals(new Set());
  };

  const cards: { key: CategoryType; label: string; icon: any; color: string }[] = [
    { key: 'pending', label: 'Pending Goals', icon: AlertCircle, color: 'text-red-500' },
    { key: 'new', label: 'New Goals', icon: Target, color: 'text-blue-500' },
    { key: 'toBeSubmitted', label: 'Goals to be Submitted', icon: FileText, color: 'text-orange-500' },
    { key: 'pendingApproval', label: 'Pending Approval', icon: Clock, color: 'text-yellow-600' },
    { key: 'approved', label: 'Approved', icon: CheckCircle, color: 'text-green-500' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'not_started': return <Badge variant="outline">Not Started</Badge>;
      case 'draft': return <Badge variant="secondary">Draft</Badge>;
      case 'submitted': return <Badge className="bg-blue-100 text-blue-800">Submitted</Badge>;
      case 'approved': return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isEditable = activeCategory === 'pending' || activeCategory === 'new' || activeCategory === 'toBeSubmitted';

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">KRAs/Goals Self Review</h1>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const counts = data?.counts || { pending: 0, new: 0, toBeSubmitted: 0, pendingApproval: 0, approved: 0 };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Target className="h-6 w-6" />
        KRAs/Goals Self Review
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {cards.map(card => {
          const Icon = card.icon;
          const count = counts[card.key];
          const isActive = activeCategory === card.key;
          return (
            <Card
              key={card.key}
              className={`cursor-pointer transition-all hover:shadow-md ${isActive ? 'ring-2 ring-primary shadow-md' : ''}`}
              onClick={() => { setActiveCategory(card.key); setSelectedGoals(new Set()); }}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={`h-8 w-8 ${card.color}`} />
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span>{cards.find(c => c.key === activeCategory)?.label}</span>
              {hasMultiSelect && filteredGoals.length > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={filteredGoals.length > 0 && selectedGoals.size === filteredGoals.length}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-sm font-normal text-muted-foreground">
                    {selectedGoals.size > 0 ? `${selectedGoals.size} of ${filteredGoals.length} selected` : 'Select All'}
                  </span>
                </div>
              )}
            </div>
            {isEditable && filteredGoals.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  disabled={saveMutation.isPending || (hasMultiSelect && selectedGoals.size === 0)}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {saveMutation.isPending ? "Saving..." : "Save as Draft"}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending || (hasMultiSelect && selectedGoals.size === 0)}
                >
                  <Send className="h-4 w-4 mr-1" />
                  {submitMutation.isPending ? "Submitting..." : "Submit for Approval"}
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredGoals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No goals found in this category</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedByKraPeriod).map(([groupKey, group]) => (
                <Card key={groupKey} className="border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      {group.kraCode} — {group.kraName}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Period: {group.periodName} | Review Frequency: {group.reviewFrequency}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {hasMultiSelect && <TableHead className="w-10"></TableHead>}
                          <TableHead>KPI Code</TableHead>
                          <TableHead>KPI Name</TableHead>
                          <TableHead>Input Type</TableHead>
                          <TableHead>Target</TableHead>
                          <TableHead>Threshold</TableHead>
                          <TableHead>Actual Value</TableHead>
                          <TableHead>Pipeline Value</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.goals.map((goal) => {
                          const editKey = getEditKey(goal);
                          const selfRating = editValues[editKey]?.selfRating ?? goal.selfRating ?? '';
                          const pipelineValue = editValues[editKey]?.pipelineValue ?? goal.pipelineValue ?? '';
                          const selfComments = editValues[editKey]?.selfComments ?? goal.selfComments ?? '';
                          const pipelineRemarks = editValues[editKey]?.pipelineRemarks ?? goal.pipelineRemarks ?? '';
                          const updateEdit = (field: string, value: string) => {
                            setEditValues(prev => ({
                              ...prev,
                              [editKey]: {
                                selfRating: prev[editKey]?.selfRating ?? goal.selfRating ?? '',
                                pipelineValue: prev[editKey]?.pipelineValue ?? goal.pipelineValue ?? '',
                                selfComments: prev[editKey]?.selfComments ?? goal.selfComments ?? '',
                                pipelineRemarks: prev[editKey]?.pipelineRemarks ?? goal.pipelineRemarks ?? '',
                                [field]: value,
                              },
                            }));
                          };
                          return (
                            <>
                              <TableRow key={`${goal.kpiId}_${goal.periodKey}`}>
                                {hasMultiSelect && (
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedGoals.has(getGoalKey(goal))}
                                      onCheckedChange={() => toggleGoalSelection(goal)}
                                    />
                                  </TableCell>
                                )}
                                <TableCell className="font-medium">{goal.kpiCode}</TableCell>
                                <TableCell>{goal.kpiName}</TableCell>
                                <TableCell className="capitalize">{goal.kpiInputType}</TableCell>
                                <TableCell>{goal.targetValue}</TableCell>
                                <TableCell>{goal.thresholdValue || '-'}</TableCell>
                                <TableCell>
                                  {isEditable ? (
                                    <Input
                                      placeholder={goal.kpiInputType || "Value"}
                                      value={selfRating}
                                      onChange={(e) => updateEdit('selfRating', e.target.value)}
                                      className="w-28 text-right"
                                    />
                                  ) : (
                                    <span>{goal.selfRating || '-'}</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {isEditable ? (
                                    <Input
                                      placeholder={goal.kpiInputType || "Value"}
                                      value={pipelineValue}
                                      onChange={(e) => updateEdit('pipelineValue', e.target.value)}
                                      className="w-28 text-right"
                                    />
                                  ) : (
                                    <span>{goal.pipelineValue || '-'}</span>
                                  )}
                                </TableCell>
                                <TableCell>{getStatusBadge(goal.status)}</TableCell>
                              </TableRow>
                              <TableRow key={`${goal.kpiId}_${goal.periodKey}_remarks`}>
                                <TableCell colSpan={hasMultiSelect ? 9 : 8} className="pt-0 pb-1">
                                  <div className="flex items-start gap-3">
                                    <span className="text-sm font-medium text-muted-foreground whitespace-nowrap w-48 shrink-0 mt-2">Remarks for Actual Value:</span>
                                    {isEditable ? (
                                      <Textarea
                                        placeholder="Enter remarks for actual value..."
                                        value={selfComments}
                                        onChange={(e) => updateEdit('selfComments', e.target.value)}
                                        className="flex-1 min-h-[60px] text-sm"
                                      />
                                    ) : (
                                      <span className="text-sm mt-2">{goal.selfComments || '-'}</span>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow key={`${goal.kpiId}_${goal.periodKey}_pipeline_remarks`} className="border-b">
                                <TableCell colSpan={hasMultiSelect ? 9 : 8} className="pt-0 pb-3">
                                  <div className="flex items-start gap-3">
                                    <span className="text-sm font-medium text-muted-foreground whitespace-nowrap w-48 shrink-0 mt-2">Remarks for Pipeline Value:</span>
                                    {isEditable ? (
                                      <Textarea
                                        placeholder="Enter remarks for pipeline value..."
                                        value={pipelineRemarks}
                                        onChange={(e) => updateEdit('pipelineRemarks', e.target.value)}
                                        className="flex-1 min-h-[60px] text-sm"
                                      />
                                    ) : (
                                      <span className="text-sm mt-2">{goal.pipelineRemarks || '-'}</span>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            </>
                          );
                        })}
                      </TableBody>
                    </Table>
                    {activeCategory === 'approved' && group.goals.some(g => g.managerComments) && (
                      <div className="mt-3 p-3 bg-muted rounded-md">
                        <p className="text-sm font-medium">Manager Comments:</p>
                        {group.goals.filter(g => g.managerComments).map(g => (
                          <p key={g.kpiId} className="text-sm text-muted-foreground">{g.kpiName}: {g.managerComments}</p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
