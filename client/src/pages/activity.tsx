import { Sidebar } from "@/components/dashboard/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

export default function Activity() {
  const [filter, setFilter] = useState("all");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const { data: activity, isLoading } = useQuery<Array<{
    id: string;
    action: string;
    lead?: string;
    campaign?: string;
    timestamp: string;
    status: string;
  }>>({
    queryKey: ["/api/activity"],
  });
  const apiUrl = import.meta.env.VITE_API_URL;
  const getActivityIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case "message sent":
        return "fas fa-paper-plane";
      case "lead uploaded":
        return "fas fa-upload";
      case "message replied":
        return "fas fa-reply";
      case "connection made":
        return "fas fa-handshake";
      case "campaign created":
        return "fas fa-bullhorn";
      default:
        return "fas fa-clock";
    }
  };

  const getActivityColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "success":
        return "bg-green-500";
      case "pending":
        return "bg-yellow-500";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-blue-500";
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const filteredActivity = activity?.filter(item => {
    if (filter === "all") return true;
    const matchesAction = item.action.toLowerCase().includes(filter.toLowerCase());
    const matchesDate = (!dateRange.from || new Date(item.timestamp) >= new Date(dateRange.from)) && (!dateRange.to || new Date(item.timestamp) <= new Date(dateRange.to));
    return matchesAction && matchesDate;
  }) || [];

  const filters = [
    { key: "all", label: "All Activity" },
    { key: "message", label: "Messages" },
    { key: "upload", label: "Uploads" },
    { key: "campaign", label: "Campaigns" },
  ];

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
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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
            <h1 className="text-2xl font-bold text-blue-700 mb-1" data-testid="text-activity-title">Activity Logs</h1>
            <p className="text-muted-foreground" data-testid="text-activity-description">
              Track all your outreach activities and system events
            </p>
          </div>
          <div className="flex gap-2">
            <input type="date" value={dateRange.from} onChange={e => setDateRange(r => ({ ...r, from: e.target.value }))} className="border rounded px-2 py-1" />
            <span>to</span>
            <input type="date" value={dateRange.to} onChange={e => setDateRange(r => ({ ...r, to: e.target.value }))} className="border rounded px-2 py-1" />
            <Button size="sm" variant="outline" onClick={() => {
              // Export filtered activity as CSV
              const csv = filteredActivity.map(a => `${a.id},${a.action},${a.lead || ""},${a.campaign || ""},${a.timestamp},${a.status}`).join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const link = document.createElement("a");
              link.href = URL.createObjectURL(blob);
              link.download = "activity.csv";
              link.click();
            }}>Export CSV</Button>
          </div>
        </header>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {filters.map((filterOption) => (
            <Button
              key={filterOption.key}
              variant={filter === filterOption.key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(filterOption.key)}
              data-testid={`filter-${filterOption.key}`}
            >
              {filterOption.label}
            </Button>
          ))}
        </div>

        {/* Analytics & Activity List */}
        <Card className="mb-6 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Recent Activity & Analytics</span>
              <span className="text-sm font-normal text-muted-foreground">{filteredActivity.length} found</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Analytics summary */}
            <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 border rounded text-center bg-white">
                <div className="text-xs text-muted-foreground">Enrichment Success</div>
                <div className="text-2xl font-bold text-green-600">{filteredActivity.filter(a => a.action.toLowerCase().includes("enrich") && a.status === "success").length}</div>
              </div>
              <div className="p-4 border rounded text-center bg-white">
                <div className="text-xs text-muted-foreground">Emails Sent</div>
                <div className="text-2xl font-bold text-blue-600">{filteredActivity.filter(a => a.action.toLowerCase().includes("email") && a.status === "success").length}</div>
              </div>
              <div className="p-4 border rounded text-center bg-white">
                <div className="text-xs text-muted-foreground">Delivery Rate</div>
                <div className="text-2xl font-bold text-primary">{filteredActivity.length > 0 ? Math.round(100 * filteredActivity.filter(a => a.action.toLowerCase().includes("email") && a.status === "success").length / filteredActivity.filter(a => a.action.toLowerCase().includes("email")).length) : 0}%</div>
              </div>
              <div className="p-4 border rounded text-center bg-white">
                <div className="text-xs text-muted-foreground">Engagement</div>
                <div className="text-2xl font-bold text-chart-2">{filteredActivity.filter(a => a.action.toLowerCase().includes("reply") && a.status === "success").length}</div>
              </div>
            </div>
            {/* Export option */}
            <Button variant="outline" size="sm" className="mb-4" onClick={() => {
              const csv = ["Action,Status,Lead,Campaign,Timestamp"].concat(
                filteredActivity.map(a => `${a.action},${a.status},${a.lead || ""},${a.campaign || ""},${a.timestamp}`)
              ).join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const link = document.createElement("a");
              link.href = window.URL.createObjectURL(blob);
              link.download = "activity-analytics.csv";
              document.body.appendChild(link);
              link.click();
              link.remove();
            }}>Export Analytics</Button>
            {/* Activity List */}
            {filteredActivity.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-history text-muted-foreground text-2xl"></i>
                </div>
                <h3 className="font-medium mb-2" data-testid="text-no-activity-title">No activity found</h3>
                <p className="text-sm text-muted-foreground" data-testid="text-no-activity-description">
                  {filter === "all" 
                    ? "Your activity will appear here once you start using the platform"
                    : `No ${filter} activities found. Try a different filter.`
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredActivity.map((item, index) => (
                  <div 
                    key={item.id} 
                    className="flex items-center gap-4 p-4 border rounded-lg bg-white hover:bg-muted/50 transition-colors"
                    data-testid={`activity-item-${index}`}
                  >
                    <div className={`w-8 h-8 ${getActivityColor(item.status)} rounded-full flex items-center justify-center`}>
                      <i className={`${getActivityIcon(item.action)} text-white text-xs`}></i>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium" data-testid={`text-activity-action-${index}`}>
                          {item.action}
                        </span>
                        <Badge 
                          variant={item.status === "success" ? "default" : "secondary"}
                          data-testid={`badge-activity-status-${index}`}
                        >
                          {item.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.lead && (
                          <span data-testid={`text-activity-lead-${index}`}>
                            Lead: {item.lead}
                          </span>
                        )}
                        {item.campaign && (
                          <span data-testid={`text-activity-campaign-${index}`}>
                            Campaign: {item.campaign}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1" data-testid={`text-activity-timestamp-${index}`}>
                        {formatTimestamp(item.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
