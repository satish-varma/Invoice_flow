
import React from 'react';
import { format } from "date-fns";
import type { Settings } from '@/services/settingsService';
import { OfferLetter } from '@/services/offerLetterService';

interface OfferLetterPreviewProps {
    offerLetter: OfferLetter;
    settings: Settings;
}

const safeFormat = (dateStr: string | undefined | null, fmt: string): string => {
    if (!dateStr) return 'TBD';
    try {
        return format(new Date(dateStr), fmt);
    } catch {
        return 'TBD';
    }
};

const styles: Record<string, React.CSSProperties> = {
    page: {
        backgroundColor: 'white',
        color: '#1a1a1a',
        width: '794px',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '12px',
        lineHeight: '1.65',
        padding: '56px 64px',
        boxSizing: 'border-box',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '4px',
    },
    companyName: {
        fontSize: '26px',
        fontWeight: '900',
        color: '#1e40af',
        margin: '0 0 6px 0',
        letterSpacing: '-0.3px',
    },
    companyDetails: {
        margin: '0',
        fontSize: '11px',
        color: '#333',
        lineHeight: '1.6',
        whiteSpace: 'pre-wrap' as const,
    },
    offerLetterTitle: {
        fontSize: '20px',
        fontWeight: '700',
        color: '#1a1a1a',
        margin: '0 0 10px 0',
        letterSpacing: '0.5px',
        textAlign: 'right' as const,
    },
    refBlock: {
        textAlign: 'right' as const,
        fontSize: '12px',
        lineHeight: '1.7',
    },
    hr: {
        border: 'none',
        borderTop: '1px solid #d1d5db',
        margin: '14px 0 28px 0',
    },
    to: {
        margin: '0 0 16px 0',
        fontWeight: '400',
        fontSize: '12px',
    },
    recipientName: {
        margin: '0 0 2px 0',
        fontWeight: '700',
        fontSize: '13px',
    },
    recipientDetails: {
        margin: '0',
        fontSize: '12px',
        lineHeight: '1.6',
        whiteSpace: 'pre-wrap' as const,
    },
    subjectLine: {
        fontSize: '15px',
        fontWeight: '700',
        margin: '24px 0 16px 0',
    },
    para: {
        margin: '0 0 14px 0',
        textAlign: 'justify' as const,
        fontSize: '12px',
    },
    termsHeading: {
        fontWeight: '700',
        textDecoration: 'underline',
        margin: '20px 0 8px 0',
        fontSize: '12px',
    },
    termsList: {
        margin: '0',
        padding: '0',
        listStyle: 'none',
        fontSize: '11.5px',
    },
    termItem: {
        display: 'flex',
        marginBottom: '4px',
        textAlign: 'justify' as const,
        lineHeight: '1.55',
    },
    termNum: {
        minWidth: '20px',
        fontWeight: '400',
        flexShrink: 0,
    },
    closingSection: {
        marginTop: '24px',
    },
    signatureRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: '40px',
    },
    sigBox: {
        display: 'flex',
        flexDirection: 'column' as const,
    },
    sigLine: {
        width: '200px',
        borderTop: '1px solid #1a1a1a',
        marginBottom: '6px',
    },
    footer: {
        marginTop: '60px',
        paddingTop: '8px',
        borderTop: '1px solid #e5e7eb',
        textAlign: 'center' as const,
        fontSize: '10px',
        color: '#888',
    },
};

