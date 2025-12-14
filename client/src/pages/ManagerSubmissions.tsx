import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { RoleGuard } from '@/components/RoleGuard';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  ClipboardList, 
  User, 
  Calendar as CalendarIcon, 
  MessageSquare, 
  Star,
  CheckCircle,
  Clock,
  AlertCircle,
  Send,
  Plus,
  FileText,
  Users,
  UserPlus,
  Mail,
  Search,
  X
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  designation: string;
}

interface Evaluation {
  id: string;
  employeeId: string;
  managerId: string;
  reviewCycleId: string;
  selfEvaluationData: any;
  selfEvaluationSubmittedAt: string | null;
  managerEvaluationData: any;
  managerEvaluationSubmittedAt: string | null;
  overallRating: number | null;
  status: string;
  meetingScheduledAt: string | null;
  meetingNotes: string | null;
  showNotesToEmployee: boolean | null;
  meetingCompletedAt: string | null;
  finalizedAt: string | null;
  employee: Employee;
  questionnaireTemplate: any;
  appraisalType: string | null;
  directReports: Employee[];
  createdAt: string;
  updatedAt: string;
}

interface PeerEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  code: string;
  department: string;
  designation: string;
  locationId: string;
  levelId: string;
  gradeId: string;
}

interface Question {
  id: string;
  text: string;
  type: 'text' | 'textarea' | 'rating';
  required: boolean;
}

interface EmployeeResponse {
  questionId: string;
  response: string;
  remarks?: string;
  rating?: number;
}

interface ManagerReviewData {
  managerEvaluationData: Record<string, any>;
  finalRating: number;
}

interface MeetingSchedule {
  meetingDate: Date;
  meetingTitle: string;
  meetingDescription: string;
}

interface MeetingNotesData {
  meetingNotes: string;
  finalRating?: number;
  showNotesToEmployee: boolean;
}

