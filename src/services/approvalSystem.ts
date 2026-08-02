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

type ApprovalListener = (pending: ApprovalRequest[]) => void;

class ApprovalSystem {
  private pendingApprovals: Map<string, ApprovalRequest> = new Map();
  private resolvers: Map<string, (response: ApprovalResponse) => void> = new Map();
  private listeners: Set<ApprovalListener> = new Set();

  subscribe(listener: ApprovalListener): () => void {
    this.listeners.add(listener);
    listener(this.getPendingApprovals());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const list = this.getPendingApprovals();
    this.listeners.forEach((listener) => listener(list));
  }

  async requestApproval(request: Omit<ApprovalRequest, 'id' | 'timestamp'>): Promise<ApprovalResponse> {
    const id = `approval_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const fullRequest: ApprovalRequest = {
      ...request,
      id,
      timestamp: new Date().toISOString(),
    };

    this.pendingApprovals.set(id, fullRequest);
    this.notify();

    return new Promise<ApprovalResponse>((resolve) => {
      this.resolvers.set(id, resolve);
    });
  }

  resolveApproval(
    requestId: string,
    decision: 'approved' | 'rejected' | 'alternative',
    selectedAlternative?: number,
    feedback?: string
  ): void {
    const resolve = this.resolvers.get(requestId);
    if (!resolve) return;

    this.resolvers.delete(requestId);
    this.pendingApprovals.delete(requestId);
    this.notify();

    resolve({ requestId, decision, selectedAlternative, feedback });
  }

  getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values());
  }

  hasPendingApprovals(): boolean {
    return this.pendingApprovals.size > 0;
  }
}

export const approvalSystem = new ApprovalSystem();
