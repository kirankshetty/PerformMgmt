import { useState, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Target, CheckCircle, XCircle, Clock, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface ReviewItem {
  id: string;
  employeeId: string;
  kpiTargetId: string;
  kpiId: string;
  kraId: string;
  periodKey: string;
  periodStartDate: string;
  periodEndDate: string;
  selfRating: string | null;
  pipelineValue: string | null;
  selfComments: string | null;
  pipelineRemarks: string | null;
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  managerComments: string | null;
  managerRemarksActual: string | null;
  managerRemarksPipeline: string | null;
  employeeName: string;
  employeeCode: string;
  employeeEmail: string;
  kpiCode: string;
  kpiName: string;
  kpiInputType: string;
  kraCode: string;
  kraName: string;
}

interface EmployeeSummary {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  employeeEmail: string;
  submittedCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalCount: number;
}

export default function ManagerKraGoalsReview() {
  const { toast } = useToast();
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [managerRemarks, setManagerRemarks] = useState<Record<string, { remarksActual: string; remarksPipeline: string }>>({});
  const [rejectingReviewId, setRejectingReviewId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: reviews, isLoading } = useQuery<ReviewItem[]>({
    queryKey: ["/api/manager/kra-goal-reviews"],
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, managerRemarksActual, managerRemarksPipeline, managerComments }: { id: string; status: string; managerRemarksActual: string; managerRemarksPipeline: string; managerComments?: string }) => {
      const response = await apiRequest("POST", `/api/manager/kra-goal-reviews/${id}/review`, {
        status,
        managerRemarksActual,
        managerRemarksPipeline,
        managerComments: managerComments || null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/kra-goal-reviews"] });
      setRejectingReviewId(null);
      setRejectionReason("");
      toast({ title: "Success", description: "Review updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update review", variant: "destructive" });
    },
  });

  const employeeSummaries: EmployeeSummary[] = [];
  if (reviews) {
    const empMap = new Map<string, EmployeeSummary>();
    for (const r of reviews) {
      if (!empMap.has(r.employeeId)) {
        empMap.set(r.employeeId, {
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          employeeCode: r.employeeCode,
          employeeEmail: r.employeeEmail,
          submittedCount: 0,
          approvedCount: 0,
          rejectedCount: 0,
          totalCount: 0,
        });
      }
      const summary = empMap.get(r.employeeId)!;
      summary.totalCount++;
      if (r.status === 'submitted') summary.submittedCount++;
      if (r.status === 'approved') summary.approvedCount++;
      if (r.status === 'rejected') summary.rejectedCount++;
    }
    employeeSummaries.push(...Array.from(empMap.values()));
  }

  const employeeReviews = reviews?.filter(r => r.employeeId === selectedEmployee) || [];

  const pendingReviews = employeeReviews.filter(r => r.status === 'submitted');
  const approvedReviews = employeeReviews.filter(r => r.status === 'approved');
  const rejectedReviews = employeeReviews.filter(r => r.status === 'rejected');

  const handleApprove = (reviewId: string) => {
    const remarks = managerRemarks[reviewId] || { remarksActual: '', remarksPipeline: '' };
    reviewMutation.mutate({
      id: reviewId,
      status: 'approved',
      managerRemarksActual: remarks.remarksActual,
      managerRemarksPipeline: remarks.remarksPipeline,
    });
  };

  const handleRejectClick = (reviewId: string) => {
    setRejectingReviewId(reviewId);
    setRejectionReason("");
  };

  const handleRejectConfirm = () => {
    if (!rejectingReviewId) return;
    if (!rejectionReason.trim()) {
      toast({ title: "Reason required", description: "Please provide a reason for rejection", variant: "destructive" });
      return;
    }
    const remarks = managerRemarks[rejectingReviewId] || { remarksActual: '', remarksPipeline: '' };
    reviewMutation.mutate({
      id: rejectingReviewId,
      status: 'rejected',
      managerRemarksActual: remarks.remarksActual,
      managerRemarksPipeline: remarks.remarksPipeline,
      managerComments: rejectionReason.trim(),
    });
  };

  const updateRemarks = (reviewId: string, field: 'remarksActual' | 'remarksPipeline', value: string) => {
    setManagerRemarks(prev => ({
      ...prev,
      [reviewId]: {
        ...prev[reviewId],
        remarksActual: prev[reviewId]?.remarksActual || '',
        remarksPipeline: prev[reviewId]?.remarksPipeline || '',
        [field]: value,
      },
    }));
  };

  const renderKpiTable = (items: ReviewItem[], showActions: boolean) => {
    const groupedByKra = items.reduce<Record<string, { kraCode: string; kraName: string; reviews: ReviewItem[] }>>((acc, review) => {
      const key = `${review.kraId}_${review.periodKey}`;
      if (!acc[key]) {
        acc[key] = { kraCode: review.kraCode, kraName: review.kraName, reviews: [] };
      }
      acc[key].reviews.push(review);
      return acc;
    }, {});

    if (Object.keys(groupedByKra).length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No KPIs in this category</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {Object.entries(groupedByKra).map(([groupKey, group]) => (
          <div key={groupKey} className="border rounded-lg p-3">
            <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Target className="h-3 w-3" />
              {group.kraCode} — {group.kraName}
            </h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>KPI Code</TableHead>
                  <TableHead>KPI Name</TableHead>
                  <TableHead>Input Type</TableHead>
                  <TableHead>Actual Value</TableHead>
                  <TableHead>Pipeline Value</TableHead>
                  <TableHead>Period</TableHead>
                  {showActions && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.reviews.map((review) => {
                  const remarkActual = managerRemarks[review.id]?.remarksActual ?? review.managerRemarksActual ?? '';
                  const remarkPipeline = managerRemarks[review.id]?.remarksPipeline ?? review.managerRemarksPipeline ?? '';
                  const periodStart = new Date(review.periodStartDate);
                  const periodEnd = new Date(review.periodEndDate);
                  const periodDisplay = `${periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                  const colSpan = showActions ? 7 : 6;
                  return (
                    <Fragment key={review.id}>
                      <TableRow>
                        <TableCell className="font-medium">{review.kpiCode}</TableCell>
                        <TableCell>{review.kpiName}</TableCell>
                        <TableCell className="capitalize">{review.kpiInputType}</TableCell>
                        <TableCell>{review.selfRating || '-'}</TableCell>
                        <TableCell>{review.pipelineValue || '-'}</TableCell>
                        <TableCell className="text-sm">{periodDisplay}</TableCell>
                        {showActions && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:bg-green-50"
                                onClick={() => handleApprove(review.id)}
                                disabled={reviewMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => handleRejectClick(review.id)}
                                disabled={reviewMutation.isPending}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                      {review.selfComments && (
                        <TableRow>
                          <TableCell colSpan={colSpan} className="pt-0 pb-1">
                            <div className="flex items-start gap-3">
                              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap w-48 shrink-0 mt-1">Employee Remarks (Actual):</span>
                              <span className="text-sm">{review.selfComments}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      {review.pipelineRemarks && (
                        <TableRow>
                          <TableCell colSpan={colSpan} className="pt-0 pb-1">
                            <div className="flex items-start gap-3">
                              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap w-48 shrink-0 mt-1">Employee Remarks (Pipeline):</span>
                              <span className="text-sm">{review.pipelineRemarks}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow>
                        <TableCell colSpan={colSpan} className="pt-0 pb-1">
                          <div className="flex items-start gap-3">
                            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap w-48 shrink-0 mt-2">Manager Remarks (Actual):</span>
                            {showActions ? (
                              <Textarea
                                placeholder="Enter your remarks for actual value..."
                                value={remarkActual}
                                onChange={(e) => updateRemarks(review.id, 'remarksActual', e.target.value)}
                                className="flex-1 min-h-[60px] text-sm"
                              />
                            ) : (
                              <span className="text-sm mt-2">{review.managerRemarksActual || '-'}</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      <TableRow className={review.managerComments && !showActions ? "" : "border-b"}>
                        <TableCell colSpan={colSpan} className="pt-0 pb-3">
                          <div className="flex items-start gap-3">
                            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap w-48 shrink-0 mt-2">Manager Remarks (Pipeline):</span>
                            {showActions ? (
                              <Textarea
                                placeholder="Enter your remarks for pipeline value..."
                                value={remarkPipeline}
                                onChange={(e) => updateRemarks(review.id, 'remarksPipeline', e.target.value)}
                                className="flex-1 min-h-[60px] text-sm"
                              />
                            ) : (
                              <span className="text-sm mt-2">{review.managerRemarksPipeline || '-'}</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {review.managerComments && (
                        <TableRow className="border-b">
                          <TableCell colSpan={colSpan} className="pt-0 pb-3">
                            <div className="flex items-start gap-3">
                              <span className="text-sm font-medium text-red-600 whitespace-nowrap w-48 shrink-0 mt-1">Reason for Rejection:</span>
                              <span className="text-sm text-red-600">{review.managerComments}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">KRAs/Goals Review</h1>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (selectedEmployee) {
    const selectedEmp = employeeSummaries.find(e => e.employeeId === selectedEmployee);
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedEmployee(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6" />
            KRAs/Goals Review — {selectedEmp?.employeeName}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Employee Code: {selectedEmp?.employeeCode} | Email: {selectedEmp?.employeeEmail}
        </p>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Pending Review
              {pendingReviews.length > 0 && (
                <Badge className="bg-blue-100 text-blue-800 ml-2">{pendingReviews.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderKpiTable(pendingReviews, true)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Approved
              {approvedReviews.length > 0 && (
                <Badge className="bg-green-100 text-green-800 ml-2">{approvedReviews.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderKpiTable(approvedReviews, false)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Rejected
              {rejectedReviews.length > 0 && (
                <Badge variant="destructive" className="ml-2">{rejectedReviews.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderKpiTable(rejectedReviews, false)}
          </CardContent>
        </Card>

        {rejectingReviewId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <XCircle className="h-5 w-5 text-red-500" />
                Reject KPI
              </h3>
              <p className="text-sm text-muted-foreground mb-3">Please provide a reason for rejecting this KPI:</p>
              <Textarea
                placeholder="Enter reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[100px] mb-4"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setRejectingReviewId(null); setRejectionReason(""); }}
                  disabled={reviewMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRejectConfirm}
                  disabled={reviewMutation.isPending || !rejectionReason.trim()}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Confirm Rejection
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Target className="h-6 w-6" />
        KRAs/Goals Review
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{employeeSummaries.reduce((sum, e) => sum + e.submittedCount, 0)}</p>
              <p className="text-xs text-muted-foreground">Pending Review</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{employeeSummaries.reduce((sum, e) => sum + e.approvedCount, 0)}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{employeeSummaries.reduce((sum, e) => sum + e.rejectedCount, 0)}</p>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employees with Submitted KPIs</CardTitle>
        </CardHeader>
        <CardContent>
          {employeeSummaries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No employees have submitted KPIs for review</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee Code</TableHead>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Approved</TableHead>
                  <TableHead>Rejected</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeSummaries.map((emp) => (
                  <TableRow
                    key={emp.employeeId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedEmployee(emp.employeeId)}
                  >
                    <TableCell className="font-medium">{emp.employeeCode}</TableCell>
                    <TableCell>{emp.employeeName}</TableCell>
                    <TableCell>{emp.employeeEmail}</TableCell>
                    <TableCell>
                      {emp.submittedCount > 0 && (
                        <Badge className="bg-blue-100 text-blue-800">{emp.submittedCount}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {emp.approvedCount > 0 && (
                        <Badge className="bg-green-100 text-green-800">{emp.approvedCount}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {emp.rejectedCount > 0 && (
                        <Badge variant="destructive">{emp.rejectedCount}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{emp.totalCount}</TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
