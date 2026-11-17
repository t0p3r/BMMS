import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  EyeOff,
  FileText,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';

// ==================== TYPES ====================
type UserRole = 'Manager' | 'Cashier' | 'Collector' | 'Auditor';
type PaymentFrequency = 'Daily' | 'Weekly' | 'Biweekly' | 'Monthly';
type InterestMethod = 'Flat' | 'Declining';
type NavTab =
  | 'dashboard'
  | 'borrowers'
  | 'calculator'
  | 'collections'
  | 'reconciliation'
  | 'reports'
  | 'audit';

interface AuthUser {
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
}

interface Borrower {
  id: string;
  fullName: string;
  mobile: string;
  address: string;
  occupation: string;
  monthlyIncome: number;
  status: 'Active' | 'Inactive';
  createdAt: string;
}

interface Installment {
  number: number;
  dueDate: string;
  principal: number;
  interest: number;
  totalDue: number;
  paidAmount: number;
  remainingBalance: number;
  status: 'Unpaid' | 'Partial' | 'Paid' | 'Overdue';
}

interface LoanAccount {
  id: string;
  borrowerId: string;
  borrowerName: string;
  productName: string;
  principal: number;
  interestRateMonthly: number;
  interestMethod: InterestMethod;
  termMonths: number;
  frequency: PaymentFrequency;
  releasedDate: string;
  collectorName: string;
  approvedBy: string;
  status: 'Active' | 'Completed' | 'Past Due';
  schedule: Installment[];
}

interface PaymentTransaction {
  txnId: string;
  loanId: string;
  borrowerName: string;
  amount: number;
  allocation: {
    penalties: number;
    fees: number;
    interest: number;
    principal: number;
  };
  collector: string;
  timestamp: string;
  status: 'Posted' | 'Reversed';
  isReversal?: boolean;
  reversesTxnId?: string;
  notes?: string;
}

interface CashReconciliation {
  id: string;
  date: string;
  collector: string;
  openingCash: number;
  expectedCollections: number;
  actualTurnedOver: number;
  variance: number;
  status: 'Pending Review' | 'Approved';
}

interface AuditLog {
  id: string;
  timestamp: string;
  userRole: UserRole;
  userName: string;
  action: string;
  details: string;
}

// ==================== DEMO ACCOUNTS ====================
const DEMO_USERS: AuthUser[] = [
  { username: 'manager', password: '123', displayName: 'Jhanet Abejuro', role: 'Manager' },
  { username: 'cashier', password: '123', displayName: 'Cris Bautista', role: 'Cashier' },
  { username: 'collector', password: '123', displayName: 'Juan Reyes', role: 'Collector' },
  { username: 'auditor', password: '123', displayName: 'Grace delos Reyes', role: 'Auditor' },
];

// ==================== HELPERS ====================
const formatPHP = (amount: number): string =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const getManilaTimestamp = (): string =>
  new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

const round2 = (val: number): number => Math.round((val + Number.EPSILON) * 100) / 100;

function loadStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function generateSchedule(
  principal: number,
  interestRateMonthly: number,
  termMonths: number,
  frequency: PaymentFrequency,
  method: InterestMethod,
  startDateISO: string
): Installment[] {
  const periodsPerMonth: Record<PaymentFrequency, number> = {
    Daily: 30,
    Weekly: 4,
    Biweekly: 2,
    Monthly: 1,
  };
  const daysStep: Record<PaymentFrequency, number> = {
    Daily: 1,
    Weekly: 7,
    Biweekly: 14,
    Monthly: 30,
  };

  const totalInstallments = Math.max(1, Math.round(termMonths * periodsPerMonth[frequency]));
  const periodicRate = interestRateMonthly / 100 / periodsPerMonth[frequency];
  const schedule: Installment[] = [];

  let remainingPrincipal = principal;
  const startDate = new Date(startDateISO);

  const pmt =
    method === 'Declining' && periodicRate > 0
      ? (principal * periodicRate) / (1 - Math.pow(1 + periodicRate, -totalInstallments))
      : 0;

  for (let i = 1; i <= totalInstallments; i++) {
    const due = new Date(startDate);
    due.setDate(due.getDate() + i * daysStep[frequency]);

    let periodPrincipal = 0;
    let periodInterest = 0;

    if (method === 'Flat') {
      const totalInterest = principal * (interestRateMonthly / 100) * termMonths;
      periodInterest = round2(totalInterest / totalInstallments);
      periodPrincipal =
        i === totalInstallments ? round2(remainingPrincipal) : round2(principal / totalInstallments);
    } else {
      periodInterest = round2(remainingPrincipal * periodicRate);
      periodPrincipal =
        i === totalInstallments ? round2(remainingPrincipal) : round2(pmt - periodInterest);
    }

    remainingPrincipal = Math.max(0, round2(remainingPrincipal - periodPrincipal));
    const totalDue = round2(periodPrincipal + periodInterest);

    schedule.push({
      number: i,
      dueDate: due.toISOString().split('T')[0],
      principal: periodPrincipal,
      interest: periodInterest,
      totalDue,
      paidAmount: 0,
      remainingBalance: remainingPrincipal,
      status: 'Unpaid',
    });
  }

  return schedule;
}

