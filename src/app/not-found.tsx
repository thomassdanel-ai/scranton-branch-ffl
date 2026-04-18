import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="nf-page">
      <div className="nf-page__code">404</div>
      <p className="nf-page__tws">That&apos;s what she said.</p>
      <p className="nf-page__desc">
        This page doesn&apos;t exist. I declare bankruptcy.
      </p>
      <Link href="/" className="btn btn--primary btn--sm">
        Back to HQ →
      </Link>
    </div>
  );
}
