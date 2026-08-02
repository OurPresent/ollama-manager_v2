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

export type ApprovalRequestInput = Omit<ApprovalRequest, 'id' | 'timestamp'> & {
  projectId?: string;
};

type ApprovalListener = (pending: ApprovalRequest[]) => void;

const API_BASE = '/api';

const persistRequest = async (request: ApprovalRequestInput): Promise<void> => {
  try {
    await fetch(`${API_BASE}/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: request.projectId ?? null,
        scopeType: request.type,
        title: request.title,
        description: request.description,
        details: request.details,
      }),
    });
  } catch (error) {
    console.warn('No se pudo persistir la solicitud de aprobación:', error);
  }
};

const persistDecision = async (
  requestId: string,
  decision: 'approved' | 'rejected' | 'alternative',
  selectedAlternative?: number,
  feedback?: string
): Promise<void> => {
  try {
    await fetch(`${API_BASE}/approvals/${encodeURIComponent(requestId)}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, selectedAlternative, feedback }),
    });
  } catch (error) {
    console.warn('No se pudo persistir la decisión de aprobación:', error);
  }
};

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

  async requestApproval(request: ApprovalRequestInput): Promise<ApprovalResponse> {
    const id = `approval_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const fullRequest: ApprovalRequest = {
      ...request,
      id,
      timestamp: new Date().toISOString(),
    };

    this.pendingApprovals.set(id, fullRequest);
    this.notify();
    persistRequest(request);

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
    persistDecision(requestId, decision, selectedAlternative, feedback);

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
