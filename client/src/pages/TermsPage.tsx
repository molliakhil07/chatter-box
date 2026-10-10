import type { ReactNode } from "react";

const sections: Array<{ title: string; body: ReactNode }> = [
  { title: "1. Acceptance", body: <>These Terms & Conditions (“Terms”) govern use of Chatter Box (“Service”). By creating an account and selecting the required acceptance checkbox, you agree to these Terms. If you do not agree, do not create an account or use the Service.</> },
  { title: "2. Eligibility", body: <>Chatter Box is intended for people aged <strong>18 or older</strong>. By registering, you confirm you are at least 18 and legally able to enter into these Terms, subject to applicable law.</> },
  { title: "3. Accounts", body: <>Provide accurate registration information, protect your password and access credentials, and notify us if you suspect unauthorized access. Do not impersonate another person or attempt to access another person's account.</> },
  { title: "4. Acceptable Use", body: <>Do not use the Service to threaten, harass, stalk, defraud, distribute malicious content, infringe others' rights, attempt unauthorized access, interfere with the Service, or engage in unlawful activity. You are responsible for content you send or share.</> },
  { title: "5. Messages and Encryption", body: <>The project design states that end-to-end encryption is implemented. <strong>Technical verification is required before this is treated as a guarantee.</strong> Verify which content is encrypted, where encryption/decryption occur, how keys are managed, and whether attachments, backups, metadata, and other features are covered. Recipients may copy, save, screenshot, or share information they receive.</> },
  { title: "6. Privacy", body: <>Our intended data practices are described in the <a href="/privacy">Chatter Box Privacy Policy</a>. The published policy must accurately reflect the deployed Service and its providers.</> },
  { title: "7. Availability and Changes", body: <>We may update, suspend, or discontinue features to maintain, improve, or protect the Service. We do not guarantee uninterrupted or error-free availability. Rights and remedies required by law remain unaffected.</> },
  { title: "8. Restrictions and Termination", body: <>We may restrict, suspend, or terminate access when reasonably necessary to address violations, security risks, unlawful activity, or misuse. Where appropriate and legally permitted, notice may be provided. Account deletion and retention limitations must be explained in the Privacy Policy.</> },
  { title: "9. Intellectual Property", body: <>The Service's software, branding, design, and materials may be protected by law. These Terms do not transfer ownership to you. You retain rights in your content, subject to rights needed to operate the Service and the rights of others. <strong>Review required:</strong> define any limited licence needed to host, transmit, display, or store content.</> },
  { title: "10. Disclaimers and Liability", body: <>To the extent permitted by law, the Service is provided on an “as available” basis. Nothing excludes or limits rights, warranties, remedies, or liabilities that cannot legally be excluded or limited. Additional liability limits require legal review.</> },
  { title: "11. Term Updates", body: <>The published version should identify its version and effective date. We will notify users of material changes and obtain renewed agreement where required by law.</> },
  { title: "12. Governing Law", body: <><strong>Not finalized.</strong> Confirm the operator's legal identity, governing law, courts, dispute process, and operating jurisdictions after legal review. Mandatory rights under applicable law remain unaffected.</> },
  { title: "13. Contact", body: <><strong>Operator/legal entity:</strong> To be confirmed<br/><strong>Terms contact email:</strong> To be configured and verified.</> },
];

export default function TermsPage() {
  return <main className="cb-legal-page"><style>{`
    html:has(.cb-legal-page),
body:has(.cb-legal-page),
#root:has(.cb-legal-page) {
  height: auto !important;
  min-height: 100% !important;
  overflow: visible !important;
}

body:has(.cb-legal-page) {
  overflow-y: auto !important;
}

#root:has(.cb-legal-page) {
  min-height: 100dvh !important;
}

.cb-legal-page {
  width: 100%;
  min-height: 100dvh;
  overflow: visible;
  background: #f1f1f1;
  color: #111;
  padding: 28px 14px 48px;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}
    .cb-legal-card{max-width:840px;margin:auto;padding:clamp(22px,5vw,46px);background:#fff;border:1px solid #ddd;border-radius:16px}
    .cb-legal-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:28px}
    .cb-legal-brand{font-size:13px;font-weight:800;letter-spacing:.08em}
    .cb-legal-back{color:#111;text-decoration:none;border:1px solid #ddd;border-radius:8px;padding:9px 12px;font-size:13px}
    .cb-legal-kicker{font-size:12px;color:#777;letter-spacing:.12em;text-transform:uppercase;font-weight:700}
    .cb-legal-card h1{font-size:clamp(30px,5vw,42px);letter-spacing:-.04em;margin:10px 0}
    .cb-legal-meta{font-size:13px;color:#777;line-height:1.7}
    .cb-legal-notice{margin:22px 0;padding:14px;border:1px solid #e3e3e3;border-radius:9px;background:#f7f7f7;font-size:13px;line-height:1.65;color:#444}
    .cb-legal-section{border-top:1px solid #eee;padding:18px 0}
    .cb-legal-section h2{font-size:17px;margin:0 0 8px}
    .cb-legal-section p{font-size:14px;line-height:1.8;color:#444;margin:0}
    .cb-legal-section a{color:#111;text-decoration:underline;text-underline-offset:3px}
    .cb-legal-foot{border-top:1px solid #eee;padding-top:16px;color:#777;font-size:12px}
  `}</style><article className="cb-legal-card">
    <header className="cb-legal-top"><span className="cb-legal-brand">CHATTER BOX</span><a className="cb-legal-back" href="/">← Back to Chatter Box</a></header>
    <div className="cb-legal-kicker">Policy document · Version 1.0</div><h1>Terms &amp; Conditions</h1>
    <div className="cb-legal-meta">Effective date: To be determined<br/>Last updated: To be determined<br/>Status: Initial draft for review</div>
    <div className="cb-legal-notice"><strong>Draft notice:</strong> Not legally reviewed. Complete operator/contact details and verify all technical and legal statements before publication.</div>
    {sections.map((s) => <section className="cb-legal-section" key={s.title}><h2>{s.title}</h2><p>{s.body}</p></section>)}
    <footer className="cb-legal-foot">Chatter Box · Terms &amp; Conditions v1.0 draft · Review required before publication.</footer>
  </article></main>;
}
