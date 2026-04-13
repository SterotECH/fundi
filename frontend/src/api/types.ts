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
