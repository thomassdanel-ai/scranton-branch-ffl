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
      // Fallback for non-https
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
    <div className="space-y-3">
      <div className="bg-bg-tertiary rounded-lg p-4 text-sm text-text-secondary whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
        {emailBody}
      </div>
      <button
        onClick={handleCopy}
        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
          copied
            ? 'bg-green-500/20 text-green-300'
            : 'bg-primary/20 text-primary hover:bg-primary/30'
        }`}
      >
        {copied ? 'Copied!' : 'Copy Email to Clipboard'}
      </button>
    </div>
  );
}
