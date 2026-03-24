import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <p className="text-6xl mb-4">😬</p>
      <h1 className="text-3xl font-extrabold text-white mb-2">404</h1>
      <p className="text-xl font-semibold text-accent-gold mb-2">
        That&apos;s what she said.
      </p>
      <p className="text-text-secondary mb-6">
        This page doesn&apos;t exist. I declare bankruptcy!
      </p>
      <Link
        href="/"
        className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors"
      >
        Back to HQ
      </Link>
    </div>
  );
}
