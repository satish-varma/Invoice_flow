
import React from 'react';
import type { Settings } from '@/services/settingsService';
import { Payslip } from '@/services/payslipService';
import { MONTH_NAMES } from '@/lib/payslipConstants';
import { format } from 'date-fns';

interface PayslipPreviewProps {
    payslip: Payslip;
    settings: Settings;
}

const safeFormat = (dateStr: string | undefined | null, fmt: string): string => {
    if (!dateStr) return '';
    try { return format(new Date(dateStr), fmt); } catch { return ''; }
};

const formatINR = (amount: number): string =>
    '₹' + (amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const PayslipPreview = React.forwardRef<HTMLDivElement, PayslipPreviewProps>(({ payslip, settings }, ref) => {
    const activeProfile = settings.companyProfiles?.find(p => p.id === payslip.companyProfileId);
    const monthName = MONTH_NAMES[(payslip.payPeriodMonth || 1) - 1];
    const periodLabel = `${monthName} ${payslip.payPeriodYear}`;

    // Pad earnings/deductions to same length
    const maxRows = Math.max(payslip.earnings?.length || 0, payslip.deductions?.length || 0);
    const padded = Array.from({ length: maxRows }, (_, i) => ({
        earning: payslip.earnings?.[i] || null,
        deduction: payslip.deductions?.[i] || null,
    }));

    const style = {
        page: {
            backgroundColor: 'white',
            color: '#1a1a1a',
            width: '794px',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '12px',
            lineHeight: '1.5',
            padding: '40px 48px',
            boxSizing: 'border-box' as const,
        },
        header: {
            backgroundColor: '#1e40af',
            color: 'white',
            padding: '20px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '0',
        },
        companyName: {
            fontSize: '22px',
            fontWeight: '900' as const,
            margin: '0 0 4px 0',
            letterSpacing: '-0.3px',
        },
        companyAddr: {
            fontSize: '10px',
            margin: '0',
            opacity: 0.85,
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap' as const,
        },
        payslipTitle: {
            fontSize: '14px',
            fontWeight: '700' as const,
            margin: '0 0 6px 0',
            letterSpacing: '1px',
            textAlign: 'right' as const,
        },
        periodLabel: {
            fontSize: '12px',
            textAlign: 'right' as const,
            margin: '0',
            opacity: 0.9,
        },
        employeeSection: {
            backgroundColor: '#f0f4ff',
            padding: '14px 24px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '10px',
            borderBottom: '2px solid #1e40af',
        },
        empField: {
            display: 'flex',
            flexDirection: 'column' as const,
        },
        empLabel: {
            fontSize: '9px',
            color: '#6b7280',
            textTransform: 'uppercase' as const,
            fontWeight: '600' as const,
            letterSpacing: '0.5px',
            margin: '0 0 2px 0',
        },
        empValue: {
            fontSize: '11.5px',
            fontWeight: '600' as const,
            margin: '0',
            color: '#1a1a1a',
        },
        daysRow: {
            display: 'flex',
            gap: '0',
            borderBottom: '1px solid #e5e7eb',
        },
        dayBox: {
            flex: 1,
            textAlign: 'center' as const,
            padding: '10px 8px',
            borderRight: '1px solid #e5e7eb',
        },
        dayLabel: {
            fontSize: '9px',
            color: '#6b7280',
            textTransform: 'uppercase' as const,
            fontWeight: '600' as const,
            margin: '0 0 2px 0',
        },
        dayValue: {
            fontSize: '14px',
            fontWeight: '700' as const,
            color: '#1e40af',
            margin: '0',
        },
        sectionHeader: {
            backgroundColor: '#1e40af',
            color: 'white',
            fontSize: '11px',
            fontWeight: '700' as const,
            padding: '5px 10px',
        },
        table: {
            width: '100%',
            borderCollapse: 'collapse' as const,
        },
        th: {
            backgroundColor: '#eff6ff',
            fontSize: '10px',
            fontWeight: '700' as const,
            color: '#374151',
            padding: '6px 10px',
            textAlign: 'left' as const,
            borderBottom: '1px solid #d1d5db',
        },
        thRight: {
            backgroundColor: '#eff6ff',
            fontSize: '10px',
            fontWeight: '700' as const,
            color: '#374151',
            padding: '6px 10px',
            textAlign: 'right' as const,
            borderBottom: '1px solid #d1d5db',
        },
        td: {
            fontSize: '11px',
            padding: '6px 10px',
            color: '#1a1a1a',
            borderBottom: '1px solid #f3f4f6',
        },
        tdRight: {
            fontSize: '11px',
            padding: '6px 10px',
            textAlign: 'right' as const,
            color: '#1a1a1a',
            borderBottom: '1px solid #f3f4f6',
        },
        tdRed: {
            fontSize: '11px',
            padding: '6px 10px',
            textAlign: 'right' as const,
            color: '#b91c1c',
            borderBottom: '1px solid #f3f4f6',
        },
        totalRow: {
            backgroundColor: '#f8fafc',
            fontWeight: '700' as const,
        },
        netPayBox: {
            backgroundColor: '#1e40af',
            color: 'white',
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '0',
        },
    };

    return (
        <div ref={ref} style={{ backgroundColor: 'white' }}>
            <div data-pdf-body="true">
                {/* ===== HEADER ===== */}
                <div style={style.header}>
                    <div>
                        <h1 style={style.companyName}>{activeProfile?.companyName?.toUpperCase() || 'THE GUT GURU'}</h1>
                        <p style={style.companyAddr}>
                            {activeProfile?.companyAddress || 'H NO.6-46/3/A, Venkateswarao nagar, Hyderabad-500050'}
                        </p>
                        {activeProfile?.companyGstin && (
                            <p style={{ ...style.companyAddr, marginTop: '2px' }}>GSTIN: {activeProfile.companyGstin}</p>
                        )}
                    </div>
                    <div>
                        <p style={style.payslipTitle}>PAYSLIP</p>
                        <p style={style.periodLabel}>For the month of {periodLabel}</p>
                        <p style={{ ...style.periodLabel, marginTop: '4px' }}>
                            Ref: {payslip.payslipNumber || '—'}
                        </p>
                    </div>
                </div>

                {/* ===== EMPLOYEE DETAILS ===== */}
                <div style={style.employeeSection}>
                    <div style={style.empField}>
                        <span style={style.empLabel}>Employee Name</span>
                        <span style={style.empValue}>{payslip.employeeName}</span>
                    </div>
                    <div style={style.empField}>
                        <span style={style.empLabel}>Employee ID</span>
                        <span style={style.empValue}>{payslip.employeeId || '—'}</span>
                    </div>
                    <div style={style.empField}>
                        <span style={style.empLabel}>Designation</span>
                        <span style={style.empValue}>{payslip.designation}</span>
                    </div>
                    <div style={style.empField}>
                        <span style={style.empLabel}>Department</span>
                        <span style={style.empValue}>{payslip.department || '—'}</span>
                    </div>
                    <div style={style.empField}>
                        <span style={style.empLabel}>Pay Date</span>
                        <span style={style.empValue}>{safeFormat(payslip.payDate, 'dd MMM yyyy')}</span>
                    </div>
                    <div style={style.empField}>
                        <span style={style.empLabel}>PAN Number</span>
                        <span style={style.empValue}>{payslip.panNumber || '—'}</span>
                    </div>
                    {payslip.bankAccount && (
                        <div style={style.empField}>
                            <span style={style.empLabel}>Bank Account</span>
                            <span style={style.empValue}>XXXX{payslip.bankAccount.slice(-4)}</span>
                        </div>
                    )}
                    {payslip.pfNumber && (
                        <div style={style.empField}>
                            <span style={style.empLabel}>PF Number</span>
                            <span style={style.empValue}>{payslip.pfNumber}</span>
                        </div>
                    )}
                </div>

                {/* ===== ATTENDANCE ===== */}
                <div style={style.daysRow}>
                    <div style={style.dayBox}>
                        <p style={style.dayLabel}>Working Days</p>
                        <p style={style.dayValue}>{payslip.workingDays}</p>
                    </div>
                    <div style={style.dayBox}>
                        <p style={style.dayLabel}>Paid Days</p>
                        <p style={{ ...style.dayValue, color: '#15803d' }}>{payslip.paidDays}</p>
                    </div>
                    <div style={{ ...style.dayBox, borderRight: 'none' }}>
                        <p style={style.dayLabel}>LOP Days</p>
                        <p style={{ ...style.dayValue, color: '#b91c1c' }}>{payslip.lopDays}</p>
                    </div>
                </div>

                {/* ===== EARNINGS & DEDUCTIONS TABLE ===== */}
                <div style={{ display: 'flex', marginTop: '16px', gap: '16px' }}>
                    {/* EARNINGS */}
                    <div style={{ flex: 1 }}>
                        <div style={style.sectionHeader}>EARNINGS</div>
                        <table style={style.table}>
                            <thead>
                                <tr>
                                    <th style={style.th}>Component</th>
                                    <th style={style.thRight}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payslip.earnings?.map((e, i) => (
                                    <tr key={i}>
                                        <td style={style.td}>{e.label}</td>
                                        <td style={style.tdRight}>{formatINR(e.amount)}</td>
                                    </tr>
                                ))}
                                <tr style={style.totalRow}>
                                    <td style={{ ...style.td, fontWeight: '700', borderTop: '1px solid #d1d5db' }}>Gross Earnings</td>
                                    <td style={{ ...style.tdRight, fontWeight: '700', borderTop: '1px solid #d1d5db' }}>{formatINR(payslip.grossEarnings)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* DEDUCTIONS */}
                    <div style={{ flex: 1 }}>
                        <div style={style.sectionHeader}>DEDUCTIONS</div>
                        <table style={style.table}>
                            <thead>
                                <tr>
                                    <th style={style.th}>Component</th>
                                    <th style={style.thRight}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payslip.deductions?.map((d, i) => (
                                    <tr key={i}>
                                        <td style={style.td}>{d.label}</td>
                                        <td style={style.tdRed}>{formatINR(d.amount)}</td>
                                    </tr>
                                ))}
                                <tr style={style.totalRow}>
                                    <td style={{ ...style.td, fontWeight: '700', borderTop: '1px solid #d1d5db' }}>Total Deductions</td>
                                    <td style={{ ...style.tdRed, fontWeight: '700', borderTop: '1px solid #d1d5db' }}>{formatINR(payslip.totalDeductions)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ===== NET PAY ===== */}
                <div style={style.netPayBox}>
                    <div>
                        <p style={{ margin: '0', fontSize: '11px', opacity: 0.8 }}>Net Pay for {periodLabel}</p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '11px', opacity: 0.7 }}>
                            ({formatINR(payslip.grossEarnings)} − {formatINR(payslip.totalDeductions)})
                        </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: '0', fontSize: '24px', fontWeight: '900', letterSpacing: '-0.5px' }}>
                            {formatINR(payslip.netPay)}
                        </p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '10px', opacity: 0.75 }}>
                            Credited to account ending XXXX{payslip.bankAccount ? payslip.bankAccount.slice(-4) : '****'}
                        </p>
                    </div>
                </div>

                {/* ===== NOTE ===== */}
                <p style={{ fontSize: '9.5px', color: '#9ca3af', marginTop: '14px', textAlign: 'center' }}>
                    This is a computer-generated payslip and does not require a signature. For any discrepancies, please contact HR.
                </p>
            </div>

            {/* ===== FOOTER ===== */}
            <div data-pdf-footer="true" style={{ borderTop: '1px solid #e5e7eb', padding: '8px 48px', textAlign: 'center', fontSize: '10px', color: '#9ca3af', backgroundColor: 'white' }}>
                <p style={{ margin: '0' }}>
                    {activeProfile?.companyName || 'THE GUT GURU'} &nbsp;|&nbsp; thegutguru.in@gmail.com &nbsp;|&nbsp; Confidential
                </p>
            </div>
        </div>
    );
});
PayslipPreview.displayName = 'PayslipPreview';
