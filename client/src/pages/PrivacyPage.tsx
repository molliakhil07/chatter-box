import type { ReactNode } from "react";

const sections: Array<{ title: string; body: ReactNode }> = [
  { title: "1. Introduction", body: <>This policy explains how Chatter Box (“we,” “us,” or “Service”) handles information when you create an account or use the app. It is an initial draft; practices marked for verification must be confirmed before publication.</> },
  { title: "2. Account and Profile Information", body: <>Information may include email, username, display name, password hash, gender if provided, account timestamps, email-verification status and related records, avatar, and biography. Confirm the deployed schema and endpoints to establish exactly what is collected.</> },
  { title: "3. Messages and Conversations", body: <>The Service processes messages and conversation information to provide messaging. This may include message content, sender/recipient identifiers, timestamps, conversation membership, and delivery/read status where implemented. Verify actual fields and retention.</> },
  { title: "4. End-to-End Encryption", body: <>The project design states end-to-end encryption is implemented. <strong>Technical verification is required before publication:</strong> confirm encryption/decryption on user devices, key management, whether the server can access content, and coverage of attachments, notification previews, backups, and metadata. Do not assume every item of information is end-to-end encrypted.</> },
  { title: "5. Sessions and Technical Information", body: <>The Service may process session identifiers, expiry/revocation records, and technical information needed to deliver requests, protect accounts, and troubleshoot. Verify which logs and identifiers are collected, who can access them, and their retention periods.</> },
  { title: "6. How Information Is Used", body: <>Information may be used to create accounts, authenticate users, send verification/account emails, deliver messages, display conversations and profiles, provide implemented message-status features, protect and troubleshoot the Service, respond to requests, and meet legal obligations.</> },
  { title: "7. Analytics and Advertising", body: <>The stated intention is that Chatter Box does not intentionally use analytics or advertising trackers. <strong>Verification required:</strong> audit dependencies, hosting integrations, embedded services, third-party scripts, and production configuration. Infrastructure providers may independently process technical information.</> },
  { title: "8. Sharing Information", body: <>Information may be processed by hosting, database, email, and other providers needed to operate the Service; delivered to intended recipients; or disclosed as reasonably necessary for security, misuse investigations, valid legal obligations, or permitted business transfers. Identify actual providers, data access, and international transfers before publication.</> },
  { title: "9. Retention", body: <>Information should be retained only as reasonably necessary for stated purposes and applicable requirements. <strong>Not finalized:</strong> document retention and cleanup for accounts, messages, sessions, verification tokens, logs, and backups. Do not promise immediate deletion from all systems until verified.</> },
  { title: "10. Account Deletion", body: <>Where available, users may request deletion through account controls. Explain which data is deleted, what happens to messages already delivered to other users, what records may remain for legitimate or legal reasons, and how backups expire.</> },
  { title: "11. Security", body: <>The Service is intended to use safeguards supported by the deployed implementation, potentially including password hashing, authenticated sessions, access controls, and secure connections. No system can be guaranteed completely secure. Describe only controls that have been implemented and verified.</> },
  { title: "12. Privacy Rights", body: <>Depending on location and applicable law, users may have rights to access, correct, or delete personal data, obtain information about processing, object to certain processing, or complain to an authority. Legal review must identify applicable laws, procedures, deadlines, and authorities.</> },
  { title: "13. Children's Privacy", body: <>Chatter Box is intended for people aged <strong>18 or older</strong>. People under 18 must not create or use an account. Any response to an underage account must be consistent with applicable law.</> },
  { title: "14. International Processing", body: <>Hosting, database, email, and other providers may process information in other countries. Confirm provider locations, transfer mechanisms, and required disclosures before describing actual processing.</> },
  { title: "15. Policy Changes", body: <>The published policy should identify its version and effective date. We will notify users of material changes and obtain additional consent where required by law.</> },
  { title: "16. Contact and Complaints", body: <><strong>Operator/legal entity:</strong> To be confirmed<br/><strong>Privacy contact email:</strong> To be configured and verified<br/><strong>Grievance/supervisory contact:</strong> To be determined after legal review.</> },
];

export default function PrivacyPage() {
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
    <div className="cb-legal-kicker">Policy document · Version 1.0</div><h1>Privacy Policy</h1>
    <div className="cb-legal-meta">Effective date: To be determined<br/>Last updated: To be determined<br/>Status: Initial draft for review</div>
    <div className="cb-legal-notice"><strong>Draft notice:</strong> Not legally reviewed. Verify encryption, data practices, retention, providers, and contact details before publication.</div>
    {sections.map((s) => <section className="cb-legal-section" key={s.title}><h2>{s.title}</h2><p>{s.body}</p></section>)}
    <footer className="cb-legal-foot">Chatter Box · Privacy Policy v1.0 draft · Review required before publication.</footer>
  </article></main>;
}
