import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { createClient, Session } from '@supabase/supabase-js';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

// --- SUPABASE CLIENT SETUP ---
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL and Anon Key must be defined in your environment variables.");
}
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- API INITIALIZATION ---
let ai: GoogleGenAI | undefined;
const geminiApiKey = process.env.REACT_APP_GEMINI_API_KEY;

if (geminiApiKey) {
    try {
        ai = new GoogleGenAI({ apiKey: geminiApiKey });
    } catch (error) {
        console.error("Failed to initialize GoogleGenAI:", error);
    }
} else {
    console.warn("Google GenAI API Key not found. AI features will be disabled.");
}

// --- TYPES AND INTERFACES ---
interface Transaction {
  id: string;
  person: 'Natan' | 'Jussara' | 'Ambos';
  category: string; 
  type: 'fixo' | 'variável';
  flow: 'income' | 'expense';
  amount: number;
  date: string;
  description: string;
  user_id?: string;
}

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  user_id?: string;
}

interface Budget {
    id: string;
    category: string;
    amount: number;
    user_id?: string;
}

interface ChatMessage {
    id: string;
    sender: 'user' | 'ai' | 'system';
    text: string;
    isLoading?: boolean;
}

type User = 'Natan' | 'Jussara';
type Theme = 'light' | 'dark';

// --- HELPER FUNCTIONS ---
const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};
const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
        .toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

// --- CONSTANTS ---
const expenseCategories = ['Alimentação', 'Moradia', 'Lazer', 'Saúde', 'Transporte', 'Outros'];
const incomeCategories = ['Salário', 'Freelancer', 'Serviços', 'Outros'];
const allCategories = [...new Set([...expenseCategories, ...incomeCategories])];

// --- ICONS ---
const Icons = {
    home: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    plus: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>,
    chart: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>,
    target: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
    chat: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    wallet: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4Z"/></svg>,
    logout: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>,
    sun: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
    moon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
    pin: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
    send: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
    chevronLeft: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>,
    chevronRight: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>,
};

// --- UI COMPONENTS ---
const MonthNavigator = ({ currentDate, setCurrentDate }: { currentDate: Date, setCurrentDate: React.Dispatch<React.SetStateAction<Date>> }) => {
    const changeMonth = (offset: number) => {
        setCurrentDate(prevDate => {
            const newDate = new Date(prevDate);
            newDate.setMonth(newDate.getMonth() + offset);
            return newDate;
        });
    };

    return (
        <div style={styles.monthNavigator}>
            <button onClick={() => changeMonth(-1)} style={styles.monthNavButton}>{Icons.chevronLeft}</button>
            <h3 style={styles.monthDisplay}>{formatMonthYear(currentDate)}</h3>
            <button onClick={() => changeMonth(1)} style={styles.monthNavButton}>{Icons.chevronRight}</button>
        </div>
    );
};

