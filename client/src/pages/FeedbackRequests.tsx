import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Clock, CheckCircle, User, Mail, Building } from "lucide-react";
import { Link } from "wouter";
import { RoleGuard } from "@/components/RoleGuard";
import { format } from "date-fns";

interface FeedbackRequestWithDetails {
  id: string;
  status: "pending" | "submitted" | "cancelled";
  createdAt: string;
  submittedAt: string | null;
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

export default function FeedbackRequests() {
  const { data: requests, isLoading } = useQuery<FeedbackRequestWithDetails[]>({
    queryKey: ["/api/feedback-requests"],
  });

  const pendingRequests = requests?.filter(r => r.status === "pending") || [];
  const submittedRequests = requests?.filter(r => r.status === "submitted") || [];

  return (
    <RoleGuard allowedRoles={["employee", "manager"]}>
      <div className="p-6 max-w-6xl mx-auto space-y-6" data-testid="feedback-requests-page">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Feedback Requests</h1>
            <p className="text-muted-foreground">Provide feedback for your colleagues</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                Pending Requests ({pendingRequests.length})
              </h2>
              
              {pendingRequests.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No pending feedback requests</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {pendingRequests.map((request) => (
                    <Card key={request.id} className="hover:shadow-md transition-shadow" data-testid={`feedback-request-${request.id}`}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <User className="h-5 w-5 text-primary" />
                              <span className="font-semibold text-lg">
                                {request.subject?.firstName} {request.subject?.lastName}
                              </span>
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                Pending
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                {request.subject?.email}
                              </div>
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4" />
                                {request.subject?.department || "N/A"}
                              </div>
                            </div>
                            
                            <p className="text-sm text-muted-foreground">
                              Requested by: {request.requester?.firstName} {request.requester?.lastName} on{" "}
                              {format(new Date(request.createdAt), "MMM dd, yyyy")}
                            </p>
                          </div>
                          
                          <Link href={`/feedback-requests/${request.id}`}>
                            <Button data-testid={`btn-provide-feedback-${request.id}`}>
                              Provide Feedback
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {submittedRequests.length > 0 && (
              <div className="space-y-4 mt-8">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Submitted Feedback ({submittedRequests.length})
                </h2>
                
                <div className="grid gap-4">
                  {submittedRequests.map((request) => (
                    <Card key={request.id} className="opacity-75" data-testid={`feedback-submitted-${request.id}`}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <User className="h-5 w-5 text-muted-foreground" />
                              <span className="font-semibold">
                                {request.subject?.firstName} {request.subject?.lastName}
                              </span>
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Submitted
                              </Badge>
                            </div>
                            
                            <p className="text-sm text-muted-foreground">
                              Submitted on: {request.submittedAt ? format(new Date(request.submittedAt), "MMM dd, yyyy") : "N/A"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </RoleGuard>
  );
}
