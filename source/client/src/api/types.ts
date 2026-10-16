export interface Ref { id: string; name: string }
export interface Health { status: 'ok' | 'degraded'; version: string; infobase: string; platform: string }
export interface WorkOrderCaps { list: boolean; read: boolean; create: boolean; update: boolean; post: boolean; unpost: boolean; print: boolean }
export interface Capabilities { workOrders: WorkOrderCaps; notes?: Record<string, string> }
export interface LoginResponse { token: string; expiresIn: number; roles: string[] }
export interface WorkOrderSummary {
  id: string; number: string; date: string; state: string; posted: boolean;
  customer?: Ref | null; car?: Ref | null; total: number;
}
export interface WorkOrderPage { items: WorkOrderSummary[]; total: number }
export interface PartLine { item: Ref; quantity: number; unit?: Ref | null; price: number; discountPercent?: number; warehouse?: Ref | null; amount: number; vatAmount?: number }
export interface WorkLine { work: Ref; lineKey?: string; quantity: number; normHours?: Ref | null; price: number; discountPercent?: number; status?: string; amount: number }
export interface PerformerLine { lineKey?: string; employee: Ref; workshop?: Ref | null; percent?: number }
export interface WorkOrder extends WorkOrderSummary {
  organization?: Ref | null; master?: Ref | null; manager?: Ref | null; repairType?: Ref | null;
  reason?: string; recommendations?: string; startDate?: string | null; endDate?: string | null;
  parts: PartLine[]; works: WorkLine[]; performers: PerformerLine[]; totalParts: number; totalWorks: number;
}
export interface WorkOrderSummaryReport {
  total: number; posted: number; firstDate?: string | null; lastDate?: string | null;
  byState: { state: string; count: number }[]; last30Days: { count: number; amount: number };
}
export interface WorkOrderQuery { q?: string; state?: string; page?: number; pageSize?: number }
