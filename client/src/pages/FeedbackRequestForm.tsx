import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, User, Mail, Building, MapPin, UserCheck, MessageSquare } from "lucide-react";
import { Link } from "wouter";
import { RoleGuard } from "@/components/RoleGuard";

const feedbackFormSchema = z.object({
  relationshipWithPeer: z.string().min(1, "Please describe your relationship with this person"),
  collaborationRating: z.enum(["excellent", "good", "average", "needs_improvement", "poor"]),
  communicationRating: z.enum(["excellent", "good", "average", "needs_improvement", "poor"]),
  reliabilityRating: z.enum(["excellent", "good", "average", "needs_improvement", "poor"]),
  problemSolvingRating: z.enum(["excellent", "good", "average", "needs_improvement", "poor"]),
  ownershipRating: z.enum(["excellent", "good", "average", "needs_improvement", "poor", "not_applicable"]),
  opennessToFeedbackRating: z.enum(["excellent", "good", "average", "needs_improvement", "poor"]),
  conflictHandlingRating: z.enum(["excellent", "good", "average", "needs_improvement", "poor", "not_applicable"]),
  jobSpecificCompetencies: z.string().min(1, "Please provide feedback on job-specific competencies"),
  strengths: z.string().min(1, "Please describe the person's strengths"),
  developmentAreas: z.string().min(1, "Please describe areas for development"),
  overallSummary: z.string().min(1, "Please provide an overall summary"),
  recommendedRating: z.number().min(1).max(5),
});

type FeedbackFormValues = z.infer<typeof feedbackFormSchema>;

const RATING_OPTIONS = [
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "average", label: "Average" },
  { value: "needs_improvement", label: "Needs Improvement" },
  { value: "poor", label: "Poor" },
];

const RATING_OPTIONS_WITH_NA = [
  ...RATING_OPTIONS,
  { value: "not_applicable", label: "Not Applicable" },
];

interface FeedbackRequestDetails {
  id: string;
  status: "pending" | "submitted" | "cancelled";
  subject: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    department: string | null;
    designation: string | null;
    locationName: string | null;
    managerName: string | null;
  } | null;
  requester: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export default function FeedbackRequestForm() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: request, isLoading } = useQuery<FeedbackRequestDetails>({
    queryKey: ["/api/feedback-requests", id],
  });

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      relationshipWithPeer: "",
      collaborationRating: undefined,
      communicationRating: undefined,
      reliabilityRating: undefined,
      problemSolvingRating: undefined,
      ownershipRating: undefined,
      opennessToFeedbackRating: undefined,
      conflictHandlingRating: undefined,
      jobSpecificCompetencies: "",
      strengths: "",
      developmentAreas: "",
      overallSummary: "",
      recommendedRating: undefined,
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: FeedbackFormValues) => {
      const response = await apiRequest("POST", `/api/feedback-requests/${id}/submit`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Feedback Submitted",
        description: "Your feedback has been submitted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/feedback-requests"] });
      navigate("/feedback-requests");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit feedback",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FeedbackFormValues) => {
    submitMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <RoleGuard allowedRoles={["employee", "manager"]}>
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-96 w-full" />
            </CardContent>
          </Card>
        </div>
      </RoleGuard>
    );
  }

  if (!request) {
    return (
      <RoleGuard allowedRoles={["employee", "manager"]}>
        <div className="p-6 max-w-4xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Feedback request not found</p>
              <Link href="/feedback-requests">
                <Button variant="link">Back to Feedback Requests</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </RoleGuard>
    );
  }

  if (request.status === "submitted") {
    return (
      <RoleGuard allowedRoles={["employee", "manager"]}>
        <div className="p-6 max-w-4xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">This feedback has already been submitted.</p>
              <Link href="/feedback-requests">
                <Button variant="link">Back to Feedback Requests</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowedRoles={["employee", "manager"]}>
      <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="feedback-form-page">
        <div className="flex items-center gap-4">
          <Link href="/feedback-requests">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Provide Feedback</h1>
            <p className="text-muted-foreground">
              Feedback for {request.subject?.firstName} {request.subject?.lastName}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Employee Details
            </CardTitle>
            <CardDescription>Information about the person you're providing feedback for</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{request.subject?.firstName} {request.subject?.lastName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{request.subject?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">{request.subject?.locationName || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-medium">{request.subject?.department || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Reporting Manager</p>
                  <p className="font-medium">{request.subject?.managerName || "N/A"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Relationship Context</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="relationshipWithPeer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Relationship with Peer*</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe how long you've worked together and in what context (same team, project, cross-functional, etc.)"
                          className="min-h-[100px]"
                          {...field}
                          data-testid="input-relationship"
                        />
                      </FormControl>
                      <FormDescription>
                        How long have you worked with this person? In what capacity?
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Competency Ratings</CardTitle>
                <CardDescription>Rate the employee on the following competencies</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="collaborationRating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Collaboration and Teamwork*</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-collaboration">
                              <SelectValue placeholder="Select rating" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RATING_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="communicationRating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Communication*</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-communication">
                              <SelectValue placeholder="Select rating" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RATING_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reliabilityRating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reliability*</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-reliability">
                              <SelectValue placeholder="Select rating" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RATING_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="problemSolvingRating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Problem-solving*</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-problem-solving">
                              <SelectValue placeholder="Select rating" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RATING_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ownershipRating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ownership*</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-ownership">
                              <SelectValue placeholder="Select rating" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RATING_OPTIONS_WITH_NA.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="opennessToFeedbackRating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Openness to Feedback*</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-openness">
                              <SelectValue placeholder="Select rating" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RATING_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="conflictHandlingRating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conflict Handling & Leadership*</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-conflict">
                              <SelectValue placeholder="Select rating" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RATING_OPTIONS_WITH_NA.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Qualitative Feedback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="jobSpecificCompetencies"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Specific Core Competencies*</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Comment on job-specific competencies (e.g., customer focus, innovation, process adherence)"
                          className="min-h-[100px]"
                          {...field}
                          data-testid="input-competencies"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="strengths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Strengths with Examples*</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What does this person do particularly well? Provide specific examples."
                          className="min-h-[100px]"
                          {...field}
                          data-testid="input-strengths"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="developmentAreas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Development Areas with Examples*</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What should this person do differently or improve? Provide specific examples."
                          className="min-h-[100px]"
                          {...field}
                          data-testid="input-development"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="overallSummary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Overall Summary*</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Provide an overall summary of your feedback"
                          className="min-h-[100px]"
                          {...field}
                          data-testid="input-summary"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Final Rating</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="recommendedRating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recommended Rating*</FormLabel>
                      <Select 
                        onValueChange={(val) => field.onChange(parseInt(val))} 
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-rating" className="w-48">
                            <SelectValue placeholder="Select rating (1-5)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">1 - Needs Improvement</SelectItem>
                          <SelectItem value="2">2 - Below Expectations</SelectItem>
                          <SelectItem value="3">3 - Meets Expectations</SelectItem>
                          <SelectItem value="4">4 - Exceeds Expectations</SelectItem>
                          <SelectItem value="5">5 - Outstanding</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Link href="/feedback-requests">
                <Button type="button" variant="outline" data-testid="btn-cancel">
                  Cancel
                </Button>
              </Link>
              <Button 
                type="submit" 
                disabled={submitMutation.isPending}
                data-testid="btn-submit"
              >
                {submitMutation.isPending ? "Submitting..." : "Submit Feedback"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </RoleGuard>
  );
}
