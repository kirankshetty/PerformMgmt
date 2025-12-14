import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Play, Users, FileText, Calendar, Settings2, Upload, X, Plus, ChevronDown, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { RoleGuard } from "@/components/RoleGuard";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { SafeUser, AppraisalGroup, QuestionnaireTemplate, FrequencyCalendar, FrequencyCalendarDetails, AppraisalCycle } from "@shared/schema";

interface AppraisalGroupWithMembers extends AppraisalGroup {
  members: SafeUser[];
}

// Multi-select component for questionnaire templates
const MultiSelect = ({ 
  options, 
  value, 
  onChange, 
  placeholder,
  testId 
}: { 
  options: { value: string; label: string }[], 
  value: string[], 
  onChange: (value: string[]) => void,
  placeholder: string,
  testId: string
}) => {
  const [open, setOpen] = useState(false);
  
  const handleToggle = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };
  
  const displayValue = value.length > 0 
    ? value.length === 1 
      ? options.find(o => o.value === value[0])?.label || value[0]
      : `${value.length} templates selected`
    : placeholder;
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-left font-normal"
          data-testid={testId}
        >
          {displayValue}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="max-h-60 overflow-auto p-1">
          {options.map((option) => (
            <div
              key={option.value}
              className="flex items-center space-x-2 rounded-md px-2 py-1 hover:bg-accent"
            >
              <Checkbox
                id={option.value}
                checked={value.includes(option.value)}
                onCheckedChange={() => handleToggle(option.value)}
              />
              <label
                htmlFor={option.value}
                className="flex-1 cursor-pointer text-sm"
              >
                {option.label}
              </label>
            </div>
          ))}
          {options.length === 0 && (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">
              No questionnaire templates available
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Calendar detail timing configuration
const calendarDetailTimingSchema = z.object({
  detailId: z.string(),
  daysToInitiate: z.coerce.number().min(0).max(365).default(0),
  daysToClose: z.coerce.number().min(1).max(365).default(30),
  numberOfReminders: z.coerce.number().min(1).max(10).default(3),
});

// Form validation schema
const initiateAppraisalSchema = z.object({
  appraisalType: z.enum(['questionnaire_based', 'kpi_based', 'mbo_based', 'okr_based']),
  questionnaireTemplateIds: z.array(z.string()).default([]),
  documentFile: z.any().optional(), // File upload
  frequencyCalendarId: z.string().optional(),
  selectedCalendarDetailIds: z.array(z.string()).default([]), // Multi-select calendar details
  calendarDetailTimings: z.array(calendarDetailTimingSchema).default([]), // Per-detail timing config
  // Keep global settings as fallback when no calendar is selected
  daysToInitiate: z.coerce.number().min(0).max(365).default(0),
  daysToClose: z.coerce.number().min(1).max(365).default(30),
  numberOfReminders: z.coerce.number().min(1).max(10).default(3),
  excludeTenureLessThanYear: z.boolean().default(false),
  excludeDojFromDate: z.date().optional(),
  excludeDojTillDate: z.date().optional(),
  excludedEmployeeIds: z.array(z.string()).default([]),
  makePublic: z.boolean().default(false),
  publishType: z.enum(['now', 'as_per_calendar']).default('now'),
}).refine((data) => {
  if (data.appraisalType === 'questionnaire_based') {
    return data.questionnaireTemplateIds && data.questionnaireTemplateIds.length > 0;
  }
  if (data.appraisalType === 'kpi_based') {
    return !!data.documentFile;
  }
  return true;
}, {
  message: "Please select required fields based on appraisal type",
  path: ["appraisalType"]
});

type CalendarDetailTiming = z.infer<typeof calendarDetailTimingSchema>;
type InitiateAppraisalForm = z.infer<typeof initiateAppraisalSchema>;

export default function InitiateAppraisal() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<AppraisalGroupWithMembers | null>(null);
  const [isInitiateFormOpen, setIsInitiateFormOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const { toast } = useToast();

  // Form initialization
  const form = useForm<InitiateAppraisalForm>({
    resolver: zodResolver(initiateAppraisalSchema),
    defaultValues: {
      appraisalType: 'questionnaire_based',
      questionnaireTemplateIds: [],
      selectedCalendarDetailIds: [],
      calendarDetailTimings: [],
      daysToInitiate: 0,
      daysToClose: 30,
      numberOfReminders: 3,
      excludeTenureLessThanYear: false,
      excludeDojFromDate: undefined,
      excludeDojTillDate: undefined,
      excludedEmployeeIds: [],
      makePublic: false,
      publishType: 'now',
    },
  });

  // Fetch appraisal groups
  const { data: groups = [], isLoading } = useQuery<AppraisalGroupWithMembers[]>({
    queryKey: ['/api/appraisal-groups'],
  });

  // Fetch questionnaire templates for dropdown
  const { data: questionnaireTemplates = [] } = useQuery<QuestionnaireTemplate[]>({
    queryKey: ['/api/questionnaire-templates'],
  });

  // Fetch frequency calendars for dropdown
  const { data: frequencyCalendars = [] } = useQuery<FrequencyCalendar[]>({
    queryKey: ['/api/frequency-calendars'],
  });

  // Fetch calendar details when a calendar is selected
  const { data: calendarDetails = [], isLoading: isLoadingDetails } = useQuery<FrequencyCalendarDetails[]>({
    queryKey: ['/api/frequency-calendars', selectedCalendarId, 'details'],
    queryFn: async () => {
      if (!selectedCalendarId) return [];
      const response = await fetch(`/api/frequency-calendars/${selectedCalendarId}/details`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch calendar details');
      }
      return response.json();
    },
    enabled: !!selectedCalendarId,
  });

  // Mutation for initiating appraisal
  const initiateMutation = useMutation({
    mutationFn: async (data: InitiateAppraisalForm & { appraisalGroupId: string }) => {
      // For now, send as JSON since file upload is not fully implemented
      // TODO: Implement proper file upload with FormData when needed
      const response = await fetch('/api/initiate-appraisal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`${response.status}: ${error}`);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Appraisal Initiated",
        description: "The appraisal has been successfully initiated.",
      });
      setIsInitiateFormOpen(false);
      setSelectedGroup(null);
      form.reset();
      setUploadedFile(null);
      queryClient.invalidateQueries({ queryKey: ['/api/initiated-appraisals'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to initiate appraisal. Please try again.",
        variant: "destructive",
      });
      console.error('Failed to initiate appraisal:', error);
    },
  });

  const handleInitiateAppraisal = (group: AppraisalGroupWithMembers) => {
    setSelectedGroup(group);
    setIsInitiateFormOpen(true);
    form.reset({
      appraisalType: 'questionnaire_based',
      questionnaireTemplateIds: [],
      selectedCalendarDetailIds: [],
      calendarDetailTimings: [],
      daysToInitiate: 0,
      daysToClose: 30,
      numberOfReminders: 3,
      excludeTenureLessThanYear: false,
      excludeDojFromDate: undefined,
      excludeDojTillDate: undefined,
      excludedEmployeeIds: [],
      makePublic: false,
      publishType: 'now',
    });
    setUploadedFile(null);
    setSelectedCalendarId(null);
  };

  // Handle frequency calendar selection
  const handleCalendarSelection = (calendarId: string) => {
    setSelectedCalendarId(calendarId);
    form.setValue('frequencyCalendarId', calendarId);
    // Clear selected calendar details and timings when switching calendars
    form.setValue('selectedCalendarDetailIds', []);
    form.setValue('calendarDetailTimings', []);
  };

  // Initialize timing settings for selected calendar details only
  // Preserves existing timing values for already-selected periods
  const initializeCalendarDetailTimings = (selectedDetailIds: string[]) => {
    const currentTimings = form.getValues('calendarDetailTimings');
    const selectedDetails = calendarDetails.filter(detail => selectedDetailIds.includes(detail.id));
    
    const updatedTimings: CalendarDetailTiming[] = selectedDetails.map(detail => {
      // Check if timing already exists for this detail
      const existingTiming = currentTimings.find(t => t.detailId === detail.id);
      if (existingTiming) {
        // Preserve existing configuration
        return existingTiming;
      }
      // Add new timing with defaults for newly selected detail
      return {
        detailId: detail.id,
        daysToInitiate: 0,
        daysToClose: 30,
        numberOfReminders: 3,
      };
    });
    
    form.setValue('calendarDetailTimings', updatedTimings);
  };

  // Handle calendar detail selection changes
  const handleCalendarDetailSelection = (selectedIds: string[]) => {
    form.setValue('selectedCalendarDetailIds', selectedIds);
    initializeCalendarDetailTimings(selectedIds);
  };

  // Watch for changes in selected calendar detail IDs
  const selectedCalendarDetailIds = form.watch('selectedCalendarDetailIds');

  const onSubmit = (data: InitiateAppraisalForm) => {
    if (!selectedGroup) return;
    
    initiateMutation.mutate({
      ...data,
      appraisalGroupId: selectedGroup.id,
      documentFile: uploadedFile,
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      form.setValue('documentFile', file);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    form.setValue('documentFile', undefined);
  };

  const appraisalType = form.watch('appraisalType');

  // Filter groups based on search query
  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (group.description || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <RoleGuard allowedRoles={['hr_manager']}>
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Initiate Appraisal Cycle</h1>
            <p className="text-muted-foreground mt-2">
              Select an appraisal group to initiate performance evaluations
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <Input
              placeholder="Search appraisal groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
              data-testid="search-groups"
            />
          </div>
        </div>

        {/* Appraisal Groups List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-muted-foreground">Loading appraisal groups...</div>
          </div>
        ) : filteredGroups.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No appraisal groups found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchQuery ? "No groups match your search criteria." : "Create some appraisal groups first to initiate appraisals."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredGroups.map((group) => (
              <Card key={group.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <h3 className="text-xl font-semibold" data-testid={`group-name-${group.id}`}>
                          {group.name}
                        </h3>
                        <Badge variant="secondary">
                          {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
                        </Badge>
                        <Badge 
                          variant={group.status === 'active' ? 'default' : 'secondary'}
                          data-testid={`group-status-${group.id}`}
                        >
                          {group.status}
                        </Badge>
                      </div>
                      
                      {group.description && (
                        <p className="text-muted-foreground mb-3" data-testid={`group-description-${group.id}`}>
                          {group.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {group.members.length} employees
                        </span>
                        <span>
                          Created {group.createdAt ? new Date(group.createdAt).toLocaleDateString() : 'Unknown'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleInitiateAppraisal(group)}
                        className="flex items-center gap-2"
                        data-testid={`initiate-btn-${group.id}`}
                      >
                        <Play className="h-4 w-4" />
                        Initiate Appraisal
                      </Button>
                    </div>
                  </div>
                  
                  {/* Member Preview */}
                  {group.members.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Group Members:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.members.slice(0, 5).map((member) => (
                          <Badge key={member.id} variant="outline" className="text-xs">
                            {member.firstName} {member.lastName}
                          </Badge>
                        ))}
                        {group.members.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{group.members.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Initiate Appraisal Form Dialog */}
        <Dialog open={isInitiateFormOpen} onOpenChange={setIsInitiateFormOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Initiate Appraisal Cycle
              </DialogTitle>
              <DialogDescription>
                Configure the appraisal settings for the selected group
              </DialogDescription>
            </DialogHeader>
            
            {selectedGroup && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Read-only Group Info */}
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Selected Appraisal Group</h4>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-medium">{selectedGroup.name}</span>
                      <Badge variant="secondary">
                        {selectedGroup.members.length} members
                      </Badge>
                    </div>
                    {selectedGroup.description && (
                      <p className="text-muted-foreground mt-2">{selectedGroup.description}</p>
                    )}
                  </div>

                  <Separator />

                  {/* Appraisal Type Selection */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Appraisal Configuration</h4>
                    
                    <FormField
                      control={form.control}
                      name="appraisalType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Appraisal Type*</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-appraisal-type">
                                <SelectValue placeholder="Select appraisal type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="questionnaire_based">SMART Objectives</SelectItem>
                              <SelectItem value="kpi_based">KPI Based</SelectItem>
                              <SelectItem value="mbo_based">360 Degree Feedback</SelectItem>
                              <SelectItem value="okr_based">OKR Based</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Choose the type of performance appraisal to conduct
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Questionnaire Template Selection (for questionnaire_based) */}
                    {appraisalType === 'questionnaire_based' && (
                      <FormField
                        control={form.control}
                        name="questionnaireTemplateIds"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Questionnaire Templates*</FormLabel>
                            <FormControl>
                              <MultiSelect
                                options={questionnaireTemplates.map(template => ({
                                  value: template.id,
                                  label: template.name
                                }))}
                                value={field.value || []}
                                onChange={field.onChange}
                                placeholder="Select questionnaire templates..."
                                testId="select-questionnaire-templates"
                              />
                            </FormControl>
                            <FormDescription>
                              Choose one or more questionnaire templates for this appraisal
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Document Upload (for KPI based only) */}
                    {appraisalType === 'kpi_based' && (
                      <div className="space-y-2">
                        <Label>Upload Document*</Label>
                        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                          {uploadedFile ? (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-blue-500" />
                                <span className="text-sm font-medium">{uploadedFile.name}</span>
                                <Badge variant="secondary">
                                  {(uploadedFile.size / 1024).toFixed(1)} KB
                                </Badge>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={removeFile}
                                data-testid="remove-file-btn"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="text-center">
                              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                              <p className="text-muted-foreground mb-2">
                                Upload {appraisalType === 'kpi_based' ? 'KPI' : 'MBO'} document
                              </p>
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx,.xlsx,.xls"
                                onChange={handleFileUpload}
                                className="hidden"
                                id="document-upload"
                                data-testid="file-input"
                              />
                              <Label htmlFor="document-upload" className="cursor-pointer">
                                <Button type="button" variant="outline" asChild>
                                  <span>Choose File</span>
                                </Button>
                              </Label>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Accepted formats: PDF, DOC, DOCX, XLS, XLSX (Max 10MB)
                        </p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Schedule & Timing Configuration */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Schedule & Timing</h4>
                    
                    <FormField
                      control={form.control}
                      name="frequencyCalendarId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Frequency Calendar</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              handleCalendarSelection(value);
                            }} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-frequency-calendar">
                                <SelectValue placeholder="Select frequency calendar (optional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {frequencyCalendars.map((calendar) => (
                                <SelectItem key={calendar.id} value={calendar.id}>
                                  {calendar.code} - {calendar.description}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Optional: Link to a frequency calendar for automated scheduling
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Show calendar details selection when a calendar is selected */}
                    {selectedCalendarId && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h5 className="text-md font-medium">Select Calendar Periods</h5>
                          {isLoadingDetails && (
                            <div className="text-sm text-muted-foreground">Loading details...</div>
                          )}
                        </div>
                        
                        {calendarDetails.length > 0 && (
                          <div className="space-y-4">
                            {/* Multi-select for calendar details */}
                            <FormField
                              control={form.control}
                              name="selectedCalendarDetailIds"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Frequency Calendar Details*</FormLabel>
                                  <FormControl>
                                    <MultiSelect
                                      options={calendarDetails.map(detail => {
                                        // Format dates properly to avoid timezone issues
                                        const formatDate = (dateValue: any) => {
                                          // First convert to Date object if it's a string
                                          const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
                                          // Then extract LOCAL date components
                                          return new Date(
                                            date.getFullYear(),
                                            date.getMonth(),
                                            date.getDate()
                                          ).toLocaleDateString();
                                        };
                                        
                                        return {
                                          value: detail.id,
                                          label: `${detail.displayName} (${formatDate(detail.startDate)} - ${formatDate(detail.endDate)})`
                                        };
                                      })}
                                      value={field.value || []}
                                      onChange={handleCalendarDetailSelection}
                                      placeholder="Select calendar periods..."
                                      testId="select-calendar-details"
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Choose one or more calendar periods for this appraisal cycle
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {/* Show timing configuration for selected calendar details */}
                            {selectedCalendarDetailIds.length > 0 && (
                              <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                  Configure timing settings for selected calendar periods:
                                </p>
                                
                                {calendarDetails
                                  .filter(detail => selectedCalendarDetailIds.includes(detail.id))
                                  .map((detail) => {
                                    const timingIndex = form.getValues('calendarDetailTimings').findIndex(t => t.detailId === detail.id);
                                    if (timingIndex === -1) return null;
                                    return (
                                      <Card key={detail.id} className="p-4">
                                        <div className="flex items-center justify-between mb-3">
                                          <div>
                                            <h6 className="font-medium">{detail.displayName}</h6>
                                            <p className="text-sm text-muted-foreground">
                                              {(() => {
                                                const formatDate = (dateValue: any) => {
                                                  // First convert to Date object if it's a string
                                                  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
                                                  // Then extract LOCAL date components
                                                  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toLocaleDateString();
                                                };
                                                return `${formatDate(detail.startDate)} - ${formatDate(detail.endDate)}`;
                                              })()}
                                            </p>
                                          </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                          <FormField
                                            control={form.control}
                                            name={`calendarDetailTimings.${timingIndex}.daysToInitiate`}
                                            render={({ field }) => (
                                              <FormItem>
                                                <FormLabel>Days to Initiate</FormLabel>
                                                <FormControl>
                                                  <Input
                                                    type="number"
                                                    min="0"
                                                    max="365"
                                                    placeholder="0"
                                                    {...field}
                                                    data-testid={`input-days-to-initiate-${detail.id}`}
                                                  />
                                                </FormControl>
                                                <FormDescription>
                                                  Days after calendar period end
                                                </FormDescription>
                                                <FormMessage />
                                              </FormItem>
                                            )}
                                          />

                                          <FormField
                                            control={form.control}
                                            name={`calendarDetailTimings.${timingIndex}.daysToClose`}
                                            render={({ field }) => (
                                              <FormItem>
                                                <FormLabel>Days to Close*</FormLabel>
                                                <FormControl>
                                                  <Input
                                                    type="number"
                                                    min="1"
                                                    max="365"
                                                    placeholder="30"
                                                    {...field}
                                                    data-testid={`input-days-to-close-${detail.id}`}
                                                  />
                                                </FormControl>
                                                <FormDescription>
                                                  Days after calendar period end
                                                </FormDescription>
                                                <FormMessage />
                                              </FormItem>
                                            )}
                                          />

                                          <FormField
                                            control={form.control}
                                            name={`calendarDetailTimings.${timingIndex}.numberOfReminders`}
                                            render={({ field }) => (
                                              <FormItem>
                                                <FormLabel>Number of Reminders</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value?.toString()}>
                                                  <FormControl>
                                                    <SelectTrigger data-testid={`select-reminders-${detail.id}`}>
                                                      <SelectValue placeholder="Select" />
                                                    </SelectTrigger>
                                                  </FormControl>
                                                  <SelectContent>
                                                    {Array.from({length: 10}, (_, i) => i + 1).map((num) => (
                                                      <SelectItem key={num} value={num.toString()}>
                                                        {num} reminder{num > 1 ? 's' : ''}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                                <FormDescription>
                                                  Automatic reminders (1-10)
                                                </FormDescription>
                                                <FormMessage />
                                              </FormItem>
                                            )}
                                          />
                                        </div>
                                      </Card>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {calendarDetails.length === 0 && !isLoadingDetails && (
                          <Card className="p-6">
                            <div className="text-center text-muted-foreground">
                              <Calendar className="h-8 w-8 mx-auto mb-2" />
                              <p>No calendar details found for this frequency calendar.</p>
                            </div>
                          </Card>
                        )}
                      </div>
                    )}

                    {/* Show global timing settings when no calendar is selected */}
                    {!selectedCalendarId && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="daysToInitiate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Days to Initiate</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  max="365"
                                  placeholder="0"
                                  value={field.value || 0}
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                  data-testid="input-days-to-initiate"
                                />
                              </FormControl>
                              <FormDescription>
                                Days after calendar period end
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="daysToClose"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Days to Close*</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  max="365"
                                  placeholder="30"
                                  value={field.value || 30}
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                  data-testid="input-days-to-close"
                                />
                              </FormControl>
                              <FormDescription>
                                Days after initiation to close
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="numberOfReminders"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Number of Reminders</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value?.toString()}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-number-of-reminders">
                                    <SelectValue placeholder="3" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {Array.from({length: 10}, (_, i) => i + 1).map((num) => (
                                    <SelectItem key={num} value={num.toString()}>
                                      {num} reminder{num > 1 ? 's' : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Automatic reminders (1-10)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Employee Exclusions */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Employee Exclusions</h4>
                    
                    <FormField
                      control={form.control}
                      name="excludeTenureLessThanYear"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              Exclude employees with tenure less than 1 year
                            </FormLabel>
                            <FormDescription>
                              Automatically exclude employees who joined less than a year ago
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-exclude-tenure"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* DOJ Date Range Filters */}
                    <div className="space-y-2">
                      <Label>Exclude by Date of Joining (DOJ)</Label>
                      <p className="text-sm text-muted-foreground">
                        Exclude employees based on their date of joining
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="excludeDojFromDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>DOJ From Date</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      className="w-full justify-start text-left font-normal"
                                      data-testid="exclude-doj-from-date"
                                    >
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <CalendarComponent
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormDescription>
                                Exclude employees who joined from this date
                              </FormDescription>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="excludeDojTillDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>DOJ Till Date</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      className="w-full justify-start text-left font-normal"
                                      data-testid="exclude-doj-till-date"
                                    >
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <CalendarComponent
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormDescription>
                                Exclude employees who joined till this date
                              </FormDescription>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Individual Employee Exclusions */}
                    <div className="space-y-2">
                      <Label>Exclude Specific Employees</Label>
                      <p className="text-sm text-muted-foreground">
                        Select individual employees to exclude from this appraisal cycle
                      </p>
                      
                      <ScrollArea className="h-40 border rounded-md p-4">
                        <div className="space-y-2">
                          {selectedGroup.members.filter((member) => {
                            const dojFromDate = form.watch('excludeDojFromDate');
                            const dojTillDate = form.watch('excludeDojTillDate');
                            
                            // Filter by DOJ From Date
                            if (dojFromDate) {
                              if (!member.dateOfJoining) return false;
                              const memberDoj = new Date(member.dateOfJoining);
                              const fromDate = new Date(dojFromDate);
                              fromDate.setHours(0, 0, 0, 0);
                              memberDoj.setHours(0, 0, 0, 0);
                              if (memberDoj < fromDate) return false;
                            }
                            
                            // Filter by DOJ Till Date
                            if (dojTillDate) {
                              if (!member.dateOfJoining) return false;
                              const memberDoj = new Date(member.dateOfJoining);
                              const tillDate = new Date(dojTillDate);
                              tillDate.setHours(23, 59, 59, 999);
                              memberDoj.setHours(0, 0, 0, 0);
                              if (memberDoj > tillDate) return false;
                            }
                            
                            return true;
                          }).map((member) => {
                            const isExcluded = form.watch('excludedEmployeeIds').includes(member.id);
                            return (
                              <div key={member.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`exclude-${member.id}`}
                                  checked={isExcluded}
                                  onCheckedChange={(checked) => {
                                    const currentExcluded = form.getValues('excludedEmployeeIds');
                                    if (checked) {
                                      form.setValue('excludedEmployeeIds', [...currentExcluded, member.id]);
                                    } else {
                                      form.setValue('excludedEmployeeIds', currentExcluded.filter(id => id !== member.id));
                                    }
                                  }}
                                  data-testid={`checkbox-exclude-${member.id}`}
                                />
                                <Label htmlFor={`exclude-${member.id}`} className="text-sm font-normal">
                                  {member.firstName} {member.lastName} ({member.email})
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>

                  {/* Publish Options */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Publish Options</h4>
                    
                    <FormField
                      control={form.control}
                      name="publishType"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>When should the appraisal be published?</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="flex flex-col space-y-2"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="now" id="publish-now" data-testid="radio-publish-now" />
                                <Label htmlFor="publish-now" className="font-normal cursor-pointer">
                                  <div>
                                    <div className="font-medium">Publish Now</div>
                                    <div className="text-sm text-muted-foreground">
                                      Immediately initiate the questionnaire to all employees in the selected appraisal group
                                    </div>
                                  </div>
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="as_per_calendar" id="publish-calendar" data-testid="radio-publish-calendar" />
                                <Label htmlFor="publish-calendar" className="font-normal cursor-pointer">
                                  <div>
                                    <div className="font-medium">Publish As Per Calendar</div>
                                    <div className="text-sm text-muted-foreground">
                                      Publish the questionnaire on the scheduled date (end date of frequency calendar + days to initiate)
                                    </div>
                                  </div>
                                </Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Info message for calendar-based publishing */}
                    {form.watch('publishType') === 'as_per_calendar' && selectedCalendarDetailIds.length > 0 && (
                      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          <strong>Scheduled Publishing:</strong> The appraisal will be published to employees based on each selected calendar period's end date plus the configured "Days to Initiate" value.
                        </p>
                        {form.watch('calendarDetailTimings').map((timing: any) => {
                          const detail = calendarDetails.find(d => d.id === timing.detailId);
                          if (!detail) return null;
                          
                          // Calculate scheduled date: end date + daysToInitiate
                          // First convert to Date object if needed, then extract local components
                          const endDateValue = detail.endDate;
                          const tempDate = endDateValue instanceof Date ? endDateValue : new Date(endDateValue);
                          // Extract LOCAL date components to preserve the intended date
                          const endDate = new Date(
                            tempDate.getFullYear(),
                            tempDate.getMonth(),
                            tempDate.getDate()
                          );
                          
                          const daysToAdd = Number(timing.daysToInitiate) || 0;
                          
                          // Create scheduled date by adding days
                          const scheduledDate = new Date(endDate);
                          scheduledDate.setDate(scheduledDate.getDate() + daysToAdd);
                          
                          return (
                            <p key={timing.detailId} className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                              • {detail.displayName}: Will be published on <strong>{scheduledDate.toLocaleDateString()}</strong> ({endDate.toLocaleDateString()} + {daysToAdd} {daysToAdd === 1 ? 'day' : 'days'})
                            </p>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <DialogFooter className="pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsInitiateFormOpen(false)}
                      data-testid="cancel-btn"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={initiateMutation.isPending}
                      data-testid="initiate-submit-btn"
                    >
                      {initiateMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Initiating...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Initiate Appraisal
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}