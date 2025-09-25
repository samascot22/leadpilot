import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function RecentActivity() {
  const { data: activity, isLoading } = useQuery<Array<{id: string, status: string, message: string, timestamp: string, leadFirstName: string, leadLastName: string}>>({
    queryKey: ["http://localhost:8000/api/activity"],
  });

  const getActivityIcon = (status: string) => {
    switch (status) {
      case "success":
        return "fas fa-check";
      case "contacted":
        return "fas fa-paper-plane";
      case "responded":
        return "fas fa-reply";
      case "connected":
        return "fas fa-handshake";
      default:
        return "fas fa-clock";
    }
  };

  const getActivityColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-chart-2";
      case "contacted":
        return "bg-primary";
      case "responded":
        return "bg-chart-4";
      case "connected":
        return "bg-chart-2";
      default:
        return "bg-muted";
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return `${Math.floor(diffMins / 1440)} days ago`;
  };

  if (isLoading) {
    return (
      <div className="mt-8 bg-card rounded-lg border border-border">
        <CardHeader className="border-b border-border">
          <CardTitle data-testid="text-recent-activity-title">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </div>
    );
  }

  return (
    <div className="mt-8 bg-card rounded-lg border border-border" data-testid="recent-activity">
      <CardHeader className="border-b border-border">
        <CardTitle data-testid="text-recent-activity-title">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {!activity || activity.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-history text-muted-foreground text-2xl"></i>
            </div>
            <h3 className="font-medium mb-2" data-testid="text-no-activity-title">No activity yet</h3>
            <p className="text-sm text-muted-foreground" data-testid="text-no-activity-description">
              Your outreach activity will appear here once you start contacting leads
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activity.map((item: any, index: number) => (
              <div key={item.id} className="flex items-center gap-4" data-testid={`activity-item-${index}`}>
                <div className={`w-8 h-8 ${getActivityColor(item.status)} rounded-full flex items-center justify-center`}>
                  <i className={`${getActivityIcon(item.status)} text-white text-xs`}></i>
                </div>
                <div className="flex-1">
                  <p className="text-sm" data-testid={`text-activity-message-${index}`}>
                    {item.message || `Activity with ${item.leadFirstName} ${item.leadLastName}`}
                  </p>
                  <p className="text-xs text-muted-foreground" data-testid={`text-activity-timestamp-${index}`}>
                    {formatTimestamp(item.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </div>
  );
}
