/**
 * API client utility for making authenticated requests
 */

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  // Auth
  async login(email: string, password: string, orgSlug?: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, orgSlug }),
    });
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  // Tasks
  async getTasks(params?: Record<string, string>) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/tasks${query ? `?${query}` : ''}`);
  }

  async getTask(id: string) {
    return this.request(`/tasks/${id}`);
  }

  async createTask(data: any) {
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: string, data: any) {
    return this.request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id: string) {
    return this.request(`/tasks/${id}`, { method: 'DELETE' });
  }

  // Task Updates
  async getTaskUpdates(taskId: string) {
    return this.request(`/tasks/${taskId}/updates`);
  }

  async createTaskUpdate(taskId: string, data: any) {
    return this.request(`/tasks/${taskId}/updates`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Task Comments
  async getTaskComments(taskId: string) {
    return this.request(`/tasks/${taskId}/comments`);
  }

  async createTaskComment(taskId: string, data: any) {
    return this.request(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Employees
  async getEmployees(params?: Record<string, string>) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/employees${query ? `?${query}` : ''}`);
  }

  async getEmployee(id: string) {
    return this.request(`/employees/${id}`);
  }

  async createEmployee(data: any) {
    return this.request('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmployee(id: string, data: any) {
    return this.request(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async inviteEmployee(id: string) {
    return this.request(`/employees/${id}/invite`, { method: 'POST' });
  }

  // Departments
  async getDepartments(params?: Record<string, string>) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/departments${query ? `?${query}` : ''}`);
  }

  async getDepartment(id: string) {
    return this.request(`/departments/${id}`);
  }

  async createDepartment(data: any) {
    return this.request('/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDepartment(id: string, data: any) {
    return this.request(`/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Analytics
  async getAnalytics(params?: Record<string, string>) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/analytics${query ? `?${query}` : ''}`);
  }

  // Notifications
  async getNotifications(unreadOnly = false, limit = 50) {
    return this.request(`/notifications?unreadOnly=${unreadOnly}&limit=${limit}`);
  }

  async markNotificationAsRead(id: string) {
    return this.request(`/notifications/${id}`, { method: 'PUT' });
  }

  async markAllNotificationsAsRead() {
    return this.request('/notifications/mark-all-read', { method: 'POST' });
  }

  // Transfers
  async getTransfers(params?: Record<string, string>) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/transfers${query ? `?${query}` : ''}`);
  }

  async createTransfer(data: any) {
    return this.request('/transfers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTransfer(id: string, data: any) {
    return this.request(`/transfers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();