// --- SCREEN COMPONENTS ---
const LoginScreen = ({ theme, toggleTheme }: { theme: Theme, toggleTheme: () => void }) => {
    return (
        <div style={styles.loginContainer}>
             <button onClick={toggleTheme} style={styles.loginThemeToggleButton}>
                {theme === 'light' ? Icons.moon : Icons.sun}
            </button>
            <div style={styles.loginBox}>
                <h2 style={styles.loginTitle}>Bem-vindo(a) ao</h2>
                <h1 style={styles.loginAppName}>O Financeiro a Dois</h1>
                <div style={{marginTop: '2rem'}}>
                    <Auth
                        supabaseClient={supabase}
                        appearance={{ theme: ThemeSupa }}
                        theme={theme === 'dark' ? 'dark' : 'default'}
                        providers={['google']}
                         localization={{
                            variables: {
                                sign_in: { email_label: 'Seu email', password_label: 'Sua senha', button_label: 'Entrar', social_provider_text: 'Entrar com {{provider}}' },
                                sign_up: { email_label: 'Seu email', password_label: 'Crie uma senha', button_label: 'Registrar', link_text: 'Não tem uma conta? Registre-se' },
                            },
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

const Header = ({ userEmail, onLogout, theme, toggleTheme }: { userEmail: string, onLogout: () => void, theme: Theme, toggleTheme: () => void }) => {
    return (
        <header style={styles.header}>
            <span style={styles.headerWelcome}>Olá, <strong>{userEmail}</strong>!</span>
            <div>
                 <button onClick={toggleTheme} style={styles.themeToggleButton}>
                    {theme === 'light' ? Icons.moon : Icons.sun}
                </button>
                <button onClick={onLogout} style={styles.logoutButton}>{Icons.logout}</button>
            </div>
        </header>
    );
};

const Dashboard = ({ transactions, goals, currentDate, setCurrentDate }: { transactions: Transaction[], goals: Goal[], currentDate: Date, setCurrentDate: React.Dispatch<React.SetStateAction<Date>> }) => {
    const { totalIncome, totalExpenses, netBalance } = useMemo(() => {
        const income = transactions.filter(t => t.flow === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expenses = transactions.filter(t => t.flow === 'expense').reduce((sum, t) => sum + t.amount, 0);
        return { totalIncome: income, totalExpenses: expenses, netBalance: income - expenses };
    }, [transactions]);

    const savingsRate = useMemo(() => {
        if (totalIncome === 0) return 0;
        return (netBalance / totalIncome) * 100;
    }, [totalIncome, netBalance]);

    const topExpenseCategory = useMemo(() => {
        const expenseTotals = transactions.filter(t => t.flow === 'expense').reduce((acc: Record<string, number>, t) => {
            acc[t.category] = (acc[t.category] || 0) + t.amount;
            return acc;
        }, {});
        if (Object.keys(expenseTotals).length === 0) return { category: 'Nenhum', amount: 0 };
        const topCategory = Object.entries(expenseTotals).sort((a, b) => b[1] - a[1])[0];
        return { category: topCategory[0], amount: topCategory[1] };
    }, [transactions]);
    
    const recentTransactions = useMemo(() => transactions.slice(0, 3), [transactions]);

    const { natanExpenses, jussaraExpenses } = useMemo(() => {
        let natanTotal = 0, jussaraTotal = 0;
        transactions.filter(t => t.flow === 'expense').forEach(t => {
            if (t.person === 'Natan') natanTotal += t.amount;
            else if (t.person === 'Jussara') jussaraTotal += t.amount;
            else { natanTotal += t.amount / 2; jussaraTotal += t.amount / 2; }
        });
        return { natanExpenses: natanTotal, jussaraExpenses: jussaraTotal };
    }, [transactions]);

    return (
        <div style={styles.page}>
            <MonthNavigator currentDate={currentDate} setCurrentDate={setCurrentDate} />
            <h2 style={styles.pageTitle}>Dashboard</h2>
            <div style={styles.card}><p style={styles.cardLabel}>Saldo do Mês</p><p style={{...styles.cardValue, color: netBalance >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}}>{formatCurrency(netBalance)}</p></div>
            <div style={styles.grid}>
                 <div style={styles.card}><p style={styles.cardLabel}>Receitas</p><p style={{...styles.cardValueSmall, color: 'var(--success-color)'}}>{formatCurrency(totalIncome)}</p></div>
                 <div style={styles.card}><p style={styles.cardLabel}>Despesas</p><p style={{...styles.cardValueSmall, color: 'var(--danger-color)'}}>{formatCurrency(totalExpenses)}</p></div>
                <div style={styles.card}><p style={styles.cardLabel}>Taxa de Poupança</p><p style={{...styles.cardValueSmall, color: savingsRate >= 0 ? 'var(--secondary-color)' : 'var(--danger-color)'}}>{savingsRate.toFixed(1)}%</p></div>
                <div style={styles.card}><p style={styles.cardLabel}>Top Gasto</p><div style={styles.topCategoryContainer}><div><p style={styles.topCategoryName}>{topExpenseCategory.category}</p><p style={styles.topCategoryAmount}>{formatCurrency(topExpenseCategory.amount)}</p></div></div></div>
            </div>
            <div style={styles.card}><p style={styles.cardLabel}>Gastos Individuais</p><div style={styles.individualSpendingContainer}><div style={styles.individualSpendingItem}><span>Natan</span>{natanExpenses > jussaraExpenses && <span style={styles.spendingTag}>Gastou mais</span>}<strong>{formatCurrency(natanExpenses)}</strong></div><div style={styles.individualSpendingItem}><span>Jussara</span>{jussaraExpenses > natanExpenses && <span style={styles.spendingTag}>Gastou mais</span>}<strong>{formatCurrency(jussaraExpenses)}</strong></div></div></div>
            {goals?.length > 0 && <div style={styles.card}><p style={styles.cardLabel}>Resumo das Metas</p>{goals.slice(0, 2).map(goal => { const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0; return (<div key={goal.id} style={styles.dashboardGoalItem}><div style={styles.goalHeader}><p style={styles.dashboardGoalTitle}>{goal.name}</p><strong style={{color: 'var(--secondary-color)', fontSize: '0.9rem'}}>{Math.round(progress)}%</strong></div><div style={styles.progressContainerSmall}><div style={{...styles.progressBar, width: `${progress}%`, background: 'var(--secondary-color)', height: '8px'}}></div></div></div>); })}</div>}
            <h3 style={styles.subPageTitle}>Últimos Lançamentos do Mês</h3>
            <div style={styles.transactionList}>{recentTransactions.length > 0 ? recentTransactions.map(t => (<div key={t.id} style={styles.transactionItem}><div style={styles.transactionDetails}><span style={styles.transactionDesc}>{t.description}</span><span style={styles.transactionSub}>{t.person} · {t.category} · {formatDate(t.date)}</span></div><span style={{...styles.transactionAmount, color: t.flow === 'income' ? 'var(--success-color)' : 'var(--danger-color)'}}>{t.flow === 'income' ? '+' : '-'}{formatCurrency(t.amount)}</span></div>)) : <p style={styles.noDataText}>Nenhum lançamento neste mês.</p>}</div>
        </div>
    );
};

const Transactions = ({ setTransactions, currentUser, allSortedTransactions, session }: { setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>, currentUser: User, allSortedTransactions: Transaction[], session: Session }) => {
    const [flow, setFlow] = useState<'expense' | 'income'>('expense');

    const addTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const newTransactionData = {
            description: formData.get('description') as string,
            amount: parseFloat(formData.get('amount') as string),
            category: formData.get('category') as string,
            person: formData.get('person') as 'Natan' | 'Jussara' | 'Ambos',
            type: formData.get('type') as 'fixo' | 'variável',
            flow: flow,
            date: new Date().toISOString().split('T')[0],
            user_id: session.user.id,
        };

        const { data, error } = await supabase.from('transactions').insert([newTransactionData]).select();
        if (error) { console.error('Error adding transaction:', error); alert('Erro ao adicionar transação.'); }
        else if (data) { setTransactions(prev => [data[0], ...prev]); e.currentTarget.reset(); }
    };
    
    const currentCategories = flow === 'expense' ? expenseCategories : incomeCategories;

    return (
        <div style={styles.page}>
            <h2 style={styles.pageTitle}>Adicionar Lançamento</h2>
            <div style={styles.card}><div style={styles.toggleContainer}><button onClick={() => setFlow('expense')} style={flow === 'expense' ? styles.toggleButtonActive : styles.toggleButton}>Despesa</button><button onClick={() => setFlow('income')} style={flow === 'income' ? styles.toggleButtonActive : styles.toggleButton}>Receita</button></div><form onSubmit={addTransaction} style={styles.form}><input style={styles.input} name="description" placeholder="Descrição" required /><input style={styles.input} name="amount" type="number" step="0.01" placeholder="Valor (R$)" required /><select style={styles.input} name="category" required>{currentCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select><div style={styles.grid}><select style={styles.input} name="person" required defaultValue={currentUser}><option value="Natan">Natan</option><option value="Jussara">Jussara</option><option value="Ambos">Ambos</option></select><select style={styles.input} name="type" required><option value="variável">Variável</option><option value="fixo">Fixo</option></select></div><button type="submit" style={styles.button}>Adicionar</button></form></div>
            <h2 style={{...styles.pageTitle, marginTop: '2rem'}}>Histórico Completo</h2>
            <div style={styles.transactionList}>{allSortedTransactions.map(t => (<div key={t.id} style={styles.transactionItem}><div style={styles.transactionDetails}><span style={styles.transactionDesc}>{t.description} {t.type === 'fixo' && <span style={{color: 'var(--text-light)'}}>{Icons.pin}</span>}</span><span style={styles.transactionSub}>{t.person} · {t.category} · {formatDate(t.date)}</span></div><span style={{...styles.transactionAmount, color: t.flow === 'income' ? 'var(--success-color)' : 'var(--danger-color)'}}>{t.flow === 'income' ? '+' : '-'}{formatCurrency(t.amount)}</span></div>))}</div>
        </div>
    );
};

const Reports = ({ transactions, currentDate, setCurrentDate }: { transactions: Transaction[], currentDate: Date, setCurrentDate: React.Dispatch<React.SetStateAction<Date>> }) => {
    const [aiInsight, setAiInsight] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerateInsight = async () => {
        if (!ai || transactions.length === 0) { setAiInsight("Adicione transações neste mês para receber insights."); return; }
        setIsLoading(true); setAiInsight('');
        try {
            const result = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: `Analise as seguintes transações financeiras de um casal para ${formatMonthYear(currentDate)} e forneça um insight conciso e útil em uma frase. Foco em tendências ou gastos elevados. Transações: ${JSON.stringify(transactions.slice(0, 20))}` });
            setAiInsight(result.text.trim());
        } catch (error) { console.error("Error fetching AI insight:", error); setAiInsight("Não foi possível gerar um insight no momento."); }
        finally { setIsLoading(false); }
    };
    
    const ReportCategoryList = ({ title, data, color }: { title: string, data: Record<string, number>, color: string }) => {
        if(Object.keys(data).length === 0) return null;
        const maxTotal = useMemo(() => Math.max(...Object.values(data), 0), [data]);
        return (<div style={styles.card}><p style={styles.cardLabel}>{title}</p>{Object.entries(data).sort(([,a],[,b]) => b - a).map(([category, total]) => (<div key={category} style={styles.reportItem}><div style={styles.reportItemDetails}><span>{category}</span><strong>{formatCurrency(total)}</strong></div><div style={styles.progressContainerSmall}><div style={{...styles.progressBar, width: `${(total / maxTotal) * 100}%`, backgroundColor: color}}></div></div></div>))}</div>);
    };

    const expenseTotals = useMemo(() => transactions.filter(t => t.flow === 'expense').reduce((acc: Record<string, number>, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {}), [transactions]);
    const incomeTotals = useMemo(() => transactions.filter(t => t.flow === 'income').reduce((acc: Record<string, number>, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {}), [transactions]);

    return (
        <div style={styles.page}>
            <MonthNavigator currentDate={currentDate} setCurrentDate={setCurrentDate} />
            <h2 style={styles.pageTitle}>Relatórios</h2>
            <ReportCategoryList title="Receitas por Categoria" data={incomeTotals} color="var(--success-color)" />
            <ReportCategoryList title="Gastos por Categoria" data={expenseTotals} color="var(--danger-color)" />
            <div style={{...styles.card, marginTop: '1rem'}}><p style={styles.cardLabel}>Insights da IA</p>{aiInsight && <p style={styles.aiInsight}>{aiInsight}</p>}<button onClick={handleGenerateInsight} disabled={isLoading || !ai} style={styles.button}>{isLoading ? 'Analisando...' : 'Gerar Insight com IA'}</button>{!ai && <p style={styles.apiKeyWarning}>GenAI API Key não configurada.</p>}</div>
        </div>
    );
};

const Goals = ({ goals, setGoals, transactions, session }: { goals: Goal[], setGoals: React.Dispatch<React.SetStateAction<Goal[]>>, transactions: Transaction[], session: Session }) => {
    const [aiSuggestion, setAiSuggestion] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerateSuggestion = async () => {
         if (!ai || goals.length === 0) { setAiSuggestion("Adicione metas para receber sugestões."); return; }
        setIsLoading(true); setAiSuggestion('');
        try {
            const result = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: `Com base nas metas e transações de um casal, dê uma sugestão curta e prática para ajudá-los a alcançar seus objetivos. Metas: ${JSON.stringify(goals)}. Transações: ${JSON.stringify(transactions.slice(0, 15))}` });
            setAiSuggestion(result.text.trim());
        } catch (error) { console.error("Error fetching AI suggestion:", error); setAiSuggestion("Não foi possível gerar uma sugestão."); }
        finally { setIsLoading(false); }
    };

    return (
        <div style={styles.page}>
            <h2 style={styles.pageTitle}>Metas do Casal</h2>
            {goals.map(goal => { const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0; return (<div key={goal.id} style={styles.card}><div style={styles.goalHeader}><p style={styles.goalTitle}>{goal.name}</p><strong style={{color: 'var(--secondary-color)'}}>{Math.round(progress)}%</strong></div><div style={styles.progressContainer}><div style={{...styles.progressBar, width: `${progress}%`, background: 'var(--secondary-color)'}}></div></div><p style={styles.goalProgressText}>{`${formatCurrency(goal.currentAmount)} / ${formatCurrency(goal.targetAmount)}`}</p></div>); })}
            <div style={{...styles.card, marginTop: '1rem'}}><p style={styles.cardLabel}>Sugestão da IA</p>{aiSuggestion && <p style={styles.aiInsight}>{aiSuggestion}</p>}<button onClick={handleGenerateSuggestion} disabled={isLoading || !ai} style={styles.button}>{isLoading ? 'Pensando...' : 'Gerar Sugestão com IA'}</button>{!ai && <p style={styles.apiKeyWarning}>GenAI API Key não configurada.</p>}</div>
        </div>
    );
};

const Budgets = ({ budgets, setBudgets, transactions, session }: { budgets: Budget[], setBudgets: React.Dispatch<React.SetStateAction<Budget[]>>, transactions: Transaction[], session: Session }) => {
    const monthlySpending = useMemo(() => transactions.filter(t => t.flow === 'expense').reduce((acc: Record<string, number>, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {}), [transactions]);
    
    const addBudget = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const category = formData.get('category') as string;
        const amount = parseFloat(formData.get('amount') as string);
        const existingBudget = budgets.find(b => b.category === category);

        if (existingBudget) {
            const { data, error } = await supabase.from('budgets').update({ amount }).eq('id', existingBudget.id).select();
            if (error) console.error("Error updating budget:", error);
            else if (data) setBudgets(budgets.map(b => b.id === existingBudget.id ? data[0] : b));
        } else {
            const { data, error } = await supabase.from('budgets').insert([{ category, amount, user_id: session.user.id }]).select();
            if (error) console.error("Error adding budget:", error);
            else if (data) setBudgets([...budgets, data[0]]);
        }
        e.currentTarget.reset();
    };

    return (
        <div style={styles.page}>
            <h2 style={styles.pageTitle}>Orçamento do Mês</h2>
            <div style={styles.card}><p style={styles.cardLabel}>Definir Teto de Gastos</p><form onSubmit={addBudget} style={{...styles.form, gap: '1rem'}}><select name="category" style={styles.input} required>{expenseCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select><input name="amount" type="number" step="0.01" placeholder="Valor Limite (R$)" style={styles.input} required /><button type="submit" style={styles.button}>Salvar Teto</button></form></div>
            <h3 style={styles.subPageTitle}>Acompanhamento</h3>
            {budgets.map(budget => {
                const spent = monthlySpending[budget.category] || 0;
                const progress = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
                const remaining = budget.amount - spent;
                const color = progress > 100 ? 'var(--danger-color)' : progress > 80 ? 'var(--warning-color)' : 'var(--success-color)';
                return (<div key={budget.id} style={styles.card}><div style={styles.goalHeader}><p style={styles.goalTitle}>{budget.category}</p><strong style={{color: color}}>{Math.round(progress)}%</strong></div><div style={styles.progressContainer}><div style={{...styles.progressBar, width: `${Math.min(progress, 100)}%`, background: color}}></div></div><div style={styles.budgetTextContainer}><span>Gasto: {formatCurrency(spent)} de {formatCurrency(budget.amount)}</span><span style={{color: remaining >= 0 ? 'var(--text-light)' : 'var(--danger-color)'}}>{remaining >= 0 ? `Resta: ${formatCurrency(remaining)}` : `Excedeu: ${formatCurrency(Math.abs(remaining))}`}</span></div></div>);
            })}
            {budgets.length === 0 && <p style={styles.noDataText}>Nenhum teto de gastos definido.</p>}
        </div>
    );
};

const Chat = ({ transactions, setTransactions, goals, setGoals, budgets, setBudgets, currentUser, session }: { transactions: Transaction[], setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>, goals: Goal[], setGoals: React.Dispatch<React.SetStateAction<Goal[]>>, budgets: Budget[], setBudgets: React.Dispatch<React.SetStateAction<Budget[]>>, currentUser: User, session: Session }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([{ id: '1', sender: 'ai', text: `Olá! Sou seu assistente financeiro. Como posso ajudar?` }]);
    const [input, setInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !ai) return;
        const userMessage: ChatMessage = { id: Date.now().toString(), sender: 'user', text: input };
        const loadingMessage: ChatMessage = { id: (Date.now() + 1).toString(), sender: 'ai', text: '', isLoading: true };
        setMessages(prev => [...prev, userMessage, loadingMessage]); setInput('');

        try {
            const responseSchema = { type: Type.OBJECT, properties: { action: { type: Type.STRING, enum: ["addTransaction", "answerQuery", "addGoal", "addBudget"] }, transaction: { type: Type.OBJECT, properties: { flow: { type: Type.STRING, enum: ["income", "expense"] }, description: { type: Type.STRING }, amount: { type: Type.NUMBER }, category: { type: Type.STRING, enum: allCategories }, person: { type: Type.STRING, enum: ["Natan", "Jussara", "Ambos"] }, type: { type: Type.STRING, enum: ["fixo", "variável"] }}}, goal: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, targetAmount: { type: Type.NUMBER }}}, budget: { type: Type.OBJECT, properties: { category: { type: Type.STRING, enum: expenseCategories }, amount: { type: Type.NUMBER }}}, answer: { type: Type.STRING }}};
            const prompt = `Contexto: Você é um assistente financeiro para um casal. Data: ${new Date().toLocaleDateString('pt-BR')}. Transações: ${JSON.stringify(transactions.slice(0, 5))}. Metas: ${JSON.stringify(goals)}. Orçamento: ${JSON.stringify(budgets)}. Tarefa: Analise a mensagem do usuário e decida a ação. Assuma valores padrão se a informação estiver incompleta. Mensagem: "${input}"`;
            const result = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt, config: { responseMimeType: "application/json", responseSchema: responseSchema }});
            const responseJson = JSON.parse(result.text.trim());
            let aiResponseText = "Não consegui entender. Poderia tentar de novo?";

            if (responseJson.action === 'addTransaction' && responseJson.transaction?.amount && responseJson.transaction?.description) {
                const t = responseJson.transaction;
                const newTxData = { description: t.description, amount: t.amount, flow: t.flow || 'expense', category: t.category || 'Outros', person: t.person || currentUser, type: t.type || 'variável', date: new Date().toISOString().split('T')[0], user_id: session.user.id };
                const {data, error} = await supabase.from('transactions').insert([newTxData]).select();
                if (error) { aiResponseText = "Erro ao salvar a transação."; console.error(error); }
                else if (data) { setTransactions(prev => [data[0], ...prev]); aiResponseText = `${t.flow === 'income' ? 'Receita' : 'Despesa'} de ${formatCurrency(t.amount)} adicionada: ${t.description}.`; }
            } else if (responseJson.action === 'answerQuery' && responseJson.answer) {
                aiResponseText = responseJson.answer;
            }
            setMessages(prev => [...prev.slice(0, -1), { id: (Date.now() + 2).toString(), sender: 'ai', text: aiResponseText }]);
        } catch (error) {
            console.error("Error with Gemini API:", error);
            setMessages(prev => [...prev.slice(0, -1), { id: (Date.now() + 2).toString(), sender: 'system', text: "Desculpe, estou com problemas para me conectar." }]);
        }
    };

    return (
        <div style={styles.pageChat}><div style={styles.chatContainer}>{messages.map(msg => (<div key={msg.id} style={ msg.sender === 'user' ? styles.userMessage : msg.sender === 'system' ? styles.systemMessage : styles.aiMessage }>{msg.isLoading ? (<div style={styles.loadingDots}><div style={styles.dot1}></div><div style={styles.dot2}></div><div style={styles.dot3}></div></div>) : msg.text}</div>))}<div ref={chatEndRef} /></div><form onSubmit={handleSendMessage} style={styles.chatInputForm}><input type="text" style={styles.chatInput} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Digite sua mensagem..." disabled={!ai} /><button type="submit" style={styles.chatSendButton} disabled={!ai || !input.trim()}>{Icons.send}</button></form>{!ai && <p style={styles.apiKeyWarning}>API Key do Google GenAI não configurada.</p>}</div>
    );
};

