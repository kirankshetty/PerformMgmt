import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Filter, LayoutGrid, LayoutList, Edit, Save, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function CalibrateRatings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [editingEvaluation, setEditingEvaluation] = useState<any>(null);
  const [calibratedRating, setCalibratedRating] = useState<number | null>(null);
  const [calibrationRemarks, setCalibrationRemarks] = useState("");
  
  const [filters, setFilters] = useState({
    appraisalGroup: "all",
    appraisalCycle: "all",
    frequencyCalendar: "all",
    frequencyCalendarDetails: "all",
    employeeSearch: "",
    location: "all",
    department: "all",
    level: "all",
    grade: "all",
    manager: "all",
  });

  // Fetch evaluations with ratings
  const { data: evaluations, isLoading } = useQuery({
    queryKey: ["/api/evaluations/calibrate"],
  });

  // Fetch filter options
  const { data: appraisalGroups } = useQuery({
    queryKey: ["/api/appraisal-groups"],
  });

  const { data: appraisalCycles } = useQuery({
    queryKey: ["/api/appraisal-cycles"],
  });

  const { data: locations } = useQuery({
    queryKey: ["/api/locations"],
  });

  const { data: departments } = useQuery({
    queryKey: ["/api/departments"],
  });

  const { data: levels } = useQuery({
    queryKey: ["/api/levels"],
  });

  const { data: grades } = useQuery({
    queryKey: ["/api/grades"],
  });

  const { data: managers } = useQuery({
    queryKey: ["/api/users?role=manager"],
  });

  const { data: frequencyCalendars } = useQuery({
    queryKey: ["/api/frequency-calendars"],
  });

  const { data: frequencyCalendarDetails } = useQuery({
    queryKey: ["/api/frequency-calendar-details"],
  });

  // Filter frequency calendar details based on selected calendar
  const filteredCalendarDetails = useMemo(() => {
    if (!frequencyCalendarDetails || filters.frequencyCalendar === "all") {
      return (frequencyCalendarDetails as any[]) || [];
    }
    return (frequencyCalendarDetails as any[]).filter(
      (detail: any) => detail.frequencyCalendarId === filters.frequencyCalendar
    );
  }, [frequencyCalendarDetails, filters.frequencyCalendar]);

  // Update calibration mutation
  const updateCalibrationMutation = useMutation({
    mutationFn: async ({ evaluationId, calibratedRating, calibrationRemarks }: { 
      evaluationId: string; 
      calibratedRating: number | null; 
      calibrationRemarks: string;
    }) => {
      const response = await apiRequest("PATCH", `/api/evaluations/${evaluationId}/calibrate`, {
        calibratedRating,
        calibrationRemarks,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "An error occurred" }));
        throw new Error(errorData.message || "Failed to update calibration");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluations/calibrate"] });
      setEditingEvaluation(null);
      setCalibratedRating(null);
      setCalibrationRemarks("");
      toast({
        title: "Calibration Updated",
        description: `Successfully updated rating for ${data.employeeName}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message || "An error occurred while updating the calibration",
        variant: "destructive",
      });
    },
  });

  const handleEditCalibration = (evaluation: any) => {
    setEditingEvaluation(evaluation);
    setCalibratedRating(evaluation.calibratedRating ?? evaluation.overallRating ?? null);
    setCalibrationRemarks(evaluation.calibrationRemarks || "");
  };

  const handleSaveCalibration = () => {
    if (!editingEvaluation) return;
    
    updateCalibrationMutation.mutate({
      evaluationId: editingEvaluation.id,
      calibratedRating,
      calibrationRemarks,
    });
  };

  // Filter evaluations
  const filteredEvaluations = useMemo(() => {
    if (!evaluations) return [];
    
    return (evaluations as any[]).filter((evaluation: any) => {
      // Appraisal group filter
      if (filters.appraisalGroup !== "all" && evaluation.appraisalGroupId !== filters.appraisalGroup) {
        return false;
      }

      // Appraisal cycle filter
      if (filters.appraisalCycle !== "all" && evaluation.appraisalCycleId !== filters.appraisalCycle) {
        return false;
      }

      // Frequency calendar filter
      if (filters.frequencyCalendar !== "all" && evaluation.frequencyCalendarId !== filters.frequencyCalendar) {
        return false;
      }

      // Frequency calendar details filter
      if (filters.frequencyCalendarDetails !== "all" && evaluation.frequencyCalendarDetailId !== filters.frequencyCalendarDetails) {
        return false;
      }

      // Employee search filter (code or name)
      if (filters.employeeSearch) {
        const searchLower = filters.employeeSearch.toLowerCase();
        const matchesName = evaluation.employeeName?.toLowerCase().includes(searchLower);
        const matchesCode = evaluation.employeeCode?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesCode) {
          return false;
        }
      }

      // Location filter
      if (filters.location !== "all" && evaluation.locationId !== filters.location) {
        return false;
      }

      // Department filter
      if (filters.department !== "all" && evaluation.departmentId !== filters.department) {
        return false;
      }

      // Level filter
      if (filters.level !== "all" && evaluation.levelId !== filters.level) {
        return false;
      }

      // Grade filter
      if (filters.grade !== "all" && evaluation.gradeId !== filters.grade) {
        return false;
      }

      // Manager filter
      if (filters.manager !== "all" && evaluation.managerId !== filters.manager) {
        return false;
      }

      return true;
    });
  }, [evaluations, filters]);

  const getRatingBadgeColor = (rating: number | null | undefined) => {
    if (rating === null || rating === undefined) return "secondary";
    if (rating >= 4) return "default";
    if (rating >= 3) return "secondary";
    return "destructive";
  };

  const getRatingLabel = (rating: number | null | undefined) => {
    if (rating === null || rating === undefined) return "Not Rated";
    return `Rating: ${rating.toFixed(1)}`;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">Calibrate Ratings</h1>
          <p className="text-muted-foreground">Review and adjust final employee ratings</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "card" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("card")}
            data-testid="view-card"
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Card View
          </Button>
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("table")}
            data-testid="view-table"
          >
            <LayoutList className="h-4 w-4 mr-2" />
            Table View
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card data-testid="filters-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appraisal-group" data-testid="label-appraisal-group">Appraisal Group</Label>
              <Select
                value={filters.appraisalGroup}
                onValueChange={(value) => setFilters({ ...filters, appraisalGroup: value })}
              >
                <SelectTrigger id="appraisal-group" data-testid="select-appraisal-group">
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {((appraisalGroups as any[]) || [])?.map((group: any) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="appraisal-cycle" data-testid="label-appraisal-cycle">Appraisal Cycle</Label>
              <Select
                value={filters.appraisalCycle}
                onValueChange={(value) => setFilters({ ...filters, appraisalCycle: value })}
              >
                <SelectTrigger id="appraisal-cycle" data-testid="select-appraisal-cycle">
                  <SelectValue placeholder="Select cycle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cycles</SelectItem>
                  {((appraisalCycles as any[]) || [])?.map((cycle: any) => (
                    <SelectItem key={cycle.id} value={cycle.id}>
                      {cycle.code} - {cycle.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency-calendar" data-testid="label-frequency-calendar">Frequency Calendar</Label>
              <Select
                value={filters.frequencyCalendar}
                onValueChange={(value) => setFilters({ ...filters, frequencyCalendar: value, frequencyCalendarDetails: "all" })}
              >
                <SelectTrigger id="frequency-calendar" data-testid="select-frequency-calendar">
                  <SelectValue placeholder="Select calendar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Calendars</SelectItem>
                  {((frequencyCalendars as any[]) || [])?.map((calendar: any) => (
                    <SelectItem key={calendar.id} value={calendar.id}>
                      {calendar.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency-calendar-details" data-testid="label-frequency-calendar-details">Calendar Details</Label>
              <Select
                value={filters.frequencyCalendarDetails}
                onValueChange={(value) => setFilters({ ...filters, frequencyCalendarDetails: value })}
              >
                <SelectTrigger id="frequency-calendar-details" data-testid="select-frequency-calendar-details">
                  <SelectValue placeholder="Select details" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Details</SelectItem>
                  {filteredCalendarDetails.map((detail: any) => (
                    <SelectItem key={detail.id} value={detail.id}>
                      {detail.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee-search" data-testid="label-employee-search">Employee Code/Name</Label>
              <Input
                id="employee-search"
                placeholder="Search by code or name..."
                value={filters.employeeSearch}
                onChange={(e) => setFilters({ ...filters, employeeSearch: e.target.value })}
                data-testid="input-employee-search"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" data-testid="label-location">Location</Label>
              <Select
                value={filters.location}
                onValueChange={(value) => setFilters({ ...filters, location: value })}
              >
                <SelectTrigger id="location" data-testid="select-location">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {((locations as any[]) || [])?.map((location: any) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department" data-testid="label-department">Department</Label>
              <Select
                value={filters.department}
                onValueChange={(value) => setFilters({ ...filters, department: value })}
              >
                <SelectTrigger id="department" data-testid="select-department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {((departments as any[]) || [])?.map((dept: any) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="level" data-testid="label-level">Level</Label>
              <Select
                value={filters.level}
                onValueChange={(value) => setFilters({ ...filters, level: value })}
              >
                <SelectTrigger id="level" data-testid="select-level">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {((levels as any[]) || [])?.map((level: any) => (
                    <SelectItem key={level.id} value={level.id}>
                      {level.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="grade" data-testid="label-grade">Grade</Label>
              <Select
                value={filters.grade}
                onValueChange={(value) => setFilters({ ...filters, grade: value })}
              >
                <SelectTrigger id="grade" data-testid="select-grade">
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {((grades as any[]) || [])?.map((grade: any) => (
                    <SelectItem key={grade.id} value={grade.id}>
                      {grade.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manager" data-testid="label-manager">Manager</Label>
              <Select
                value={filters.manager}
                onValueChange={(value) => setFilters({ ...filters, manager: value })}
              >
                <SelectTrigger id="manager" data-testid="select-manager">
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Managers</SelectItem>
                  {((managers as any[]) || [])?.map((manager: any) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : filteredEvaluations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground" data-testid="no-evaluations-message">No evaluations found with the selected filters.</p>
          </CardContent>
        </Card>
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvaluations.map((evaluation: any) => (
            <Card key={evaluation.id} data-testid={`evaluation-card-${evaluation.id}`}>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg" data-testid={`employee-name-${evaluation.id}`}>
                      {evaluation.employeeName}
                    </h3>
                    <p className="text-sm text-muted-foreground" data-testid={`employee-code-${evaluation.id}`}>Code: {evaluation.employeeCode}</p>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location:</span>
                      <span data-testid={`location-${evaluation.id}`}>{evaluation.locationName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Department:</span>
                      <span data-testid={`department-${evaluation.id}`}>{evaluation.departmentName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Manager:</span>
                      <span data-testid={`manager-${evaluation.id}`}>{evaluation.managerName}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Manager Rating:</span>
                      <Badge variant={getRatingBadgeColor(evaluation.overallRating)} data-testid={`manager-rating-${evaluation.id}`}>
                        {getRatingLabel(evaluation.overallRating)}
                      </Badge>
                    </div>
                    {evaluation.calibratedRating !== null && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Calibrated Rating:</span>
                        <Badge variant={getRatingBadgeColor(evaluation.calibratedRating)} data-testid={`calibrated-rating-${evaluation.id}`}>
                          {getRatingLabel(evaluation.calibratedRating)}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => handleEditCalibration(evaluation)}
                    data-testid={`edit-calibration-${evaluation.id}`}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    {evaluation.calibratedRating !== null ? "Edit Calibration" : "Calibrate Rating"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead data-testid="table-header-employee">Employee</TableHead>
                  <TableHead data-testid="table-header-code">Code</TableHead>
                  <TableHead data-testid="table-header-location">Location</TableHead>
                  <TableHead data-testid="table-header-department">Department</TableHead>
                  <TableHead data-testid="table-header-manager">Manager</TableHead>
                  <TableHead data-testid="table-header-manager-rating">Manager Rating</TableHead>
                  <TableHead data-testid="table-header-calibrated-rating">Calibrated Rating</TableHead>
                  <TableHead data-testid="table-header-actions">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvaluations.map((evaluation: any) => (
                  <TableRow key={evaluation.id} data-testid={`evaluation-row-${evaluation.id}`}>
                    <TableCell className="font-medium" data-testid={`table-employee-name-${evaluation.id}`}>{evaluation.employeeName}</TableCell>
                    <TableCell data-testid={`table-employee-code-${evaluation.id}`}>{evaluation.employeeCode}</TableCell>
                    <TableCell data-testid={`table-location-${evaluation.id}`}>{evaluation.locationName}</TableCell>
                    <TableCell data-testid={`table-department-${evaluation.id}`}>{evaluation.departmentName}</TableCell>
                    <TableCell data-testid={`table-manager-${evaluation.id}`}>{evaluation.managerName}</TableCell>
                    <TableCell data-testid={`table-manager-rating-${evaluation.id}`}>
                      <Badge variant={getRatingBadgeColor(evaluation.overallRating)}>
                        {getRatingLabel(evaluation.overallRating)}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`table-calibrated-rating-${evaluation.id}`}>
                      {evaluation.calibratedRating !== null ? (
                        <Badge variant={getRatingBadgeColor(evaluation.calibratedRating)}>
                          {getRatingLabel(evaluation.calibratedRating)}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditCalibration(evaluation)}
                        data-testid={`edit-calibration-${evaluation.id}`}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        {evaluation.calibratedRating !== null ? "Edit" : "Calibrate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit Calibration Dialog */}
      <Dialog open={!!editingEvaluation} onOpenChange={(open) => !open && setEditingEvaluation(null)}>
        <DialogContent data-testid="calibration-dialog">
          <DialogHeader>
            <DialogTitle>Calibrate Rating</DialogTitle>
            <DialogDescription>
              Adjust the final rating for {editingEvaluation?.employeeName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Manager's Rating</Label>
              <div className="p-3 bg-muted rounded-md">
                <Badge variant={getRatingBadgeColor(editingEvaluation?.overallRating)}>
                  {getRatingLabel(editingEvaluation?.overallRating)}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calibrated-rating">Calibrated Rating*</Label>
              <Select
                value={calibratedRating?.toString() || ""}
                onValueChange={(value) => setCalibratedRating(value ? Number(value) : null)}
              >
                <SelectTrigger id="calibrated-rating" data-testid="select-calibrated-rating">
                  <SelectValue placeholder="Select rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1.0 - Poor</SelectItem>
                  <SelectItem value="2">2.0 - Below Average</SelectItem>
                  <SelectItem value="3">3.0 - Average</SelectItem>
                  <SelectItem value="4">4.0 - Good</SelectItem>
                  <SelectItem value="5">5.0 - Excellent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calibration-remarks">Remarks (Optional)</Label>
              <Textarea
                id="calibration-remarks"
                placeholder="Add any remarks about the calibration..."
                value={calibrationRemarks}
                onChange={(e) => setCalibrationRemarks(e.target.value)}
                rows={4}
                data-testid="textarea-calibration-remarks"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingEvaluation(null)}
                data-testid="button-cancel"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSaveCalibration}
                disabled={updateCalibrationMutation.isPending || calibratedRating === null}
                data-testid="button-save"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateCalibrationMutation.isPending ? "Saving..." : "Save Calibration"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
