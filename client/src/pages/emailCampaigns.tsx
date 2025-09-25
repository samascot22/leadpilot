import { useState,useEffect } from "react";
import { Badge } from "@/components/ui/badge"; 
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid} from "recharts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";  
import { Loader2, Search, Filter, Download, Upload, Eye, Edit, Trash2, Globe } from "lucide-react";

const apiUrl = import.meta.env.VITE_API_URL;
 
export default function EmailCampaigns() {
  // Chart data state and API call
  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ["http://localhost:8000/api/email-campaigns/performance"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/email-campaigns/performance`);
      return await res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  // Fallback to mock data if API fails or is loading
  const mockChartData = [
    { date: "2025-09-01", sent: 10, responses: 2 },
    { date: "2025-09-02", sent: 15, responses: 3 },
    { date: "2025-09-03", sent: 20, responses: 5 },
    { date: "2025-09-04", sent: 18, responses: 4 },
    { date: "2025-09-05", sent: 25, responses: 7 }
  ];
  // Helper for status badge color
  function getStatusColor(status: string) {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "active":
        return "bg-green-100 text-green-800";
      case "paused":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  } 
  const [aiMessage, setAiMessage] = useState("");
  // Status change mutation
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PUT", `${apiUrl}/api/email-campaigns/${id}`, { status });
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["http://localhost:8000/api/email-campaigns"] });
      toast.toast({ title: "Status Changed", description: `Campaign status changed to ${data.status}` });
    },
    onError: (error: any) => {
      toast.toast({ title: "Status Change Failed", description: error.message, variant: "destructive" });
    },
  });

  // Status change handler
  function handleStatusChange(id: number, newStatus: string) {
    statusMutation.mutate({ id, status: newStatus });
  }
  // AI Message Generator State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSubject, setAiSubject] = useState("");
  const [aiBody, setAiBody] = useState("");
  const [aiPrompt, setAiPrompt] = useState({ goal: "email", tone: "friendly", personalization: "", cta: "", length: 300 });
  const handleGenerateAiMessage = async () => {
    setAiLoading(true);
    try {
      // Get token from localStorage (or your auth provider)
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${apiUrl}/api/generate-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
           Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          leadInfo: `Subject: ${form.subject}, Body: ${form.body}`,
          ...aiPrompt,
          type: "email"
        })
      });
      const data = await res.json();
      if (data.message) {
        setAiMessage(data.message);
        setAiSubject(form.subject);
      }
    } catch (e) {
      toast.toast({ title: "AI Error", description: "Failed to generate email message.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };
  // Edit dialog state for drafts
  const [editingDraft, setEditingDraft] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: "", subject: "", body: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<number | null>(null);
  const [enrichmentFilter, setEnrichmentFilter] = useState<"all" | "enriched" | "not_enriched">("all");
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "active" | "paused" | "completed">("all");

  // Edit mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof editForm }) => {
      const res = await apiRequest("PUT", `${apiUrl}/api/email-campaigns/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      setEditingDraft(null);
      queryClient.invalidateQueries({ queryKey: ["http://localhost:8000/api/email-campaigns"] });
      toast.toast({ title: "Draft updated", description: "Draft email campaign updated successfully." });
    },
    onError: (error: any) => {
      toast.toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });
  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `${apiUrl}/api/email-campaigns/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["http://localhost:8000/api/email-campaigns"] });
      toast.toast({ title: "Draft deleted", description: "Draft email campaign deleted successfully." });
    },
    onError: (error: any) => {
      toast.toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const handleEditDraft = (c: any) => {
    setEditingDraft(c);
    setEditForm({ name: c.name, subject: c.subject, body: c.body });
  };
  const handleEditSave = () => {
    if (!editingDraft) return;
    if (!editForm.name.trim() || !editForm.subject.trim() || !editForm.body.trim()) {
      toast.toast({ title: "Validation error", description: "All fields are required.", variant: "destructive" });
      return;
    }
    setEditLoading(true);
    updateMutation.mutate({ id: editingDraft.id, data: editForm });
    setEditLoading(false);
  };
  const handleDeleteDraft = (c: any) => {
    if (!window.confirm("Are you sure you want to delete this draft email campaign? This action cannot be undone.")) return;
    setDeleteLoadingId(c.id);
    deleteMutation.mutate(c.id, {
      onSettled: () => setDeleteLoadingId(null),
    });
  };
  const { data: campaigns, isLoading } = useQuery<any[]>({
    queryKey: ["http://localhost:8000/api/email-campaigns"],
  });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", subject: "", body: "" });
  // Follow-up email draft state
  const [followUpDraft, setFollowUpDraft] = useState({ subject: "", body: "", delay_days: 1 });
  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      // Only send follow_ups if present
      const payload = { ...data };
      const res = await apiRequest("POST", `${apiUrl}/api/email-campaigns`, payload);
      return await res.json();
    },
    onSuccess: () => {
      setShowCreate(false);
      setForm({ name: "", subject: "", body: ""});
      setFollowUpDraft({ subject: "", body: "", delay_days: 1 });
      queryClient.invalidateQueries({ queryKey: ["http://localhost:8000/api/email-campaigns"] });
    },
  });
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendCampaign, setSendCampaign] = useState<any>(null);
  const [sendLeads, setSendLeads] = useState<any[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [personalization, setPersonalization] = useState<{ [leadId: string]: { first_name: string; company: string } }>({});
  const [sending, setSending] = useState(false);
  // (removed duplicate toast declaration)
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [logsCampaign, setLogsCampaign] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  // Fetch leads when send dialog opens
  useEffect(() => {
    if (sendDialogOpen) {
      (async () => {
        const res = await apiRequest("GET", `${apiUrl}/api/leads/list`);
        const data = await res.json();
        setSendLeads(data.leads || []);
        setPersonalization(
          Object.fromEntries((data.leads || []).map((l: any) => [l.id, { first_name: l.first_name, company: l.company }]))
        );
        setSelectedLeadIds((data.leads || []).map((l: any) => l.id));
      })();
    }
  }, [sendDialogOpen]);
  // Fetch logs when dialog opens
  useEffect(() => {
    if (logsDialogOpen && logsCampaign) {
      setLogsLoading(true);
      apiRequest("GET", `${apiUrl}/api/email-campaigns/${logsCampaign.id}/logs`)
        .then(res => res.json())
        .then(data => setLogs(data))
        .finally(() => setLogsLoading(false));
    }
  }, [logsDialogOpen, logsCampaign]);
  // Send handler
  const handleSend = async () => {
    setSending(true);
    try {
      const res = await apiRequest("POST", `${apiUrl}/api/email-campaigns/${sendCampaign.id}/send`, {
        leadIds: selectedLeadIds,
        personalization,
      });
      const data = await res.json();
  toast.toast({ title: "Emails sent", description: data.message });
      setSendDialogOpen(false);
    } catch (e: any) {
  toast.toast({ title: "Send failed", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };


  // Filtered campaigns based on search and status
  const filteredCampaigns = (campaigns || []).filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-blue-700 mb-1">Email Campaigns</h1>
          <p className="text-muted-foreground">Manage your email outreach campaigns</p>
        </header>
        {/* Performance Over Time Card - full width, reduced height, title above */}
        <div className="mb-6">
          <div className="font-semibold text-lg mb-2">Performance Over Time</div>
          <Card className="w-full shadow-sm">
            <CardContent className="p-4">
              <div className="h-40">
                {chartLoading ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading chart...
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={Array.isArray(chartData) && chartData.length > 0 ? chartData : mockChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="sent" stroke="#2563eb" name="Sent" />
                      <Line type="monotone" dataKey="responses" stroke="#10b981" name="Responses" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <Card className="mb-6 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col md:flex-row gap-4 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Input
                    placeholder="Search email campaigns..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as "all" | "draft" | "active" | "paused" | "completed")}
                  className="px-3 py-2 border border-input rounded-md bg-background"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <Button onClick={() => setShowCreate(true)}>Create Email Campaign</Button>
            </div>
          </CardContent>
        </Card>

        {/* Campaigns Grid with stats and actions */}
        {filteredCampaigns.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="p-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-envelope text-muted-foreground text-2xl"></i>
                </div>
                <h3 className="font-medium mb-2">No email campaigns found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchTerm || statusFilter !== "all" 
                    ? "Try adjusting your search or filter criteria"
                    : "Create your first email campaign to start organizing your outreach efforts"
                  }
                </p>
                <Button onClick={() => setShowCreate(true)}>
                  Create Email Campaign
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCampaigns.map((c) => (
              <Card key={c.id} className="shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{c.name}</CardTitle>
                      <div className="text-sm text-muted-foreground">{c.subject}</div>
                    </div>
                    <Badge className={getStatusColor(c.status)}>{c.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-primary">{c.leads_count || 0}</div>
                        <div className="text-xs text-muted-foreground">Leads</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-chart-1">{c.messages_sent || 0}</div>
                        <div className="text-xs text-muted-foreground">Sent</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-chart-2">{c.responses || 0}</div>
                        <div className="text-xs text-muted-foreground">Responses</div>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(c.id, c.status === "active" ? "paused" : "active")}
                      >
                        {c.status === "active" ? "Pause" : "Activate"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditDraft(c)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteDraft(c)}
                        disabled={deleteLoadingId === c.id}
                      >
                        Delete
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setSendCampaign(c); setSendDialogOpen(true); }}
                      >
                        Send Emails
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
       {/* Create Email Campaign Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent> 
           {/* AI Message Generator for Email */}
                  <div className="border rounded p-3 mb-4 bg-blue-50">
                    <div className="font-medium mb-2">AI Email Message Generator</div>
                    <div className="flex flex-col gap-2 mb-2">
                      <Input
                        placeholder="Personalization (e.g. shared interests, company news)"
                        value={aiPrompt.personalization}
                        onChange={e => setAiPrompt(p => ({ ...p, personalization: e.target.value }))}
                      />
                      <Input
                        placeholder="Call to Action (optional)"
                        value={aiPrompt.cta}
                        onChange={e => setAiPrompt(p => ({ ...p, cta: e.target.value }))}
                      />
                      <select value={aiPrompt.tone} onChange={e => setAiPrompt(p => ({ ...p, tone: e.target.value }))} className="border rounded px-2 py-1">
                        <option value="professional">Professional</option>
                        <option value="friendly">Friendly</option>
                        <option value="casual">Casual</option>
                      </select>
                    </div>
                    <Button type="button" onClick={handleGenerateAiMessage} disabled={aiLoading}>
                      {aiLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : "Generate Message"}
                    </Button>
                    {aiMessage.trim() !== "" && (
                      <div className="mt-3 p-2 border rounded bg-muted text-xs whitespace-pre-line">
                        <b>AI Suggested Message:</b>
                        <div>{aiMessage}</div>
                      </div>
                    )}
                  </div>
          <DialogHeader>
            <DialogTitle>Create Email Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Campaign Name {{Campaign_name }}"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
            <Input
              placeholder="Subject {{Subject}}"
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
            />
            <Textarea
              placeholder="Email Body {{Email_body}}"
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              rows={6}
            />
           
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.status === "pending"}>
              {createMutation.status === "pending" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Campaign
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ...existing dialogs... */}
      {/* ...existing code... */}
    </main>
    </div>
    );
}
