import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useForm } from "react-hook-form";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RoleGuard } from "@/components/RoleGuard";
import { 
  Calendar, 
  Clock, 
  User, 
  FileText,
  CheckCircle,
  CalendarCheck,
  CalendarX,
  MessageSquare
} from "lucide-react";
import type { Evaluation, User as UserType } from "@shared/schema";

interface EvaluationWithDetails extends Evaluation {
  employee?: UserType;
  manager?: UserType;
}

interface MeetingNotesData {
  meetingNotes: string;
  finalRating?: number;
  showNotesToEmployee: boolean;
}

export default function Meetings() {
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationWithDetails | null>(null);
  const [notesData, setNotesData] = useState<MeetingNotesData>({ 
    meetingNotes: '', 
    finalRating: undefined,
    showNotesToEmployee: false 
  });

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get active role for role switching support
  const activeRole = (user as any)?.activeRole || (user as any)?.role || "employee";

  // Fetch evaluations filtered by active role:
  // - As Employee: show evaluations where user is the employee
  // - As Manager: show evaluations where user is the manager (meetings with their reporting members)
  const { data: evaluations = [], isLoading } = useQuery<EvaluationWithDetails[]>({
    queryKey: ["/api/evaluations"],
    select: (data) => data.filter(evaluation => {
      if (activeRole === 'manager') {
        // As Manager: show meetings with reporting members (where user is the manager)
        return evaluation.managerId === user?.id;
      } else {
        // As Employee: show meetings where user is the employee
        return evaluation.employeeId === user?.id;
      }
    }),
  });

  const scheduleMeetingMutation = useMutation({
    mutationFn: async ({ id, meetingDate }: { id: string; meetingDate: Date }) => {
      await apiRequest("PUT", `/api/evaluations/${id}`, {
        meetingScheduledAt: meetingDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluations"] });
      setIsScheduleModalOpen(false);
      toast({
        title: "Success",
        description: "Meeting scheduled successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to schedule meeting",
        variant: "destructive",
      });
    },
  });

  // Save meeting notes mutation (for managers)
  const saveNotesMutation = useMutation({
    mutationFn: async (data: { evaluationId: string; notesData: MeetingNotesData }) => {
      const response = await apiRequest('PUT', `/api/evaluations/${data.evaluationId}/meeting-notes`, data.notesData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/evaluations'] });
      setIsNotesDialogOpen(false);
      setSelectedEvaluation(null);
      toast({
        title: "Notes Saved",
        description: "Meeting notes have been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save notes",
        variant: "destructive",
      });
    },
  });


  const form = useForm({
    defaultValues: {
      meetingDate: "",
      meetingTime: "",
    },
  });

  const handleScheduleMeeting = (evaluation: EvaluationWithDetails) => {
    setSelectedEvaluation(evaluation);
    setIsScheduleModalOpen(true);
  };

  const handleAddNotes = (evaluation: EvaluationWithDetails) => {
    setSelectedEvaluation(evaluation);
    setNotesData({
      meetingNotes: evaluation.meetingNotes || '',
      finalRating: evaluation.overallRating || undefined,
      showNotesToEmployee: evaluation.showNotesToEmployee ?? false
    });
    setIsNotesDialogOpen(true);
  };

  const onSubmitSchedule = (data: any) => {
    if (selectedEvaluation) {
      const meetingDateTime = new Date(`${data.meetingDate}T${data.meetingTime}`);
      scheduleMeetingMutation.mutate({ 
        id: selectedEvaluation.id, 
        meetingDate: meetingDateTime 
      });
    }
  };

  const getMeetingStatus = (evaluation: EvaluationWithDetails) => {
    if (evaluation.meetingCompletedAt) return "completed";
    if (evaluation.meetingScheduledAt) return "scheduled";
    return "not_scheduled";
  };

  const getMeetingStatusBadge = (evaluation: EvaluationWithDetails) => {
    const status = getMeetingStatus(evaluation);
    switch (status) {
      case "completed":
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case "scheduled":
        return <Badge variant="secondary"><CalendarCheck className="h-3 w-3 mr-1" />Scheduled</Badge>;
      default:
        return <Badge variant="outline"><CalendarX className="h-3 w-3 mr-1" />Not Scheduled</Badge>;
    }
  };

  const canScheduleMeeting = (evaluation: EvaluationWithDetails) => {
    // Can schedule if both evaluations are done and not yet scheduled
    return !evaluation.meetingScheduledAt && evaluation.selfEvaluationSubmittedAt && evaluation.managerEvaluationSubmittedAt;
  };

  const canAddNotes = (evaluation: EvaluationWithDetails) => {
    // Manager can add notes after meeting is scheduled
    return user?.id === evaluation.managerId && evaluation.meetingScheduledAt && !evaluation.finalizedAt;
  };

  const isManager = (evaluation: EvaluationWithDetails) => {
    return user?.id === evaluation.managerId;
  };

  // Show all evaluations that are ready for meetings (both evaluations submitted)
  const eligibleEvaluations = evaluations.filter(evaluation => 
    evaluation.selfEvaluationSubmittedAt && evaluation.managerEvaluationSubmittedAt
  );

  return (
    <RoleGuard allowedRoles={["employee", "manager"]}>
      <div className="space-y-6" data-testid="meetings">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Performance Review Meetings</h1>
            <p className="text-muted-foreground">Schedule and manage one-on-one performance review meetings</p>
          </div>
        </div>

        {/* Meeting Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Meetings</p>
                  <p className="text-2xl font-bold" data-testid="total-meetings">
                    {evaluations.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Scheduled</p>
                  <p className="text-2xl font-bold" data-testid="scheduled-meetings">
                    {evaluations.filter(e => e.meetingScheduledAt && !e.meetingCompletedAt).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold" data-testid="completed-meetings">
                    {evaluations.filter(e => e.meetingCompletedAt).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Meetings List */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Review Meetings</CardTitle>
            <CardDescription>
              Meetings for evaluations ready for discussion
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 animate-pulse">
                    <div className="w-10 h-10 bg-muted rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : eligibleEvaluations.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg mb-2">No meetings ready to schedule</p>
                <p className="text-muted-foreground text-sm">
                  Meetings become available after both employee and manager complete their evaluations
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {eligibleEvaluations.map((evaluation) => (
                  <div
                    key={evaluation.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/20 transition-colors"
                    data-testid={`meeting-row-${evaluation.id}`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <p className="font-medium" data-testid={`meeting-participants-${evaluation.id}`}>
                            {user?.id === evaluation.employeeId ? (
                              <>Meeting with {evaluation.manager?.firstName} {evaluation.manager?.lastName}</>
                            ) : (
                              <>{evaluation.employee?.firstName} {evaluation.employee?.lastName} - Performance Review</>
                            )}
                          </p>
                          {getMeetingStatusBadge(evaluation)}
                        </div>
                        
                        {evaluation.meetingScheduledAt && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {new Date(evaluation.meetingScheduledAt).toLocaleDateString()} at{' '}
                              {new Date(evaluation.meetingScheduledAt).toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>
                        )}

                        {evaluation.meetingCompletedAt && evaluation.meetingNotes && (
                          (evaluation.showNotesToEmployee || user?.id === evaluation.managerId) && (
                            <div className="mt-2 p-3 bg-muted/30 rounded-lg">
                              <p className="text-sm font-medium mb-1">Meeting Notes:</p>
                              <p className="text-sm text-muted-foreground">{evaluation.meetingNotes}</p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {!evaluation.meetingScheduledAt && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleScheduleMeeting(evaluation)}
                          data-testid={`schedule-meeting-${evaluation.id}`}
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule
                        </Button>
                      )}
                      
                      {evaluation.meetingScheduledAt && !evaluation.meetingCompletedAt && isManager(evaluation) && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleAddNotes(evaluation)}
                          data-testid={`complete-review-${evaluation.id}`}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Complete Review
                        </Button>
                      )}

                      {canAddNotes(evaluation) && evaluation.meetingCompletedAt && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddNotes(evaluation)}
                          data-testid={`edit-notes-${evaluation.id}`}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Edit Notes
                        </Button>
                      )}
                      
                      {evaluation.finalizedAt && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          data-testid={`meeting-finalized-${evaluation.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Finalized
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Schedule Meeting Modal */}
        <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Schedule Meeting</DialogTitle>
              <DialogDescription>
                Schedule a one-on-one performance review meeting
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitSchedule)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="meetingDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meeting Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field}
                          min={new Date().toISOString().split('T')[0]}
                          data-testid="input-meeting-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="meetingTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meeting Time</FormLabel>
                      <FormControl>
                        <Input 
                          type="time" 
                          {...field}
                          data-testid="input-meeting-time"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsScheduleModalOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={scheduleMeetingMutation.isPending}
                    data-testid="submit-schedule-meeting"
                  >
                    Schedule Meeting
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Meeting Notes Dialog (Manager Only) */}
        <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Meeting Notes</DialogTitle>
              <DialogDescription>
                Add notes from your one-on-one meeting with {selectedEvaluation?.employee?.firstName} {selectedEvaluation?.employee?.lastName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="notes">Meeting Notes</Label>
                <Textarea
                  id="notes"
                  rows={8}
                  placeholder="Enter detailed notes from your meeting..."
                  value={notesData.meetingNotes}
                  onChange={(e) => setNotesData(prev => ({ ...prev, meetingNotes: e.target.value }))}
                  data-testid="textarea-meeting-notes"
                />
              </div>
              <div>
                <Label htmlFor="updated-rating">Update Final Rating (Optional)</Label>
                <Select
                  value={notesData.finalRating ? String(notesData.finalRating) : undefined}
                  onValueChange={(value) => setNotesData(prev => ({ ...prev, finalRating: value ? parseInt(value) : undefined }))}
                >
                  <SelectTrigger data-testid="select-final-rating">
                    <SelectValue placeholder="Keep current rating or update" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Below Expectations</SelectItem>
                    <SelectItem value="2">2 - Partially Meets Expectations</SelectItem>
                    <SelectItem value="3">3 - Meets Expectations</SelectItem>
                    <SelectItem value="4">4 - Exceeds Expectations</SelectItem>
                    <SelectItem value="5">5 - Outstanding</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Show Meeting Notes to Employee</Label>
                <RadioGroup
                  value={notesData.showNotesToEmployee ? "yes" : "no"}
                  onValueChange={(value) => setNotesData(prev => ({ ...prev, showNotesToEmployee: value === "yes" }))}
                  className="flex gap-4 mt-2"
                  data-testid="radio-show-notes"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="show-yes" data-testid="radio-show-yes" />
                    <Label htmlFor="show-yes" className="font-normal cursor-pointer">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="show-no" data-testid="radio-show-no" />
                    <Label htmlFor="show-no" className="font-normal cursor-pointer">No</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNotesDialogOpen(false)} data-testid="button-cancel-notes">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedEvaluation) {
                    saveNotesMutation.mutate({
                      evaluationId: selectedEvaluation.id,
                      notesData
                    });
                  }
                }}
                disabled={saveNotesMutation.isPending}
                data-testid="button-save-notes"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Save Notes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}
