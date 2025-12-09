import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RoleGuard } from "@/components/RoleGuard";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import {
  TrendingUp,
  Users,
  Award,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Building2,
  MapPin,
  Layers,
  Star,
  Target,
  Calendar,
  UserCheck,
} from "lucide-react";

interface AnalyticsData {
  summary: {
    totalEmployees: number;
    totalEvaluations: number;
    completedEvaluations: number;
    averageRating: number;
    averageCalibratedRating: number;
    calibrationRate: number;
    meetingsCompletedRate: number;
    topPerformers: number;
    needsImprovement: number;
  };
  ratingDistribution: {
    rating: number;
    count: number;
    calibratedCount: number;
  }[];
  cyclePerformance: {
    cycleId: string;
    cycleName: string;
    cycleDescription: string;
    totalEvaluations: number;
    averageRating: number;
    averageCalibratedRating: number;
    completionRate: number;
  }[];
  departmentStats: {
    department: string;
    employeeCount: number;
    averageRating: number;
  }[];
  locationStats: {
    location: string;
    employeeCount: number;
    averageRating: number;
  }[];
  levelStats: {
    level: string;
    employeeCount: number;
    averageRating: number;
  }[];
  gradeStats: {
    grade: string;
    employeeCount: number;
    averageRating: number;
  }[];
  managerStats: {
    managerId: string;
    managerName: string;
    teamSize: number;
    averageRatingGiven: number;
  }[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];
const RATING_COLORS: Record<number, string> = {
  1: '#fca5a5',
  2: '#fdba74',
  3: '#fde047',
  4: '#86efac',
  5: '#93c5fd',
};
const RATING_LABELS: Record<number, string> = {
  1: 'Needs Improvement',
  2: 'Below Expectations',
  3: 'Meets Expectations',
  4: 'Exceeds Expectations',
  5: 'Outstanding',
};

export default function Analytics() {
  const { data, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics/performance-trends"],
  });

  if (isLoading) {
    return (
      <RoleGuard allowedRoles={["hr_manager", "admin", "super_admin"]}>
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-20 bg-muted rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </RoleGuard>
    );
  }

  if (error || !data) {
    return (
      <RoleGuard allowedRoles={["hr_manager", "admin", "super_admin"]}>
        <div className="p-6 max-w-7xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-muted-foreground">Failed to load analytics data</p>
            </CardContent>
          </Card>
        </div>
      </RoleGuard>
    );
  }

  const { summary, ratingDistribution, cyclePerformance, departmentStats, locationStats, levelStats, gradeStats, managerStats } = data;

  const pieData = ratingDistribution.map((item) => ({
    name: RATING_LABELS[item.rating] || `Rating ${item.rating}`,
    value: item.count,
    rating: item.rating,
    color: RATING_COLORS[item.rating] || '#8884d8',
  })).filter(item => item.value > 0);

