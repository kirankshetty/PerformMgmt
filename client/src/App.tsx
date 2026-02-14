import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import DevLogin from "@/pages/DevLogin";
import Dashboard from "@/pages/Dashboard";
import CompanyManagement from "@/pages/CompanyManagement";
import EmployeeManagement from "@/pages/EmployeeManagement";
import LocationManagement from "@/pages/LocationManagement";
import DepartmentManagement from "@/pages/DepartmentManagement";
import QuestionnaireTemplates from "@/pages/QuestionnaireTemplates";
import PublishQuestionnaires from "@/pages/PublishQuestionnaires";
import LevelManagement from "@/pages/LevelManagement";
import GradeManagement from "@/pages/GradeManagement";
import BusinessRoleManagement from "@/pages/BusinessRoleManagement";
import FunctionalAreaManagement from "@/pages/FunctionalAreaManagement";
import RatingManagement from "@/pages/RatingManagement";
import AppraisalCycleManagement from "@/pages/AppraisalCycleManagement";
import ReviewFrequencyManagement from "@/pages/ReviewFrequencyManagement";
import FrequencyCalendarManagement from "@/pages/FrequencyCalendarManagement";
import FrequencyCalendarDetailsManagement from "@/pages/FrequencyCalendarDetailsManagement";
import PerformanceReviews from "@/pages/PerformanceReviews";
import ReviewProgress from "@/pages/ReviewProgress";
import AppraisalGroups from "@/pages/AppraisalGroups";
import InitiateAppraisal from "@/pages/InitiateAppraisal";
import ReviewAppraisal from "@/pages/ReviewAppraisal";
import Evaluations from "@/pages/Evaluations";
import ManagerSubmissions from "@/pages/ManagerSubmissions";
import Meetings from "@/pages/Meetings";
import HRMeetingsView from "@/pages/HRMeetingsView";
import CalibrateRatings from "@/pages/CalibrateRatings";
import KraGoalsManagement from "@/pages/KraGoalsManagement";
import Analytics from "@/pages/Analytics";
import DevelopmentGoals from "@/pages/DevelopmentGoals";
import MemberDevelopmentGoals from "@/pages/MemberDevelopmentGoals";
import FeedbackRequests from "@/pages/FeedbackRequests";
import FeedbackRequestForm from "@/pages/FeedbackRequestForm";
import SetTargetsKraGoals from "@/pages/SetTargetsKraGoals";
import KraGoalsSelfReview from "@/pages/KraGoalsSelfReview";
import ManagerKraGoalsReview from "@/pages/ManagerKraGoalsReview";
import Settings from "@/pages/Settings";
import ReportScoreCard from "@/pages/ReportScoreCard";
import ReportActivity from "@/pages/ReportActivity";
import ReportTrend from "@/pages/ReportTrend";
import EmployeeReportActivity from "@/pages/EmployeeReportActivity";
import EmployeeLeaderboard from "@/pages/EmployeeLeaderboard";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/dev" component={DevLogin} />
          <Route path="/login" component={Landing} />
          <Route path="/company/:companyUrl" component={Landing} />
        </>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/companies" component={CompanyManagement} />
          <Route path="/users" component={EmployeeManagement} />
          <Route path="/locations" component={LocationManagement} />
          <Route path="/departments" component={DepartmentManagement} />
          <Route path="/questionnaires" component={QuestionnaireTemplates} />
          <Route path="/questionnaire-templates" component={QuestionnaireTemplates} />
          <Route path="/publish-questionnaires" component={PublishQuestionnaires} />
          <Route path="/levels" component={LevelManagement} />
          <Route path="/grades" component={GradeManagement} />
          <Route path="/business-roles" component={BusinessRoleManagement} />
          <Route path="/business-roles-hr" component={BusinessRoleManagement} />
          <Route path="/functional-areas" component={FunctionalAreaManagement} />
          <Route path="/functional-areas-hr" component={FunctionalAreaManagement} />
          <Route path="/ratings" component={RatingManagement} />
          <Route path="/kra-goals" component={KraGoalsManagement} />
          <Route path="/appraisal-cycles" component={AppraisalCycleManagement} />
          <Route path="/review-frequencies" component={ReviewFrequencyManagement} />
          <Route path="/frequency-calendars" component={FrequencyCalendarManagement} />
          <Route path="/frequency-calendar-details" component={FrequencyCalendarDetailsManagement} />
          <Route path="/performance-reviews" component={PerformanceReviews} />
          <Route path="/review-progress" component={ReviewProgress} />
          <Route path="/appraisal-groups" component={AppraisalGroups} />
          <Route path="/initiate-appraisal" component={InitiateAppraisal} />
          <Route path="/review-appraisal" component={ReviewAppraisal} />
          <Route path="/evaluations" component={Evaluations} />
          <Route path="/manager-submissions" component={ManagerSubmissions} />
          <Route path="/set-targets" component={SetTargetsKraGoals} />
          <Route path="/manager-kra-reviews" component={ManagerKraGoalsReview} />
          <Route path="/member-development-goals" component={MemberDevelopmentGoals} />
          <Route path="/meetings" component={Meetings} />
          <Route path="/development-goals" component={DevelopmentGoals} />
          <Route path="/kra-goals-self-review" component={KraGoalsSelfReview} />
          <Route path="/feedback-requests" component={FeedbackRequests} />
          <Route path="/feedback-requests/:id" component={FeedbackRequestForm} />
          <Route path="/hr-meetings" component={HRMeetingsView} />
          <Route path="/calibrate-ratings" component={CalibrateRatings} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/settings" component={Settings} />
          <Route path="/report-score-card" component={ReportScoreCard} />
          <Route path="/report-activity" component={ReportActivity} />
          <Route path="/report-trend" component={ReportTrend} />
          <Route path="/employee-activity-report" component={EmployeeReportActivity} />
          <Route path="/employee-leaderboard" component={EmployeeLeaderboard} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <>
      <Toaster />
      {isLoading || !isAuthenticated ? (
        <Router />
      ) : (
        <Layout>
          <Router />
        </Layout>
      )}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
