export type User = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  organisation_name?: string;
};

export type Client = {
  id: string;
  type: string;
  name: string;
  email: string;
  contact_person: string;
  phone: string;
  address?: string;
  region: string;
  is_archived: boolean;
  notes?: string;
};

export type Lead = {
  id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  source: string;
  status: string;
  notes?: string;
  converted_to_client?: string | null;
};

export type Proposal = {
  id: string;
  title: string;
  client: string;
  client_name?: string;
  description: string;
  sent_date: string | null;
  deadline: string;
  decision_date: string | null;
  status: string;
  amount: string;
  notes?: string;
};

export type Project = {
  id: string;
  title: string;
  description?: string;
  status: string;
  start_date: string;
  due_date: string;
  budget: string;
  client: string;
  client_name?: string;
  proposal?: string | null;
  proposal_title?: string | null;
};

export type Milestone = {
  id: string;
  project: string;
  project_title: string;
  title: string;
  description?: string;
  due_date: string;
  completed: boolean;
  completed_at: string | null;
  order: number;
  created_at?: string;
  updated_at?: string;
};

export type Invoice = {
  id: string;
  invoice_number: string | null;
  client: string;
  client_name: string;
  project: string | null;
  project_title?: string | null;
  status: string;
  notes?: string;
  issue_date: string | null;
  due_date: string | null;
  subtotal: string;
  tax: string;
  total: string;
  amount_paid: string;
  amount_remaining: string;
  created_at: string;
};

export type InvoiceLineItem = {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
  line_total: string;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  amount: string;
  method: string;
  method_display: string;
  provider_reference?: string;
  notes?: string;
  payment_date: string;
  running_balance: string;
  created_at: string;
  updated_at: string;
};

export type TimeLog = {
  id: string;
  project: string;
  project_title: string;
  user: string;
  user_name: string;
  log_date: string;
  hours: string;
  description: string;
  billable: boolean;
  created_at: string;
  updated_at?: string;
};

export type ProjectTimeLogsResponse = {
  total_hours: string;
  billable_hours: string;
  non_billable_hours: string;
  effective_rate: string;
  results: TimeLog[];
};

export type ProjectDetail = Project & {
  milestones: Milestone[];
  time_summary: {
    total_hours: string;
    billable_hours: string;
    non_billable_hours: string;
    effective_rate: string;
  };
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  type: string;
  type_display: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
};

export type NotificationListResponse = {
  count: number;
  unread_count: number;
  results: Notification[];
};

export type InvoiceDetail = Invoice & {
  line_items: InvoiceLineItem[];
  payments: Payment[];
  updated_at: string;
};

export type DashboardSummary = {
  proposal_counts: Record<string, number>;
  proposal_amounts: Record<string, string>;
  upcoming_proposal_deadlines: Array<{
    id: string;
    title: string;
    client: string;
    client_name: string;
    status: string;
    deadline: string;
    amount: string;
  }>;
  active_projects: Array<{
    id: string;
    title: string;
    client: string;
    client_name: string;
    status: string;
    due_date: string;
    budget: string;
  }>;
  total_outstanding: string;
  overdue_invoices: Array<{
    id: string;
    invoice_number: string | null;
    client: string;
    client_name: string;
    status: string;
    due_date: string | null;
    total: string;
    amount_paid: string;
    amount_remaining: string;
  }>;
  unread_notifications_count: number;
};

export type AssistantItem = {
  type: string;
  label: string;
  reason: string;
  entity_type?: string;
  entity_id?: string;
  priority: number;
};

export type AssistantDraft = {
  subject: string;
  body: string;
  template_key: string;
};

export type AssistantQueryResponse = {
  reply: string;
  matched_rule: string;
  data_context_used?: string;
  draft?: AssistantDraft;
  items?: AssistantItem[];
};

export type RevenueSummary = {
  this_month_collected: string;
  last_month_collected: string;
  mom_change_pct: number;
  ytd_collected: string;
  total_outstanding: string;
  overdue_count: number;
  overdue_total: string;
};

export type RevenuePoint = {
  month: string;
  collected_ghs: string;
  invoiced_ghs: string;
};

export type RevenueSeries = {
  months: RevenuePoint[];
  total_collected: string;
  total_outstanding: string;
};

export type PipelineStatusRow = {
  status: string;
  count: number;
  total_value_ghs: string;
};

export type PipelineMetrics = {
  by_status: PipelineStatusRow[];
  win_rate_pct: number;
  avg_deal_value_ghs: string;
  avg_days_to_close: number;
  total_pipeline_value_ghs: string;
};

export type ClientProfitabilityRow = {
  client_id: string;
  client_name: string;
  invoiced_ghs: string;
  collected_ghs: string;
  outstanding_ghs: string;
  total_hours: number;
  billable_hours: number;
  effective_rate_ghs: string;
  open_proposals: number;
};

export type ProjectBudgetBurnRow = {
  project_id: string;
  title: string;
  client_name: string;
  budget_ghs: string;
  invoiced_ghs: string;
  collected_ghs: string;
  total_hours: number;
  billable_hours: number;
  burn_pct: number;
  status: string;
};

export type Insight = {
  type: string;
  severity: string;
  title: string;
  body: string;
  entity_type?: string;
  entity_id?: string;
  value?: string;
};

export type AssistantBriefing = {
  headline: string;
  revenue_summary: RevenueSummary;
  follow_up: AssistantQueryResponse;
  insights: Insight[];
};
