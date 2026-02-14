import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Trophy, Medal, Award, Send, Bot, User, Sparkles, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RoleGuard } from "@/components/RoleGuard";

interface KpiDetail {
  kpiName: string;
  target: number;
  actual: number;
  achievement: number;
}

interface LeaderboardEntry {
  employeeId: string;
  name: string;
  employeeCode: string;
  department: string;
  overallScore: number;
  kpiCount: number;
  totalWeightageAchieved: number;
  totalWeightage: number;
  rank: number;
  kpis: KpiDetail[];
}

interface LeaderboardData {
  myRank: number | null;
  myEmployeeId: string | null;
  leaderboard: LeaderboardEntry[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function KpiBar({ kpi }: { kpi: KpiDetail }) {
  const barMax = Math.max(kpi.target, kpi.actual, 1);
  const actualPct = Math.min((kpi.actual / barMax) * 100, 100);

  const barColor = kpi.achievement >= 100
    ? 'bg-emerald-500'
    : kpi.achievement >= 75
      ? 'bg-blue-500'
      : kpi.achievement >= 50
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <div className="flex items-center gap-2 py-1">
      <div className="w-24 text-xs font-medium text-muted-foreground truncate" title={kpi.kpiName}>
        {kpi.kpiName}
      </div>
      <div className="flex-1 relative h-5 bg-muted rounded-sm overflow-hidden">
        <div
          className={`absolute top-0 left-0 h-full ${barColor} rounded-sm transition-all duration-500`}
          style={{ width: `${actualPct}%` }}
        />
        {kpi.target > 0 && (
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground/40"
            style={{ left: `${Math.min((kpi.target / barMax) * 100, 100)}%` }}
            title={`Target: ${kpi.target.toLocaleString()}`}
          />
        )}
      </div>
      <div className="w-16 text-right text-xs font-semibold tabular-nums">
        {kpi.actual.toLocaleString()}
      </div>
    </div>
  );
}

function EmployeeCard({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const getRankDisplay = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-700" />;
    return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-emerald-500';
    if (score >= 70) return 'bg-blue-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <Card className={`relative overflow-hidden transition-shadow hover:shadow-lg ${isMe ? 'ring-2 ring-primary shadow-md' : ''}`}>
      {isMe && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
      )}
      <CardContent className="pt-4 pb-4 px-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-sm">
              {entry.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-sm leading-tight">{entry.name}</h3>
                {isMe && <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">You</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{entry.department}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8">
              {getRankDisplay(entry.rank)}
            </div>
          </div>
        </div>

        <div className="space-y-0">
          {entry.kpis.slice(0, 5).map((kpi, idx) => (
            <KpiBar key={idx} kpi={kpi} />
          ))}
          {entry.kpis.length > 5 && (
            <p className="text-xs text-muted-foreground text-center mt-1">
              +{entry.kpis.length - 5} more KPIs
            </p>
          )}
          {entry.kpis.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">No KPI data</p>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-2 border-t">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Target line shown</span>
            <div className="w-3 h-3 border-l-2 border-foreground/40" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Score:</span>
            <Badge className={`${getScoreBg(entry.overallScore)} text-white text-xs font-bold px-2`}>
              {entry.overallScore}%
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function EmployeeLeaderboard() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const [appliedParams, setAppliedParams] = useState<string>(() => {
    const params = new URLSearchParams();
    const d = new Date();
    d.setDate(1);
    params.set('fromDate', d.toISOString().split('T')[0]);
    params.set('toDate', new Date().toISOString().split('T')[0]);
    return params.toString();
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleApplyFilters = () => {
    const params = new URLSearchParams();
    params.set('fromDate', fromDate);
    params.set('toDate', toDate);
    setAppliedParams(params.toString());
  };

  const { data, isLoading } = useQuery<LeaderboardData>({
    queryKey: ['/api/employee-reports/leaderboard', appliedParams],
    queryFn: async () => {
      const res = await fetch(`/api/employee-reports/leaderboard?${appliedParams}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const buildContext = () => {
    if (!data) return '';
    const myEntry = data.leaderboard.find(e => e.employeeId === data.myEmployeeId);
    const lines: string[] = [];
    lines.push(`My Rank: ${data.myRank || 'N/A'} out of ${data.leaderboard.length} employees`);
    if (myEntry) {
      lines.push(`My Overall Score: ${myEntry.overallScore}%`);
      lines.push(`My KPIs:`);
      myEntry.kpis.forEach(k => {
        lines.push(`  - ${k.kpiName}: Actual ${k.actual}, Target ${k.target}, Achievement ${k.achievement}%`);
      });
    }
    lines.push(`\nTop 5 performers:`);
    data.leaderboard.slice(0, 5).forEach(e => {
      lines.push(`  #${e.rank} ${e.name} (${e.department}) - Score: ${e.overallScore}%`);
      e.kpis.slice(0, 3).forEach(k => {
        lines.push(`    ${k.kpiName}: ${k.actual}/${k.target} (${k.achievement}%)`);
      });
    });
    return lines.join('\n');
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isSending) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsSending(true);

    try {
      const context = buildContext();
      const response = await fetch('/api/employee-reports/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, context }),
      });

      if (!response.ok) throw new Error('Failed to get AI response');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let assistantContent = '';
      setChatMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.done) break;
              if (parsed.content) {
                assistantContent += parsed.content;
                setChatMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                  return updated;
                });
              }
              if (parsed.error) {
                setChatMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsSending(false);
    }
  };

  const leaderboard = data?.leaderboard || [];

  const myEntry = data?.myEmployeeId
    ? leaderboard.find(e => e.employeeId === data.myEmployeeId)
    : null;

  return (
    <RoleGuard allowedRoles={["employee"]}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">KPI Leaderboard</h1>
          <p className="text-muted-foreground">See how you compare with your colleagues across KPIs</p>
        </div>

        <Card>
          <button
            type="button"
            className="w-full flex items-center justify-between px-6 py-3 text-left"
            onClick={() => setFiltersExpanded(!filtersExpanded)}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <Filter className="h-4 w-4" />
              <span>Date Filter</span>
              <Badge variant="secondary" className="ml-1 text-xs font-normal">
                {new Date(fromDate).toLocaleDateString()} – {new Date(toDate).toLocaleDateString()}
              </Badge>
            </div>
            {filtersExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {filtersExpanded && (
            <CardContent className="pt-0 pb-4">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <Label>From Date</Label>
                  <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-44" />
                </div>
                <div>
                  <Label>To Date</Label>
                  <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-44" />
                </div>
                <Button onClick={handleApplyFilters}>Apply</Button>
              </div>
            </CardContent>
          )}
        </Card>

        {data && myEntry && (
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center">
                    {data.myRank === 1 ? <Trophy className="h-7 w-7 text-yellow-500" /> :
                     data.myRank === 2 ? <Medal className="h-7 w-7 text-gray-400" /> :
                     data.myRank === 3 ? <Award className="h-7 w-7 text-amber-700" /> :
                     <span className="text-xl font-bold">#{data.myRank}</span>}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Your Rank</p>
                    <p className="text-2xl font-bold">#{data.myRank} <span className="text-sm font-normal text-muted-foreground">of {leaderboard.length}</span></p>
                  </div>
                </div>
                <div className="h-10 w-px bg-border hidden sm:block" />
                <div>
                  <p className="text-sm text-muted-foreground">Overall Score</p>
                  <p className="text-2xl font-bold">{myEntry.overallScore}%</p>
                </div>
                <div className="h-10 w-px bg-border hidden sm:block" />
                <div>
                  <p className="text-sm text-muted-foreground">KPIs Tracked</p>
                  <p className="text-2xl font-bold">{myEntry.kpis.length}</p>
                </div>
                <div className="h-10 w-px bg-border hidden sm:block" />
                <div>
                  <p className="text-sm text-muted-foreground">Wtg. Achieved</p>
                  <p className="text-2xl font-bold">{myEntry.totalWeightageAchieved} / {myEntry.totalWeightage}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          </div>
        ) : leaderboard.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">No performance data available for the selected period.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {leaderboard.map((entry) => (
                <EmployeeCard
                  key={entry.employeeId}
                  entry={entry}
                  isMe={entry.employeeId === data?.myEmployeeId}
                />
              ))}
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Performance Insights
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ask about your KPI performance, get improvement tips, or compare your metrics with peers
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-y-auto space-y-3 mb-4 max-h-[350px] min-h-[120px]">
                  {chatMessages.length === 0 && (
                    <div className="text-center text-muted-foreground py-6 space-y-2">
                      <Bot className="h-10 w-10 mx-auto opacity-50" />
                      <p className="text-sm">Ask me anything about your KPI performance!</p>
                      <div className="flex flex-wrap gap-2 justify-center mt-3">
                        {[
                          "How can I improve my weakest KPIs?",
                          "What are my top strengths?",
                          "How do I compare to the top performer?",
                          "Tips to improve my ranking",
                        ].map((suggestion) => (
                          <Button
                            key={suggestion}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => setChatInput(suggestion)}
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={`rounded-lg px-3 py-2 max-w-[80%] text-sm whitespace-pre-wrap ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        {msg.content || (isSending && idx === chatMessages.length - 1 ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : '')}
                      </div>
                      {msg.role === 'user' && (
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-1">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Ask about your KPI performance..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="min-h-[40px] max-h-[80px] resize-none"
                    rows={1}
                  />
                  <Button
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim() || isSending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </RoleGuard>
  );
}
