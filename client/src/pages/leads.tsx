import { Sidebar } from "@/components/dashboard/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Filter, Download, Upload, Eye, Edit, Trash2, Globe } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useEffect } from "react";

const apiUrl = import.meta.env.VITE_API_URL;
interface Lead {
  id: number;
  first_name: string;
  last_name: string;
  job_title: string;
  company: string;
  profile_url: string;
  status: string;
  message_text?: string;
  email?: string;
  email_confidence?: number;
    campaign_id: number;
  }
export default function Leads() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const enrichEmailMutation = useMutation({
    mutationFn: async (leadId: number) => {
      const res = await apiRequest("POST", `${apiUrl}/api/enrich-email`, { leadId });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["http://localhost:8000/api/leads/list"] });
      toast({ title: "Email enriched", description: data.email ? `Email: ${data.email} (Confidence: ${data.confidence})` : data.message });
    },
    onError: (error: Error) => {
      toast({ title: "Enrichment failed", description: error.message, variant: "destructive" });
    },
  });
  // ...existing code...
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [enrichmentFilter, setEnrichmentFilter] = useState("all");
  // Removed campaignFilter state
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
  const [scrapeModalOpen, setScrapeModalOpen] = useState(false);
  const [scrapeForm, setScrapeForm] = useState({
    keywords: "",
    industry: "",
    location: "",
    currentCompany: "",
    job_title: ""
  });
  // Removed web scrape modal and related states
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Fetch campaigns for assignment
  const { data: campaigns } = useQuery<any[]>({
    queryKey: ["http://localhost:8000/api/email-campaigns"],
  });
  // Fetch leads with unassigned filter
  const { data: leads, isLoading, refetch } = useQuery<{leads: Lead[]}>({
    queryKey: ["http://localhost:8000/api/leads/list", showUnassigned],
    queryFn: async () => {
      const res = await apiRequest("GET", `${apiUrl}/api/leads/list?unassigned=${showUnassigned}`);
      return await res.json();
    },
  });

  const { data: usage } = useQuery<{ current_usage: number; limit: number; tier: string }>({
    queryKey: ["http://localhost:8000/api/subscriptions/usage"],
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: number; status: string }) => {
      const res = await apiRequest("PUT", `${apiUrl}/api/${leadId}`, { status });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["http://localhost:8000/api/leads/list"] });
      queryClient.invalidateQueries({ queryKey: ["http://localhost:8000/api/subscriptions/usage"] });
      
      if (data.warning === "approaching_limit") {
        toast({
          title: "Approaching Limit",
          description: data.message,
          action: (
            <Button variant="outline" size="sm" onClick={() => window.location.href = "/pricing"}>
              Upgrade Plan
            </Button>
          ),
        });
      } else if (data.warning === "limit_reached") {
        toast({
          title: "Limit Reached",
          description: data.message,
          variant: "destructive",
          action: (
            <Button variant="outline" size="sm" onClick={() => window.location.href = "/pricing"}>
              Upgrade Now
            </Button>
          ),
        });
      } else {
        toast({
          title: "Lead updated",
          description: "Lead status has been updated successfully.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (leadId: number) => {
      const res = await apiRequest("DELETE", `${apiUrl}/api/${leadId}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["http://localhost:8000/api/leads/list"] });
      toast({
        title: "Lead deleted",
        description: "Lead has been removed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add mutation for scraping LinkedIn leads
  const scrapeLeadsMutation = useMutation({
    mutationFn: async (filters: typeof scrapeForm) => {
      const res = await apiRequest("POST", `${apiUrl}/api/scrape-linkedin-leads`, filters);
      return await res.json();
    },
    onSuccess: (data) => {
      setScrapeModalOpen(false);
      toast({
        title: "Scraping started",
        description: data.message || "LinkedIn lead scraping has been triggered.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Scraping failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Export leads as CSV (with auth)
  const handleExport = async () => {
    const token = localStorage.getItem("access_token");
    const url = `${apiUrl}/api/export?unassigned=${showUnassigned}`;
    if (!token) {
      toast({ title: "Not authenticated", description: "Please log in to export leads.", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed: " + res.statusText);
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = "leads.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    }
  };

  // Upload leads from file (CSV)
  const fileInputRef = useState(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.style.display = 'none';
    return input;
  })[0];

  // Show campaign select dialog before upload
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadCampaign, setUploadCampaign] = useState("");

  const handleUploadClick = () => {
    if (fileInputRef) {
      fileInputRef.value = '';
      fileInputRef.onchange = (e: any) => handleFileChange(e);
      fileInputRef.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement> | Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      setPendingFile(input.files[0]);
      setUploadDialogOpen(true);
    }
  };

  // Read CSV and upload to backend
  const handleUploadLeads = async () => {
    if (!pendingFile || !uploadCampaign) return;
    setUploading(true);
    try {
      const text = await pendingFile.text();
      const res = await apiRequest("POST", `${apiUrl}/api/upload`, {
        csvData: text,
        campaignId: uploadCampaign,
      });
      const data = await res.json();
      toast({ title: data.message, description: data.warning ? data.warning : undefined });
      setUploadDialogOpen(false);
      setPendingFile(null);
      setUploadCampaign("");
      refetch();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };
  // Assign selected leads to campaign
  const handleAssignToCampaign = async () => {
    setAssigning(true);
    try {
      const res = await apiRequest("POST", `${apiUrl}/api/assign-to-campaign`, {
        leadIds: selectedLeads,
        campaignId: selectedCampaign,
      });
      const data = await res.json();
      toast({ title: "Leads assigned", description: data.message });
      setAssignDialogOpen(false);
      setSelectedLeads([]);
      refetch();
    } catch (e: any) {
      toast({ title: "Assign failed", description: e.message, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const filteredLeads = leads?.leads?.filter(lead => {
    const matchesSearch = 
      lead.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.job_title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    const matchesEnrichment = enrichmentFilter === "all" || (enrichmentFilter === "enriched" ? !!lead.email : !lead.email);
    return matchesSearch && matchesStatus && matchesEnrichment;
  }) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "contacted":
        return "bg-blue-100 text-blue-800";
      case "replied":
        return "bg-green-100 text-green-800";
      case "connected":
        return "bg-purple-100 text-purple-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleStatusChange = (leadId: number, newStatus: string) => {
    updateLeadMutation.mutate({ leadId, status: newStatus });
  };

  const handleDeleteLead = (leadId: number) => {
    if (confirm("Are you sure you want to delete this lead?")) {
      deleteLeadMutation.mutate(leadId);
    }
  };

  const handleSelectLead = (leadId: number) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleSelectAll = () => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map(lead => lead.id));
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">
          <header className="mb-8">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </header>
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-blue-700 mb-1" data-testid="text-leads-title">Leads</h1>
            <p className="text-muted-foreground" data-testid="text-leads-description">
              Manage your LinkedIn leads and outreach status
            </p>
          </div>
        </header>

        {/* Usage Warning Banner */}
        {usage && usage.current_usage >= usage.limit * 0.8 && (
          <Card className={`mb-6 shadow-sm ${usage.current_usage >= usage.limit ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${usage.current_usage >= usage.limit ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                  <div>
                    <p className={`font-medium ${usage.current_usage >= usage.limit ? 'text-red-800' : 'text-yellow-800'}`}>
                      <strong>Usage:</strong> You can generate up to 100 leads per day. For higher limits, set up your Phantombuster API key in <a href="/settings" className="underline text-blue-700">Settings</a>.
                    </p>
                    <p className={`text-sm ${usage.current_usage >= usage.limit ? 'text-red-600' : 'text-yellow-600'}`}>
                      {usage.current_usage}/{usage.limit} leads used on your {usage.tier} plan
                    </p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant={usage.current_usage >= usage.limit ? "destructive" : "outline"}
                  onClick={() => window.location.href = "/pricing"}
                >
                  {usage.current_usage >= usage.limit ? 'Upgrade Now' : 'Upgrade Plan'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters and Actions */}
        <Card className="mb-6 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-4 items-center w-full">
              <div className="flex flex-wrap gap-4 w-full">
                <div className="relative flex-grow min-w-[220px] max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search leads..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full"
                    data-testid="input-search-leads"
                  />
                </div>
                <div className="flex-grow min-w-[180px] max-w-xs">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full" data-testid="select-status-filter">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="replied">Replied</SelectItem>
                      <SelectItem value="connected">Connected</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-grow min-w-[180px] max-w-xs">
                  <Select value={enrichmentFilter} onValueChange={setEnrichmentFilter}>
                    <SelectTrigger className="w-full" data-testid="select-enrichment-filter">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by enrichment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="enriched">Enriched</SelectItem>
                      <SelectItem value="not_enriched">Not Enriched</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Bulk Actions */}
                {selectedLeads.length > 0 && (
                  <Button size="sm" variant="default" onClick={() => setAssignDialogOpen(true)} data-testid="button-bulk-assign">
                    Assign Selected to Campaign
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export-leads">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <a
                  href="/csv-template/leads-template.csv"
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  <Button size="sm" variant="outline" data-testid="button-download-csv-template">
                    Download Lead Template
                  </Button>
                </a>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setScrapeModalOpen(true)}
                  data-testid="button-scrape-linkedin-leads"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Scrape  Leads
                </Button>
                     {/* <Button size="sm" variant="outline" onClick={() => setShowUnassigned(v => !v)} data-testid="button-toggle-unassigned">
                  {showUnassigned ? "Show All Leads" : "Show Unassigned Leads"}
                </Button> */}
                {/* {showUnassigned && (
                  <Button size="sm" variant="default" disabled={selectedLeads.length === 0} onClick={() => setAssignDialogOpen(true)} data-testid="button-assign-campaign">
                    Assign to Campaign
                  </Button>
                )} */}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leads Table */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle data-testid="text-leads-table-title">Lead Management</CardTitle>
            <CardDescription data-testid="text-leads-table-description">
              {filteredLeads.length} leads found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredLeads.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-users text-muted-foreground text-2xl"></i>
                </div>
                <h3 className="font-medium mb-2" data-testid="text-no-leads-title">No leads found</h3>
                <p className="text-sm text-muted-foreground mb-4" data-testid="text-no-leads-description">
                  {searchTerm || statusFilter !== "all" 
                    ? "Try adjusting your search or filter criteria"
                    : "Upload leads through campaigns to get started"
                  }
                </p>
                <Button data-testid="button-upload-first-leads" onClick={handleUploadClick}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Leads
                </Button>
      {/* Upload Leads Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Leads to Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>File: {pendingFile?.name}</div>
            <Select value={uploadCampaign} onValueChange={setUploadCampaign}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns?.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleUploadLeads} disabled={!uploadCampaign || uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload
            </Button>
          </div>
        </DialogContent>
      </Dialog>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                        onChange={handleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id} data-testid={`lead-row-${lead.id}`}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedLeads.includes(lead.id)}
                          onChange={() => handleSelectLead(lead.id)}
                          data-testid={`checkbox-lead-${lead.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium" data-testid={`text-lead-name-${lead.id}`}>
                            {lead.first_name} {lead.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <a 
                              href={lead.profile_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:underline"
                              data-testid={`link-lead-profile-${lead.id}`}
                            >
                              View Profile
                            </a>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-lead-company-${lead.id}`}>
                        {lead.company}
                      </TableCell>
                      <TableCell data-testid={`text-lead-title-${lead.id}`}>
                        {lead.job_title}
                      </TableCell>
                      <TableCell>
                        {lead.email ? (
                          <div>
                            <span className="font-mono text-xs">{lead.email}</span>
                            {typeof lead.email_confidence === "number" && (
                              <Badge variant="secondary" className="ml-2">Confidence: {lead.email_confidence}</Badge>
                            )}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => enrichEmailMutation.mutate(lead.id)}
                            disabled={enrichEmailMutation.isPending}
                            data-testid={`button-enrich-email-${lead.id}`}
                          >
                            {enrichEmailMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : "Enrich Email"}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={lead.status}
                          onValueChange={(value) => handleStatusChange(lead.id, value)}
                        >
                          <SelectTrigger className="w-32" data-testid={`select-lead-status-${lead.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="replied">Replied</SelectItem>
                            <SelectItem value="connected">Connected</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`button-view-lead-${lead.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`button-edit-lead-${lead.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteLead(lead.id)}
                            data-testid={`button-delete-lead-${lead.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
      <Dialog open={scrapeModalOpen} onOpenChange={setScrapeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scrape LinkedIn Leads</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); scrapeLeadsMutation.mutate(scrapeForm); }}>
            <div className="space-y-4">
              <Input
                placeholder="Keywords (optional)"
                value={scrapeForm.keywords}
                onChange={e => setScrapeForm(f => ({ ...f, keywords: e.target.value }))}
                data-testid="input-scrape-keywords"
              />
              <Input
                placeholder="Industry (optional)"
                value={scrapeForm.industry}
                onChange={e => setScrapeForm(f => ({ ...f, industry: e.target.value }))}
                data-testid="input-scrape-industry"
              />
              <Input
                placeholder="Location (optional)"
                value={scrapeForm.location}
                onChange={e => setScrapeForm(f => ({ ...f, location: e.target.value }))}
                data-testid="input-scrape-location"
              />
              <Input
                placeholder="Current Company (optional)"
                value={scrapeForm.currentCompany}
                onChange={e => setScrapeForm(f => ({ ...f, currentCompany: e.target.value }))}
                data-testid="input-scrape-company"
              />
              <Input
                placeholder="Job Title (optional)"
                value={scrapeForm.job_title}
                onChange={e => setScrapeForm(f => ({ ...f, job_title: e.target.value }))}
                data-testid="input-scrape-job-title"
              />
            </div>
            <DialogFooter className="mt-6">
              <Button type="submit" disabled={scrapeLeadsMutation.isPending}>
                {scrapeLeadsMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Start Scraping
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Leads to Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns?.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAssignToCampaign} disabled={!selectedCampaign || assigning}>
              {assigning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : "Assign"}
            </Button>
          </div>
        </DialogContent>
      </Dialog> */}
    </div>
  );
}
