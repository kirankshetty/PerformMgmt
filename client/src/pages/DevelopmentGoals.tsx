import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RoleGuard } from "@/components/RoleGuard";
import { format } from "date-fns";
import { 
  Target, 
  Plus, 
  Pencil, 
  Trash2, 
  Calendar,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Clock,
  Flag
} from "lucide-react";
import type { DevelopmentGoal } from "@shared/schema";

interface GoalWithDetails extends DevelopmentGoal {
  evaluation?: {
    id: string;
    status: string;
    meetingCompletedAt: Date | null;
    overallRating: number | null;
  } | null;
  appraisalCycle?: {
    id: string;
    code: string;
    description: string;
  } | null;
  frequencyCalendarPeriod?: {
    displayName: string;
    startDate: string;
    endDate: string;
  } | null;
}

interface EligibleEvaluation {
  id: string;
  meetingCompletedAt: Date;
  overallRating: number | null;
  appraisalCycle: {
    id: string;
    code: string;
    description: string;
    status: string;
  } | null;
  frequencyCalendarPeriod: {
    displayName: string;
    startDate: string;
    endDate: string;
  } | null;
  isActiveAppraisalCycle: boolean;
  goalsCount: number;
}

const goalFormSchema = z.object({
  evaluationId: z.string().min(1, "Please select an evaluation"),
  description: z.string().min(1, "Goal description is required"),
  plannedOutcome: z.string().min(1, "Planned outcome is required"),
  targetDate: z.string().min(1, "Target date is required"),
  progress: z.number().min(0).max(100).default(0),
});

type GoalFormData = z.infer<typeof goalFormSchema>;