function generateTxnId(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TXN-${datePart}-${rand}`;
}

// ==================== INITIAL MOCK DATA ====================
const initialBorrowers: Borrower[] = [
  {
    id: 'BRW-0001',
    fullName: 'Maria Clara Santos',
    mobile: '+63 917 452 8810',
    address: 'Purok 2, Brgy. San Isidro, Naga City',
    occupation: 'Sari-Sari Store Owner',
    monthlyIncome: 18500,
    status: 'Active',
    createdAt: '2026-01-12',
  },
  {
    id: 'BRW-0002',
    fullName: 'Roberto Dela Cruz',
    mobile: '+63 928 310 4421',
    address: 'Zone 4, Brgy. Concepcion Pequeña, Naga City',
    occupation: 'Tricycle Driver',
    monthlyIncome: 14000,
    status: 'Active',
    createdAt: '2026-01-20',
  },
  {
    id: 'BRW-0003',
    fullName: 'Elena Villanueva',
    mobile: '+63 995 771 2039',
    address: 'Purok 1, Brgy. Mabolo, Naga City',
    occupation: 'Market Vegetable Vendor',
    monthlyIncome: 22000,
    status: 'Active',
    createdAt: '2026-02-05',
  },
];

const loan1Schedule = generateSchedule(15000, 3, 3, 'Weekly', 'Flat', '2026-02-15');
loan1Schedule[0].paidAmount = loan1Schedule[0].totalDue;
loan1Schedule[0].status = 'Paid';
loan1Schedule[1].paidAmount = loan1Schedule[1].totalDue;
loan1Schedule[1].status = 'Paid';
loan1Schedule[2].status = 'Overdue';

const loan2Schedule = generateSchedule(10000, 2.5, 2, 'Biweekly', 'Declining', '2026-03-01');
loan2Schedule[0].paidAmount = loan2Schedule[0].totalDue;
loan2Schedule[0].status = 'Paid';

const initialLoans: LoanAccount[] = [
  {
    id: 'LN-2026-0101',
    borrowerId: 'BRW-0001',
    borrowerName: 'Maria Clara Santos',
    productName: 'Micro-Enterprise Weekly',
    principal: 15000,
    interestRateMonthly: 3,
    interestMethod: 'Flat',
    termMonths: 3,
    frequency: 'Weekly',
    releasedDate: '2026-02-15',
    collectorName: 'Juan Reyes',
    approvedBy: 'Elena Cruz',
    status: 'Past Due',
    schedule: loan1Schedule,
  },
  {
    id: 'LN-2026-0102',
    borrowerId: 'BRW-0002',
    borrowerName: 'Roberto Dela Cruz',
    productName: 'Transport Livelihood',
    principal: 10000,
    interestRateMonthly: 2.5,
    interestMethod: 'Declining',
    termMonths: 2,
    frequency: 'Biweekly',
    releasedDate: '2026-03-01',
    collectorName: 'Juan Reyes',
    approvedBy: 'Elena Cruz',
    status: 'Active',
    schedule: loan2Schedule,
  },
];

const initialPayments: PaymentTransaction[] = [
  {
    txnId: 'TXN-20260308-4821',
    loanId: 'LN-2026-0101',
    borrowerName: 'Maria Clara Santos',
    amount: loan1Schedule[0].totalDue,
    allocation: {
      penalties: 0,
      fees: 0,
      interest: loan1Schedule[0].interest,
      principal: loan1Schedule[0].principal,
    },
    collector: 'Juan Reyes',
    timestamp: 'Mar 08, 2026, 09:42 AM',
    status: 'Posted',
  },
  {
    txnId: 'TXN-20260315-9104',
    loanId: 'LN-2026-0102',
    borrowerName: 'Roberto Dela Cruz',
    amount: loan2Schedule[0].totalDue,
    allocation: {
      penalties: 0,
      fees: 0,
      interest: loan2Schedule[0].interest,
      principal: loan2Schedule[0].principal,
    },
    collector: 'Juan Reyes',
    timestamp: 'Mar 15, 2026, 02:15 PM',
    status: 'Posted',
  },
];

const initialReconciliations: CashReconciliation[] = [
  {
    id: 'REC-20260328-01',
    date: '2026-03-28',
    collector: 'Juan Reyes',
    openingCash: 1000,
    expectedCollections: 4500,
    actualTurnedOver: 4500,
    variance: 0,
    status: 'Approved',
  },
];

const initialAuditLogs: AuditLog[] = [
  {
    id: 'AUD-001',
    timestamp: 'Mar 28, 2026, 05:10 PM',
    userRole: 'Manager',
    userName: 'Elena Cruz',
    action: 'RECONCILIATION_APPROVED',
    details: 'Approved REC-20260328-01 for Juan Reyes (Variance: ₱0.00)',
  },
];

// ==================== MAIN APP ====================
export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() =>
    loadStorage<AuthUser | null>('bmms_v1_user', null)
  );
  const [loginUsername, setLoginUsername] = useState('manager');
  const [loginPassword, setLoginPassword] = useState('123');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [borrowers, setBorrowers] = useState<Borrower[]>(() =>
    loadStorage('bmms_v1_borrowers', initialBorrowers)
  );
  const [loans, setLoans] = useState<LoanAccount[]>(() =>
    loadStorage('bmms_v1_loans', initialLoans)
  );
  const [payments, setPayments] = useState<PaymentTransaction[]>(() =>
    loadStorage('bmms_v1_payments', initialPayments)
  );
  const [reconciliations, setReconciliations] = useState<CashReconciliation[]>(() =>
    loadStorage('bmms_v1_reconciliations', initialReconciliations)
  );
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() =>
    loadStorage('bmms_v1_audit', initialAuditLogs)
  );

  useEffect(() => {
    localStorage.setItem('bmms_v1_user', JSON.stringify(currentUser));
  }, [currentUser]);
  useEffect(() => {
    localStorage.setItem('bmms_v1_borrowers', JSON.stringify(borrowers));
  }, [borrowers]);
  useEffect(() => {
    localStorage.setItem('bmms_v1_loans', JSON.stringify(loans));
  }, [loans]);
  useEffect(() => {
    localStorage.setItem('bmms_v1_payments', JSON.stringify(payments));
  }, [payments]);
  useEffect(() => {
    localStorage.setItem('bmms_v1_reconciliations', JSON.stringify(reconciliations));
  }, [reconciliations]);
  useEffect(() => {
    localStorage.setItem('bmms_v1_audit', JSON.stringify(auditLogs));
  }, [auditLogs]);

  const [borrowerSearch, setBorrowerSearch] = useState('');
  const [newBorrower, setNewBorrower] = useState({
    fullName: '',
    mobile: '+63 ',
    address: '',
    occupation: '',
    monthlyIncome: '',
  });
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentTransaction | null>(null);
  const [selectedAgreementLoan, setSelectedAgreementLoan] = useState<LoanAccount | null>(null);

  const [calcBorrowerId, setCalcBorrowerId] = useState<string>(initialBorrowers[2].id);
  const [calcPrincipal, setCalcPrincipal] = useState<number>(12000);
  const [calcRate, setCalcRate] = useState<number>(3);
  const [calcTerm, setCalcTerm] = useState<number>(3);
  const [calcFreq, setCalcFreq] = useState<PaymentFrequency>('Weekly');
  const [calcMethod, setCalcMethod] = useState<InterestMethod>('Flat');
  const [calcStart, setCalcStart] = useState<string>(new Date().toISOString().split('T')[0]);

  const [payLoanId, setPayLoanId] = useState<string>(loans[0]?.id || '');
  const [payAmount, setPayAmount] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');

  const [recCollector, setRecCollector] = useState('Juan Reyes');
  const [recOpening, setRecOpening] = useState('1000');
  const [recActual, setRecActual] = useState('');

  const [reportType, setReportType] = useState<'loans' | 'collections' | 'overdue' | 'borrowers'>('loans');

  const role: UserRole = currentUser?.role || 'Auditor';
  const isReadOnly = role === 'Auditor';

  const addAudit = (action: string, details: string, userOverride?: AuthUser) => {
    const actor = userOverride || currentUser;
    if (!actor) return;
    setAuditLogs((prev) => [
      {
        id: `AUD-${String(prev.length + 1).padStart(3, '0')}`,
        timestamp: getManilaTimestamp(),
        userRole: actor.role,
        userName: actor.displayName,
        action,
        details,
      },
      ...prev,
    ]);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const found = DEMO_USERS.find(
      (u) => u.username.toLowerCase() === loginUsername.trim().toLowerCase() && u.password === loginPassword
    );
    if (!found) {
      setLoginError('Invalid username or password. Try one of the demo accounts below.');
      return;
    }
    setLoginError('');
    setCurrentUser(found);
    addAudit('USER_LOGIN', `${found.displayName} signed in as ${found.role}`, found);
  };

  const handleLogout = () => {
    if (currentUser) {
      addAudit('USER_LOGOUT', `${currentUser.displayName} signed out`);
    }
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  const handleResetDemo = () => {
    if (!window.confirm('Reset all borrowers, loans, payments, and logs back to default demo data?')) return;
    setBorrowers(initialBorrowers);
    setLoans(initialLoans);
    setPayments(initialPayments);
    setReconciliations(initialReconciliations);
    setAuditLogs(initialAuditLogs);
  };

  const kpis = useMemo(() => {
    let totalOutstanding = 0;
    let overdueBalance = 0;
    let pastDueCount = 0;

    loans.forEach((loan) => {
      let loanOverdue = false;
      loan.schedule.forEach((inst) => {
        const unpaid = Math.max(0, inst.totalDue - inst.paidAmount);
        totalOutstanding += unpaid;
        if (inst.status === 'Overdue') {
          overdueBalance += unpaid;
          loanOverdue = true;
        }
      });
      if (loanOverdue || loan.status === 'Past Due') pastDueCount++;
    });

    const totalPostedCollections = payments
      .filter((p) => p.status === 'Posted' && !p.isReversal)
      .reduce((sum, p) => sum + p.amount, 0);

    const parPercent = totalOutstanding > 0 ? (overdueBalance / totalOutstanding) * 100 : 0;

    return {
      totalBorrowers: borrowers.length,
      activeLoans: loans.filter((l) => l.status !== 'Completed').length,
      totalOutstanding,
      totalPostedCollections,
      overdueBalance,
      pastDueCount,
      parPercent,
    };
  }, [borrowers, loans, payments]);

  const duplicateWarning = useMemo(() => {
    const nameClean = newBorrower.fullName.trim().toLowerCase();
    const phoneClean = newBorrower.mobile.replace(/\s+/g, '');
    if (!nameClean && phoneClean.length < 7) return null;
    return borrowers.find(
      (b) =>
        (nameClean && b.fullName.toLowerCase() === nameClean) ||
        (phoneClean.length >= 7 && b.mobile.replace(/\s+/g, '') === phoneClean)
    );
  }, [newBorrower, borrowers]);

  const handleAddBorrower = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !newBorrower.fullName.trim()) return;
    const id = `BRW-${String(borrowers.length + 1).padStart(4, '0')}`;
    const created: Borrower = {
      id,
      fullName: newBorrower.fullName.trim(),
      mobile: newBorrower.mobile.trim(),
      address: newBorrower.address.trim(),
      occupation: newBorrower.occupation.trim(),
      monthlyIncome: Number(newBorrower.monthlyIncome) || 0,
      status: 'Active',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setBorrowers([created, ...borrowers]);
    addAudit('BORROWER_CREATED', `Registered ${created.fullName} (${created.id})`);
    setNewBorrower({ fullName: '', mobile: '+63 ', address: '', occupation: '', monthlyIncome: '' });
  };

  const previewSchedule = useMemo(
    () => generateSchedule(calcPrincipal, calcRate, calcTerm, calcFreq, calcMethod, calcStart),
    [calcPrincipal, calcRate, calcTerm, calcFreq, calcMethod, calcStart]
  );

  const previewTotals = useMemo(() => {
    const totalInterest = previewSchedule.reduce((s, r) => s + r.interest, 0);
    const totalRepayable = previewSchedule.reduce((s, r) => s + r.totalDue, 0);
    return {
      totalInterest,
      totalRepayable,
      perInstallment: previewSchedule[0]?.totalDue || 0,
      count: previewSchedule.length,
    };
  }, [previewSchedule]);

  const handleReleaseLoan = () => {
    if (isReadOnly || role === 'Collector' || !currentUser) return;
    const borrower = borrowers.find((b) => b.id === calcBorrowerId);
    if (!borrower) return;

    const loanId = `LN-2026-0${101 + loans.length}`;
    const newLoan: LoanAccount = {
      id: loanId,
      borrowerId: borrower.id,
      borrowerName: borrower.fullName,
      productName: `${calcMethod} ${calcFreq} Loan`,
      principal: calcPrincipal,
      interestRateMonthly: calcRate,
      interestMethod: calcMethod,
      termMonths: calcTerm,
      frequency: calcFreq,
      releasedDate: calcStart,
      collectorName: 'Juan Reyes',
      approvedBy: currentUser.displayName,
      status: 'Active',
      schedule: previewSchedule,
    };

    setLoans([newLoan, ...loans]);
    addAudit(
      'LOAN_RELEASED',
      `Released ${loanId} to ${borrower.fullName} for ${formatPHP(calcPrincipal)} (${calcMethod}, ${calcFreq})`
    );
    setPayLoanId(loanId);
    setSelectedAgreementLoan(newLoan);
  };

  const handlePostPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !currentUser) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return;

    const targetLoan = loans.find((l) => l.id === payLoanId);
    if (!targetLoan) return;

    let remainingPayment = amount;
    let allocatedInterest = 0;
    let allocatedPrincipal = 0;

    const updatedSchedule = targetLoan.schedule.map((inst) => {
      if (remainingPayment <= 0 || inst.status === 'Paid') return inst;
      const dueLeft = Math.round((inst.totalDue - inst.paidAmount) * 100) / 100;
      const applied = Math.min(remainingPayment, dueLeft);
      remainingPayment = Math.round((remainingPayment - applied) * 100) / 100;

      const intPortion = Math.min(applied, inst.interest);
      const prinPortion = Math.round((applied - intPortion) * 100) / 100;
      allocatedInterest = Math.round((allocatedInterest + intPortion) * 100) / 100;
      allocatedPrincipal = Math.round((allocatedPrincipal + prinPortion) * 100) / 100;

      const newPaid = Math.round((inst.paidAmount + applied) * 100) / 100;
      const newStatus = newPaid >= inst.totalDue ? 'Paid' : 'Partial';
      return { ...inst, paidAmount: newPaid, status: newStatus as Installment['status'] };
    });

    const allPaid = updatedSchedule.every((i) => i.status === 'Paid');
    setLoans((prev) =>
      prev.map((l) =>
        l.id === targetLoan.id
          ? { ...l, schedule: updatedSchedule, status: allPaid ? 'Completed' : l.status }
          : l
      )
    );

    const txn: PaymentTransaction = {
      txnId: generateTxnId(),
      loanId: targetLoan.id,
      borrowerName: targetLoan.borrowerName,
      amount,
      allocation: {
        penalties: 0,
        fees: 0,
        interest: allocatedInterest,
        principal: allocatedPrincipal,
      },
      collector: currentUser.displayName,
      timestamp: getManilaTimestamp(),
      status: 'Posted',
      notes: payNotes.trim() || undefined,
    };

    setPayments([txn, ...payments]);
    addAudit('PAYMENT_POSTED', `${txn.txnId}: ${formatPHP(amount)} for ${targetLoan.id}`);
    setSelectedReceipt(txn);
    setPayAmount('');
    setPayNotes('');
  };

  const handleReversePayment = (orig: PaymentTransaction) => {
    if (role !== 'Manager' || orig.status === 'Reversed' || orig.isReversal || !currentUser) return;

    setLoans((prev) =>
      prev.map((loan) => {
        if (loan.id !== orig.loanId) return loan;
        let toRollback = orig.amount;
        const reversedSched = [...loan.schedule].reverse().map((inst) => {
          if (toRollback <= 0 || inst.paidAmount <= 0) return inst;
          const deduct = Math.min(toRollback, inst.paidAmount);
          toRollback = Math.round((toRollback - deduct) * 100) / 100;
          const newPaid = Math.round((inst.paidAmount - deduct) * 100) / 100;
          return {
            ...inst,
            paidAmount: newPaid,
            status: newPaid === 0 ? ('Unpaid' as const) : ('Partial' as const),
          };
        });
        return { ...loan, status: 'Active', schedule: reversedSched.reverse() };
      })
    );

    const reversalTxn: PaymentTransaction = {
      txnId: generateTxnId(),
      loanId: orig.loanId,
      borrowerName: orig.borrowerName,
      amount: -orig.amount,
      allocation: {
        penalties: 0,
        fees: 0,
        interest: -orig.allocation.interest,
        principal: -orig.allocation.principal,
      },
      collector: `${currentUser.displayName} (Reversal)`,
      timestamp: getManilaTimestamp(),
      status: 'Posted',
      isReversal: true,
      reversesTxnId: orig.txnId,
      notes: `Controlled reversal of ${orig.txnId}`,
    };

    setPayments((prev) => [
      reversalTxn,
      ...prev.map((p) => (p.txnId === orig.txnId ? { ...p, status: 'Reversed' as const } : p)),
    ]);
    addAudit('PAYMENT_REVERSED', `Reversed ${orig.txnId} via ${reversalTxn.txnId} (${formatPHP(orig.amount)})`);
  };

  const handleSubmitReconciliation = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    const opening = Number(recOpening) || 0;
    const actual = Number(recActual) || 0;
    const variance = Math.round((actual - kpis.totalPostedCollections) * 100) / 100;

    const newRec: CashReconciliation = {
      id: `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-0${reconciliations.length + 1}`,
      date: new Date().toISOString().split('T')[0],
      collector: recCollector,
      openingCash: opening,
      expectedCollections: kpis.totalPostedCollections,
      actualTurnedOver: actual,
      variance,
      status: role === 'Manager' && variance === 0 ? 'Approved' : 'Pending Review',
    };
    setReconciliations([newRec, ...reconciliations]);
    addAudit('RECONCILIATION_SUBMITTED', `${newRec.id} Variance: ${formatPHP(variance)}`);
    setRecActual('');
  };

  const handleApproveRec = (id: string) => {
    if (role !== 'Manager') return;
    setReconciliations((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'Approved' } : r)));
    addAudit('RECONCILIATION_APPROVED', `Approved ${id}`);
  };

  // ==================== LOGIN SCREEN ====================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 border border-slate-800/40">
          {/* Left Panel */}
          <div className="lg:col-span-6 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white p-8 md:p-10 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.22),transparent_55%)] pointer-events-none" />

            <div className="relative space-y-6">
              <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm">
                <Building2 className="w-4 h-4 text-blue-300" />
                <span className="text-xs font-semibold tracking-wide text-blue-100 uppercase">
                  BMMS • Microfinance Platform
                </span>
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight text-white">
                  Smart Lending &amp; Collection Control
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Centralized borrower management, automated loan schedules, immutable receipts, and
                  daily cash reconciliation built for barangay and community lending operations.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {[
                  {
                    title: 'Accurate Amortization Engine',
                    desc: 'Flat-rate & declining-balance schedules in PHP (₱)',
                  },
                  {
                    title: 'Protected Financial Ledger',
                    desc: 'Unique receipt IDs with controlled reversal audit logs',
                  },
                  {
                    title: 'Daily Cash Reconciliation',
                    desc: 'Track collector turnover, shortages, and approvals',
                  },
                ].map((feat) => (
                  <div
                    key={feat.title}
                    className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold text-white">{feat.title}</div>
                      <div className="text-xs text-slate-300">{feat.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative pt-8 mt-6 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-400" /> Role-Based Access Control
              </span>
              <span>Asia/Manila • PHP</span>
            </div>
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-6 p-8 md:p-10 flex flex-col justify-center bg-white">
            <div className="max-w-md w-full mx-auto space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Sign in with your staff credentials to access your workspace.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Username
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      required
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="e.g., manager"
                      className="w-full pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold py-2.5 rounded-xl text-sm shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition"
                >
                  Sign In to Portal <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="pt-5 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Demo Staff Accounts
                  </span>
                  <span className="text-[11px] text-slate-400">Password: 123</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {DEMO_USERS.map((u) => {
                    const selected = loginUsername.toLowerCase() === u.username;
                    return (
                      <button
                        key={u.username}
                        type="button"
                        onClick={() => {
                          setLoginUsername(u.username);
                          setLoginPassword(u.password);
                          setLoginError('');
                        }}
                        className={`text-left p-2.5 rounded-xl border transition ${
                          selected
                            ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500/30'
                            : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">{u.role}</span>
                          {selected && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {u.displayName} ({u.username})
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== AUTHENTICATED APP ====================
  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'borrowers', label: 'Borrowers', icon: <Users className="w-4 h-4" /> },
    { id: 'calculator', label: 'Loan Calculator & Release', icon: <Calculator className="w-4 h-4" /> },
    { id: 'collections', label: 'Collections & Receipts', icon: <Wallet className="w-4 h-4" /> },
    { id: 'reconciliation', label: 'Cash Reconciliation', icon: <ClipboardCheck className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports & Exports', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'audit', label: 'Audit Trail', icon: <ShieldCheck className="w-4 h-4" /> },
  ];

  const filteredBorrowers = borrowers.filter(
    (b) =>
      b.fullName.toLowerCase().includes(borrowerSearch.toLowerCase()) ||
      b.id.toLowerCase().includes(borrowerSearch.toLowerCase()) ||
      b.address.toLowerCase().includes(borrowerSearch.toLowerCase())
  );

  const overdueLoans = loans.filter(
    (l) => l.status === 'Past Due' || l.schedule.some((s) => s.status === 'Overdue')
  );

  const handleExportReportCSV = () => {
    if (reportType === 'loans') {
      exportToCSV(
        'bmms-loan-portfolio.csv',
        ['Loan ID', 'Borrower', 'Method', 'Frequency', 'Principal', 'Remaining Due', 'Status'],
        loans.map((l) => [
          l.id,
          l.borrowerName,
          l.interestMethod,
          l.frequency,
          l.principal,
          l.schedule.reduce((s, i) => s + (i.totalDue - i.paidAmount), 0),
          l.status,
        ])
      );
    } else if (reportType === 'collections') {
      exportToCSV(
        'bmms-collections.csv',
        ['Transaction ID', 'Loan ID', 'Borrower', 'Amount', 'Collector', 'Timestamp', 'Status'],
        payments.map((p) => [p.txnId, p.loanId, p.borrowerName, p.amount, p.collector, p.timestamp, p.status])
      );
    } else if (reportType === 'overdue') {
      exportToCSV(
        'bmms-overdue-accounts.csv',
        ['Loan ID', 'Borrower', 'Overdue Amount', 'Collector', 'Status'],
        overdueLoans.map((l) => [
          l.id,
          l.borrowerName,
          l.schedule.filter((s) => s.status === 'Overdue').reduce((sum, s) => sum + (s.totalDue - s.paidAmount), 0),
          l.collectorName,
          l.status,
        ])
      );
    } else {
      exportToCSV(
        'bmms-borrower-masterlist.csv',
        ['Borrower ID', 'Full Name', 'Mobile', 'Address', 'Occupation', 'Monthly Income', 'Status'],
        borrowers.map((b) => [b.id, b.fullName, b.mobile, b.address, b.occupation, b.monthlyIncome, b.status])
      );
    }
    addAudit('REPORT_EXPORTED', `Exported ${reportType} report to CSV`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row">
      <aside
        className={`${
          mobileMenuOpen ? 'block' : 'hidden'
        } md:flex md:flex-col w-full md:w-64 bg-slate-900 text-slate-100 flex-shrink-0 print:hidden`}
      >
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg tracking-tight text-white">BMMS</h1>
            <p className="text-xs text-slate-400">Microfinance System</p>
          </div>
          <button className="md:hidden text-slate-400" onClick={() => setMobileMenuOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-3 space-y-1 flex-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === item.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 m-3 rounded-lg bg-slate-800/80 border border-slate-700 space-y-3">
          <div>
            <div className="text-xs text-slate-400">Signed in as</div>
            <div className="text-sm font-semibold text-white">{currentUser.displayName}</div>
            <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded bg-blue-600/30 text-blue-300 font-medium">
              {currentUser.role}
            </span>
          </div>

          <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-700">
            <button
              onClick={handleResetDemo}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-300 hover:text-white py-1.5 rounded bg-slate-700/60 hover:bg-slate-700"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reset Demo Data
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-red-300 hover:text-red-200 py-1.5 rounded bg-red-900/30 hover:bg-red-900/50"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3.5 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded-md border border-slate-200"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-slate-900">
              {navItems.find((n) => n.id === activeTab)?.label}
            </h2>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-3">
            <span className="hidden sm:inline text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              Auto-Saved Locally
            </span>
            <span className="hidden md:inline">PHP (₱) • Asia/Manila</span>
          </div>
        </header>

        <main className="p-4 md:p-6 space-y-6 max-w-6xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Registered Borrowers" value={String(kpis.totalBorrowers)} sub="Initial target: 100–500" />
                <StatCard label="Active Loan Accounts" value={String(kpis.activeLoans)} sub={`${kpis.pastDueCount} Past Due`} />
                <StatCard
                  label="Outstanding Balance"
                  value={formatPHP(kpis.totalOutstanding)}
                  sub={`Collected: ${formatPHP(kpis.totalPostedCollections)}`}
                />
                <StatCard
                  label="Portfolio at Risk (PAR)"
                  value={`${kpis.parPercent.toFixed(1)}%`}
                  sub={`Overdue: ${formatPHP(kpis.overdueBalance)}`}
                  alert={kpis.parPercent > 10}
                />
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3">Active Loan Accounts Overview</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 pr-4">Loan ID</th>
                        <th className="py-2.5 pr-4">Borrower</th>
                        <th className="py-2.5 pr-4">Product / Method</th>
                        <th className="py-2.5 pr-4">Principal</th>
                        <th className="py-2.5 pr-4">Remaining Due</th>
                        <th className="py-2.5 pr-4">Status</th>
                        <th className="py-2.5">Forms</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loans.map((loan) => {
                        const rem = loan.schedule.reduce((s, i) => s + (i.totalDue - i.paidAmount), 0);
                        return (
                          <tr key={loan.id}>
                            <td className="py-3 pr-4 font-medium text-blue-700">{loan.id}</td>
                            <td className="py-3 pr-4">{loan.borrowerName}</td>
                            <td className="py-3 pr-4 text-slate-600">
                              {loan.interestMethod} • {loan.frequency}
                            </td>
                            <td className="py-3 pr-4">{formatPHP(loan.principal)}</td>
                            <td className="py-3 pr-4 font-medium">{formatPHP(rem)}</td>
                            <td className="py-3 pr-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  loan.status === 'Past Due'
                                    ? 'bg-red-100 text-red-700'
                                    : loan.status === 'Completed'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {loan.status}
                              </span>
                            </td>
                            <td className="py-3">
                              <button
                                onClick={() => setSelectedAgreementLoan(loan)}
                                className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-medium"
                              >
                                <Printer className="w-3.5 h-3.5" /> Agreement / Note
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'borrowers' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-600" /> Register Borrower
                </h3>
                <form onSubmit={handleAddBorrower} className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Full Name *</label>
                    <input
                      required
                      disabled={isReadOnly}
                      value={newBorrower.fullName}
                      onChange={(e) => setNewBorrower({ ...newBorrower, fullName: e.target.value })}
                      placeholder="e.g., Ana Liza Mendoza"
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Mobile Number *</label>
                    <input
                      required
                      disabled={isReadOnly}
                      value={newBorrower.mobile}
                      onChange={(e) => setNewBorrower({ ...newBorrower, mobile: e.target.value })}
                      placeholder="+63 9XX XXX XXXX"
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Barangay / Address *</label>
                    <input
                      required
                      disabled={isReadOnly}
                      value={newBorrower.address}
                      onChange={(e) => setNewBorrower({ ...newBorrower, address: e.target.value })}
                      placeholder="Purok, Brgy., City"
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-slate-600">Occupation</label>
                      <input
                        disabled={isReadOnly}
                        value={newBorrower.occupation}
                        onChange={(e) => setNewBorrower({ ...newBorrower, occupation: e.target.value })}
                        placeholder="Vendor"
                        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Monthly Income</label>
                      <input
                        type="number"
                        disabled={isReadOnly}
                        value={newBorrower.monthlyIncome}
                        onChange={(e) => setNewBorrower({ ...newBorrower, monthlyIncome: e.target.value })}
                        placeholder="15000"
                        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  {duplicateWarning && (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Possible duplicate found: <strong>{duplicateWarning.fullName}</strong> ({duplicateWarning.id})
                      </span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isReadOnly}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium py-2 rounded-lg text-sm"
                  >
                    Save Borrower Profile
                  </button>
                </form>
              </div>

              <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <h3 className="font-semibold text-slate-900">Borrower Directory ({filteredBorrowers.length})</h3>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      value={borrowerSearch}
                      onChange={(e) => setBorrowerSearch(e.target.value)}
                      placeholder="Search name, ID, barangay..."
                      className="pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm w-full sm:w-64"
                    />
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {filteredBorrowers.map((b) => (
                    <div key={b.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                            {b.id}
                          </span>
                          <span className="font-medium text-slate-900">{b.fullName}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {b.mobile} • {b.address}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="text-xs text-slate-600">{b.occupation || 'N/A'}</div>
                        <div className="text-xs font-medium text-slate-800">
                          Income: {formatPHP(b.monthlyIncome)}/mo
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'calculator' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                <h3 className="font-semibold text-slate-900">Configure Loan & Release</h3>
                <div>
                  <label className="text-xs font-medium text-slate-600">Borrower</label>
                  <select
                    value={calcBorrowerId}
                    onChange={(e) => setCalcBorrowerId(e.target.value)}
                    className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {borrowers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.fullName} ({b.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Principal (PHP)</label>
                    <input
                      type="number"
                      min={500}
                      step={500}
                      value={calcPrincipal}
                      onChange={(e) => setCalcPrincipal(Number(e.target.value) || 0)}
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Monthly Interest (%)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={calcRate}
                      onChange={(e) => setCalcRate(Number(e.target.value) || 0)}
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Term (Months)</label>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={calcTerm}
                      onChange={(e) => setCalcTerm(Math.max(1, Number(e.target.value) || 1))}
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Frequency</label>
                    <select
                      value={calcFreq}
                      onChange={(e) => setCalcFreq(e.target.value as PaymentFrequency)}
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Biweekly">Biweekly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Interest Method</label>
                    <select
                      value={calcMethod}
                      onChange={(e) => setCalcMethod(e.target.value as InterestMethod)}
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="Flat">Flat-Rate</option>
                      <option value="Declining">Declining-Balance</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Release Date</label>
                    <input
                      type="date"
                      value={calcStart}
                      onChange={(e) => setCalcStart(e.target.value)}
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Installments:</span>
                    <span className="font-semibold">{previewTotals.count} payments</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Est. per {calcFreq}:</span>
                    <span className="font-semibold text-blue-700">{formatPHP(previewTotals.perInstallment)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Interest:</span>
                    <span className="font-semibold">{formatPHP(previewTotals.totalInterest)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1">
                    <span className="text-slate-800 font-medium">Total Repayable:</span>
                    <span className="font-bold text-slate-900">{formatPHP(previewTotals.totalRepayable)}</span>
                  </div>
                </div>

                <button
                  onClick={handleReleaseLoan}
                  disabled={isReadOnly || role === 'Collector'}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg text-sm"
                >
                  Approve & Release Loan
                </button>
              </div>

              <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3">Amortization Schedule Preview</h3>
                <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="uppercase text-slate-500 border-b border-slate-200 sticky top-0 bg-white">
                      <tr>
                        <th className="py-2 pr-3">#</th>
                        <th className="py-2 pr-3">Due Date</th>
                        <th className="py-2 pr-3">Principal</th>
                        <th className="py-2 pr-3">Interest</th>
                        <th className="py-2 pr-3">Total Due</th>
                        <th className="py-2">Ending Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewSchedule.map((row) => (
                        <tr key={row.number}>
                          <td className="py-2 pr-3 font-medium">{row.number}</td>
                          <td className="py-2 pr-3">{row.dueDate}</td>
                          <td className="py-2 pr-3">{formatPHP(row.principal)}</td>
                          <td className="py-2 pr-3">{formatPHP(row.interest)}</td>
                          <td className="py-2 pr-3 font-semibold text-slate-900">{formatPHP(row.totalDue)}</td>
                          <td className="py-2 text-slate-600">{formatPHP(row.remainingBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'collections' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3">Post Collection Payment</h3>
                <form onSubmit={handlePostPayment} className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Select Loan Account</label>
                    <select
                      value={payLoanId}
                      onChange={(e) => setPayLoanId(e.target.value)}
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    >
                      {loans.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.id} — {l.borrowerName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(() => {
                    const l = loans.find((x) => x.id === payLoanId);
                    const nextDue = l?.schedule.find((s) => s.status !== 'Paid');
                    return nextDue ? (
                      <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-900">
                        Next Installment #{nextDue.number} (Due {nextDue.dueDate}):{' '}
                        <strong>{formatPHP(nextDue.totalDue - nextDue.paidAmount)}</strong>
                        <button
                          type="button"
                          onClick={() => setPayAmount(String(nextDue.totalDue - nextDue.paidAmount))}
                          className="ml-2 underline font-semibold"
                        >
                          Fill Exact
                        </button>
                      </div>
                    ) : null;
                  })()}

                  <div>
                    <label className="text-xs font-medium text-slate-600">Amount Received (PHP) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      disabled={isReadOnly}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="0.00"
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Remarks (Optional)</label>
                    <input
                      disabled={isReadOnly}
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                      placeholder="e.g., Partial payment / Advance"
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isReadOnly}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium py-2 rounded-lg text-sm"
                  >
                    Post Payment & Issue Receipt
                  </button>
                </form>
              </div>

              <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">Immutable Payment Ledger</h3>
                  <span className="text-xs text-slate-500">Manager can reverse errors (no silent deletes)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2 pr-3">Transaction ID</th>
                        <th className="py-2 pr-3">Borrower / Loan</th>
                        <th className="py-2 pr-3">Amount</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map((p) => (
                        <tr key={p.txnId} className={p.isReversal ? 'bg-red-50/50' : ''}>
                          <td className="py-2.5 pr-3 font-mono font-medium">{p.txnId}</td>
                          <td className="py-2.5 pr-3">
                            <div className="font-medium text-slate-900">{p.borrowerName}</div>
                            <div className="text-slate-500">
                              {p.loanId} • {p.timestamp}
                            </div>
                          </td>
                          <td className={`py-2.5 pr-3 font-semibold ${p.amount < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                            {formatPHP(p.amount)}
                          </td>
                          <td className="py-2.5 pr-3">
                            <span
                              className={`px-2 py-0.5 rounded-full font-medium ${
                                p.status === 'Reversed'
                                  ? 'bg-slate-200 text-slate-600 line-through'
                                  : p.isReversal
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {p.isReversal ? 'Reversal Entry' : p.status}
                            </span>
                          </td>
                          <td className="py-2.5 flex items-center gap-2">
                            <button
                              onClick={() => setSelectedReceipt(p)}
                              className="text-blue-600 hover:underline inline-flex items-center gap-1"
                            >
                              <Receipt className="w-3.5 h-3.5" /> Receipt
                            </button>
                            {role === 'Manager' && p.status === 'Posted' && !p.isReversal && (
                              <button
                                onClick={() => handleReversePayment(p)}
                                className="text-red-600 hover:underline inline-flex items-center gap-1"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Reverse
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reconciliation' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3">Daily Cash Turnover</h3>
                <form onSubmit={handleSubmitReconciliation} className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Collector</label>
                    <input
                      value={recCollector}
                      onChange={(e) => setRecCollector(e.target.value)}
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Opening Cash (PHP)</label>
                    <input
                      type="number"
                      value={recOpening}
                      onChange={(e) => setRecOpening(e.target.value)}
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                    System Posted Collections: <strong>{formatPHP(kpis.totalPostedCollections)}</strong>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Actual Cash Turned Over (PHP) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      disabled={isReadOnly}
                      value={recActual}
                      onChange={(e) => setRecActual(e.target.value)}
                      placeholder={String(kpis.totalPostedCollections)}
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isReadOnly}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium py-2 rounded-lg text-sm"
                  >
                    Submit Reconciliation
                  </button>
                </form>
              </div>

              <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3">Reconciliation History</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2 pr-3">Ref ID / Date</th>
                        <th className="py-2 pr-3">Collector</th>
                        <th className="py-2 pr-3">Expected</th>
                        <th className="py-2 pr-3">Turned Over</th>
                        <th className="py-2 pr-3">Variance</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reconciliations.map((rec) => (
                        <tr key={rec.id}>
                          <td className="py-2.5 pr-3">
                            <div className="font-mono font-medium">{rec.id}</div>
                            <div className="text-slate-500">{rec.date}</div>
                          </td>
                          <td className="py-2.5 pr-3">{rec.collector}</td>
                          <td className="py-2.5 pr-3">{formatPHP(rec.expectedCollections)}</td>
                          <td className="py-2.5 pr-3 font-medium">{formatPHP(rec.actualTurnedOver)}</td>
                          <td
                            className={`py-2.5 pr-3 font-semibold ${
                              rec.variance === 0 ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {formatPHP(rec.variance)}
                          </td>
                          <td className="py-2.5">
                            {rec.status === 'Approved' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-medium">
                                <CheckCircle2 className="w-3 h-3" /> Approved
                              </span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-medium">
                                  Pending
                                </span>
                                {role === 'Manager' && (
                                  <button
                                    onClick={() => handleApproveRec(rec.id)}
                                    className="text-blue-600 underline font-medium"
                                  >
                                    Approve
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['loans', 'Active Loans Report'],
                      ['collections', 'Collection Report'],
                      ['overdue', 'Overdue Accounts'],
                      ['borrowers', 'Borrower Masterlist'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setReportType(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                        reportType === key
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportReportCSV}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Report
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h3 className="font-bold text-slate-900 text-base mb-1">
                  BMMS Official Operational Report —{' '}
                  {reportType === 'loans'
                    ? 'Loan Portfolio'
                    : reportType === 'collections'
                    ? 'Collections Summary'
                    : reportType === 'overdue'
                    ? 'Overdue & Past Due Accounts'
                    : 'Borrower Masterlist'}
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Generated by {currentUser.displayName} ({currentUser.role}) • {getManilaTimestamp()} (Asia/Manila)
                </p>

                <div className="overflow-x-auto">
                  {reportType === 'loans' && (
                    <table className="w-full text-xs text-left">
                      <thead className="uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2 pr-3">Loan ID</th>
                          <th className="py-2 pr-3">Borrower</th>
                          <th className="py-2 pr-3">Terms</th>
                          <th className="py-2 pr-3">Principal</th>
                          <th className="py-2 pr-3">Balance</th>
                          <th className="py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loans.map((l) => (
                          <tr key={l.id}>
                            <td className="py-2 pr-3 font-medium">{l.id}</td>
                            <td className="py-2 pr-3">{l.borrowerName}</td>
                            <td className="py-2 pr-3">
                              {l.interestMethod} • {l.frequency} • {l.termMonths}mo
                            </td>
                            <td className="py-2 pr-3">{formatPHP(l.principal)}</td>
                            <td className="py-2 pr-3 font-semibold">
                              {formatPHP(l.schedule.reduce((s, i) => s + (i.totalDue - i.paidAmount), 0))}
                            </td>
                            <td className="py-2">{l.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {reportType === 'collections' && (
                    <table className="w-full text-xs text-left">
                      <thead className="uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2 pr-3">Txn ID</th>
                          <th className="py-2 pr-3">Loan</th>
                          <th className="py-2 pr-3">Borrower</th>
                          <th className="py-2 pr-3">Amount</th>
                          <th className="py-2 pr-3">Collector</th>
                          <th className="py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {payments.map((p) => (
                          <tr key={p.txnId}>
                            <td className="py-2 pr-3 font-mono">{p.txnId}</td>
                            <td className="py-2 pr-3">{p.loanId}</td>
                            <td className="py-2 pr-3">{p.borrowerName}</td>
                            <td className="py-2 pr-3 font-semibold">{formatPHP(p.amount)}</td>
                            <td className="py-2 pr-3">{p.collector}</td>
                            <td className="py-2">{p.isReversal ? 'Reversal' : p.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {reportType === 'overdue' && (
                    <table className="w-full text-xs text-left">
                      <thead className="uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2 pr-3">Loan ID</th>
                          <th className="py-2 pr-3">Borrower</th>
                          <th className="py-2 pr-3">Overdue Balance</th>
                          <th className="py-2">Collector</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {overdueLoans.map((l) => (
                          <tr key={l.id}>
                            <td className="py-2 pr-3 font-medium">{l.id}</td>
                            <td className="py-2 pr-3">{l.borrowerName}</td>
                            <td className="py-2 pr-3 font-semibold text-red-600">
                              {formatPHP(
                                l.schedule
                                  .filter((s) => s.status === 'Overdue')
                                  .reduce((sum, s) => sum + (s.totalDue - s.paidAmount), 0)
                              )}
                            </td>
                            <td className="py-2">{l.collectorName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {reportType === 'borrowers' && (
                    <table className="w-full text-xs text-left">
                      <thead className="uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2 pr-3">ID</th>
                          <th className="py-2 pr-3">Full Name</th>
                          <th className="py-2 pr-3">Mobile</th>
                          <th className="py-2 pr-3">Address</th>
                          <th className="py-2">Occupation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {borrowers.map((b) => (
                          <tr key={b.id}>
                            <td className="py-2 pr-3 font-mono">{b.id}</td>
                            <td className="py-2 pr-3 font-medium">{b.fullName}</td>
                            <td className="py-2 pr-3">{b.mobile}</td>
                            <td className="py-2 pr-3">{b.address}</td>
                            <td className="py-2">{b.occupation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-600" /> System Audit Log
              </h3>
              <div className="divide-y divide-slate-100 text-sm">
                {auditLogs.map((log) => (
                  <div key={log.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded mr-2">{log.action}</span>
                      <span className="text-slate-800">{log.details}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {log.userName} ({log.userRole}) • {log.timestamp}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {selectedReceipt && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="font-bold text-slate-900">BMMS Official Digital Receipt</h4>
              <button onClick={() => setSelectedReceipt(null)} className="text-slate-400 hover:text-slate-600 print:hidden">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs space-y-1.5 text-slate-700">
              <div className="flex justify-between">
                <span>Transaction No:</span>
                <span className="font-mono font-bold">{selectedReceipt.txnId}</span>
              </div>
              <div className="flex justify-between">
                <span>Date/Time (PH):</span>
                <span>{selectedReceipt.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span>Borrower:</span>
                <span className="font-semibold">{selectedReceipt.borrowerName}</span>
              </div>
              <div className="flex justify-between">
                <span>Loan Account:</span>
                <span>{selectedReceipt.loanId}</span>
              </div>
              <div className="border-t border-dashed border-slate-300 my-2 pt-2 space-y-1">
                <div className="flex justify-between">
                  <span>Applied to Interest:</span>
                  <span>{formatPHP(selectedReceipt.allocation.interest)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Applied to Principal:</span>
                  <span>{formatPHP(selectedReceipt.allocation.principal)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-1">
                  <span>Total Paid:</span>
                  <span>{formatPHP(selectedReceipt.amount)}</span>
                </div>
              </div>
              <div className="text-center text-[11px] text-slate-500 pt-2">
                Processed by: {selectedReceipt.collector} • Status: {selectedReceipt.status}
              </div>
            </div>
            <button
              onClick={() => window.print()}
              className="w-full bg-slate-900 text-white py-2 rounded-lg text-xs font-medium hover:bg-slate-800 print:hidden"
            >
              Print Receipt
            </button>
          </div>
        </div>
      )}

      {selectedAgreementLoan && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h4 className="font-bold text-slate-900 text-base">LOAN AGREEMENT & PROMISSORY NOTE</h4>
                <p className="text-xs text-slate-500">Loan Reference: {selectedAgreementLoan.id}</p>
              </div>
              <button
                onClick={() => setSelectedAgreementLoan(null)}
                className="text-slate-400 hover:text-slate-600 print:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-700 space-y-3 leading-relaxed">
              <p>
                FOR VALUE RECEIVED, I, <strong>{selectedAgreementLoan.borrowerName}</strong> (Borrower ID:{' '}
                <strong>{selectedAgreementLoan.borrowerId}</strong>), promise to pay the Microfinance Organization the
                principal sum of <strong>{formatPHP(selectedAgreementLoan.principal)}</strong>, together with{' '}
                <strong>
                  {selectedAgreementLoan.interestRateMonthly}% monthly ({selectedAgreementLoan.interestMethod})
                </strong>{' '}
                interest, payable in <strong>{selectedAgreementLoan.schedule.length}</strong>{' '}
                <strong>{selectedAgreementLoan.frequency}</strong> installments starting from{' '}
                <strong>{selectedAgreementLoan.releasedDate}</strong>.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 block">Principal</span>
                  <strong>{formatPHP(selectedAgreementLoan.principal)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Installment</span>
                  <strong>{formatPHP(selectedAgreementLoan.schedule[0]?.totalDue || 0)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Repayable</span>
                  <strong>
                    {formatPHP(selectedAgreementLoan.schedule.reduce((s, i) => s + i.totalDue, 0))}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Approved By</span>
                  <strong>{selectedAgreementLoan.approvedBy}</strong>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6 pt-8 text-center">
                <div className="border-t border-slate-400 pt-1">
                  <div className="font-semibold">{selectedAgreementLoan.borrowerName}</div>
                  <div className="text-[11px] text-slate-500">Borrower Signature / Thumbmark</div>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <div className="font-semibold">{selectedAgreementLoan.collectorName}</div>
                  <div className="text-[11px] text-slate-500">Collector / Witness</div>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <div className="font-semibold">{selectedAgreementLoan.approvedBy}</div>
                  <div className="text-[11px] text-slate-500">Authorized Approving Officer</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 print:hidden">
              <button
                onClick={() => setSelectedAgreementLoan(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
              >
                <Printer className="w-3.5 h-3.5" /> Print Agreement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  alert = false,
}: {
  label: string;
  value: string;
  sub: string;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 bg-white ${alert ? 'border-red-300 bg-red-50/40' : 'border-slate-200'}`}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${alert ? 'text-red-700' : 'text-slate-900'}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
    </div>
  );
}
