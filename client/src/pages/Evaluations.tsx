import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RoleGuard } from "@/components/RoleGuard";
import { isUnauthorizedError } from "@/lib/authUtils";
import { 
  ClipboardList, 
  Calendar, 
  Download, 
  Send, 
  Eye, 
  CheckCircle, 
  Clock,
  Star,
  FileText,
  Play,
  Target
} from "lucide-react";
import { Link } from "wouter";
import type { Evaluation, User as UserType, ReviewCycle, AppraisalCycle, FrequencyCalendar, FrequencyCalendarDetails } from "@shared/schema";

interface EvaluationWithDetails extends Evaluation {
  employee?: UserType;
  manager?: UserType;
  reviewCycle?: ReviewCycle;
  questionnaires?: QuestionnaireTemplate[];
  appraisalCycle?: AppraisalCycle;
  frequencyCalendar?: FrequencyCalendar;
  frequencyCalendarDetail?: FrequencyCalendarDetails;
}

interface QuestionnaireTemplate {
  id: string;
  name: string;
  description?: string;
  questions: Question[];
  targetRole: string;
}

interface Question {
  id: string;
  text: string;
  type: 'text' | 'rating' | 'textarea';
  required: boolean;
  category?: string;
  weight?: number;
}

interface EnhancedQuestion extends Question {
  questionnaireName?: string;
}

interface QuestionResponse {
  questionId: string;
  response: string;
  rating?: number;
  remarks?: string;
}