// --- MAIN APP COMPONENT ---
const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [activeScreen, setActiveScreen] = useState('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [theme, setTheme] = useState<Theme>('light');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentUser] = useState<User>('Natan');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);
  
  useEffect(() => {
    const fetchData = async () => {
        if (session) {
            const { data: tData, error: tError } = await supabase.from('transactions').select('*').order('date', { ascending: false });
            if (tError) console.error('Error fetching transactions:', tError); else setTransactions(tData || []);
            const { data: gData, error: gError } = await supabase.from('goals').select('*');
            if (gError) console.error('Error fetching goals:', gError); else setGoals(gData || []);
            const { data: bData, error: bError } = await supabase.from('budgets').select('*');
            if (bError) console.error('Error fetching budgets:', bError); else setBudgets(bData || []);
        }
    };
    fetchData();
  }, [session]);

  const allSortedTransactions = useMemo(() => [...transactions], [transactions]);
  const filteredTransactions = useMemo(() => allSortedTransactions.filter(t => new Date(t.date).getFullYear() === currentDate.getFullYear() && new Date(t.date).getMonth() === currentDate.getMonth()), [allSortedTransactions, currentDate]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(savedTheme);
  }, []);

  useEffect(() => { document.body.setAttribute('data-theme', theme); localStorage.setItem('theme', theme); }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const handleLogout = async () => { await supabase.auth.signOut(); setTransactions([]); setGoals([]); setBudgets([]); };

  if (!session) return <LoginScreen theme={theme} toggleTheme={toggleTheme}/>;

  const renderScreen = () => {
    switch (activeScreen) {
      case 'dashboard': return <Dashboard transactions={filteredTransactions} goals={goals} currentDate={currentDate} setCurrentDate={setCurrentDate} />;
      case 'transactions': return <Transactions setTransactions={setTransactions} currentUser={currentUser} allSortedTransactions={allSortedTransactions} session={session} />;
      case 'reports': return <Reports transactions={filteredTransactions} currentDate={currentDate} setCurrentDate={setCurrentDate} />;
      case 'goals': return <Goals goals={goals} setGoals={setGoals} transactions={allSortedTransactions} session={session} />;
      case 'budgets': return <Budgets budgets={budgets} setBudgets={setBudgets} transactions={filteredTransactions} session={session}/>;
      case 'chat': return <Chat transactions={allSortedTransactions} setTransactions={setTransactions} goals={goals} setGoals={setGoals} budgets={budgets} setBudgets={setBudgets} currentUser={currentUser} session={session} />;
      default: return <Dashboard transactions={filteredTransactions} goals={goals} currentDate={currentDate} setCurrentDate={setCurrentDate} />;
    }
  };

  const NavItem = ({ screen, label, icon }: { screen: string, label: string, icon: React.ReactNode }) => (<button className="nav-item-btn" style={activeScreen === screen ? styles.navButtonActive : styles.navButton} onClick={() => setActiveScreen(screen)} aria-label={label}><div style={styles.navIcon}>{icon}</div><div style={styles.navLabel} className="nav-label">{label}</div></button>);

  return (
    <div className="app-layout">
        <nav style={styles.nav} className="app-nav"><NavItem screen="dashboard" label="Início" icon={Icons.home} /><NavItem screen="transactions" label="Lançar" icon={Icons.plus} /><NavItem screen="reports" label="Relatórios" icon={Icons.chart} /><NavItem screen="budgets" label="Orçamento" icon={Icons.wallet} /><NavItem screen="goals" label="Metas" icon={Icons.target} /><NavItem screen="chat" label="Chat IA" icon={Icons.chat} /></nav>
        <div className="main-content-wrapper"><Header userEmail={session.user.email || ''} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme}/><main style={styles.mainContent} className="app-main">{renderScreen()}</main></div>
    </div>
  );
};

