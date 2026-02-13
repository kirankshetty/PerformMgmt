import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, Filter, Mail, ChevronDown, ChevronRight, Users, LayoutGrid, LayoutList, Download, FileDown } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import * as XLSX from "xlsx";

export default function ReviewAppraisal() {
  const { toast } = useToast();
  
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  
  const [filters, setFilters] = useState({
    appraisalGroup: "all",
    appraisalCycle: "all",
    frequencyCalendar: "all",
    frequencyCalendarDetails: "all",
    employee: "",
    location: "all",
    department: "all",
    level: "all",
    grade: "all",
    businessRole: "all",
    manager: "all",
  });

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Fetch initiated appraisals
  const { data: appraisals, isLoading } = useQuery({
    queryKey: ["/api/initiated-appraisals"],
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

  const { data: businessRoles = [] } = useQuery<any[]>({
    queryKey: ["/api/business-roles"],
  });

  const { data: managers } = useQuery({
    queryKey: ["/api/users?role=manager"],
  });

  // Fetch frequency calendars
  const { data: frequencyCalendars } = useQuery({
    queryKey: ["/api/frequency-calendars"],
  });

  // Fetch frequency calendar details
  const { data: frequencyCalendarDetails } = useQuery({
    queryKey: ["/api/frequency-calendar-details"],
  });

  // Send reminder mutation
  const sendReminderMutation = useMutation({
    mutationFn: async ({ employeeId, initiatedAppraisalId }: { employeeId: string; initiatedAppraisalId: string }) => {
      const response = await apiRequest("POST", "/api/send-reminder", { employeeId, initiatedAppraisalId });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "An error occurred" }));
        throw new Error(errorData.message || "Failed to send reminder");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Reminder Sent",
        description: `Reminder email sent to ${data.employeeName} (${data.employeeEmail})`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Send Reminder",
        description: error.message || "An error occurred while sending the reminder",
        variant: "destructive",
      });
    },
  });

  const toggleGroupExpansion = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const sendReminder = (employeeId: string, initiatedAppraisalId: string) => {
    sendReminderMutation.mutate({ employeeId, initiatedAppraisalId });
  };

  // Download evaluation mutation
  const downloadEvaluationMutation = useMutation({
    mutationFn: async ({ evaluationId, format }: { evaluationId: string; format: 'pdf' | 'docx' }) => {
      const response = await apiRequest("POST", "/api/evaluations/export", { evaluationId, format });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "An error occurred" }));
        throw new Error(errorData.message || "Failed to download evaluation");
      }
      
      return { response, format, evaluationId };
    },
    onSuccess: async (data) => {
      // Download the file
      const blob = await data.response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evaluation-${data.evaluationId}.${data.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download Successful",
        description: `Evaluation downloaded as ${data.format.toUpperCase()}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Download Failed",
        description: error.message || "An error occurred while downloading the evaluation",
        variant: "destructive",
      });
    },
  });

  const downloadEvaluation = (evaluationId: string, format: 'pdf' | 'docx') => {
    downloadEvaluationMutation.mutate({ evaluationId, format });
  };

  // Export to Excel function
  const exportToExcel = () => {
    try {
      // Prepare data for Excel export
      const excelData = filteredRows.map((row: any) => ({
        "Employee Name": row.employeeName,
        "Location": row.locationName,
        "Department": row.departmentName,
        "Manager": row.managerName,
        "Appraisal Group": row.appraisalGroupName,
        "Appraisal Type": row.appraisalType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        "Frequency Calendar": row.frequencyCalendarName,
        "Status": row.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        "Due Date": row.dueDate ? format(new Date(row.dueDate), 'MMM dd, yyyy') : 'N/A',
        "Member Rating": typeof row.memberRating === 'number' ? row.memberRating.toFixed(1) : 'N/A',
        "Final Manager Rating": typeof row.finalManagerRating === 'number' ? row.finalManagerRating.toFixed(1) : 'N/A',
      }));

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Appraisal Progress");

      // Set column widths for better readability
      const columnWidths = [
        { wch: 25 }, // Employee Name
        { wch: 20 }, // Location
        { wch: 20 }, // Department
        { wch: 25 }, // Manager
        { wch: 25 }, // Appraisal Group
        { wch: 20 }, // Appraisal Type
        { wch: 25 }, // Frequency Calendar
        { wch: 15 }, // Status
        { wch: 15 }, // Due Date
        { wch: 18 }, // Member Rating
        { wch: 22 }, // Final Manager Rating
      ];
      worksheet['!cols'] = columnWidths;

      // Generate filename with timestamp
      const timestamp = format(new Date(), 'yyyy-MM-dd_HHmmss');
      const filename = `Appraisal_Progress_${timestamp}.xlsx`;

      // Download the file
      XLSX.writeFile(workbook, filename);

      toast({
        title: "Export Successful",
        description: `Downloaded ${filteredRows.length} employee records to ${filename}`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "An error occurred while exporting to Excel",
        variant: "destructive",
      });
    }
  };

  // Create frequency calendar lookup map (for display names)
  const frequencyCalendarMap = useMemo(() => {
    if (!frequencyCalendars) return new Map();
    return new Map((frequencyCalendars as any[]).map(cal => [cal.id, `${cal.code} - ${cal.description}`]));
  }, [frequencyCalendars]);

  // Create frequency calendar to appraisal cycle lookup map (for filtering)
  const frequencyCalendarToCycleMap = useMemo(() => {
    if (!frequencyCalendars) return new Map();
    return new Map((frequencyCalendars as any[]).map(cal => [cal.id, cal.appraisalCycleId]));
  }, [frequencyCalendars]);

  // Create location lookup map
  const locationMap = useMemo(() => {
    if (!locations) return new Map();
    return new Map((locations as any[]).map(loc => [loc.id, loc.name]));
  }, [locations]);

  // Filter frequency calendar details based on selected frequency calendar
  const filteredFrequencyCalendarDetails = useMemo(() => {
    if (!frequencyCalendarDetails) return [];
    if (filters.frequencyCalendar === "all") {
      return frequencyCalendarDetails as any[];
    }
    return (frequencyCalendarDetails as any[]).filter(
      (detail: any) => detail.frequencyCalendarId === filters.frequencyCalendar
    );
  }, [frequencyCalendarDetails, filters.frequencyCalendar]);

  // Flatten appraisals data into rows for table view
  const flattenedRows = useMemo(() => {
    if (!appraisals) return [];
    
    const rows: any[] = [];
    (appraisals as any[]).forEach((appraisal: any) => {
      const employeeProgress = appraisal.progress?.employeeProgress || [];
      
      employeeProgress.forEach((empProgress: any) => {
        // Calculate due date if available
        let dueDate = null;
        if (appraisal.createdAt && appraisal.daysToClose) {
          const createdDate = new Date(appraisal.createdAt);
          dueDate = new Date(createdDate.getTime() + appraisal.daysToClose * 24 * 60 * 60 * 1000);
        }

        // Extract ratings from evaluation data
        const memberRating = empProgress.evaluation?.selfEvaluationData?.averageRating ?? null;
        const finalManagerRating = empProgress.evaluation?.overallRating ?? 
                                   empProgress.evaluation?.managerEvaluationData?.averageRating ?? null;

        // Get appraisal cycle ID from frequency calendar
        const appraisalCycleId = appraisal.frequencyCalendarId 
          ? frequencyCalendarToCycleMap.get(appraisal.frequencyCalendarId) || null
          : null;

        rows.push({
          employeeId: empProgress.employee.id,
          initiatedAppraisalId: appraisal.id,
          evaluationId: empProgress.evaluation?.id || null,
          employeeName: `${empProgress.employee.firstName} ${empProgress.employee.lastName}`,
          employeeFirstName: empProgress.employee.firstName,
          employeeLastName: empProgress.employee.lastName,
          departmentId: empProgress.employee.departmentId || null,
          departmentName: empProgress.employee.department || 'N/A',
          locationId: empProgress.employee.locationId,
          locationName: empProgress.employee.locationId 
            ? locationMap.get(empProgress.employee.locationId) || 'N/A'
            : 'N/A',
          levelId: empProgress.employee.levelId,
          gradeId: empProgress.employee.gradeId,
          businessRoleId: empProgress.employee.businessRoleId,
          managerId: empProgress.evaluation?.manager?.id || null,
          managerName: empProgress.evaluation?.manager 
            ? `${empProgress.evaluation.manager.firstName} ${empProgress.evaluation.manager.lastName}`
            : 'N/A',
          appraisalGroupId: appraisal.appraisalGroupId,
          appraisalGroupName: appraisal.appraisalGroup?.name || 'Unknown Group',
          appraisalType: appraisal.appraisalType,
          appraisalCycleId: appraisalCycleId,
          frequencyCalendarId: appraisal.frequencyCalendarId,
          frequencyCalendarName: appraisal.frequencyCalendarId 
            ? frequencyCalendarMap.get(appraisal.frequencyCalendarId) || 'N/A'
            : 'N/A',
          status: empProgress.status,
          dueDate: dueDate,
          appraisalStatus: appraisal.status,
          memberRating: memberRating,
          finalManagerRating: finalManagerRating,
        });
      });
    });
    
    return rows;
  }, [appraisals, frequencyCalendarMap, frequencyCalendarToCycleMap, locationMap]);

  // Apply filters to flattened rows
  const filteredRows = useMemo(() => {
    return flattenedRows.filter(row => {
      // Appraisal group filter
      if (filters.appraisalGroup !== "all" && row.appraisalGroupId !== filters.appraisalGroup) {
        return false;
      }

      // Appraisal cycle filter
      if (filters.appraisalCycle !== "all" && row.appraisalCycleId !== filters.appraisalCycle) {
        return false;
      }

      // Frequency calendar filter
      if (filters.frequencyCalendar !== "all" && row.frequencyCalendarId !== filters.frequencyCalendar) {
        return false;
      }

      // Frequency calendar details filter (placeholder for now)
      if (filters.frequencyCalendarDetails !== "all") {
        // This would filter by specific calendar detail/period if that data becomes available
        // For now, we'll keep this as a placeholder
      }

      // Employee name filter
      if (filters.employee && !row.employeeName.toLowerCase().includes(filters.employee.toLowerCase())) {
        return false;
      }

      // Location filter
      if (filters.location !== "all" && row.locationId !== filters.location) {
        return false;
      }

      // Department filter
      if (filters.department !== "all" && row.departmentId !== filters.department) {
        return false;
      }

      // Level filter
      if (filters.level !== "all" && row.levelId !== filters.level) {
        return false;
      }

      // Grade filter
      if (filters.grade !== "all" && row.gradeId !== filters.grade) {
        return false;
      }

      // Business Role filter
      if (filters.businessRole !== "all" && row.businessRoleId !== filters.businessRole) {
        return false;
      }

      // Manager filter
      if (filters.manager !== "all" && row.managerId !== filters.manager) {
        return false;
      }

      return true;
    });
  }, [flattenedRows, filters]);

  // Filter appraisals for card view based on filtered rows
  const filteredAppraisals = useMemo(() => {
    if (!appraisals) return [];
    
    // Build a map for O(1) membership checks: appraisalId -> Set<employeeId>
    const filteredEmployeesByAppraisal = new Map<string, Set<string>>();
    filteredRows.forEach(row => {
      if (!filteredEmployeesByAppraisal.has(row.initiatedAppraisalId)) {
        filteredEmployeesByAppraisal.set(row.initiatedAppraisalId, new Set());
      }
      filteredEmployeesByAppraisal.get(row.initiatedAppraisalId)!.add(row.employeeId);
    });
    
    return (appraisals as any[]).map((appraisal: any) => {
      // Only include this appraisal if it has matching rows
      const employeeSet = filteredEmployeesByAppraisal.get(appraisal.id);
      if (!employeeSet) {
        return null;
      }

      // Filter the employee progress to only show matching employees using O(1) lookup
      const filteredEmployeeProgress = (appraisal.progress?.employeeProgress || []).filter((empProgress: any) => {
        return employeeSet.has(empProgress.employee.id);
      });

      return {
        ...appraisal,
        progress: {
          ...appraisal.progress,
          employeeProgress: filteredEmployeeProgress,
          totalEmployees: filteredEmployeeProgress.length,
          completedEvaluations: filteredEmployeeProgress.filter((emp: any) => emp.status === 'completed').length,
          percentage: filteredEmployeeProgress.length > 0 
            ? Math.round((filteredEmployeeProgress.filter((emp: any) => emp.status === 'completed').length / filteredEmployeeProgress.length) * 100)
            : 0,
        },
      };
    }).filter(appraisal => appraisal !== null);
  }, [appraisals, filteredRows]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6" data-testid="review-appraisal-page">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Review Appraisal Progress</h1>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6" data-testid="review-appraisal-page">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold" data-testid="page-title">Review Appraisal Progress</h1>
        <div className="flex items-center gap-3">
          <Button 
            onClick={exportToExcel}
            variant="outline"
            disabled={!filteredRows || filteredRows.length === 0}
            data-testid="button-export-excel"
          >
            <Download className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "card" | "table")} data-testid="view-mode-tabs">
            <TabsList>
              <TabsTrigger value="card" data-testid="tab-card">
                <LayoutGrid className="h-4 w-4 mr-2" />
                Card View
              </TabsTrigger>
              <TabsTrigger value="table" data-testid="tab-table">
                <LayoutList className="h-4 w-4 mr-2" />
                Table View
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Filters Section */}
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
                  {(appraisalGroups || [])?.map((group: any) => (
                    <SelectItem key={group.id} value={group.id} data-testid={`group-option-${group.id}`}>
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
                  {(appraisalCycles || [])?.map((cycle: any) => (
                    <SelectItem key={cycle.id} value={cycle.id} data-testid={`cycle-option-${cycle.id}`}>
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
                  {(frequencyCalendars || [])?.map((calendar: any) => (
                    <SelectItem key={calendar.id} value={calendar.id} data-testid={`calendar-option-${calendar.id}`}>
                      {calendar.code} - {calendar.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency-calendar-details" data-testid="label-frequency-calendar-details">Frequency Calendar Details</Label>
              <Select
                value={filters.frequencyCalendarDetails}
                onValueChange={(value) => setFilters({ ...filters, frequencyCalendarDetails: value })}
              >
                <SelectTrigger id="frequency-calendar-details" data-testid="select-frequency-calendar-details">
                  <SelectValue placeholder="Select details" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Details</SelectItem>
                  {filteredFrequencyCalendarDetails.map((detail: any) => (
                    <SelectItem key={detail.id} value={detail.id} data-testid={`calendar-detail-option-${detail.id}`}>
                      {detail.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee-search" data-testid="label-employee-search">Employee</Label>
              <Input
                id="employee-search"
                placeholder="Search by employee name"
                value={filters.employee}
                onChange={(e) => setFilters({ ...filters, employee: e.target.value })}
                data-testid="input-employee-search"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location-filter" data-testid="label-location">Location</Label>
              <Select
                value={filters.location}
                onValueChange={(value) => setFilters({ ...filters, location: value })}
              >
                <SelectTrigger id="location-filter" data-testid="select-location">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {(locations || [])?.map((location: any) => (
                    <SelectItem key={location.id} value={location.id} data-testid={`location-option-${location.id}`}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department-filter" data-testid="label-department">Department</Label>
              <Select
                value={filters.department}
                onValueChange={(value) => setFilters({ ...filters, department: value })}
              >
                <SelectTrigger id="department-filter" data-testid="select-department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {(departments || [])?.map((dept: any) => (
                    <SelectItem key={dept.id} value={dept.id} data-testid={`department-option-${dept.id}`}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="level-filter" data-testid="label-level">Level</Label>
              <Select
                value={filters.level}
                onValueChange={(value) => setFilters({ ...filters, level: value })}
              >
                <SelectTrigger id="level-filter" data-testid="select-level">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {(levels || [])?.map((level: any) => (
                    <SelectItem key={level.id} value={level.id} data-testid={`level-option-${level.id}`}>
                      {level.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="grade-filter" data-testid="label-grade">Grade</Label>
              <Select
                value={filters.grade}
                onValueChange={(value) => setFilters({ ...filters, grade: value })}
              >
                <SelectTrigger id="grade-filter" data-testid="select-grade">
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {(grades || [])?.map((grade: any) => (
                    <SelectItem key={grade.id} value={grade.id} data-testid={`grade-option-${grade.id}`}>
                      {grade.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-role-filter" data-testid="label-business-role">Business Role</Label>
              <Select
                value={filters.businessRole}
                onValueChange={(value) => setFilters({ ...filters, businessRole: value })}
              >
                <SelectTrigger id="business-role-filter" data-testid="select-business-role">
                  <SelectValue placeholder="Select business role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Business Roles</SelectItem>
                  {businessRoles.map((role: any) => (
                    <SelectItem key={role.id} value={role.id} data-testid={`business-role-option-${role.id}`}>
                      {role.code} - {role.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manager-filter" data-testid="label-manager">Manager</Label>
              <Select
                value={filters.manager}
                onValueChange={(value) => setFilters({ ...filters, manager: value })}
              >
                <SelectTrigger id="manager-filter" data-testid="select-manager">
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Managers</SelectItem>
                  {(managers || [])?.map((manager: any) => (
                    <SelectItem key={manager.id} value={manager.id} data-testid={`manager-option-${manager.id}`}>
                      {manager.firstName} {manager.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => setFilters({
                  appraisalGroup: "all",
                  appraisalCycle: "all",
                  frequencyCalendar: "all",
                  frequencyCalendarDetails: "all",
                  employee: "",
                  location: "all",
                  department: "all",
                  level: "all",
                  grade: "all",
                  businessRole: "all",
                  manager: "all",
                })}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appraisal Progress Summary */}
      <Card data-testid="progress-summary-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Appraisal Progress Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!appraisals || (appraisals as any[])?.length === 0 ? (
            <div className="text-center py-8" data-testid="no-appraisals-message">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Appraisals Found</h3>
              <p className="text-muted-foreground">
                No initiated appraisals match your current filters. Try adjusting your filter criteria.
              </p>
            </div>
          ) : viewMode === "table" ? (
            /* Table View */
            <div className="overflow-x-auto" data-testid="table-view">
              {filteredRows.length === 0 ? (
                <div className="text-center py-8" data-testid="no-filtered-results-message">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
                  <p className="text-muted-foreground">
                    No employees match your current filters. Try adjusting your filter criteria.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead>Appraisal Group</TableHead>
                      <TableHead>Appraisal Type</TableHead>
                      <TableHead>Frequency Calendar</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row: any, index: number) => (
                      <TableRow key={`${row.employeeId}-${row.initiatedAppraisalId}`} data-testid={`table-row-${index}`}>
                        <TableCell data-testid={`table-employee-name-${index}`}>
                          {row.employeeName}
                        </TableCell>
                        <TableCell data-testid={`table-location-${index}`}>
                          {row.locationName}
                        </TableCell>
                        <TableCell data-testid={`table-department-${index}`}>
                          {row.departmentName}
                        </TableCell>
                        <TableCell data-testid={`table-manager-${index}`}>
                          {row.managerName}
                        </TableCell>
                        <TableCell data-testid={`table-appraisal-group-${index}`}>
                          {row.appraisalGroupName}
                        </TableCell>
                        <TableCell data-testid={`table-appraisal-type-${index}`}>
                          {row.appraisalType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </TableCell>
                        <TableCell data-testid={`table-frequency-calendar-${index}`}>
                          {row.frequencyCalendarName}
                        </TableCell>
                        <TableCell data-testid={`table-status-${index}`}>
                          <Badge
                            variant={
                              row.status === 'completed' ? 'default' :
                              row.status === 'in_progress' ? 'secondary' :
                              row.status === 'overdue' ? 'destructive' : 'outline'
                            }
                          >
                            {row.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`table-due-date-${index}`}>
                          {row.dueDate ? format(new Date(row.dueDate), 'MMM dd, yyyy') : 'N/A'}
                        </TableCell>
                        <TableCell data-testid={`table-actions-${index}`}>
                          <div className="flex gap-2">
                            {row.status !== 'completed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => sendReminder(row.employeeId, row.initiatedAppraisalId)}
                                data-testid={`table-button-send-reminder-${index}`}
                                disabled={sendReminderMutation.isPending}
                              >
                                <Mail className="h-4 w-4 mr-1" />
                                Send Reminder
                              </Button>
                            )}
                            {row.status === 'completed' && row.evaluationId && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => downloadEvaluation(row.evaluationId, 'pdf')}
                                  data-testid={`table-button-download-pdf-${index}`}
                                  disabled={downloadEvaluationMutation.isPending}
                                >
                                  <FileDown className="h-4 w-4 mr-1" />
                                  PDF
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => downloadEvaluation(row.evaluationId, 'docx')}
                                  data-testid={`table-button-download-docx-${index}`}
                                  disabled={downloadEvaluationMutation.isPending}
                                >
                                  <FileDown className="h-4 w-4 mr-1" />
                                  DOCX
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ) : (
            /* Card View */
            <div className="space-y-4" data-testid="card-view">
              {filteredAppraisals.length === 0 ? (
                <div className="text-center py-8" data-testid="no-filtered-results-message">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
                  <p className="text-muted-foreground">
                    No appraisals match your current filters. Try adjusting your filter criteria.
                  </p>
                </div>
              ) : (
                filteredAppraisals.map((appraisal: any) => (
                <Card key={appraisal.id} className="border-l-4 border-l-primary" data-testid={`appraisal-card-${appraisal.id}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleGroupExpansion(appraisal.id)}
                          data-testid={`expand-button-${appraisal.id}`}
                        >
                          {expandedGroups.has(appraisal.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        <div>
                          <h4 className="font-semibold" data-testid={`appraisal-title-${appraisal.id}`}>
                            {appraisal.appraisalGroup?.name || "Unknown Group"}
                          </h4>
                          <p className="text-sm text-muted-foreground" data-testid={`appraisal-type-${appraisal.id}`}>
                            {appraisal.appraisalType} • Status: {appraisal.status}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Progress</div>
                          <div className="font-semibold" data-testid={`progress-text-${appraisal.id}`}>
                            {appraisal.progress?.completedEvaluations || 0}/{appraisal.progress?.totalEmployees || 0} ({appraisal.progress?.percentage || 0}%)
                          </div>
                        </div>
                        <Progress value={appraisal.progress?.percentage || 0} className="w-32" data-testid={`progress-bar-${appraisal.id}`} />
                        <Badge variant="outline" data-testid={`status-badge-${appraisal.id}`}>
                          {appraisal.status}
                        </Badge>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {expandedGroups.has(appraisal.id) && (
                      <div className="mt-4 pt-4 border-t border-border" data-testid={`expanded-content-${appraisal.id}`}>
                        <div className="mb-4">
                          <h5 className="font-semibold mb-2">Employee Progress</h5>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Employee</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead>Manager</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {appraisal.progress?.employeeProgress?.length > 0 ? (
                                appraisal.progress.employeeProgress.map((employeeProgress: any, index: number) => (
                                  <TableRow key={employeeProgress.employee.id} data-testid={`employee-row-${appraisal.id}-${employeeProgress.employee.id}`}>
                                    <TableCell data-testid={`employee-name-${employeeProgress.employee.id}`}>
                                      {employeeProgress.employee.firstName} {employeeProgress.employee.lastName}
                                    </TableCell>
                                    <TableCell data-testid={`employee-location-${employeeProgress.employee.id}`}>
                                      {employeeProgress.employee.locationId 
                                        ? locationMap.get(employeeProgress.employee.locationId) || 'N/A'
                                        : 'N/A'}
                                    </TableCell>
                                    <TableCell data-testid={`employee-department-${employeeProgress.employee.id}`}>
                                      {employeeProgress.employee.department || 'N/A'}
                                    </TableCell>
                                    <TableCell data-testid={`employee-manager-${employeeProgress.employee.id}`}>
                                      {employeeProgress.evaluation?.manager 
                                        ? `${employeeProgress.evaluation.manager.firstName} ${employeeProgress.evaluation.manager.lastName}`
                                        : 'N/A'}
                                    </TableCell>
                                    <TableCell data-testid={`employee-status-${employeeProgress.employee.id}`}>
                                      <Badge
                                        variant={
                                          employeeProgress.status === 'completed' ? 'default' :
                                          employeeProgress.status === 'in_progress' ? 'secondary' :
                                          employeeProgress.status === 'overdue' ? 'destructive' : 'outline'
                                        }
                                      >
                                        {employeeProgress.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                      </Badge>
                                    </TableCell>
                                    <TableCell data-testid={`employee-actions-${employeeProgress.employee.id}`}>
                                      <div className="flex gap-2">
                                        {employeeProgress.status !== 'completed' && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => sendReminder(employeeProgress.employee.id, appraisal.id)}
                                            data-testid={`button-send-reminder-${employeeProgress.employee.id}`}
                                            disabled={sendReminderMutation.isPending}
                                          >
                                            <Mail className="h-4 w-4 mr-1" />
                                            Send Reminder
                                          </Button>
                                        )}
                                        {employeeProgress.status === 'completed' && employeeProgress.evaluation?.id && (
                                          <>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => downloadEvaluation(employeeProgress.evaluation.id, 'pdf')}
                                              data-testid={`button-download-pdf-${employeeProgress.employee.id}`}
                                              disabled={downloadEvaluationMutation.isPending}
                                            >
                                              <FileDown className="h-4 w-4 mr-1" />
                                              PDF
                                            </Button>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => downloadEvaluation(employeeProgress.evaluation.id, 'docx')}
                                              data-testid={`button-download-docx-${employeeProgress.employee.id}`}
                                              disabled={downloadEvaluationMutation.isPending}
                                            >
                                              <FileDown className="h-4 w-4 mr-1" />
                                              DOCX
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))
                              ) : (
                                <TableRow data-testid={`employee-row-placeholder-${appraisal.id}`}>
                                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                                    No employee progress data available
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}