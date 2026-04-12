export type User = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
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
};

export type DashboardSummary = {
  proposal_counts: Record<string, number>;
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
};
