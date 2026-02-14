import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Trophy, Medal, Award, Send, Bot, User, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RoleGuard } from "@/components/RoleGuard";

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

export default function EmployeeLeaderboard() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [appliedParams, setAppliedParams] = useState<string>(() => {
    const params = new URLSearchParams();
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
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
    const myEntry = data.leaderboard.find(e => e.rank === data.myRank);
    const lines: string[] = [];
    lines.push(`My Rank: ${data.myRank || 'N/A'} out of ${data.leaderboard.length} employees`);
    if (myEntry) {
      lines.push(`My Overall Score: ${myEntry.overallScore}%`);
      lines.push(`My KPIs Reviewed: ${myEntry.kpiCount}`);
      lines.push(`My Weightage Achieved: ${myEntry.totalWeightageAchieved} / ${myEntry.totalWeightage}`);
    }
    lines.push(`\nTop 5 performers:`);
    data.leaderboard.slice(0, 5).forEach(e => {
      lines.push(`  #${e.rank} ${e.name} (${e.department}) - Score: ${e.overallScore}%`);
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

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="text-sm text-muted-foreground font-medium">#{rank}</span>;
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 dark:text-green-400';
    if (score >= 70) return 'text-blue-600 dark:text-blue-400';
    if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const leaderboard = data?.leaderboard || [];

  return (
    <RoleGuard allowedRoles={["employee"]}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          <p className="text-muted-foreground">See how you compare with your colleagues and get AI-powered insights</p>
        </div>

        <Card>
          <CardContent className="pt-6">
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
        </Card>

        {data && data.myRank && (
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
                  {getRankIcon(data.myRank)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Your Rank</p>
                  <p className="text-3xl font-bold">#{data.myRank}</p>
                  <p className="text-sm text-muted-foreground">out of {leaderboard.length} employees</p>
                </div>
                {(() => {
                  const entry = data.myEmployeeId 
                    ? leaderboard.find(e => e.employeeId === data.myEmployeeId)
                    : leaderboard.find(e => e.rank === data.myRank);
                  if (!entry) return null;
                  return (
                    <div className="ml-auto text-right">
                      <p className="text-sm text-muted-foreground">Overall Score</p>
                      <p className={`text-3xl font-bold ${getScoreColor(entry.overallScore)}`}>
                        {entry.overallScore}%
                      </p>
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Performance Rankings</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : leaderboard.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No performance data available for the selected period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Rank</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead className="text-right">KPIs</TableHead>
                          <TableHead className="text-right">Wtg. Achieved</TableHead>
                          <TableHead className="text-right">Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leaderboard.map((entry) => {
                          const isMe = data?.myEmployeeId ? entry.employeeId === data.myEmployeeId : false;
                          return (
                            <TableRow key={entry.employeeId} className={isMe ? 'bg-primary/5' : ''}>
                              <TableCell>
                                <div className="flex items-center justify-center">
                                  {getRankIcon(entry.rank)}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">
                                {entry.name}
                                {isMe && <Badge variant="outline" className="ml-2 text-xs">You</Badge>}
                              </TableCell>
                              <TableCell>{entry.department}</TableCell>
                              <TableCell className="text-right">{entry.kpiCount}</TableCell>
                              <TableCell className="text-right">
                                {entry.totalWeightageAchieved} / {entry.totalWeightage}
                              </TableCell>
                              <TableCell className={`text-right font-bold ${getScoreColor(entry.overallScore)}`}>
                                {entry.overallScore}%
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Insights
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ask about your performance, get improvement tips, or compare metrics
                </p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto space-y-3 mb-4 max-h-[400px] min-h-[200px]">
                  {chatMessages.length === 0 && (
                    <div className="text-center text-muted-foreground py-8 space-y-2">
                      <Bot className="h-10 w-10 mx-auto opacity-50" />
                      <p className="text-sm">Ask me anything about your performance!</p>
                      <div className="flex flex-wrap gap-2 justify-center mt-3">
                        {[
                          "How can I improve my score?",
                          "What are my strengths?",
                          "Tips to reach top 3",
                        ].map((suggestion) => (
                          <Button
                            key={suggestion}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              setChatInput(suggestion);
                            }}
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
                        className={`rounded-lg px-3 py-2 max-w-[85%] text-sm whitespace-pre-wrap ${
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
                    placeholder="Ask about your performance..."
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
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
