export interface ApprovalRequest {
  id: string;
  type: 'file_edit' | 'code_change' | 'architecture_decision' | 'dependency_install';
  title: string;
  description: string;
  details: {
    files?: string[];
    changes?: string[];
    alternatives?: string[];
    riskLevel: 'low' | 'medium' | 'high';
  };
  timestamp: string;
}

export interface ApprovalResponse {
  requestId: string;
  decision: 'approved' | 'rejected' | 'alternative';
  selectedAlternative?: number;
  feedback?: string;
}

type ApprovalCallback = (request: ApprovalRequest) => Promise<ApprovalResponse>;

class ApprovalSystem {
  private pendingApprovals: Map<string, ApprovalRequest> = new Map();
  private callback: ApprovalCallback | null = null;

  setCallback(callback: ApprovalCallback) {
    this.callback = callback;
  }

  async requestApproval(request: Omit<ApprovalRequest, 'id' | 'timestamp'>): Promise<ApprovalResponse> {
    const id = `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullRequest: ApprovalRequest = {
      ...request,
      id,
      timestamp: new Date().toISOString(),
    };

    this.pendingApprovals.set(id, fullRequest);

    if (!this.callback) {
      return {
        requestId: id,
        decision: 'rejected',
        feedback: 'No approval callback configured',
      };
    }

    try {
      const response = await this.callback(fullRequest);
      this.pendingApprovals.delete(id);
      return response;
    } catch (error) {
      this.pendingApprovals.delete(id);
      return {
        requestId: id,
        decision: 'rejected',
        feedback: 'Error processing approval',
      };
    }
  }

  getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values());
  }

  hasPendingApprovals(): boolean {
    return this.pendingApprovals.size > 0;
  }
}

export const approvalSystem = new ApprovalSystem();