import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface QuickActionsProps {
  onUploadClick: () => void;
}

export function QuickActions({ onUploadClick }: QuickActionsProps) {
  return (
    <Card data-testid="quick-actions">
      <CardHeader className="border-b border-border">
        <CardTitle data-testid="text-quick-actions-title">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-3">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onUploadClick}
          data-testid="button-upload-leads"
        >
          <i className="fas fa-upload text-primary mr-3"></i>
          <div className="text-left">
            <div className="font-medium text-sm">Upload Leads</div>
            <div className="text-xs text-muted-foreground">Import CSV file</div>
          </div>
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          data-testid="button-view-analytics"
          onClick={() => window.location.href = "/activity"}
        >
          <i className="fas fa-chart-bar text-chart-1 mr-3"></i>
          <div className="text-left">
            <div className="font-medium text-sm">View Activity Log</div>
            <div className="text-xs text-muted-foreground">Recent actions & logs</div>
          </div>
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          data-testid="button-manage-plan"
          onClick={() => window.location.href = "/pricing"}
        >
          <i className="fas fa-credit-card text-chart-2 mr-3"></i>
          <div className="text-left">
            <div className="font-medium text-sm">Manage Plan</div>
            <div className="text-xs text-muted-foreground">Upgrade or change</div>
          </div>
        </Button>
      </CardContent>
    </Card>
  );
}
