'use client';

import { useState } from 'react';

type Props = {
  cohortName: string;
  seasonYear: string;
  inviteUrl: string;
  deadline?: string | null;
};

export default function InviteEmailGenerator({ cohortName, seasonYear, inviteUrl, deadline }: Props) {
  const [copied, setCopied] = useState(false);

  const emailBody = `Hey!

You're invited to join the Scranton Branch Fantasy Football League for the ${seasonYear} season.

Cohort: ${cohortName}
${deadline ? `Registration Deadline: ${deadline}\n` : ''}
To register, click the link below and enter your name and email:

${inviteUrl}

Once you register, the commissioner will confirm your spot and assign you to a league. You'll get more details about the draft once everything is set.

See you on the field!
- Scranton Branch FFL Commissioner`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(emailBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = emailBody;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="col col--sm">
      <div
        style={{
          padding: 14,
          background: 'var(--ink-0)',
          border: 'var(--hairline)',
          borderRadius: 'var(--r-2)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          lineHeight: 1.5,
          color: 'var(--ink-7)',
          whiteSpace: 'pre-wrap',
          maxHeight: 260,
          overflowY: 'auto',
        }}
      >
        {emailBody}
      </div>
      <button
        onClick={handleCopy}
        className={`btn btn--sm ${copied ? 'chip--success' : 'btn--primary'}`}
        style={{ alignSelf: 'flex-start' }}
      >
        {copied ? 'Copied!' : 'Copy Email to Clipboard'}
      </button>
    </div>
  );
}