export default function ManagerSubmissions() {
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [isMeetingDialogOpen, setIsMeetingDialogOpen] = useState(false);
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false);
  const [reviewData, setReviewData] = useState<ManagerReviewData>({ 
    managerEvaluationData: { questionRemarks: {} },
    finalRating: 5
  });
  const [meetingData, setMeetingData] = useState<MeetingSchedule>({
    meetingDate: addDays(new Date(), 7),
    meetingTitle: 'Performance Review One-on-One',
    meetingDescription: 'Discussion about your performance review and career development.'
  });
  const [notesData, setNotesData] = useState<MeetingNotesData>({ meetingNotes: '', showNotesToEmployee: false });
  const [selectedTab, setSelectedTab] = useState<'pending' | 'reviewed' | 'completed'>('pending');
  
  // 360 Degree Feedback state
  const [is360DialogOpen, setIs360DialogOpen] = useState(false);
  const [selected360Tab, setSelected360Tab] = useState<'peers' | 'reportees' | 'others'>('peers');
  const [selectedPeerIds, setSelectedPeerIds] = useState<string[]>([]);
  const [selectedReporteeIds, setSelectedReporteeIds] = useState<string[]>([]);
  const [externalEmails, setExternalEmails] = useState<string>('');
  const [peerSearchTerm, setPeerSearchTerm] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<{success: boolean; emailsSent: string[]} | null>(null);
  
  const { toast } = useToast();

  // Fetch manager submissions
  const { data: evaluations = [], isLoading, refetch } = useQuery<Evaluation[]>({
    queryKey: ['/api/evaluations/manager-submissions'],
  });

  // Submit manager review mutation
  const submitReviewMutation = useMutation({
    mutationFn: async (data: { evaluationId: string; reviewData: ManagerReviewData }) => {
      const response = await apiRequest('PUT', `/api/evaluations/${data.evaluationId}/manager-review`, data.reviewData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/evaluations/manager-submissions'] });
      setIsReviewDialogOpen(false);
      setSelectedEvaluation(null);
      toast({
        title: "Review Submitted",
        description: "Your review has been submitted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit review",
        variant: "destructive",
      });
    },
  });

  // Schedule meeting mutation
  const scheduleMeetingMutation = useMutation({
    mutationFn: async (data: { evaluationId: string; meetingData: MeetingSchedule }) => {
      const response = await apiRequest('POST', `/api/evaluations/${data.evaluationId}/schedule-meeting`, data.meetingData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/evaluations/manager-submissions'] });
      setIsMeetingDialogOpen(false);
      setSelectedEvaluation(null);
      toast({
        title: "Meeting Scheduled",
        description: "Calendar invite has been sent to the employee.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule meeting",
        variant: "destructive",
      });
    },
  });

  // Save meeting notes mutation
  const saveNotesMutation = useMutation({
    mutationFn: async (data: { evaluationId: string; notesData: MeetingNotesData }) => {
      const response = await apiRequest('PUT', `/api/evaluations/${data.evaluationId}/meeting-notes`, data.notesData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/evaluations/manager-submissions'] });
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

  // Complete evaluation mutation
  const completeEvaluationMutation = useMutation({
    mutationFn: async (evaluationId: string) => {
      const response = await apiRequest('POST', `/api/evaluations/${evaluationId}/complete`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/evaluations/manager-submissions'] });
      toast({
        title: "Evaluation Completed",
        description: "Evaluation has been completed and notifications have been sent.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete evaluation",
        variant: "destructive",
      });
    },
  });

  // 360 Feedback - fetch peer employees when dialog is open
  const { data: peerEmployees = [] } = useQuery<PeerEmployee[]>({
    queryKey: ['/api/feedback-requests/peer-employees'],
    enabled: is360DialogOpen,
  });

  // 360 Feedback - create feedback requests mutation
  const createFeedbackRequestsMutation = useMutation({
    mutationFn: async (data: { evaluationId: string; peerIds: string[]; reporteeIds: string[]; externalEmails: string[] }) => {
      const response = await apiRequest('POST', '/api/feedback-requests/create-for-team-member', data);
      return response.json();
    },
    onSuccess: (data) => {
      setConfirmationResult({ success: true, emailsSent: data.emailsSent || [] });
      setSelectedPeerIds([]);
      setSelectedReporteeIds([]);
      setExternalEmails('');
      queryClient.invalidateQueries({ queryKey: ['/api/evaluations/manager-submissions'] });
      toast({
        title: "Feedback Requests Sent",
        description: `Feedback requests have been sent to ${data.emailsSent?.length || 0} recipients.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send feedback requests",
        variant: "destructive",
      });
    },
  });

  // Open 360 dialog for a specific evaluation
  const open360Dialog = (evaluation: Evaluation) => {
    setSelectedEvaluation(evaluation);
    setIs360DialogOpen(true);
    setSelected360Tab('peers');
    setSelectedPeerIds([]);
    setSelectedReporteeIds([]);
    setExternalEmails('');
    setPeerSearchTerm('');
    setConfirmationResult(null);
  };

  // Handle sending 360 feedback requests
  const handleSend360Requests = () => {
    if (!selectedEvaluation) return;
    
    const externalEmailList = externalEmails
      .split(/[,;\n]/)
      .map(e => e.trim())
      .filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    
    if (selectedPeerIds.length === 0 && selectedReporteeIds.length === 0 && externalEmailList.length === 0) {
      toast({
        title: "No Recipients",
        description: "Please select at least one peer, reportee, or enter an external email.",
        variant: "destructive",
      });
      return;
    }
    
    createFeedbackRequestsMutation.mutate({
      evaluationId: selectedEvaluation.id,
      peerIds: selectedPeerIds,
      reporteeIds: selectedReporteeIds,
      externalEmails: externalEmailList,
    });
  };

  // Filter peer employees based on search term, excluding the subject employee
  const filteredPeerEmployees = peerEmployees.filter(peer => {
    if (selectedEvaluation && peer.id === selectedEvaluation.employeeId) return false;
    if (!peerSearchTerm) return true;
    const searchLower = peerSearchTerm.toLowerCase();
    return (
      peer.firstName.toLowerCase().includes(searchLower) ||
      peer.lastName.toLowerCase().includes(searchLower) ||
      peer.email.toLowerCase().includes(searchLower) ||
      peer.department?.toLowerCase().includes(searchLower) ||
      peer.designation?.toLowerCase().includes(searchLower)
    );
  });

  // Filter evaluations based on selected tab
  const filteredEvaluations = evaluations.filter(evaluation => {
    if (selectedTab === 'pending') {
      return evaluation.selfEvaluationSubmittedAt && !evaluation.managerEvaluationSubmittedAt;
    } else if (selectedTab === 'reviewed') {
      return evaluation.managerEvaluationSubmittedAt && !evaluation.finalizedAt;
    } else { // completed
      return evaluation.finalizedAt;
    }
  });

  const getStatusBadge = (evaluation: Evaluation) => {
    if (evaluation.finalizedAt) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>;
    } else if (evaluation.managerEvaluationSubmittedAt) {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Reviewed</Badge>;
    } else if (evaluation.selfEvaluationSubmittedAt) {
      return <Badge variant="outline" className="bg-orange-100 text-orange-800">Pending Review</Badge>;
    } else {
      return <Badge variant="outline">Not Started</Badge>;
    }
  };

  const canScheduleMeeting = (evaluation: Evaluation) => {
    return evaluation.managerEvaluationSubmittedAt && !evaluation.meetingScheduledAt;
  };

  const canAddNotes = (evaluation: Evaluation) => {
    return evaluation.meetingScheduledAt && !evaluation.finalizedAt;
  };

  const canCompleteEvaluation = (evaluation: Evaluation) => {
    return evaluation.managerEvaluationSubmittedAt && !evaluation.finalizedAt;
  };

  // Parse questionnaire templates and employee responses for manager review
  const renderQuestionnaireReview = (evaluation: Evaluation) => {
    const selfEvalData = evaluation.selfEvaluationData;
    const responses = selfEvalData?.responses || {};
    const questionnaireTemplates = Array.isArray(evaluation.questionnaireTemplate) 
      ? evaluation.questionnaireTemplate 
      : [evaluation.questionnaireTemplate].filter(Boolean);

    // Collect all questions from all questionnaires
    const allQuestions: { question: Question; questionnaireId: string; questionnaireName: string }[] = [];
    
    questionnaireTemplates.forEach((template: any) => {
      if (template && template.questions) {
        const questions = Array.isArray(template.questions) ? template.questions : JSON.parse(template.questions);
        questions.forEach((question: Question) => {
          allQuestions.push({
            question,
            questionnaireId: template.id,
            questionnaireName: template.name
          });
        });
      }
    });

    return (
      <div className="space-y-6">
        {allQuestions.map(({ question, questionnaireId, questionnaireName }) => {
          const responseKey = `${questionnaireId}_${question.id}`;
          const employeeResponse: EmployeeResponse = responses[responseKey];
          
          if (!employeeResponse) return null;

          return (
            <div key={responseKey} className="border rounded-lg p-6 space-y-4">
              {/* Question */}
              <div className="space-y-2">
                <h4 className="font-semibold text-lg text-gray-900">{question.text}</h4>
                <p className="text-sm text-gray-500">From: {questionnaireName}</p>
              </div>

              {/* Employee Response */}
              <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                <h5 className="font-medium text-blue-900">Employee's Response</h5>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-medium text-blue-800">Answer:</p>
                    <p className="text-gray-700 bg-white p-3 rounded border">{employeeResponse.response}</p>
                  </div>
                  
                  {question.type === 'rating' && employeeResponse.rating && (
                    <div>
                      <p className="text-sm font-medium text-blue-800">Rating:</p>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={cn(
                                "h-4 w-4",
                                star <= employeeResponse.rating! ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                              )}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-medium">{employeeResponse.rating}/5</span>
                      </div>
                    </div>
                  )}
                  
                  {employeeResponse.remarks && (
                    <div>
                      <p className="text-sm font-medium text-blue-800">Employee's Remarks:</p>
                      <p className="text-gray-700 bg-white p-3 rounded border">{employeeResponse.remarks}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Manager Remarks Input */}
              <div className="bg-green-50 rounded-lg p-4 space-y-3">
                <h5 className="font-medium text-green-900">Your Manager Remarks</h5>
                <div>
                  <Label htmlFor={`manager-remarks-${responseKey}`} className="text-sm font-medium text-green-800">
                    Add your feedback and comments for this response:
                  </Label>
                  <Textarea
                    id={`manager-remarks-${responseKey}`}
                    placeholder="Enter your manager remarks for this question..."
                    rows={3}
                    className="mt-2 border-green-200 focus:border-green-400"
                    value={reviewData.managerEvaluationData.questionRemarks?.[responseKey] || ''}
                    onChange={(e) => setReviewData(prev => ({
                      ...prev,
                      managerEvaluationData: {
                        ...prev.managerEvaluationData,
                        questionRemarks: {
                          ...prev.managerEvaluationData.questionRemarks,
                          [responseKey]: e.target.value
                        }
                      }
                    }))}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {/* Final Rating */}
        <div className="border-t pt-6">
          <div>
            <Label htmlFor="final-rating">Final Rating (1-5)</Label>
            <Select
              value={String(reviewData.finalRating)}
              onValueChange={(value) => setReviewData(prev => ({ ...prev, finalRating: parseInt(value) }))}
            >
              <SelectTrigger id="final-rating" data-testid="final-rating-select">
                <SelectValue placeholder="Select rating" />
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
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading submissions...</p>
        </div>
      </div>
    );
  }

  return (
    <RoleGuard allowedRoles={["manager"]}>
      <div className="space-y-6" data-testid="manager-submissions">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Employee Submissions</h1>
            <p className="text-muted-foreground">Review and manage employee performance evaluations</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            data-testid="refresh-submissions"
          >
            <ClipboardList className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Tabs for different evaluation states */}
        <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as typeof selectedTab)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending" data-testid="tab-pending">
              Pending Review ({evaluations.filter(e => e.selfEvaluationSubmittedAt && !e.managerEvaluationSubmittedAt).length})
            </TabsTrigger>
            <TabsTrigger value="reviewed" data-testid="tab-reviewed">
              Reviewed ({evaluations.filter(e => e.managerEvaluationSubmittedAt && !e.finalizedAt).length})
            </TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed">
              Completed ({evaluations.filter(e => e.finalizedAt).length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedTab} className="space-y-4">
            {filteredEvaluations.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">No evaluations found</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedTab === 'pending' && "No employee submissions are pending your review."}
                  {selectedTab === 'reviewed' && "No evaluations are in reviewed status."}
                  {selectedTab === 'completed' && "No evaluations have been completed yet."}
                </p>
              </div>
            ) : (
              <div className="grid gap-6">
                {filteredEvaluations.map((evaluation) => (
                  <Card key={evaluation.id} className="w-full" data-testid={`evaluation-card-${evaluation.id}`}>
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">
                              {evaluation.employee?.firstName} {evaluation.employee?.lastName}
                            </CardTitle>
                            <CardDescription>
                              {evaluation.employee?.designation} • {evaluation.employee?.department}
                            </CardDescription>
                          </div>
                        </div>
                        {getStatusBadge(evaluation)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Timeline */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div className={cn(
                            "flex items-center space-x-2 p-3 rounded-lg",
                            evaluation.selfEvaluationSubmittedAt ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"
                          )}>
                            <CheckCircle className="h-4 w-4" />
                            <div>
                              <p className="font-medium">Employee Submitted</p>
                              <p className="text-xs">
                                {evaluation.selfEvaluationSubmittedAt ? 
                                  format(new Date(evaluation.selfEvaluationSubmittedAt), 'MMM dd, yyyy') : 
                                  'Not submitted'
                                }
                              </p>
                            </div>
                          </div>
                          <div className={cn(
                            "flex items-center space-x-2 p-3 rounded-lg",
                            evaluation.managerEvaluationSubmittedAt ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"
                          )}>
                            <Star className="h-4 w-4" />
                            <div>
                              <p className="font-medium">Manager Reviewed</p>
                              <p className="text-xs">
                                {evaluation.managerEvaluationSubmittedAt ? 
                                  format(new Date(evaluation.managerEvaluationSubmittedAt), 'MMM dd, yyyy') : 
                                  'Pending'
                                }
                              </p>
                            </div>
                          </div>
                          <div className={cn(
                            "flex items-center space-x-2 p-3 rounded-lg",
                            evaluation.finalizedAt ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"
                          )}>
                            <CheckCircle className="h-4 w-4" />
                            <div>
                              <p className="font-medium">Completed</p>
                              <p className="text-xs">
                                {evaluation.finalizedAt ? 
                                  format(new Date(evaluation.finalizedAt), 'MMM dd, yyyy') : 
                                  'Not completed'
                                }
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Ratings */}
                        {evaluation.overallRating && (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">Final Rating:</span>
                            <div className="flex items-center space-x-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={cn(
                                    "h-4 w-4",
                                    star <= evaluation.overallRating! ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                                  )}
                                />
                              ))}
                              <span className="text-sm font-medium ml-2">{evaluation.overallRating}/5</span>
                            </div>
                          </div>
                        )}

                        {/* Meeting info */}
                        {evaluation.meetingScheduledAt && (
                          <div className="flex items-center space-x-2 text-sm">
                            <CalendarIcon className="h-4 w-4" />
                            <span>
                              Meeting scheduled: {format(new Date(evaluation.meetingScheduledAt), 'MMM dd, yyyy at h:mm a')}
                            </span>
                            {evaluation.meetingCompletedAt && (
                              <Badge variant="secondary" className="ml-2">Completed</Badge>
                            )}
                          </div>
                        )}

                        {/* Action buttons */}
                        <Separator />
                        <div className="flex flex-wrap gap-2">
                          {selectedTab === 'pending' && (
                            <Button
                              onClick={() => {
                                setSelectedEvaluation(evaluation);
                                setReviewData({ 
                                  managerEvaluationData: { questionRemarks: {} },
                                  finalRating: 5
                                });
                                setIsReviewDialogOpen(true);
                              }}
                              data-testid={`review-button-${evaluation.id}`}
                            >
                              <Star className="h-4 w-4 mr-2" />
                              Review Submission
                            </Button>
                          )}

                          {selectedTab === 'pending' && evaluation.appraisalType === 'mbo_based' && (
                            <Button
                              variant="outline"
                              onClick={() => open360Dialog(evaluation)}
                              data-testid={`360-feedback-button-${evaluation.id}`}
                            >
                              <Users className="h-4 w-4 mr-2" />
                              360° Feedback
                            </Button>
                          )}

                          {canScheduleMeeting(evaluation) && (
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedEvaluation(evaluation);
                                setIsMeetingDialogOpen(true);
                              }}
                              data-testid={`schedule-meeting-button-${evaluation.id}`}
                            >
                              <CalendarIcon className="h-4 w-4 mr-2" />
                              Schedule Meeting
                            </Button>
                          )}

                          {canAddNotes(evaluation) && (
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedEvaluation(evaluation);
                                setNotesData({ 
                                  meetingNotes: evaluation.meetingNotes || '',
                                  finalRating: evaluation.overallRating || undefined,
                                  showNotesToEmployee: evaluation.showNotesToEmployee ?? false
                                });
                                setIsNotesDialogOpen(true);
                              }}
                              data-testid={`meeting-notes-button-${evaluation.id}`}
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              {evaluation.meetingNotes ? 'Edit Notes' : 'Add Meeting Notes'}
                            </Button>
                          )}

                          {canCompleteEvaluation(evaluation) && (
                            <Button
                              variant="default"
                              onClick={() => completeEvaluationMutation.mutate(evaluation.id)}
                              disabled={completeEvaluationMutation.isPending}
                              data-testid={`complete-evaluation-button-${evaluation.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Complete Evaluation
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Review Dialog */}
        <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Review Employee Submission</DialogTitle>
              <DialogDescription>
                Review {selectedEvaluation?.employee?.firstName} {selectedEvaluation?.employee?.lastName}'s evaluation and provide your feedback
              </DialogDescription>
            </DialogHeader>

            {selectedEvaluation && (
              <div className="space-y-6">
                {/* Employee's Self Evaluation with Manager Review */}
                {selectedEvaluation.selfEvaluationData && selectedEvaluation.questionnaireTemplate && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold">Employee's Self Evaluation & Your Review</h3>
                    {renderQuestionnaireReview(selectedEvaluation)}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedEvaluation) {
                    submitReviewMutation.mutate({
                      evaluationId: selectedEvaluation.id,
                      reviewData
                    });
                  }
                }}
                disabled={submitReviewMutation.isPending}
                data-testid="submit-review-button"
              >
                <Send className="h-4 w-4 mr-2" />
                Submit Review
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Meeting Schedule Dialog */}
        <Dialog open={isMeetingDialogOpen} onOpenChange={setIsMeetingDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Schedule One-on-One Meeting</DialogTitle>
              <DialogDescription>
                Schedule a meeting with {selectedEvaluation?.employee?.firstName} {selectedEvaluation?.employee?.lastName} to discuss their performance review
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="meeting-date">Meeting Date & Time</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {meetingData.meetingDate ? format(meetingData.meetingDate, "PPP 'at' p") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={meetingData.meetingDate}
                      onSelect={(date) => date && setMeetingData(prev => ({ ...prev, meetingDate: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="meeting-title">Meeting Title</Label>
                <Input
                  id="meeting-title"
                  value={meetingData.meetingTitle}
                  onChange={(e) => setMeetingData(prev => ({ ...prev, meetingTitle: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="meeting-description">Meeting Description</Label>
                <Textarea
                  id="meeting-description"
                  rows={3}
                  value={meetingData.meetingDescription}
                  onChange={(e) => setMeetingData(prev => ({ ...prev, meetingDescription: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsMeetingDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedEvaluation) {
                    scheduleMeetingMutation.mutate({
                      evaluationId: selectedEvaluation.id,
                      meetingData
                    });
                  }
                }}
                disabled={scheduleMeetingMutation.isPending}
                data-testid="schedule-meeting-submit"
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Schedule & Send Invite
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Meeting Notes Dialog */}
        <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
          <DialogContent className="max-w-2xl">
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
                />
              </div>
              <div>
                <Label htmlFor="updated-rating">Update Final Rating (Optional)</Label>
                <Select
                  value={notesData.finalRating ? String(notesData.finalRating) : undefined}
                  onValueChange={(value) => setNotesData(prev => ({ ...prev, finalRating: value ? parseInt(value) : undefined }))}
                >
                  <SelectTrigger>
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
                  data-testid="show-notes-radio"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="show-yes" />
                    <Label htmlFor="show-yes" className="font-normal cursor-pointer">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="show-no" />
                    <Label htmlFor="show-no" className="font-normal cursor-pointer">No</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNotesDialogOpen(false)}>
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
                data-testid="save-notes-button"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Save Notes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 360 Degree Feedback Dialog */}
        <Dialog open={is360DialogOpen} onOpenChange={(open) => {
          setIs360DialogOpen(open);
          if (!open) {
            setConfirmationResult(null);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                360° Feedback Request
              </DialogTitle>
              <DialogDescription>
                Request feedback for {selectedEvaluation?.employee?.firstName} {selectedEvaluation?.employee?.lastName} from peers, direct reports, or external contacts.
              </DialogDescription>
            </DialogHeader>

            {confirmationResult ? (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Feedback requests sent successfully!</span>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Emails sent to:</h4>
                  <ul className="space-y-1">
                    {confirmationResult.emailsSent.map((email, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-gray-500" />
                        {email}
                      </li>
                    ))}
                  </ul>
                </div>
                <DialogFooter>
                  <Button onClick={() => setIs360DialogOpen(false)}>
                    Done
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <>
                <Tabs value={selected360Tab} onValueChange={(v) => setSelected360Tab(v as typeof selected360Tab)} className="flex-1 overflow-hidden flex flex-col">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="peers" data-testid="360-tab-peers">
                      <UserPlus className="h-4 w-4 mr-1" />
                      Peers ({selectedPeerIds.length})
                    </TabsTrigger>
                    <TabsTrigger value="reportees" data-testid="360-tab-reportees">
                      <Users className="h-4 w-4 mr-1" />
                      Reportees ({selectedReporteeIds.length})
                    </TabsTrigger>
                    <TabsTrigger value="others" data-testid="360-tab-others">
                      <Mail className="h-4 w-4 mr-1" />
                      Others
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="peers" className="flex-1 overflow-hidden flex flex-col mt-4">
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search peers by name, email, department..."
                        value={peerSearchTerm}
                        onChange={(e) => setPeerSearchTerm(e.target.value)}
                        className="pl-10"
                        data-testid="peer-search-input"
                      />
                    </div>
                    <ScrollArea className="flex-1 border rounded-lg h-[300px]">
                      <div className="p-2 space-y-1">
                        {filteredPeerEmployees.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            No peers found
                          </div>
                        ) : (
                          filteredPeerEmployees.map((peer) => (
                            <div
                              key={peer.id}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                                selectedPeerIds.includes(peer.id) ? "bg-primary/10 border border-primary/30" : "hover:bg-gray-50"
                              )}
                              onClick={() => {
                                setSelectedPeerIds(prev => 
                                  prev.includes(peer.id) 
                                    ? prev.filter(id => id !== peer.id)
                                    : [...prev, peer.id]
                                );
                              }}
                              data-testid={`peer-item-${peer.id}`}
                            >
                              <Checkbox
                                checked={selectedPeerIds.includes(peer.id)}
                                onCheckedChange={(checked) => {
                                  setSelectedPeerIds(prev => 
                                    checked 
                                      ? [...prev, peer.id]
                                      : prev.filter(id => id !== peer.id)
                                  );
                                }}
                              />
                              <div className="flex-1">
                                <p className="font-medium">{peer.firstName} {peer.lastName}</p>
                                <p className="text-sm text-gray-500">{peer.email}</p>
                                <p className="text-xs text-gray-400">{peer.designation} • {peer.department}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="reportees" className="flex-1 overflow-hidden flex flex-col mt-4">
                    <ScrollArea className="flex-1 border rounded-lg h-[300px]">
                      <div className="p-2 space-y-1">
                        {!selectedEvaluation?.directReports || selectedEvaluation.directReports.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            No direct reports found for this employee
                          </div>
                        ) : (
                          selectedEvaluation.directReports.map((report) => (
                            <div
                              key={report.id}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                                selectedReporteeIds.includes(report.id) ? "bg-primary/10 border border-primary/30" : "hover:bg-gray-50"
                              )}
                              onClick={() => {
                                setSelectedReporteeIds(prev => 
                                  prev.includes(report.id) 
                                    ? prev.filter(id => id !== report.id)
                                    : [...prev, report.id]
                                );
                              }}
                              data-testid={`reportee-item-${report.id}`}
                            >
                              <Checkbox
                                checked={selectedReporteeIds.includes(report.id)}
                                onCheckedChange={(checked) => {
                                  setSelectedReporteeIds(prev => 
                                    checked 
                                      ? [...prev, report.id]
                                      : prev.filter(id => id !== report.id)
                                  );
                                }}
                              />
                              <div className="flex-1">
                                <p className="font-medium">{report.firstName} {report.lastName}</p>
                                <p className="text-sm text-gray-500">{report.email}</p>
                                <p className="text-xs text-gray-400">{report.designation} • {report.department}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="others" className="flex-1 flex flex-col mt-4">
                    <div className="space-y-3">
                      <Label>External Email Addresses</Label>
                      <Textarea
                        placeholder="Enter email addresses separated by commas, semicolons, or new lines.&#10;&#10;Example:&#10;john@external.com, jane@partner.org&#10;client@company.com"
                        value={externalEmails}
                        onChange={(e) => setExternalEmails(e.target.value)}
                        rows={6}
                        className="resize-none"
                        data-testid="external-emails-input"
                      />
                      <p className="text-xs text-gray-500">
                        These external contacts will receive an email requesting feedback for {selectedEvaluation?.employee?.firstName}.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>

                <DialogFooter className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between w-full">
                    <div className="text-sm text-gray-500">
                      {selectedPeerIds.length + selectedReporteeIds.length + (externalEmails.split(/[,;\n]/).filter(e => e.trim()).length)} recipient(s) selected
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setIs360DialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSend360Requests}
                        disabled={createFeedbackRequestsMutation.isPending}
                        data-testid="send-360-requests-button"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {createFeedbackRequestsMutation.isPending ? 'Sending...' : 'Send Requests'}
                      </Button>
                    </div>
                  </div>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}