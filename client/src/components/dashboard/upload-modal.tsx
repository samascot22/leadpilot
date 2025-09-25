import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaigns } = useQuery<Array<{id: string, name: string}>>({
  queryKey: ["/api/campaigns/campaigns"],
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ campaignId, csvData }: { campaignId: string; csvData: string }) => {
      const res = await apiRequest("POST", "/api/leads/upload", { campaignId, csvData });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Upload successful",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
      onClose();
      setSelectedFile(null);
      setSelectedCampaign("");
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "text/csv") {
      setSelectedFile(file);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please select a CSV file",
        variant: "destructive",
      });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedCampaign) {
      toast({
        title: "Missing information",
        description: "Please select a file and campaign",
        variant: "destructive",
      });
      return;
    }

    try {
      const csvContent = await selectedFile.text();
      uploadMutation.mutate({ campaignId: selectedCampaign, csvData: csvContent });
    } catch (error) {
      toast({
        title: "File read error",
        description: "Failed to read the CSV file",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="upload-modal">
        <DialogHeader>
          <DialogTitle data-testid="text-upload-modal-title">Upload Leads</DialogTitle>
          <DialogDescription data-testid="text-upload-modal-description">
            Import leads from a CSV file to your campaign
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="campaign-select" data-testid="label-campaign-select">Select Campaign</Label>
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger data-testid="select-campaign">
                <SelectValue placeholder="Choose a campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns?.map((campaign: any) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="csv-file" data-testid="label-csv-file">CSV File</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <i className="fas fa-cloud-upload text-4xl text-muted-foreground mb-4"></i>
              <p className="text-sm font-medium mb-2" data-testid="text-upload-instruction">
                {selectedFile ? selectedFile.name : "Drop your CSV file here"}
              </p>
              <p className="text-xs text-muted-foreground mb-4">or click to browse</p>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                data-testid="input-csv-file"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById("csv-file")?.click()}
                data-testid="button-choose-file"
              >
                Choose File
              </Button>
            </div>
            <div className="mt-4 text-xs text-muted-foreground" data-testid="text-csv-format-info">
              <p>Supported format: CSV with columns: first_name, last_name, job_title, company, profile_url</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-upload">
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={uploadMutation.isPending || !selectedFile || !selectedCampaign}
            data-testid="button-upload-file"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