export default function DevelopmentGoals() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<GoalWithDetails | null>(null);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: goals = [], isLoading: isLoadingGoals } = useQuery<GoalWithDetails[]>({
    queryKey: ["/api/development-goals"],
  });

  const { data: eligibleEvaluations = [], isLoading: isLoadingEvaluations } = useQuery<EligibleEvaluation[]>({
    queryKey: ["/api/development-goals/eligible-evaluations"],
  });

  const createForm = useForm<GoalFormData>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      evaluationId: selectedEvaluationId || "",
      description: "",
      plannedOutcome: "",
      targetDate: "",
      progress: 0,
    },
  });

  const editForm = useForm<GoalFormData>({
    resolver: zodResolver(goalFormSchema),
  });

  const createGoalMutation = useMutation({
    mutationFn: async (data: GoalFormData) => {
      const response = await apiRequest("POST", "/api/development-goals", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/development-goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/development-goals/eligible-evaluations"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "Goal Created",
        description: "Your development goal has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create goal",
        variant: "destructive",
      });
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<GoalFormData> }) => {
      const response = await apiRequest("PUT", `/api/development-goals/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/development-goals"] });
      setIsEditDialogOpen(false);
      setSelectedGoal(null);
      toast({
        title: "Goal Updated",
        description: "Your development goal has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update goal",
        variant: "destructive",
      });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/development-goals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/development-goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/development-goals/eligible-evaluations"] });
      toast({
        title: "Goal Deleted",
        description: "Your development goal has been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete goal",
        variant: "destructive",
      });
    },
  });

  const handleEditGoal = (goal: GoalWithDetails) => {
    setSelectedGoal(goal);
    editForm.reset({
      evaluationId: goal.evaluationId,
      description: goal.description,
      plannedOutcome: goal.plannedOutcome,
      targetDate: goal.targetDate ? format(new Date(goal.targetDate), "yyyy-MM-dd") : "",
      progress: goal.progress || 0,
    });
    setIsEditDialogOpen(true);
  };

  const handleCreateGoal = (evaluationId?: string) => {
    createForm.reset({
      evaluationId: evaluationId || "",
      description: "",
      plannedOutcome: "",
      targetDate: "",
      progress: 0,
    });
    setSelectedEvaluationId(evaluationId || null);
    setIsCreateDialogOpen(true);
  };

  const onCreateSubmit = (data: GoalFormData) => {
    createGoalMutation.mutate(data);
  };

  const onEditSubmit = (data: GoalFormData) => {
    if (selectedGoal) {
      updateGoalMutation.mutate({
        id: selectedGoal.id,
        data: {
          description: data.description,
          plannedOutcome: data.plannedOutcome,
          targetDate: data.targetDate,
          progress: data.progress,
        },
      });
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "on_track":
        return (
          <Badge variant="default" className="bg-blue-600">
            <TrendingUp className="h-3 w-3 mr-1" />
            On Track
          </Badge>
        );
      case "delayed":
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Delayed
          </Badge>
        );
      case "not_started":
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Not Started
          </Badge>
        );
    }
  };

  const groupedGoals = goals.reduce((acc, goal) => {
    const cycleKey = goal.appraisalCycle?.code || "Unknown Cycle";
    if (!acc[cycleKey]) {
      acc[cycleKey] = {
        cycle: goal.appraisalCycle,
        goals: [],
      };
    }
    acc[cycleKey].goals.push(goal);
    return acc;
  }, {} as Record<string, { cycle: typeof goals[0]['appraisalCycle']; goals: GoalWithDetails[] }>);

  const isLoading = isLoadingGoals || isLoadingEvaluations;

  return (
    <RoleGuard allowedRoles={["employee", "manager"]}>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              My Development Goals
            </h1>
            <p className="text-muted-foreground">
              Track your professional development goals linked to your evaluations
            </p>
          </div>
          <Button
            onClick={() => handleCreateGoal()}
            disabled={eligibleEvaluations.length === 0}
            data-testid="button-add-goal"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Goal
          </Button>
        </div>

        {eligibleEvaluations.length === 0 && !isLoading && (
          <Card>
            <CardContent className="py-8 text-center">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Eligible Evaluations</h3>
              <p className="text-muted-foreground">
                Development goals can only be created after your evaluation meeting is completed 
                and for active appraisal cycles. Complete your evaluations to start setting goals.
              </p>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 bg-muted rounded w-1/4"></div>
                  <div className="h-4 bg-muted rounded w-1/3 mt-2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-muted rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : goals.length === 0 && eligibleEvaluations.length > 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Flag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Goals Yet</h3>
              <p className="text-muted-foreground mb-4">
                Start setting your development goals based on your completed evaluations.
              </p>
              <Button onClick={() => handleCreateGoal()} data-testid="button-create-first-goal">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Goal
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedGoals).map(([cycleKey, { cycle, goals: cycleGoals }]) => (
              <Card key={cycleKey}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {cycle?.code} - {cycle?.description}
                  </CardTitle>
                  <CardDescription>
                    {cycleGoals.length} goal{cycleGoals.length !== 1 ? "s" : ""} in this cycle
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cycleGoals.map((goal) => (
                    <div
                      key={goal.id}
                      className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
                      data-testid={`goal-card-${goal.id}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1 flex-1">
                          <h4 className="font-medium">{goal.description}</h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            {goal.frequencyCalendarPeriod && (
                              <span className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {goal.frequencyCalendarPeriod.displayName} ({format(new Date(goal.frequencyCalendarPeriod.startDate), "dd/MM/yyyy")} - {format(new Date(goal.frequencyCalendarPeriod.endDate), "dd/MM/yyyy")})
                              </span>
                            )}
                            {getStatusBadge(goal.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            <strong>Planned Outcome:</strong> {goal.plannedOutcome}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Target: {goal.targetDate ? format(new Date(goal.targetDate), "MMM dd, yyyy") : "Not set"}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditGoal(goal)}
                            data-testid={`button-edit-goal-${goal.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                data-testid={`button-delete-goal-${goal.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Goal</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this goal? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteGoalMutation.mutate(goal.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span className="font-medium">{goal.progress || 0}%</span>
                        </div>
                        <Progress value={goal.progress || 0} className="h-2" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Development Goal</DialogTitle>
              <DialogDescription>
                Add a new development goal linked to a completed evaluation.
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="evaluationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Performance Evaluation</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-evaluation">
                            <SelectValue placeholder="Select an evaluation" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {eligibleEvaluations.map((evaluation) => {
                            let periodInfo = '';
                            if (evaluation.frequencyCalendarPeriod) {
                              const startDate = format(new Date(evaluation.frequencyCalendarPeriod.startDate), "dd/MM/yyyy");
                              const endDate = format(new Date(evaluation.frequencyCalendarPeriod.endDate), "dd/MM/yyyy");
                              periodInfo = ` | ${evaluation.frequencyCalendarPeriod.displayName} (${startDate} - ${endDate})`;
                            }
                            return (
                              <SelectItem 
                                key={evaluation.id} 
                                value={evaluation.id}
                                data-testid={`option-evaluation-${evaluation.id}`}
                              >
                                {evaluation.appraisalCycle?.code} - {evaluation.appraisalCycle?.description}
                                {periodInfo}
                                {evaluation.goalsCount > 0 && ` (${evaluation.goalsCount} goals)`}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Goal Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe your development goal..."
                          {...field}
                          data-testid="input-goal-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="plannedOutcome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Planned Outcome</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What is the expected outcome..."
                          {...field}
                          data-testid="input-planned-outcome"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="targetDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          data-testid="input-target-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createGoalMutation.isPending}
                    data-testid="button-submit-goal"
                  >
                    {createGoalMutation.isPending ? "Creating..." : "Create Goal"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Development Goal</DialogTitle>
              <DialogDescription>
                Update your goal details and track your progress.
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                {selectedGoal && (
                  <div className="p-3 bg-muted rounded-md text-sm space-y-1">
                    <div className="font-medium">
                      {selectedGoal.appraisalCycle?.code} - {selectedGoal.appraisalCycle?.description}
                    </div>
                    {selectedGoal.frequencyCalendarPeriod && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {selectedGoal.frequencyCalendarPeriod.displayName} ({format(new Date(selectedGoal.frequencyCalendarPeriod.startDate), "dd/MM/yyyy")} - {format(new Date(selectedGoal.frequencyCalendarPeriod.endDate), "dd/MM/yyyy")})
                      </div>
                    )}
                  </div>
                )}

                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Goal Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe your development goal..."
                          {...field}
                          data-testid="input-edit-goal-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="plannedOutcome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Planned Outcome</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What is the expected outcome..."
                          {...field}
                          data-testid="input-edit-planned-outcome"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="targetDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          data-testid="input-edit-target-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="progress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Progress: {field.value}%</FormLabel>
                      <FormControl>
                        <Slider
                          value={[field.value]}
                          onValueChange={(values) => field.onChange(values[0])}
                          max={100}
                          step={5}
                          className="mt-2"
                          data-testid="slider-progress"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateGoalMutation.isPending}
                    data-testid="button-update-goal"
                  >
                    {updateGoalMutation.isPending ? "Updating..." : "Update Goal"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}