export const OfferLetterPreview = React.forwardRef<HTMLDivElement, OfferLetterPreviewProps>(({ offerLetter, settings }, ref) => {
    const activeProfile = settings.companyProfiles?.find(p => p.id === offerLetter.companyProfileId);
    const annualCTC = offerLetter.compensation || 0;

    // Format annual CTC in Indian style: ₹3,00,000
    const formatINR = (amount: number): string => {
        return amount.toLocaleString('en-IN');
    };

    const offerDateFormatted = safeFormat(offerLetter.offerDate, "MMMM do, yyyy");
    const startDateFormatted = safeFormat(offerLetter.proposedStartDate, "MMMM do, yyyy");
    // Acceptance deadline: ~7 days before start date
    const acceptanceDeadline = offerLetter.proposedStartDate
        ? safeFormat(
              new Date(new Date(offerLetter.proposedStartDate).getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
              "MMMM do, yyyy"
          )
        : 'TBD';

    const terms = [
        `Scope of Work: Your roles and responsibilities will be as discussed and may be amended from time to time by the management based on business requirements.`,
        `Work Hours & Location: Your standard working hours will be ${offerLetter.workHours || '9:00 AM to 6:00 PM, 5 working days in a week'}. The company reserves the right to change work timings or locations as per operational needs.`,
        `Probation & Confirmation: You will be on a probation period of ${offerLetter.probationPeriod || '3 months'}. Your performance will be reviewed periodically, and your employment will be confirmed in writing upon satisfactory completion of probation.`,
        `Confidentiality: You shall maintain absolute confidentiality regarding the company's business, trade secrets, financial information, and client data. This obligation continues even after the termination of your employment.`,
        `Intellectual Property: Any work, software, design, or documentation produced by you during your tenure shall be the exclusive property of the company.`,
        `Notice Period: During probation, the notice period for resignation or termination will be ${offerLetter.noticePeriodProbation || '15 days'}. Post-confirmation, a written notice of ${offerLetter.noticePeriodPostConfirmation || '30 days'} or salary in lieu thereof is required from either party.`,
        `Non-Compete & Non-Solicitation: For a period of 12 months following your departure, you agree not to engage with direct competitors or solicit the company's clients or employees.`,
        `Background Verification: This offer is contingent upon the successful completion of background checks, including verification of your academic credentials and previous employment history.`,
        `Code of Conduct: You are expected to adhere to the company's policies, maintain professional ethics, and ensure a respectful workplace environment at all times.`,
        `Leave Policy: You will be entitled to ${offerLetter.annualLeaves || 12} days of annual leave, which will be credited on a pro-rata basis from your date of joining.`,
        `Termination for Cause: The company reserves the right to terminate your employment without notice in cases of misconduct, fraud, or breach of confidentiality.`,
        `Governing Law: This agreement shall be governed by the laws of India, and any disputes shall be subject to the exclusive jurisdiction of the local courts where the company is headquartered.`,
        ...(offerLetter.customTerms ? [offerLetter.customTerms] : []),
    ];

    return (
        <div ref={ref} style={{ backgroundColor: 'white' }}>
        <div data-pdf-body="true" style={styles.page}>
            {/* ===== HEADER ===== */}
            <div style={styles.header}>
                <div>
                    <h1 style={styles.companyName}>
                        {activeProfile?.companyName?.toUpperCase() || 'THE GUT GURU'}
                    </h1>
                    <p style={styles.companyDetails}>
                        {activeProfile?.companyAddress || 'H NO.6-46/3/A, Venkateswarao nagar,\nChanda Nagar, Hyderabad-500050'}
                    </p>
                    {activeProfile?.companyGstin && (
                        <p style={{ ...styles.companyDetails, marginTop: '2px' }}>
                            GSTIN: {activeProfile.companyGstin}
                        </p>
                    )}
                </div>
                <div>
                    <p style={styles.offerLetterTitle}>OFFER LETTER</p>
                    <div style={styles.refBlock}>
                        <p style={{ margin: '0' }}>Ref: {offerLetter.offerNumber || 'TGG/OL/26/0001'}</p>
                        <p style={{ margin: '0' }}>Date: {offerDateFormatted}</p>
                    </div>
                </div>
            </div>

            <hr style={styles.hr} />

            {/* ===== RECIPIENT ===== */}
            <p style={styles.to}><strong>To,</strong></p>
            <p style={styles.recipientName}>{offerLetter.employeeName}</p>
            <p style={styles.recipientDetails}>
                {offerLetter.employeeAddress}
            </p>
            <p style={{ ...styles.recipientDetails, margin: '2px 0 0 0' }}>{offerLetter.employeeEmail}</p>

            {/* ===== SUBJECT ===== */}
            <p style={styles.subjectLine}>
                Subject: Offer of Employment for the position of {offerLetter.position}
            </p>

            {/* ===== BODY ===== */}
            <p style={styles.para}>Dear {offerLetter.employeeName?.split(' ')[0] || 'Candidate'},</p>

            <p style={styles.para}>
                We are pleased to offer you employment at <strong>THE GUT GURU</strong> as <strong>{offerLetter.position}</strong>. We believe your skills and experience will be a valuable asset to our team.
            </p>

            <p style={styles.para}>
                <strong>Proposed Start Date:</strong> Your first day of employment will be <strong>{startDateFormatted}</strong>.
            </p>

            <p style={styles.para}>
                <strong>Compensation:</strong> Your total annual compensation will be <strong>₹{formatINR(annualCTC)}</strong> (Cost to Company), subject to statutory deductions. This amount includes all allowances and benefits as per company policy.
            </p>

            <p style={styles.para}>
                <strong>Probation Period:</strong> You will be on a probation period of <strong>{offerLetter.probationPeriod || '3 months'}</strong>. Upon successful completion of your probation, your employment may be confirmed based on your performance.
            </p>

            <p style={{ ...styles.para, marginBottom: '20px' }}>
                <strong>Responsibilities:</strong> As {offerLetter.position}, your primary responsibilities will include contributing to our growth and maintaining the high standards of quality and service that our clients expect from us.
            </p>

            {/* ===== TERMS ===== */}
            <p style={styles.termsHeading}>Terms and Conditions of Employment:</p>
            <div style={styles.termsList as React.CSSProperties}>
                {terms.map((term, i) => (
                    <div key={i} style={styles.termItem}>
                        <span style={styles.termNum}>{i + 1}.</span>
                        <span>{term}</span>
                    </div>
                ))}
            </div>

            {/* ===== CLOSING ===== */}
            <div style={styles.closingSection}>
                <p style={styles.para}>
                    This offer is contingent upon the successful completion of background checks and verification of your academic and professional credentials. Please sign and return a copy of this letter as a token of your acceptance by <strong>{acceptanceDeadline}</strong>.
                </p>
                <p style={styles.para}>
                    We look forward to having you join us and wish you a successful career with THE GUT GURU.
                </p>
            </div>

            {/* ===== SIGNATURE BLOCK ===== */}
            <div style={styles.signatureRow}>
                {/* Left: Candidate */}
                <div style={styles.sigBox}>
                    <div style={{ height: '50px' }} /> {/* space for candidate to sign */}
                    <div style={styles.sigLine} />
                    <p style={{ margin: '0', fontWeight: '700', fontSize: '12px' }}>Candidate Signature</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#555' }}>
                        Accepted by {offerLetter.employeeName}
                    </p>
                </div>

                {/* Right: Company */}
                <div style={{ ...styles.sigBox, alignItems: 'flex-end' }}>
                    <p style={{ margin: '0 0 4px 0', fontSize: '12px' }}>
                        For <strong>THE GUT GURU</strong>
                    </p>
                    {/* Stamp / Signature image */}
                    <div style={{ width: '110px', height: '90px', marginBottom: '0px' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/sigwithsign.png"
                            alt="Company Stamp"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                    </div>
                    <div style={{ ...styles.sigLine, marginTop: '0' }} />
                    <p style={{ margin: '0', fontWeight: '700', fontSize: '12px' }}>Authorized Signatory</p>
                </div>
            </div>

            {/* ===== FOOTER ===== */}
            <div data-pdf-footer="true" style={styles.footer}>
                <p style={{ margin: '0' }}>
                    THE GUT GURU &nbsp;|&nbsp; Contact: {activeProfile?.companyGstin || '36DDTPJ6536DlZ8'} &nbsp;|&nbsp; Confidential
                </p>
            </div>
        </div>
        </div>
    );
});
OfferLetterPreview.displayName = "OfferLetterPreview";