// --- STYLES ---
const styles: { [key: string]: React.CSSProperties } = {
    mainContent: { flex: 1, overflowY: 'auto', padding: '1rem', paddingBottom: '70px' },
    page: { animation: 'fadeIn 0.5s ease-in-out' },
    pageTitle: { fontSize: '1.75rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-color)' },
    subPageTitle: { fontSize: '1.25rem', fontWeight: 600, marginTop: '2rem', marginBottom: '1rem', color: 'var(--text-color)' },
    loginContainer: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '1rem', backgroundColor: 'var(--background-color)', position: 'relative' },
    loginThemeToggleButton: { position: 'absolute', top: '1rem', right: '1rem', background: 'var(--card-background)', border: '1px solid var(--border-color)', color: 'var(--text-light)', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
    loginBox: { textAlign: 'center', backgroundColor: 'var(--card-background)', padding: '2.5rem', borderRadius: '24px', boxShadow: '0 8px 30px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' },
    loginTitle: { margin: 0, fontSize: '1.2rem', color: 'var(--text-light)', fontWeight: 500 },
    loginAppName: { margin: '0.25rem 0 1.5rem 0', fontSize: '2rem', color: 'var(--primary-color)', fontWeight: 700 },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', flexShrink: 0 },
    headerWelcome: { fontWeight: 500, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    logoutButton: { background: 'none', border: 'none', color: 'var(--text-light)', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: '0.5rem' },
    themeToggleButton: { background: 'none', border: 'none', color: 'var(--text-light)', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
    monthNavigator: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--background-color)', borderRadius: '12px', padding: '0.25rem', marginBottom: '1rem' },
    monthNavButton: { background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px' },
    monthDisplay: { margin: 0, fontSize: '1rem', fontWeight: 600, textTransform: 'capitalize' },
    card: { backgroundColor: 'var(--card-background)', borderRadius: '16px', padding: '1rem', marginBottom: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' },
    cardLabel: { margin: '0 0 0.5rem 0', color: 'var(--text-light)', fontSize: '0.9rem' },
    cardValue: { margin: '0', fontSize: '2.25rem', fontWeight: 700, color: 'var(--text-color)' },
    cardValueSmall: { margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-color)' },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
    nav: { display: 'flex', justifyContent: 'space-around', padding: '0.5rem 0', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--card-background)', position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: '500px', margin: '0 auto', zIndex: 100 },
    navButton: { background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', textAlign: 'center', padding: '0.25rem', borderRadius: '8px', transition: 'all 0.2s ease', flex: 1 },
    navButtonActive: { background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', textAlign: 'center', padding: '0.25rem', borderRadius: '8px', transition: 'all 0.2s ease', flex: 1 },
    navIcon: { height: '24px' },
    navLabel: { fontSize: '0.7rem', marginTop: '2px' },
    topCategoryContainer: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
    topCategoryName: { margin: 0, fontWeight: 600, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    topCategoryAmount: { margin: '2px 0 0 0', color: 'var(--text-light)', fontSize: '0.9rem', fontWeight: 500 },
    individualSpendingContainer: { display: 'flex', justifyContent: 'space-around', gap: '1rem' },
    individualSpendingItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' },
    spendingTag: { fontSize: '0.7rem', color: 'var(--warning-color)', fontWeight: 600 },
    dashboardGoalItem: { marginBottom: '1rem' },
    dashboardGoalTitle: { margin: '0 0 0.5rem 0', fontWeight: 500, fontSize: '1rem' },
    noDataText: { textAlign: 'center', color: 'var(--text-light)', padding: '1rem' },
    toggleContainer: { display: 'flex', backgroundColor: 'var(--background-color)', borderRadius: '14px', padding: '4px', marginBottom: '1rem' },
    toggleButton: { flex: 1, padding: '0.6rem', border: 'none', background: 'transparent', color: 'var(--text-light)', fontWeight: 600, borderRadius: '12px', cursor: 'pointer' },
    toggleButtonActive: { flex: 1, padding: '0.6rem', border: 'none', background: 'var(--card-background)', color: 'var(--primary-color)', fontWeight: 600, borderRadius: '12px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    form: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
    input: { padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--background-color)', fontSize: '1rem', color: 'var(--text-color)' },
    button: { padding: '0.85rem', borderRadius: '12px', border: 'none', backgroundColor: 'var(--primary-color)', color: 'white', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' },
    transactionList: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
    transactionItem: { display: 'flex', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--card-background)', borderRadius: '12px' },
    transactionDetails: { display: 'flex', flexDirection: 'column', flex: 1, marginRight: '1rem' },
    transactionDesc: { fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' },
    transactionSub: { color: 'var(--text-light)', fontSize: '0.8rem', marginTop: '2px' },
    transactionAmount: { fontWeight: 600, fontSize: '1.1rem' },
    reportItem: { display: 'flex', flexDirection: 'column', padding: '0.75rem 0' },
    reportItemDetails: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' },
    goalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    goalTitle: { margin: '0 0 0.5rem 0', fontWeight: 600, fontSize: '1.1rem' },
    progressContainer: { height: '20px', backgroundColor: 'var(--border-color)', borderRadius: '10px', overflow: 'hidden' },
    progressContainerSmall: { height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' },
    progressBar: { height: '100%', backgroundColor: 'var(--primary-color)', borderRadius: '10px', transition: 'width 0.5s ease' },
    goalProgressText: { margin: '0.5rem 0 0 0', color: 'var(--text-light)', textAlign: 'right', fontSize: '0.9rem' },
    budgetTextContainer: { display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-light)' },
    aiInsight: { fontStyle: 'italic', color: 'var(--text-light)', minHeight: '1.2em', marginBottom: '1rem' },
    pageChat: { display: 'flex', flexDirection: 'column', height: '100%', animation: 'fadeIn 0.5s ease-in-out' },
    chatContainer: { flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
    userMessage: { alignSelf: 'flex-end', backgroundColor: 'var(--primary-color)', color: 'white', padding: '0.75rem 1.25rem', borderRadius: '20px 20px 4px 20px', maxWidth: '80%', wordBreak: 'break-word' },
    aiMessage: { alignSelf: 'flex-start', backgroundColor: 'var(--border-color)', color: 'var(--text-color)', padding: '0.75rem 1.25rem', borderRadius: '20px 20px 20px 4px', maxWidth: '80%', wordBreak: 'break-word' },
    systemMessage: { alignSelf: 'center', backgroundColor: 'var(--warning-color)', color: 'white', padding: '0.5rem 1rem', borderRadius: '12px', fontSize: '0.8rem' },
    chatInputForm: { display: 'flex', padding: '0.5rem 1rem', borderTop: '1px solid var(--border-color)', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--card-background)' },
    chatInput: { flex: 1, border: 'none', padding: '0.75rem', borderRadius: '20px', backgroundColor: 'var(--background-color)', color: 'var(--text-color)' },
    chatSendButton: { background: 'var(--primary-color)', border: 'none', color: 'white', cursor: 'pointer', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    apiKeyWarning: { textAlign: 'center', padding: '0.5rem', color: 'var(--danger-color)', fontSize: '0.8rem' },
    loadingDots: { display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center', height: '21px' },
    dot1: { animation: 'typing-dot 1.5s infinite 0s', height: '8px', width: '8px', backgroundColor: 'var(--text-light)', borderRadius: '50%' },
    dot2: { animation: 'typing-dot 1.5s infinite 0.25s', height: '8px', width: '8px', backgroundColor: 'var(--text-light)', borderRadius: '50%' },
    dot3: { animation: 'typing-dot 1.5s infinite 0.5s', height: '8px', width: '8px', backgroundColor: 'var(--text-light)', borderRadius: '50%' },
};

// --- RENDER APP ---
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