  return (
    <RoleGuard allowedRoles={["hr_manager", "admin", "super_admin"]}>
      <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="analytics-dashboard">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
              <p className="text-muted-foreground">Performance trends and insights</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="card-total-employees">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Employees</p>
                  <p className="text-2xl font-bold">{summary.totalEmployees}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-completed-evaluations">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed Evaluations</p>
                  <p className="text-2xl font-bold">{summary.completedEvaluations}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-average-rating">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                  <Star className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Average Rating</p>
                  <p className="text-2xl font-bold">{summary.averageRating}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-calibration-rate">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Calibration Rate</p>
                  <p className="text-2xl font-bold">{summary.calibrationRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-top-performers">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-lg">
                  <Award className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Top Performers</p>
                  <p className="text-2xl font-bold">{summary.topPerformers}</p>
                  <p className="text-xs text-muted-foreground">Rating 5</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-needs-improvement">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Needs Improvement</p>
                  <p className="text-2xl font-bold">{summary.needsImprovement}</p>
                  <p className="text-xs text-muted-foreground">Rating 1-2</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-meetings-completed">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                  <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Meetings Completed</p>
                  <p className="text-2xl font-bold">{summary.meetingsCompletedRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-calibrated-rating">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Calibrated Rating</p>
                  <p className="text-2xl font-bold">{summary.averageCalibratedRating || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="distribution" className="space-y-4">
          <TabsList>
            <TabsTrigger value="distribution" data-testid="tab-distribution">Rating Distribution</TabsTrigger>
            <TabsTrigger value="trends" data-testid="tab-trends">Performance Trends</TabsTrigger>
            <TabsTrigger value="departments" data-testid="tab-departments">By Department</TabsTrigger>
            <TabsTrigger value="locations" data-testid="tab-locations">By Location</TabsTrigger>
            <TabsTrigger value="levels" data-testid="tab-levels">By Level/Grade</TabsTrigger>
            <TabsTrigger value="managers" data-testid="tab-managers">By Manager</TabsTrigger>
          </TabsList>

          <TabsContent value="distribution" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Rating Distribution
                  </CardTitle>
                  <CardDescription>Count of employees by rating</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ratingDistribution}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="rating" tickFormatter={(val) => `${val} Star${val !== 1 ? 's' : ''}`} />
                        <YAxis />
                        <Tooltip 
                          formatter={(value: number, name: string) => [value, name === 'count' ? 'Manager Rating' : 'Calibrated Rating']}
                          labelFormatter={(label) => `Rating: ${label}`}
                        />
                        <Legend />
                        <Bar dataKey="count" name="Manager Rating" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="calibratedCount" name="Calibrated Rating" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Rating Breakdown
                  </CardTitle>
                  <CardDescription>Percentage of employees by rating category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="35%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={90}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [`${value} employees`, 'Count']} />
                        <Legend 
                          layout="vertical" 
                          verticalAlign="middle" 
                          align="right"
                          formatter={(value: string, entry: any) => {
                            const item = pieData.find(p => p.name === value);
                            const total = pieData.reduce((sum, p) => sum + p.value, 0);
                            const percent = item && total > 0 ? Math.round((item.value / total) * 100) : 0;
                            return `${value} (${percent}%)`;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Rating Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {ratingDistribution.map((item) => {
                    const total = ratingDistribution.reduce((sum, r) => sum + r.count, 0);
                    const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
                    return (
                      <div key={item.rating} className="flex items-center gap-4">
                        <div className="w-48 flex items-center gap-2">
                          <Badge 
                            className="w-8 h-8 flex items-center justify-center text-white" 
                            style={{ backgroundColor: RATING_COLORS[item.rating] }}
                          >
                            {item.rating}
                          </Badge>
                          <span className="text-sm font-medium">{RATING_LABELS[item.rating]}</span>
                        </div>
                        <div className="flex-1">
                          <Progress value={percentage} className="h-2" />
                        </div>
                        <div className="w-24 text-right">
                          <span className="font-medium">{item.count}</span>
                          <span className="text-muted-foreground ml-1">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Performance Trends by Appraisal Cycle
                </CardTitle>
                <CardDescription>Average ratings and completion rates across appraisal cycles</CardDescription>
              </CardHeader>
              <CardContent>
                {cyclePerformance.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cyclePerformance}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="cycleName" />
                        <YAxis yAxisId="left" domain={[0, 5]} />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="averageRating" name="Avg Rating" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="left" dataKey="averageCalibratedRating" name="Avg Calibrated" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="right" dataKey="completionRate" name="Completion %" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-80 flex items-center justify-center">
                    <p className="text-muted-foreground">No appraisal cycle data available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cyclePerformance.map((cycle) => (
                <Card key={cycle.cycleId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{cycle.cycleName}</CardTitle>
                    <CardDescription>{cycle.cycleDescription}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Evaluations</span>
                        <span className="font-medium">{cycle.totalEvaluations}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Average Rating</span>
                        <Badge variant="secondary">{cycle.averageRating}</Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Calibrated Rating</span>
                        <Badge variant="secondary">{cycle.averageCalibratedRating || '-'}</Badge>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Completion Rate</span>
                          <span className="font-medium">{cycle.completionRate}%</span>
                        </div>
                        <Progress value={cycle.completionRate} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="departments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Department Performance Comparison
                </CardTitle>
                <CardDescription>Average ratings by department</CardDescription>
              </CardHeader>
              <CardContent>
                {departmentStats.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={departmentStats} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 5]} />
                        <YAxis dataKey="department" type="category" width={150} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="averageRating" name="Average Rating" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-80 flex items-center justify-center">
                    <p className="text-muted-foreground">No department data available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departmentStats.map((dept, index) => (
                <Card key={dept.department}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] + '20' }}
                        >
                          <Building2 className="h-5 w-5" style={{ color: COLORS[index % COLORS.length] }} />
                        </div>
                        <div>
                          <p className="font-medium">{dept.department}</p>
                          <p className="text-sm text-muted-foreground">{dept.employeeCount} employees</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-lg px-3 py-1">
                        {dept.averageRating}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="locations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Location Performance Comparison
                </CardTitle>
                <CardDescription>Average ratings by location</CardDescription>
              </CardHeader>
              <CardContent>
                {locationStats.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={locationStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="location" />
                        <YAxis domain={[0, 5]} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="averageRating" name="Average Rating" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="employeeCount" name="Employee Count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-80 flex items-center justify-center">
                    <p className="text-muted-foreground">No location data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="levels" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    Performance by Level
                  </CardTitle>
                  <CardDescription>Average ratings across organizational levels</CardDescription>
                </CardHeader>
                <CardContent>
                  {levelStats.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={levelStats} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" domain={[0, 5]} />
                          <YAxis dataKey="level" type="category" width={120} />
                          <Tooltip />
                          <Bar dataKey="averageRating" name="Average Rating" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center">
                      <p className="text-muted-foreground">No level data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Performance by Grade
                  </CardTitle>
                  <CardDescription>Average ratings across job grades</CardDescription>
                </CardHeader>
                <CardContent>
                  {gradeStats.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={gradeStats} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" domain={[0, 5]} />
                          <YAxis dataKey="grade" type="category" width={120} />
                          <Tooltip />
                          <Bar dataKey="averageRating" name="Average Rating" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center">
                      <p className="text-muted-foreground">No grade data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="managers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Manager Rating Patterns
                </CardTitle>
                <CardDescription>Average ratings given by each manager (sorted by team size)</CardDescription>
              </CardHeader>
              <CardContent>
                {managerStats.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={managerStats.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="managerName" angle={-45} textAnchor="end" height={80} />
                        <YAxis yAxisId="left" domain={[0, 5]} />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="averageRatingGiven" name="Avg Rating Given" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="right" dataKey="teamSize" name="Team Size" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-80 flex items-center justify-center">
                    <p className="text-muted-foreground">No manager data available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {managerStats.slice(0, 8).map((manager, index) => (
                <Card key={manager.managerId}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      >
                        {manager.managerName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{manager.managerName}</p>
                        <p className="text-sm text-muted-foreground">{manager.teamSize} direct reports</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Avg Rating Given</span>
                      <Badge variant="secondary">{manager.averageRatingGiven}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </RoleGuard>
  );
}