export default function Evaluations() {
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationWithDetails | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [responses, setResponses] = useState<Record<string, QuestionResponse>>({});
  const [averageRating, setAverageRating] = useState<number>(0);
  const [showMeetingScheduler, setShowMeetingScheduler] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [meetingData, setMeetingData] = useState({
    date: '',
    time: '',
    duration: '60',
    location: 'office',
    notes: ''
  });

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: evaluations = [], isLoading } = useQuery<EvaluationWithDetails[]>({
    queryKey: ["/api/evaluations", { employeeId: user?.id, includeQuestionnaires: true }],
    queryFn: async () => {
      const params = new URLSearchParams({
        employeeId: user?.id || '',
        includeQuestionnaires: 'true'
      });
      const response = await fetch(`/api/evaluations?${params}`);
      if (!response.ok) throw new Error('Failed to fetch evaluations');
      return response.json();
    },
  });

  const submitEvaluationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PUT", `/api/evaluations/${id}`, {
        selfEvaluationData: data,
        selfEvaluationSubmittedAt: new Date(),
        status: 'in_progress',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluations"] });
      setIsViewModalOpen(false);
      toast({
        title: "Success",
        description: "Evaluation submitted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to submit evaluation",
        variant: "destructive",
      });
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PUT", `/api/evaluations/${id}`, {
        selfEvaluationData: data,
        status: 'in_progress',
        // Don't set selfEvaluationSubmittedAt - this keeps it as a draft
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluations"] });
      setIsViewModalOpen(false);
      toast({
        title: "Draft Saved",
        description: "Your progress has been saved successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save draft",
        variant: "destructive",
      });
    },
  });

  // Schedule meeting mutation
  const scheduleMeetingMutation = useMutation({
    mutationFn: async ({ evaluationId, meetingDetails }: { evaluationId: string; meetingDetails: any }) => {
      const response = await apiRequest('POST', `/api/evaluations/${evaluationId}/schedule-meeting-employee`, meetingDetails);
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluations"] });
      toast({
        title: "Meeting Request Sent",
        description: "Calendar invite has been sent to your manager.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule meeting",
        variant: "destructive",
      });
    },
    onSettled: (data, error) => {
      // Only reset form and close modal on success
      if (!error) {
        setShowMeetingScheduler(false);
        setMeetingData({ date: '', time: '', duration: '60', location: 'office', notes: '' });
      }
      // On error, keep modal open so user can correct input
    },
  });

  const form = useForm({
    defaultValues: responses,
  });

  const handleViewEvaluation = (evaluation: EvaluationWithDetails) => {
    setSelectedEvaluation(evaluation);
    setIsViewModalOpen(true);
    
    // Load existing responses if available
    if (evaluation.selfEvaluationData) {
      const savedData = evaluation.selfEvaluationData as any;
      
      // Handle both old format (direct responses) and new format (with responses key)
      const savedResponses = savedData.responses || savedData;
      setResponses(savedResponses);
      
      // Recalculate and set average rating from persisted data
      const newAverage = calculateAverageRating(savedResponses);
      setAverageRating(newAverage);
      
      form.reset(savedResponses);
    } else {
      // Reset state for new evaluation
      setResponses({});
      setAverageRating(0);
      form.reset({});
    }
  };

  const onSubmit = (data: any) => {
    if (selectedEvaluation) {
      // Store responses in the same keyed format expected by the form
      const evaluationData = {
        responses,
        averageRating,
        questionnaires: selectedEvaluation.questionnaires?.map(q => q.id)
      };
      submitEvaluationMutation.mutate({ id: selectedEvaluation.id, data: evaluationData });
    }
  };

  const handleSaveDraft = () => {
    if (selectedEvaluation) {
      const evaluationData = {
        responses,
        averageRating,
        questionnaires: selectedEvaluation.questionnaires?.map(q => q.id)
      };
      saveDraftMutation.mutate({ id: selectedEvaluation.id, data: evaluationData });
    }
  };

  // Export functionality - now using server-side data for security
  const handleExport = async (evaluation: EvaluationWithDetails, format: 'pdf' | 'docx') => {
    if (!evaluation) return;
    
    setIsExporting(true);
    try {
      const exportData = {
        evaluationId: evaluation.id,
        format
      };
      
      const response = await fetch('/api/evaluations/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(exportData)
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized');
        }
        throw new Error('Export failed');
      }
      
      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `evaluation-${evaluation.id}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Export Successful",
        description: `Evaluation exported as ${format.toUpperCase()}`
      });
    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        toast({
          title: "Unauthorized",
          description: "Please log in to export evaluations.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Export Failed",
          description: "Unable to export evaluation. Please try again.",
          variant: "destructive"
        });
      }
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusIcon = (evaluation: EvaluationWithDetails) => {
    if (evaluation.selfEvaluationSubmittedAt) {
      return <CheckCircle className="h-4 w-4 text-accent" />;
    }
    if (evaluation.status === 'not_started') {
      return <Play className="h-4 w-4 text-blue-500" />;
    }
    return <Clock className="h-4 w-4 text-yellow-500" />;
  };

  const getStatusText = (evaluation: EvaluationWithDetails) => {
    if (evaluation.finalizedAt) return "Completed";
    if (evaluation.managerEvaluationSubmittedAt) return "Manager Review Complete";
    if (evaluation.selfEvaluationSubmittedAt) return "Self Evaluation Complete";
    if (evaluation.status === 'not_started') return "Initiated";
    return "Pending";
  };

  const getStatusVariant = (evaluation: EvaluationWithDetails) => {
    if (evaluation.finalizedAt) return "default";
    if (evaluation.managerEvaluationSubmittedAt) return "secondary";
    if (evaluation.selfEvaluationSubmittedAt) return "outline";
    if (evaluation.status === 'not_started') return "secondary";
    return "destructive";
  };

  // Calculate average rating from responses
  const calculateAverageRating = (responseData: Record<string, QuestionResponse>) => {
    const ratings = Object.values(responseData)
      .filter(response => response.rating !== undefined)
      .map(response => response.rating!);
    
    if (ratings.length === 0) return 0;
    
    const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    // Round to nearest 0.5
    return Math.round(average * 2) / 2;
  };

  // Get all questions from questionnaires
  const getAllQuestions = (questionnaires: QuestionnaireTemplate[]): EnhancedQuestion[] => {
    if (!questionnaires || !Array.isArray(questionnaires)) {
      return [];
    }
    
    return questionnaires.flatMap((questionnaire, qIndex) => {
      if (!questionnaire || !questionnaire.questions || !Array.isArray(questionnaire.questions)) {
        return [];
      }
      
      return questionnaire.questions
        .filter(question => question && typeof question === 'object')
        .map((question, index) => ({
          ...question,
          id: `${questionnaire.id}_${question.id || index}`,
          questionnaireName: questionnaire.name
        })) as EnhancedQuestion[];
    });
  };

  const renderQuestion = (question: EnhancedQuestion) => {
    const questionKey = question.id;
    const currentResponse = responses[questionKey] || { questionId: questionKey, response: '', rating: undefined, remarks: '' };

    const updateResponse = (field: string, value: any) => {
      setResponses(prev => {
        const updated = {
          ...prev,
          [questionKey]: {
            ...currentResponse,
            [field]: value
          }
        };
        
        // Recalculate average when ratings change
        if (field === 'rating') {
          const newAverage = calculateAverageRating(updated);
          setAverageRating(newAverage);
        }
        
        return updated;
      });
    };

    switch (question.type) {
      case 'textarea':
        return (
          <Card key={question.id} className="p-4">
            <div className="space-y-4">
              <div>
                <FormLabel className="text-base font-semibold">{question.text}</FormLabel>
                {question.required && <span className="text-red-500 ml-1">*</span>}
                {question.questionnaireName && (
                  <p className="text-sm text-muted-foreground mt-1">From: {question.questionnaireName}</p>
                )}
              </div>
              <div>
                <FormLabel className="text-sm">Self Remarks</FormLabel>
                <Textarea
                  value={currentResponse.response}
                  onChange={(e) => updateResponse('response', e.target.value)}
                  placeholder="Enter your detailed response..."
                  className="min-h-[100px] mt-1"
                  data-testid={`question-response-${question.id}`}
                />
              </div>
            </div>
          </Card>
        );
      case 'rating':
        return (
          <Card key={question.id} className="p-4">
            <div className="space-y-4">
              <div>
                <FormLabel className="text-base font-semibold">{question.text}</FormLabel>
                {question.required && <span className="text-red-500 ml-1">*</span>}
                {question.questionnaireName && (
                  <p className="text-sm text-muted-foreground mt-1">From: {question.questionnaireName}</p>
                )}
              </div>
              <div>
                <FormLabel className="text-sm">Rating</FormLabel>
                <Select
                  value={currentResponse.rating?.toString() || ''}
                  onValueChange={(value) => updateResponse('rating', parseInt(value))}
                >
                  <SelectTrigger data-testid={`question-rating-${question.id}`}>
                    <SelectValue placeholder="Select rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Below Expectations</SelectItem>
                    <SelectItem value="2">2 - Meets Some Expectations</SelectItem>
                    <SelectItem value="3">3 - Meets Expectations</SelectItem>
                    <SelectItem value="4">4 - Exceeds Expectations</SelectItem>
                    <SelectItem value="5">5 - Outstanding</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FormLabel className="text-sm">Self Assessment</FormLabel>
                <Textarea
                  value={currentResponse.response}
                  onChange={(e) => updateResponse('response', e.target.value)}
                  placeholder="Explain your rating..."
                  className="min-h-[80px] mt-1"
                  data-testid={`question-response-${question.id}`}
                />
              </div>
            </div>
          </Card>
        );
      default:
        return (
          <Card key={question.id} className="p-4">
            <div className="space-y-4">
              <div>
                <FormLabel className="text-base font-semibold">{question.text}</FormLabel>
                {question.required && <span className="text-red-500 ml-1">*</span>}
                {question.questionnaireName && (
                  <p className="text-sm text-muted-foreground mt-1">From: {question.questionnaireName}</p>
                )}
              </div>
              <div>
                <FormLabel className="text-sm">Self Remarks</FormLabel>
                <Input
                  value={currentResponse.response}
                  onChange={(e) => updateResponse('response', e.target.value)}
                  placeholder="Enter your response..."
                  className="mt-1"
                  data-testid={`question-response-${question.id}`}
                />
              </div>
            </div>
          </Card>
        );
    }
  };

  return (
    <RoleGuard allowedRoles={["employee"]}>
      <div className="space-y-6" data-testid="evaluations">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">My Evaluations</h1>
            <p className="text-muted-foreground">Complete your performance evaluations</p>
          </div>
        </div>

        {/* Evaluations List */}
        <div className="space-y-4">
          {isLoading ? (
            [...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-20 bg-muted rounded"></div>
                </CardContent>
              </Card>
            ))
          ) : evaluations.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg mb-2">No evaluations assigned</p>
                <p className="text-muted-foreground text-sm">Your performance evaluations will appear here</p>
              </CardContent>
            </Card>
          ) : (
            evaluations.map((evaluation) => (
              <Card key={evaluation.id} data-testid={`evaluation-card-${evaluation.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold" data-testid={`evaluation-title-${evaluation.id}`}>
                          Performance Review - {evaluation.reviewCycle?.name || 'Review Cycle'}
                        </h3>
                        <Badge variant={getStatusVariant(evaluation)}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(evaluation)}
                            <span>{getStatusText(evaluation)}</span>
                          </div>
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground mb-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            Due: {evaluation.reviewCycle?.endDate ? new Date(evaluation.reviewCycle.endDate).toLocaleDateString() : 'TBD'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>Manager: {evaluation.manager?.firstName} {evaluation.manager?.lastName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {evaluation.overallRating && (
                            <>
                              <Star className="h-4 w-4 text-yellow-500" />
                              <span>Rating: {evaluation.overallRating}/5</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Progress indicators */}
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Self Evaluation:</span>
                          {evaluation.selfEvaluationSubmittedAt ? (
                            <span className="text-accent font-medium">Completed</span>
                          ) : (
                            <span className="text-yellow-600 font-medium">Pending</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Manager Review:</span>
                          {evaluation.managerEvaluationSubmittedAt ? (
                            <span className="text-accent font-medium">Completed</span>
                          ) : (
                            <span className="text-muted-foreground font-medium">Pending</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Meeting:</span>
                          {evaluation.meetingCompletedAt ? (
                            <span className="text-accent font-medium">Completed</span>
                          ) : (
                            <span className="text-muted-foreground font-medium">Pending</span>
                          )}
                        </div>
                      </div>

                      {/* Manager Feedback Section - visible when manager has provided feedback */}
                      {((evaluation.managerEvaluationData as any)?.managerRemarks || evaluation.meetingNotes || evaluation.finalizedAt) && (
                        <div className="mt-4 pt-4 border-t border-border space-y-3">
                          <h4 className="font-medium text-sm text-muted-foreground">Manager Feedback</h4>
                          
                          {/* Manager Remarks */}
                          {(evaluation.managerEvaluationData as any)?.managerRemarks && (
                            <div className="bg-blue-50 p-3 rounded-lg space-y-2">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-800">Manager's Review</span>
                                {evaluation.managerEvaluationSubmittedAt && (
                                  <span className="text-xs text-blue-600">
                                    {new Date(evaluation.managerEvaluationSubmittedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-blue-900 whitespace-pre-wrap">
                                {(evaluation.managerEvaluationData as any).managerRemarks}
                              </p>
                            </div>
                          )}

                          {/* Meeting Notes */}
                          {evaluation.meetingNotes && (
                            <div className="bg-green-50 p-3 rounded-lg space-y-2">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-medium text-green-800">One-on-One Meeting Notes</span>
                                {evaluation.meetingCompletedAt && (
                                  <span className="text-xs text-green-600">
                                    {new Date(evaluation.meetingCompletedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-green-900 whitespace-pre-wrap">
                                {evaluation.meetingNotes}
                              </p>
                            </div>
                          )}

                          {/* Completion Status */}
                          {evaluation.finalizedAt && (
                            <div className="bg-accent/10 p-3 rounded-lg">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-accent" />
                                <span className="text-sm font-medium text-accent">
                                  Evaluation Completed on {new Date(evaluation.finalizedAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewEvaluation(evaluation)}
                        data-testid={`view-evaluation-${evaluation.id}`}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        {evaluation.selfEvaluationSubmittedAt ? 'View' : 'Start'}
                      </Button>
                      {evaluation.selfEvaluationSubmittedAt && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isExporting}
                              data-testid={`export-evaluation-${evaluation.id}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem
                              onClick={() => handleExport(evaluation, 'pdf')}
                              disabled={isExporting}
                              data-testid={`export-pdf-card-${evaluation.id}`}
                            >
                              Export as PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleExport(evaluation, 'docx')}
                              disabled={isExporting}
                              data-testid={`export-docx-card-${evaluation.id}`}
                            >
                              Export as DOCX
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      {evaluation.managerEvaluationSubmittedAt && !evaluation.meetingCompletedAt && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedEvaluation(evaluation);
                            setShowMeetingScheduler(true);
                          }}
                          data-testid={`schedule-meeting-${evaluation.id}`}
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule 1 on 1
                        </Button>
                      )}
                      {evaluation.meetingCompletedAt && (
                        <Link href="/development-goals">
                          <Button
                            variant="outline"
                            size="sm"
                            data-testid={`add-goal-${evaluation.id}`}
                          >
                            <Target className="h-4 w-4 mr-2" />
                            Add Goal
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Evaluation Modal */}
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle data-testid="evaluation-dialog-title">
                Performance Evaluation
                {selectedEvaluation?.appraisalCycle && selectedEvaluation?.frequencyCalendar && (
                  <span className="text-sm font-normal text-muted-foreground block mt-1">
                    {selectedEvaluation.appraisalCycle.code} - {selectedEvaluation.appraisalCycle.description}
                    {selectedEvaluation.frequencyCalendarDetail && (
                      <>
                        {' | '}
                        {selectedEvaluation.frequencyCalendarDetail.displayName} - {new Date(selectedEvaluation.frequencyCalendarDetail.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).replace(/\//g, '-')} to {new Date(selectedEvaluation.frequencyCalendarDetail.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).replace(/\//g, '-')}
                      </>
                    )}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription>
                Complete your self-evaluation by answering the questions below
              </DialogDescription>
            </DialogHeader>
            
            {selectedEvaluation && (
              <div className="space-y-6">
                {/* Evaluation Info */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                        <FileText className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{selectedEvaluation.reviewCycle?.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Manager: {selectedEvaluation.manager?.firstName} {selectedEvaluation.manager?.lastName}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Questions Form */}
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                    {/* Average Rating Display */}
                    {averageRating > 0 && (
                      <Card className="bg-accent/10">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <Star className="h-6 w-6 text-yellow-500" />
                            <div>
                              <p className="font-semibold">Current Average Rating</p>
                              <p className="text-2xl font-bold text-primary">{averageRating.toFixed(1)}/5.0</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Questionnaires */}
                    {selectedEvaluation.questionnaires && selectedEvaluation.questionnaires.length > 0 ? (
                      <div className="space-y-6">
                        {selectedEvaluation.questionnaires.map((questionnaire, index) => (
                          <Card key={questionnaire.id} className="border-l-4 border-l-primary">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-lg">{questionnaire.name}</CardTitle>
                              {questionnaire.description && (
                                <CardDescription>{questionnaire.description}</CardDescription>
                              )}
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {getAllQuestions([questionnaire]).map(renderQuestion)}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="text-center py-8">
                          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">No questionnaires assigned to this evaluation</p>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t">
                      <Button
                        type="button"
                        onClick={() => handleExport(selectedEvaluation, 'pdf')}
                        variant="outline"
                        disabled={isExporting}
                        data-testid="export-pdf-btn"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {isExporting ? 'Exporting...' : 'Export PDF'}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleExport(selectedEvaluation, 'docx')}
                        variant="outline"
                        disabled={isExporting}
                        data-testid="export-docx-btn"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {isExporting ? 'Exporting...' : 'Export DOCX'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSaveDraft}
                        className="flex-1"
                        disabled={saveDraftMutation.isPending}
                        data-testid="save-draft-btn"
                      >
                        {saveDraftMutation.isPending ? 'Saving...' : 'Save Draft'}
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1"
                        disabled={submitEvaluationMutation.isPending || !!selectedEvaluation.selfEvaluationSubmittedAt}
                        data-testid="submit-evaluation"
                      >
                        {selectedEvaluation.selfEvaluationSubmittedAt ? 'Already Submitted' : 'Submit Evaluation'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Meeting Scheduler Modal */}
        <Dialog open={showMeetingScheduler} onOpenChange={setShowMeetingScheduler}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Schedule One-on-One Meeting</DialogTitle>
              <DialogDescription>
                Select your preferred date and time for your evaluation discussion with your manager
              </DialogDescription>
            </DialogHeader>
            
            {selectedEvaluation && (
              <div className="space-y-6">
                {/* Meeting Info */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                        <Calendar className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Meeting with {selectedEvaluation.manager?.firstName} {selectedEvaluation.manager?.lastName}</h3>
                        <p className="text-sm text-muted-foreground">
                          Evaluation: {selectedEvaluation.reviewCycle?.name}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Date Selection */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Select Preferred Time Slot</CardTitle>
                    <CardDescription>
                      Choose your preferred date and time. Your manager will confirm the final meeting time.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Preferred Date</label>
                        <div className="space-y-2">
                          <Input
                            type="date"
                            min={new Date().toISOString().split('T')[0]}
                            value={meetingData.date}
                            onChange={(e) => setMeetingData(prev => ({ ...prev, date: e.target.value }))}
                            data-testid="meeting-date-1"
                          />
                          <Input
                            type="time"
                            value={meetingData.time}
                            onChange={(e) => setMeetingData(prev => ({ ...prev, time: e.target.value }))}
                            data-testid="meeting-time-1"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Meeting Duration</label>
                        <Select value={meetingData.duration} onValueChange={(value) => setMeetingData(prev => ({ ...prev, duration: value }))}>
                          <SelectTrigger data-testid="meeting-duration">
                            <SelectValue placeholder="Select duration" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 minutes</SelectItem>
                            <SelectItem value="45">45 minutes</SelectItem>
                            <SelectItem value="60">60 minutes</SelectItem>
                            <SelectItem value="90">90 minutes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Meeting Location</label>
                      <Select value={meetingData.location} onValueChange={(value) => setMeetingData(prev => ({ ...prev, location: value }))}>
                        <SelectTrigger data-testid="meeting-location">
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="office">Office - In Person</SelectItem>
                          <SelectItem value="video">Video Call</SelectItem>
                          <SelectItem value="phone">Phone Call</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Additional Notes (Optional)</label>
                      <Textarea
                        value={meetingData.notes}
                        onChange={(e) => setMeetingData(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Any specific topics you'd like to discuss or special requirements..."
                        className="min-h-[80px]"
                        data-testid="meeting-notes"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setShowMeetingScheduler(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (!meetingData.date || !meetingData.time) {
                        toast({
                          title: "Error",
                          description: "Please select a date and time for the meeting",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      // Validate that the selected date is not in the past
                      const meetingDateTime = new Date(`${meetingData.date}T${meetingData.time}`);
                      const now = new Date();
                      if (meetingDateTime <= now) {
                        toast({
                          title: "Error", 
                          description: "Please select a future date and time",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      if (selectedEvaluation) {
                        scheduleMeetingMutation.mutate({
                          evaluationId: selectedEvaluation.id,
                          meetingDetails: {
                            meetingDate: meetingDateTime.toISOString(),
                            duration: parseInt(meetingData.duration),
                            location: meetingData.location,
                            notes: meetingData.notes,
                          }
                        });
                      }
                    }}
                    className="flex-1"
                    disabled={scheduleMeetingMutation.isPending}
                    data-testid="send-meeting-request"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {scheduleMeetingMutation.isPending ? 'Sending...' : 'Send Request'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}
