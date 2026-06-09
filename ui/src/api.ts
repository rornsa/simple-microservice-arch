import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:3000/api' });

// Request interceptor to attach bearer token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor to handle 401 Unauthorized errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only reload if it's not a login request
    if (error.response && error.response.status === 401 && !error.config.url.endsWith('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// ---- Types ----

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface StudentsResponse {
  data: Student[];
  pagination: Pagination;
}

type BaseResult<T> = {
  success: boolean;
  message: string;
  data: T;
}

export type PaymentResult = BaseResult<{ message: string }>

export interface Payment {
  id: number;
  student_id: number;
  amount: number;
  reference: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  transaction_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PaymentsResponse {
  data: Payment[];
}

// ---- Endpoints ----

export type LoginResponse = BaseResult<{
  token: string;
  user: {
    id: number;
    email: string;
    role: string;
  };
}>

export const login = async (email: string, password: string): Promise<LoginResponse> => {
  const res = await api.post('/auth/login', { email, password });
  return res.data
};

export const fetchStudents = async (): Promise<StudentsResponse> => {
  const res = await api.get('/student');
  return res.data
};

export const makePayment = async (
  studentId: string,
  payload: { amount: number; reference: string }
): Promise<PaymentResult> => {
  const res = await api.post(`/student/${studentId}/pay`, payload);
  return res.data
};

export const fetchPayments = async (studentId?: string): Promise<PaymentsResponse> => {
  const url = studentId ? `/payments?student_id=${studentId}` : '/payments';
  const res = await api.get(url);
  return res.data
};

