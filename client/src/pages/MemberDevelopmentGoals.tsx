import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from "@/hooks/useAuth";
import { RoleGuard } from "@/components/RoleGuard";
import { format } from "date-fns";
import { 
  Target, 
  Search,
  Calendar,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Clock,
  Flag,
  User,
  Filter,
  Users
} from "lucide-react";
import type { DevelopmentGoal } from "@shared/schema";

interface GoalWithDetails extends DevelopmentGoal {
  employee?: {
    id: string;
    code: string;
    firstName: string;
    lastName: string;
    email: string;
    department: string | null;
    designation: string | null;
    locationId: string | null;
    levelId: string | null;
    gradeId: string | null;
    managerId: string | null;
  } | null;
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
  appraisalGroup?: {
    id: string;
    name: string;
  } | null;
  frequencyCalendarPeriod?: {
    displayName: string;
    startDate: string;
    endDate: string;
  } | null;
}

interface FilterState {
  appraisalCycle: string;
  appraisalGroup: string;
  employeeSearch: string;
  location: string;
  department: string;
  level: string;
  grade: string;
  businessRole: string;
  manager: string;
}

export default function MemberDevelopmentGoals() {
  const [filters, setFilters] = useState<FilterState>({
    appraisalCycle: "all",
    appraisalGroup: "all",
    employeeSearch: "",
    location: "all",
    department: "all",
    level: "all",
    grade: "all",
    businessRole: "all",
    manager: "all",
  });
  const [searchApplied, setSearchApplied] = useState(false);

  const { user } = useAuth();

  const { data: goals = [], isLoading: isLoadingGoals } = useQuery<GoalWithDetails[]>({
    queryKey: ["/api/development-goals/team"],
  });

  const { data: appraisalCycles = [] } = useQuery<any[]>({
    queryKey: ["/api/appraisal-cycles"],
  });

  const { data: appraisalGroups = [] } = useQuery<any[]>({
    queryKey: ["/api/appraisal-groups"],
  });

  const { data: locations = [] } = useQuery<any[]>({
    queryKey: ["/api/locations"],
  });

  const { data: departments = [] } = useQuery<any[]>({
    queryKey: ["/api/departments"],
  });

  const { data: levels = [] } = useQuery<any[]>({
    queryKey: ["/api/levels"],
  });

  const { data: grades = [] } = useQuery<any[]>({
    queryKey: ["/api/grades"],
  });

  const { data: businessRoles = [] } = useQuery<any[]>({
    queryKey: ["/api/business-roles"],
  });

  const { data: managers = [] } = useQuery<any[]>({
    queryKey: ["/api/users", { role: "manager" }],
  });

  const filteredGoals = useMemo(() => {
    if (!searchApplied) return [];
    
    return goals.filter((goal) => {
      if (filters.appraisalCycle !== "all" && goal.appraisalCycle?.id !== filters.appraisalCycle) {
        return false;
      }
      
      if (filters.appraisalGroup !== "all" && goal.appraisalGroup?.id !== filters.appraisalGroup) {
        return false;
      }
      
      if (filters.employeeSearch) {
        const searchLower = filters.employeeSearch.toLowerCase();
        const matchesName = `${goal.employee?.firstName} ${goal.employee?.lastName}`.toLowerCase().includes(searchLower);
        const matchesCode = goal.employee?.code?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesCode) {
          return false;
        }
      }
      
      if (filters.location !== "all" && goal.employee?.locationId !== filters.location) {
        return false;
      }
      
      if (filters.department !== "all" && goal.employee?.department !== filters.department) {
        return false;
      }
      
      if (filters.level !== "all" && goal.employee?.levelId !== filters.level) {
        return false;
      }
      
      if (filters.grade !== "all" && goal.employee?.gradeId !== filters.grade) {
        return false;
      }
      
      if (filters.businessRole !== "all" && (goal.employee as any)?.businessRoleId !== filters.businessRole) {
        return false;
      }
      
      if (filters.manager !== "all" && goal.employee?.managerId !== filters.manager) {
        return false;
      }
      
      return true;
    });
  }, [goals, filters, searchApplied]);

  const groupedGoals = useMemo(() => {
    const grouped: Record<string, GoalWithDetails[]> = {};
    
    filteredGoals.forEach((goal) => {
      const employeeId = goal.employee?.id || 'unknown';
      if (!grouped[employeeId]) {
        grouped[employeeId] = [];
      }
      grouped[employeeId].push(goal);
    });
    
    return grouped;
  }, [filteredGoals]);

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'on_track':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"><TrendingUp className="h-3 w-3 mr-1" />On Track</Badge>;
      case 'delayed':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"><AlertCircle className="h-3 w-3 mr-1" />Delayed</Badge>;
      case 'not_started':
      default:
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"><Clock className="h-3 w-3 mr-1" />Not Started</Badge>;
    }
  };

  const handleSearch = () => {
    setSearchApplied(true);
  };

  const handleClearFilters = () => {
    setFilters({
      appraisalCycle: "all",
      appraisalGroup: "all",
      employeeSearch: "",
      location: "all",
      department: "all",
      level: "all",
      grade: "all",
      businessRole: "all",
      manager: "all",
    });
    setSearchApplied(false);
  };

  const uniqueDepartments = useMemo(() => {
    const depts = new Set<string>();
    goals.forEach(goal => {
      if (goal.employee?.department) {
        depts.add(goal.employee.department);
      }
    });
    return Array.from(depts).sort();
  }, [goals]);

  return (
    <RoleGuard allowedRoles={["manager"]}>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2" data-testid="page-title">
              <Users className="h-8 w-8 text-primary" />
              Member Development Goals
            </h1>
            <p className="text-muted-foreground mt-1">
              View and track development goals of your team members
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Appraisal Cycle</label>
                <Select
                  value={filters.appraisalCycle}
                  onValueChange={(value) => setFilters({ ...filters, appraisalCycle: value })}
                >
                  <SelectTrigger data-testid="filter-appraisal-cycle">
                    <SelectValue placeholder="All Cycles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cycles</SelectItem>
                    {appraisalCycles.map((cycle: any) => (
                      <SelectItem key={cycle.id} value={cycle.id}>
                        {cycle.code} - {cycle.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Appraisal Group</label>
                <Select
                  value={filters.appraisalGroup}
                  onValueChange={(value) => setFilters({ ...filters, appraisalGroup: value })}
                >
                  <SelectTrigger data-testid="filter-appraisal-group">
                    <SelectValue placeholder="All Groups" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    {appraisalGroups.map((group: any) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Employee Name/Code</label>
                <Input
                  placeholder="Search by name or code"
                  value={filters.employeeSearch}
                  onChange={(e) => setFilters({ ...filters, employeeSearch: e.target.value })}
                  data-testid="filter-employee-search"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Location</label>
                <Select
                  value={filters.location}
                  onValueChange={(value) => setFilters({ ...filters, location: value })}
                >
                  <SelectTrigger data-testid="filter-location">
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map((location: any) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Department</label>
                <Select
                  value={filters.department}
                  onValueChange={(value) => setFilters({ ...filters, department: value })}
                >
                  <SelectTrigger data-testid="filter-department">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {uniqueDepartments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Level</label>
                <Select
                  value={filters.level}
                  onValueChange={(value) => setFilters({ ...filters, level: value })}
                >
                  <SelectTrigger data-testid="filter-level">
                    <SelectValue placeholder="All Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {levels.map((level: any) => (
                      <SelectItem key={level.id} value={level.id}>
                        {level.code} - {level.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Grade</label>
                <Select
                  value={filters.grade}
                  onValueChange={(value) => setFilters({ ...filters, grade: value })}
                >
                  <SelectTrigger data-testid="filter-grade">
                    <SelectValue placeholder="All Grades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Grades</SelectItem>
                    {grades.map((grade: any) => (
                      <SelectItem key={grade.id} value={grade.id}>
                        {grade.code} - {grade.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Business Role</label>
                <Select
                  value={filters.businessRole}
                  onValueChange={(value) => setFilters({ ...filters, businessRole: value })}
                >
                  <SelectTrigger data-testid="filter-business-role">
                    <SelectValue placeholder="All Business Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Business Roles</SelectItem>
                    {businessRoles.map((role: any) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.code} - {role.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Reporting Manager</label>
                <Select
                  value={filters.manager}
                  onValueChange={(value) => setFilters({ ...filters, manager: value })}
                >
                  <SelectTrigger data-testid="filter-manager">
                    <SelectValue placeholder="All Managers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Managers</SelectItem>
                    {managers.map((manager: any) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.firstName} {manager.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <Button onClick={handleSearch} data-testid="btn-search">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
              <Button variant="outline" onClick={handleClearFilters} data-testid="btn-clear-filters">
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoadingGoals ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-4">Loading development goals...</p>
            </CardContent>
          </Card>
        ) : !searchApplied ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Please select filters and click Search to view team member development goals.
              </p>
            </CardContent>
          </Card>
        ) : Object.keys(groupedGoals).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No development goals found matching the selected filters.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Found {filteredGoals.length} goal(s) for {Object.keys(groupedGoals).length} team member(s)
            </p>
            
            <Accordion type="multiple" className="space-y-4">
              {Object.entries(groupedGoals).map(([employeeId, employeeGoals]) => {
                const employee = employeeGoals[0]?.employee;
                if (!employee) return null;
                
                return (
                  <AccordionItem key={employeeId} value={employeeId} className="border rounded-lg">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center gap-4 w-full">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="text-left flex-1">
                          <p className="font-semibold">{employee.firstName} {employee.lastName}</p>
                          <p className="text-sm text-muted-foreground">
                            {employee.code} | {employee.designation || 'N/A'} | {employee.department || 'N/A'}
                          </p>
                        </div>
                        <Badge variant="outline" className="mr-4">
                          {employeeGoals.length} Goal{employeeGoals.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4 mt-2">
                        {employeeGoals.map((goal) => (
                          <Card key={goal.id} className="border-l-4 border-l-primary">
                            <CardContent className="pt-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Target className="h-5 w-5 text-primary" />
                                  <span className="font-medium">{goal.description}</span>
                                </div>
                                {getStatusBadge(goal.status)}
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Planned Outcome:</span>
                                  <p className="mt-1">{goal.plannedOutcome}</p>
                                </div>
                                
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-muted-foreground">Target Date:</span>
                                    <span>{goal.targetDate ? format(new Date(goal.targetDate), 'MMM d, yyyy') : 'Not set'}</span>
                                  </div>
                                  
                                  {goal.appraisalCycle && (
                                    <div className="flex items-center gap-2">
                                      <Flag className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-muted-foreground">Appraisal Cycle:</span>
                                      <span>{goal.appraisalCycle.code}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="mt-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm text-muted-foreground">Progress</span>
                                  <span className="text-sm font-medium">{goal.progress || 0}%</span>
                                </div>
                                <Progress value={goal.progress || 0} className="h-2" />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
